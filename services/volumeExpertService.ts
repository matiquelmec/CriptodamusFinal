import { VolumeExpertAnalysis, DerivativesData, CVDData } from '../types-advanced.ts';

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

const fetchWithTimeout = async (url: string, timeout = 4000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
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
    const fSymbol = symbol.replace('/', '').toUpperCase();
    const cacheKey = `derivatives-${fSymbol}`;

    const cached = getCached<DerivativesData>(cacheKey);
    if (cached) return cached;

    // Helper to safely fetch with a default fallback
    const safeFetch = async (url: string, defaultVal: any = null) => {
        try {
            const res = await fetchWithTimeout(url, 3000);
            if (res.status === 400 || res.status === 451 || !res.ok) return null; // Silent fail for Bad Request (Invalid Symbol) or Geoblock
            return await res.json();
        } catch (e) {
            return null; // Silent fail (Network/CORS)
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
                buySellRatio: 1
            };
        }

        // Ratio blocked by CORS, defaulting to Neutral (1.0)
        let buySellRatio = 1.0;
        // if (ratioRes && Array.isArray(ratioRes) && ratioRes.length > 0) {
        //     buySellRatio = parseFloat(ratioRes[0].longShortRatio);
        // }

        const openInterest = parseFloat(oiData.openInterest); // En monedas
        const fundingRate = parseFloat(fundingData.lastFundingRate);
        const price = parseFloat(fundingData.markPrice); // Use Mark Price specifically

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

/**
 * 2. COINBASE PREMIUM (Institutional Flow)
 * Source: Compare Binance USDT Spot vs Coinbase USD Spot
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
        if (gapPercent > 0.05) signal = 'INSTITUTIONAL_BUY'; // Significant Premium (>0.05%)
        else if (gapPercent < -0.05) signal = 'INSTITUTIONAL_SELL'; // Significant Discount

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
        // Fetch last 500 trades (approx last few minutes depending on volume)
        const res = await fetchWithTimeout(`${BINANCE_SPOT_API}/aggTrades?symbol=${fSymbol}&limit=500`);
        if (!res.ok) throw new Error('Binance Trades API Error');

        const trades = await res.json();

        let cvdDelta = 0;
        let buyVol = 0;
        let sellVol = 0;

        // aggTrade structure: { m: true } -> Maker was Buyer (so Taker was SELLER) -> Sell Aggressor
        // { m: false } -> Maker was Seller (so Taker was BUYER) -> Buy Aggressor

        trades.forEach((t: any) => {
            const qty = parseFloat(t.q);
            const isBuyerMaker = t.m;

            if (isBuyerMaker) {
                // Seller Aggressed (Sold into Buy wall)
                cvdDelta -= qty;
                sellVol += qty;
            } else {
                // Buyer Aggressed (Bought from Sell wall)
                cvdDelta += qty;
                buyVol += qty;
            }
        });

        // Determine trend
        let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
        if (buyVol > sellVol * 1.5) trend = 'BULLISH';
        else if (sellVol > buyVol * 1.5) trend = 'BEARISH';

        // NOTE: Divergence requires price context which we perform at the service level, 
        // here we just return the raw CVD data.

        return {
            current: cvdDelta,
            trend,
            divergence: 'NONE', // Calculated in CryptoService with price context
            candleDelta: cvdDelta // Approx for this snapshot
        };

    } catch (error) {
        return {
            current: 0,
            trend: 'NEUTRAL',
            divergence: 'NONE',
            candleDelta: 0
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
    const liquidityScore = Math.min(100, Math.max(0, 50 + (derivatives.openInterestValue > 10000000 ? 30 : 0)));

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
