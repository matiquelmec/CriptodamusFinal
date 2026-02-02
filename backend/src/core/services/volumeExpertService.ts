import { VolumeExpertAnalysis, DerivativesData, CVDData } from '../types/types-advanced';
import { fetchCandles, fetchOrderBook } from './api/binanceApi';
import { estimateLiquidationClusters, analyzeOrderBook } from './engine/liquidationEngine';
import { SmartFetch } from './SmartFetch';
import { CEXConnector } from './api/CEXConnector';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// CONSTANTS & ENDPOINTS
// ============================================================================

const BINANCE_FUTURES_API = 'https://fapi.binance.com/fapi/v1';
const BINANCE_SPOT_API = 'https://data-api.binance.vision/api/v3'; // Uses Vision (CORS Friendly)
const COINBASE_API = 'https://api.coinbase.com/v2';

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

// Supabase Init for Wall Historian
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

// ============================================================================
// CORE ANALYSIS FUNCTIONS
// ============================================================================

/**
 * 1. DERIVATIVES DATA (Open Interest & Funding)
 * Source: Binance Futures API (Public)
 */
export async function getDerivativesData(symbol: string): Promise<DerivativesData> {
    // Normalize symbol for Futures (BTCUSDT mostly)
    // HANDLE SPECIAL 1000-PREFIX COINS (PEPE, BONK, FLOKI, etc.)
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

    // Helper to safely fetch with SmartFetch (handles geoblocking)
    const safeFetch = async (url: string) => {
        try {
            return await SmartFetch.get(url, { timeout: 3000 });
        } catch (e) {
            return null; // Silent fail
        }
    };

    try {
        // Parallel Fetch: Open Interest + Funding Rate (Premium Index)
        const [oiData, fundingData] = await Promise.all([
            safeFetch(`${BINANCE_FUTURES_API}/openInterest?symbol=${fSymbol}`),
            safeFetch(`${BINANCE_FUTURES_API}/premiumIndex?symbol=${fSymbol}`) // Removed blocked globalLongShort to prevent CORS error
        ]);

        // If primary data failed (likely geoblocked), return defaults immediately
        if (!oiData || !fundingData) {
            return {
                openInterest: 0,
                openInterestValue: 0,
                fundingRate: 0,
                fundingRateDaily: 0,
                buySellRatio: null
            };
        }

        // Ratio blocked by CORS, defaulting to Neutral (1.0)
        let buySellRatio = 1.0;
        // if (ratioRes && Array.isArray(ratioRes) && ratioRes.length > 0) {
        //     buySellRatio = parseFloat(ratioRes[0].longShortRatio);
        // }

        const openInterest = parseFloat((oiData as any).openInterest); // En monedas
        const fundingRate = parseFloat((fundingData as any).lastFundingRate);
        const price = parseFloat((fundingData as any).markPrice); // Use Mark Price specifically

        const fundingRateDaily = fundingRate * 3;

        const result: DerivativesData = {
            openInterest,
            openInterestValue: openInterest * price,
            fundingRate,
            fundingRateDaily,
            buySellRatio
        };

        setCache(cacheKey, result);
        return result;

    } catch (error) {
        // Catch-all (Logic errors)
        return {
            openInterest: 0,
            openInterestValue: 0,
            fundingRate: 0,
            fundingRateDaily: 0,
            buySellRatio: 1
        };
    }
}



const COINBASE_EXCHANGE_API = 'https://api.exchange.coinbase.com';

/**
 * Helper to fetch Coinbase Candles (Public)
 * Note: Browser checks requiring CORS might fail here if Coinbase blocks them.
 * Fallback is handled by the caller.
 */
