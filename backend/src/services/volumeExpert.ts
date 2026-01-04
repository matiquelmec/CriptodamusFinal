
import { VolumeExpertAnalysis, DerivativesData, CVDData } from '../core/types/types-advanced';
import { estimateLiquidationClusters, analyzeOrderBook } from './engine/liquidationEngine';

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
// HELPER FUNCTIONS
// ============================================================================

const fetchWithTimeout = async (url: string, timeout = 4000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal } as RequestInit);
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

const getCached = <T>(key: string): T | null => {
    const entry = cache[key];
    if (entry && (Date.now() - entry.timestamp < CACHE_DURATION)) {
        return entry.data;
    }
    return null;
};

const setCache = <T>(key: string, data: T) => {
    cache[key] = { data, timestamp: Date.now() };
    timestamp: Date.now()
};

// Minimal Fetch for internal needs if not using full BinanceApi service
async function fetchCandles(symbol: string, interval: string): Promise<any[]> {
    // Basic implementation for Backend
    try {
        const res = await fetchWithTimeout(`${BINANCE_SPOT_API}/klines?symbol=${symbol}&interval=${interval}&limit=100`, 5000);
        if (!res.ok) return [];
        const data = await res.json();
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
        const res = await fetchWithTimeout(`${BINANCE_SPOT_API}/depth?symbol=${symbol}&limit=${limit}`, 5000);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

// ============================================================================
// CORE ANALYSIS FUNCTIONS
// ============================================================================

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

    // Helper to safely fetch with a default fallback
    const safeFetch = async (url: string) => {
        try {
            const res = await fetchWithTimeout(url, 3000);
            if (res.status === 400 || res.status === 451 || !res.ok) return null;
            return await res.json();
        } catch (e) {
            return null;
        }
    };

    try {
        // Parallel Fetch: Open Interest + Funding Rate (Premium Index)
        const [oiData, fundingData] = await Promise.all([
            safeFetch(`${BINANCE_FUTURES_API}/openInterest?symbol=${fSymbol}`),
            safeFetch(`${BINANCE_FUTURES_API}/premiumIndex?symbol=${fSymbol}`)
        ]);

        if (!oiData || !fundingData) {
            return {
                openInterest: 0,
                openInterestValue: 0,
                fundingRate: 0,
                fundingRateDaily: 0,
                buySellRatio: 1
            };
        }

        const openInterest = parseFloat(oiData.openInterest); // En monedas
        const fundingRate = parseFloat(fundingData.lastFundingRate);
        const price = parseFloat(fundingData.markPrice); // Use Mark Price specifically

        const fundingRateDaily = fundingRate * 3;

        const result: DerivativesData = {
            openInterest,
            openInterestValue: openInterest * price,
            fundingRate,
            fundingRateDaily,
            buySellRatio: 1.0 // Ratio endpoint often blocked or requires stricter auth/headers, keeping simple
        };

        setCache(cacheKey, result);
        return result;

    } catch (error) {
        return {
            openInterest: 0,
            openInterestValue: 0,
            fundingRate: 0,
            fundingRateDaily: 0,
            buySellRatio: 1
        };
    }
}

/**
 * Helper to fetch Coinbase Candles (Public)
 */
async function fetchCoinbaseCandles(productIds: string, granularity: number = 3600): Promise<any[]> {
    try {
        const res = await fetchWithTimeout(`${COINBASE_EXCHANGE_API}/products/${productIds}/candles?granularity=${granularity}`, 4000);
        if (!res.ok) return [];
        return await res.json();
    } catch (e) { return []; }
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
        const [bnRes, cbRes] = await Promise.all([
            fetchWithTimeout(`${BINANCE_SPOT_API}/ticker/price?symbol=${bnSymbol}`),
            fetchWithTimeout(`${COINBASE_API}/prices/${cbSymbol}/spot`)
        ]);

        if (!bnRes.ok || !cbRes.ok) throw new Error('Price API Error');

        const bnData = await bnRes.json();
        const cbData = await cbRes.json();

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
        const res = await fetchWithTimeout(`${BINANCE_SPOT_API}/aggTrades?symbol=${fSymbol}&limit=500`);
        if (!res.ok) throw new Error('Binance Trades API Error');

        const trades = await res.json();

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
    const liquidityScore = Math.min(100, Math.max(0, 50 + (derivatives.openInterestValue > 10000000 ? 30 : 0)));

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
        enriched.liquidity.orderBook = analyzeOrderBook(orderBook.bids, orderBook.asks, currentPrice);

        // Adjust Market Depth Score based on Wall presence
        if (enriched.liquidity.orderBook.bidWall && enriched.liquidity.orderBook.bidWall.strength > 50) {
            enriched.liquidity.marketDepthScore = Math.min(100, enriched.liquidity.marketDepthScore + 10);
        }
    }

    return enriched;
}
