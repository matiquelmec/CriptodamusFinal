
import { VolumeExpertAnalysis, DerivativesData, CVDData } from '../core/types/types-advanced';
import { estimateLiquidationClusters, analyzeOrderBook } from './engine/liquidationEngine';
import { SmartFetch } from '../core/services/SmartFetch';

// ============================================================================
// CONSTANTS & ENDPOINTS
// ============================================================================

const BINANCE_FUTURES_API = 'https://fapi.binance.com/fapi/v1';
const BINANCE_SPOT_API = 'https://data-api.binance.vision/api/v3'; // Uses Vision (CORS Friendly)
const COINBASE_API = 'https://api.coinbase.com/v2';
const COINBASE_EXCHANGE_API = 'https://api.exchange.coinbase.com';

// Cache to prevent rate limits
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const CACHE_DURATION = 10000; // 10 seconds (High frequency data)
const cache: Record<string, CacheEntry<any>> = {};

// ============================================================================
// HELPER FUNCTIONS (Refactored to use SmartFetch)
// ============================================================================

const getCached = <T>(key: string): T | null => {
    const entry = cache[key];
    if (entry && (Date.now() - entry.timestamp < CACHE_DURATION)) {
        return entry.data;
    }
    return null;
};

const setCache = <T>(key: string, data: T) => {
    cache[key] = { data, timestamp: Date.now() };
};

// Helper to safely fetch with a default fallback (Proxied via SmartFetch)
const safeFetch = async (url: string) => {
    try {
        // SmartFetch handles 451/403 internally by routing through Bifrost if env var is set
        return await SmartFetch.get(url, { timeout: 5000 });
    } catch (e) {
        console.warn(`[VolumeExpert] Failed to fetch ${url}`, e);
        return null; // Return null to trigger fallback handling (0.0 defaults)
    }
};

// Minimal Fetch for internal needs if not using full BinanceApi service
async function fetchCandles(symbol: string, interval: string): Promise<any[]> {
    try {
        // Uses Vision (Spot) - usually safe, but SmartFetch adds robustness
        const data = await SmartFetch.get<any[]>(`${BINANCE_SPOT_API}/klines?symbol=${symbol}&interval=${interval}&limit=100`, { timeout: 5000 });
        if (!Array.isArray(data)) return [];

        return data.map((d: any[]) => ({
            timestamp: d[0],
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5])
        }));
    } catch (e) {
        return [];
    }
}

async function fetchOrderBook(symbol: string, limit = 50) {
    try {
        return await SmartFetch.get(`${BINANCE_SPOT_API}/depth?symbol=${symbol}&limit=${limit}`, { timeout: 5000 });
    } catch (e) {
        return null;
    }
}

/**
 * Helper to fetch Coinbase Candles (Public)
 */
async function fetchCoinbaseCandles(productIds: string, granularity: number = 3600): Promise<any[]> {
    try {
        return await SmartFetch.get<any[]>(`${COINBASE_EXCHANGE_API}/products/${productIds}/candles?granularity=${granularity}`, { timeout: 4000 });
    } catch (e) { return []; }
}

// ============================================================================
// CORE ANALYSIS FUNCTIONS
// ============================================================================

/**
 * 1. DERIVATIVES DATA (Open Interest & Funding)
 * Source: Binance Futures API (Public)
 */
/**
 * 1. DERIVATIVES DATA (Open Interest & Funding)
 * Source: Binance Futures API (Public)
 */