async function fetchCoinbaseCandles(productIds: string, granularity: number = 3600): Promise<any[]> {
    try {
        return await SmartFetch.get<any[]>(`${COINBASE_EXCHANGE_API}/products/${productIds}/candles?granularity=${granularity}`, { timeout: 4000 });
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
        // FAST PATH: Snapshot (Current Price)
        // SLOW PATH: SMA (History) - Only for BTC/ETH to save calls
        const useSMA = ['BTC', 'ETH'].includes(base);

        if (useSMA) {
            // Fetch Last 24h (24 candles)
            const [bnCandles, cbCandles] = await Promise.all([
                fetchCandles(bnSymbol, '1h'),
                fetchCoinbaseCandles(cbSymbol, 3600)
            ]);

            if (bnCandles.length < 24 || cbCandles.length < 24) {
                throw new Error("Insufficient history for SMA");
            }

            // Calculate Gap % for last 20 hours
            let gapSum = 0;
            let count = 0;
            const lookback = 20;

            for (let i = 0; i < lookback; i++) {
                // Coinbase candles: [time, low, high, open, close, vol] using UNIX seconds
                // Binance candles: { timestamp (ms), close ... }
                // Align roughly by index (both are 1h, recent first or last?)
                // checkCoinbase returns [newest, ..., oldest]
                // fetchCandles returns [oldest, ..., newest] usually? Check fetchCandles implementation.
                // fetchCandles maps binance klines. limit=1000. 
                // We need to match timestamps.

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
            SmartFetch.get<any>(`${BINANCE_SPOT_API}/ticker/price?symbol=${bnSymbol}`, { timeout: 4000 }),
            SmartFetch.get<any>(`${COINBASE_API}/prices/${cbSymbol}/spot`, { timeout: 4000 })
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
        // console.warn(`[VolumeExpert] Error calculating premium for ${symbol}`);
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
        // Professional Pivot: Try CEXConnector first (Premium Data)
        const realCVD = await CEXConnector.getRealCVD(symbol);
        if (realCVD.integrity >= 1.0) {
            // Return premium data but preserve bubble/absorption analysis structure
            return {
                current: realCVD.delta,
                trend: realCVD.delta > 0.05 ? 'BULLISH' : realCVD.delta < -0.05 ? 'BEARISH' : 'NEUTRAL',
                divergence: null,
                candleDelta: realCVD.delta,
                cvdSeries: [],
                priceSeries: [],
                bubbles: [], // CEX data doesn't provide granular bubbles yet
                absorption: null
            };
        }

        // Fallback: Public aggTrades (Integrity 0.5)
        const trades = await SmartFetch.get<any[]>(`${BINANCE_SPOT_API}/aggTrades?symbol=${fSymbol}&limit=500`, { timeout: 5000 });

        let cvdDelta = 0;
        let buyVol = 0;
        let sellVol = 0;

        // --- NEW: History Series Generation (Buckets for Divergence) ---
        // We have 500 trades. Let's create 10 data points (buckets of 50 trades)
        // This simulates a "timeframe" for the Micro-structure divergence.
        const bucketSize = 50;
        const cvdSeries: number[] = [];
        const priceSeries: number[] = [];

        let currentBucketCVD = 0;
        let currentBucketPriceSum = 0;
        let currentBucketCount = 0;

        // Trades come newest first or oldest first? Binance usually returns Oldest First if no specific sorting?
        // Actually aggTrades by default is from startTime? or limit from latest?
        // If we just use default, it's usually latest X trades.
        // Important: Binance API usually returns Oldest to Newest in the array if startTime is used, 
        // but with just limit, it's usually the latest X trades, but check order.
        // Standard Binance array is [Oldest, ..., Newest].

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
            currentBucketCVD += tradeDelta; // We want Cumulative? Or Delta per bucket? 
            // For Divergence: Price vs Oscillator. oscillator is "CVD" (Cumulative Volume Delta) or checks "Delta" peaks?
            // Usually CVD Divergence compares PRICE HIGH vs CVD HIGH. CVD is cumulative.
            // So we should push the running total `cvdDelta` at the end of the bucket.
            currentBucketPriceSum += price;
            currentBucketCount++;

            if (currentBucketCount >= bucketSize || index === trades.length - 1) {
                cvdSeries.push(cvdDelta); // Push the RUNNING TOTAL (Cumulative)
                priceSeries.push(currentBucketPriceSum / currentBucketCount); // Avg Price of bucket

                // Reset bucket accumulators (but NOT the running cvdDelta)
                currentBucketPriceSum = 0;
                currentBucketCount = 0;
            }
        });

        // --- NEW: Bubble & Absorption Detection ---
        const BUBBLE_THRESHOLD_USD = 50000; // $50k cluster in a bucket
        const bubbles: { price: number; type: 'BULLISH' | 'BEARISH'; size: number }[] = [];
        let absorptionDetected: 'BULLISH' | 'BEARISH' | null = null;

        // Analyze buckets for Bubbles
        cvdSeries.forEach((cumCvd, i) => {
            const currentPrice = priceSeries[i];
            const bucketDelta = i === 0 ? cumCvd : cumCvd - cvdSeries[i - 1];
            const bucketVolumeUSD = Math.abs(bucketDelta) * currentPrice;

            if (bucketVolumeUSD > BUBBLE_THRESHOLD_USD) {
                bubbles.push({
                    price: currentPrice,
                    type: bucketDelta > 0 ? 'BULLISH' : 'BEARISH',
                    size: bucketVolumeUSD
                });
            }
        });

        // Absorption logic: High CVD delta vs Low Price Delta
        if (priceSeries.length > 2) {
            const totalCvdDelta = Math.abs(cvdDelta);
            const startPrice = priceSeries[0];
            const endPrice = priceSeries[priceSeries.length - 1];
            const priceMovePct = Math.abs((endPrice - startPrice) / startPrice) * 100;

            // Definition: CVD is large but price barely moved (< 0.05%)
            if (totalCvdDelta > (buyVol + sellVol) * 0.4 && priceMovePct < 0.05) {
                absorptionDetected = cvdDelta > 0 ? 'BEARISH' : 'BULLISH'; // CVD buy but no move = passive sellers
            }
        }

        // Determine trend
        let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
        if (buyVol > sellVol * 1.5) trend = 'BULLISH';
        else if (sellVol > buyVol * 1.5) trend = 'BEARISH';

        return {
            current: cvdDelta,
            trend,
            divergence: null, // Calculated in CryptoService with price context
            candleDelta: cvdDelta,
            cvdSeries,
            priceSeries,
            bubbles,
            absorption: absorptionDetected
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

    // Simple liquidity proxy (Funding stability + CVD volume)
    // Real depth requires OrderBook endpoint (heavy), simplifying for now.
    const liquidityScore = Math.min(100, Math.max(0, 50 + ((derivatives.openInterestValue || 0) > 10000000 ? 30 : 0)));

    return {
        derivatives,
        cvd,
        coinbasePremium: premium,
        liquidity: {
            bidAskSpread: 0, // Not fetching depth for speed
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
    // Map Symbol correctly (USDT only for now)
    const normalizedSymbol = symbol.replace('/', '').toUpperCase();
    const orderBook = await fetchOrderBook(normalizedSymbol);

    if (orderBook) {
        enriched.liquidity.orderBook = analyzeOrderBook(orderBook.bids, orderBook.asks, currentPrice);

        // Adjust Market Depth Score based on Wall presence
        if (enriched.liquidity.orderBook.bidWall && enriched.liquidity.orderBook.bidWall.strength > 50) {
            enriched.liquidity.marketDepthScore = Math.min(100, enriched.liquidity.marketDepthScore + 10);
        }

        // NEW: Save historical snapshot (Wall Historian)
        saveSnapshot(normalizedSymbol, enriched.liquidity.orderBook);
    }

    return enriched;
}