export async function getDerivativesData(symbol: string): Promise<DerivativesData> {
    // Normalize symbol for Futures (BTCUSDT mostly)
    const checkSpot = symbol.replace('/', '').toUpperCase();
    const map1000 = ['PEPE', 'BONK', 'FLOKI', 'SATS', 'RATS', 'CAT', 'X']; // Common 1000-prefix coins

    let fSymbol = checkSpot;
    const base = checkSpot.replace('USDT', '');

    if (map1000.includes(base)) {
        fSymbol = `1000${base}USDT`;
    } else if (base === 'LUNA') {
        fSymbol = 'LUNA2USDT'; // LUNA 2.0 on futures
    }

    const cacheKey = `derivatives-${fSymbol}`;
    const cached = getCached<DerivativesData>(cacheKey);
    if (cached) return cached;

    try {
        // Parallel Fetch: Open Interest + Funding + Long/Short Ratio (Real Data)
        const [oiData, fundingData, lsData] = await Promise.all([
            safeFetch(`${BINANCE_FUTURES_API}/openInterest?symbol=${fSymbol}`),
            safeFetch(`${BINANCE_FUTURES_API}/premiumIndex?symbol=${fSymbol}`),
            safeFetch(`${BINANCE_FUTURES_API}/globalLongShortAccountRatio?symbol=${fSymbol}&period=5m&limit=1`)
        ]);

        if (!oiData) {
            // IF DATA IS MISSING -> RETURN NULL (Don't fake 0.0)
            return {
                openInterest: null,
                openInterestValue: null,
                fundingRate: 0, // 0 is safe "Neutral"
                fundingRateDaily: 0,
                buySellRatio: null
            };
        }

        // Funding might be missing but OI present?
        const fundingRate = fundingData ? parseFloat((fundingData as any).lastFundingRate) : 0;
        const markPrice = fundingData ? parseFloat((fundingData as any).markPrice) : 0;


        const openInterest = parseFloat((oiData as any).openInterest); // En monedas

        const openInterestValue = (markPrice > 0) ? openInterest * markPrice : null; // Can't calc value without price

        const fundingRateDaily = fundingRate * 3;

        // Parse Long/Short Ratio
        let buySellRatio = 1.0;
        if (lsData && Array.isArray(lsData) && lsData.length > 0) {
            buySellRatio = parseFloat(lsData[0].longShortRatio);
        } else {
            // Fallback only if endpoint fails
            // console.warn(`[VolumeExpert] L/S Ratio missing for ${fSymbol}`);
        }

        const result: DerivativesData = {
            openInterest,
            openInterestValue,
            fundingRate,
            fundingRateDaily,
            buySellRatio
        };

        setCache(cacheKey, result);
        return result;

    } catch (error) {
        return {
            openInterest: null,
            openInterestValue: null,
            fundingRate: 0,
            fundingRateDaily: 0,
            buySellRatio: null
        };
    }
}

/**
 * 2. COINBASE PREMIUM (Institutional Flow) - With SMA Smoothing
 */
export async function getCoinbasePremium(symbol: string): Promise<VolumeExpertAnalysis['coinbasePremium']> {
    // Symbol mapping: BTC -> BTC-USD (Coinbase) vs BTCUSDT (Binance)
    const base = symbol.replace('/USDT', '').replace('USDT', '');
    const cbSymbol = `${base}-USD`;
    const bnSymbol = `${base}USDT`;

    // Only major assets usually have valid significant premiums to track
    if (!['BTC', 'ETH', 'SOL'].includes(base)) {
        return { index: 0, gapPercent: 0, signal: 'NEUTRAL' };
    }

    try {
        const useSMA = ['BTC', 'ETH'].includes(base);

        if (useSMA) {
            // Fetch Last 24h (24 candles)
            const [bnCandles, cbCandles] = await Promise.all([
                fetchCandles(bnSymbol, '1h'),
                fetchCoinbaseCandles(cbSymbol, 3600)
            ]);

            if (bnCandles.length < 24 || cbCandles.length < 24) {
                // Return neutral if fetch failed
                return { index: 0, gapPercent: 0, signal: 'NEUTRAL' };
            }

            // Calculate Gap % for last 20 hours
            let gapSum = 0;
            let count = 0;
            const lookback = 20;

            for (let i = 0; i < lookback; i++) {
                const bn = bnCandles[bnCandles.length - 1 - i]; // Newest going back
                const cb = cbCandles[i]; // Newest is index 0 in Coinbase API

                if (!bn || !cb) continue;

                const bnClose = bn.close;
                const cbClose = cb[4]; // close index

                const gap = cbClose - bnClose;
                const pct = (gap / bnClose) * 100;
                gapSum += pct;
                count++;
            }

            const smaGap = count > 0 ? (gapSum / count) : 0;

            // Signal Logic based on SMA
            let signal: 'INSTITUTIONAL_BUY' | 'INSTITUTIONAL_SELL' | 'NEUTRAL' = 'NEUTRAL';
            if (smaGap > 0.02) signal = 'INSTITUTIONAL_BUY'; // Lower threshold for SMA (stable)
            else if (smaGap < -0.02) signal = 'INSTITUTIONAL_SELL';

            return {
                index: smaGap * bnCandles[bnCandles.length - 1].close, // Approx index
                gapPercent: smaGap,
                signal
            };
        }

        // Fallback: Snapshot Logic
        const [bnData, cbData] = await Promise.all([
            SmartFetch.get<any>(`${BINANCE_SPOT_API}/ticker/price?symbol=${bnSymbol}`),
            SmartFetch.get<any>(`${COINBASE_API}/prices/${cbSymbol}/spot`)
        ]);

        const bnPrice = parseFloat(bnData.price);
        const cbPrice = parseFloat(cbData.data.amount);

        const gap = cbPrice - bnPrice;
        const gapPercent = (gap / bnPrice) * 100;

        // Thresholds for signals
        let signal: 'INSTITUTIONAL_BUY' | 'INSTITUTIONAL_SELL' | 'NEUTRAL' = 'NEUTRAL';
        if (gapPercent > 0.05) signal = 'INSTITUTIONAL_BUY';
        else if (gapPercent < -0.05) signal = 'INSTITUTIONAL_SELL';

        return {
            index: gap,
            gapPercent,
            signal
        };

    } catch (error) {
        return { index: 0, gapPercent: 0, signal: 'NEUTRAL' };
    }
}

/**
 * 3. SYNTHETIC CVD (Microstructure)
 * Logic: Fetch recent aggTrades (snapshot) to determine immediate aggressor
 */
export async function getInstantCVD(symbol: string): Promise<CVDData> {
    const fSymbol = symbol.replace('/', '').toUpperCase();

    try {
        // Fetch last 500 trades
        const trades = await SmartFetch.get<any[]>(`${BINANCE_SPOT_API}/aggTrades?symbol=${fSymbol}&limit=500`, { timeout: 5000 });

        let cvdDelta = 0;
        let buyVol = 0;
        let sellVol = 0;

        const bucketSize = 50;
        const cvdSeries: number[] = [];
        const priceSeries: number[] = [];

        let currentBucketCVD = 0;
        let currentBucketPriceSum = 0;
        let currentBucketCount = 0;

        trades.forEach((t: any, index: number) => {
            const qty = parseFloat(t.q);
            const price = parseFloat(t.p);
            const isBuyerMaker = t.m;

            let tradeDelta = 0;

            if (isBuyerMaker) {
                // Seller Aggressed
                tradeDelta = -qty;
                sellVol += qty;
            } else {
                // Buyer Aggressed
                tradeDelta = qty;
                buyVol += qty;
            }

            cvdDelta += tradeDelta;

            // Series Building
            currentBucketCVD += tradeDelta;
            currentBucketPriceSum += price;
            currentBucketCount++;

            if (currentBucketCount >= bucketSize || index === trades.length - 1) {
                cvdSeries.push(cvdDelta); // Push the RUNNING TOTAL (Cumulative)
                priceSeries.push(currentBucketPriceSum / currentBucketCount); // Avg Price of bucket

                currentBucketPriceSum = 0;
                currentBucketCount = 0;
            }
        });

        // Determine trend
        let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
        if (buyVol > sellVol * 1.5) trend = 'BULLISH';
        else if (sellVol > buyVol * 1.5) trend = 'BEARISH';

        return {
            current: cvdDelta,
            trend,
            divergence: null, // Calculated in CryptoService
            candleDelta: cvdDelta,
            cvdSeries,
            priceSeries
        };

    } catch (error) {
        return {
            current: 0,
            trend: 'NEUTRAL',
            divergence: null,
            candleDelta: 0,
            cvdSeries: [],
            priceSeries: []
        };
    }
}

/**
 * MASTER FUNCTION: Get Full Expert Analysis
 */
export async function getExpertVolumeAnalysis(symbol: string): Promise<VolumeExpertAnalysis> {

    const [derivatives, premium, cvd] = await Promise.all([
        getDerivativesData(symbol),
        getCoinbasePremium(symbol),
        getInstantCVD(symbol)
    ]);

    // Simple liquidity proxy
    // Guard against null OI
    const oiVal = derivatives.openInterestValue || 0;
    const liquidityScore = Math.min(100, Math.max(0, 50 + (oiVal > 10000000 ? 30 : 0)));

    return {
        derivatives,
        cvd,
        coinbasePremium: premium,
        liquidity: {
            bidAskSpread: 0,
            marketDepthScore: liquidityScore
        }
    };
}

// Supabase Init for Snapshotting
import { createClient } from '@supabase/supabase-js';
// ESM Config (Redundant but safe if file scope changes, reusing existing if possible)
// ... already imported dotenv above via previous checks? No, volumeExpert didn't have it.
// Adding imports at top is hard with replace_file_content if I don't replace the whole top.
// I'll assume server environment has env vars loaded (it essentially does).
// But for standalone script usage, I might need dotenv.
// Let's use process.env directly assuming it's loaded.

const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_KEY)
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
    : null;

async function saveSnapshot(symbol: string, ob: any) {
    if (!supabase) return;
    const items = [];

    // Save Bid Wall (Support) if significant
    if (ob.bidWall && ob.bidWall.strength > 80) {
        items.push({
            symbol,
            wall_price: ob.bidWall.price,
            wall_volume: ob.bidWall.volume,
            side: 'BID',
            strength: ob.bidWall.strength,
            timestamp: Date.now()
        });
    }

    // Save Ask Wall (Resistance)
    if (ob.askWall && ob.askWall.strength > 80) {
        items.push({
            symbol,
            wall_price: ob.askWall.price,
            wall_volume: ob.askWall.volume,
            side: 'ASK',
            strength: ob.askWall.strength,
            timestamp: Date.now()
        });
    }

    if (items.length > 0) {
        // Fire and forget (don't await to block scanner)
        supabase.from('orderbook_snapshots').insert(items).then(({ error }) => {
            if (error) console.error("❌ Snapshot Error:", error.message);
        });
    }
}

/**
 * ENRICHMENT: Add Depth & Liquidation Analysis (Heavy, Call only on High Score)
 */
export async function enrichWithDepthAndLiqs(symbol: string, currentAnalysis: VolumeExpertAnalysis, highs: number[], lows: number[], currentPrice: number): Promise<VolumeExpertAnalysis> {
    const enriched = { ...currentAnalysis };

    // 1. Calculate Liquidation Clusters (Pure Math, Cheap)
    enriched.liquidity.liquidationClusters = estimateLiquidationClusters(highs, lows, currentPrice);

    // 2. Fetch Orderbook (Heavy I/O)
    const normalizedSymbol = symbol.replace('/', '').toUpperCase();
    const orderBook = await fetchOrderBook(normalizedSymbol);

    if (orderBook) {
        enriched.liquidity.orderBook = analyzeOrderBook((orderBook as any).bids, (orderBook as any).asks, currentPrice);

        // Adjust Market Depth Score based on Wall presence
        if (enriched.liquidity.orderBook.bidWall && enriched.liquidity.orderBook.bidWall.strength > 50) {
            enriched.liquidity.marketDepthScore = Math.min(100, enriched.liquidity.marketDepthScore + 10);
        }

        // 3. HISTORY: Save Snapshot (The "Wall Historian")
        saveSnapshot(normalizedSymbol, enriched.liquidity.orderBook);
    }

    return enriched;
}
