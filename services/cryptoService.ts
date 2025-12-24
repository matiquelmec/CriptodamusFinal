import { MarketData, FearAndGreedData, AIOpportunity, TradingStyle, TechnicalIndicators, MarketRisk, FundamentalTier } from '../types';
import { hasActiveSession } from './geminiService';
import { analyzeIchimoku } from './strategies/IchimokuAdapter';
import { calculateIchimokuData } from './ichimokuStrategy'; // NEW: Direct calculation for Advisor
import { analyzeMemeSignal } from './strategies/MemeStrategy';
import { analyzeSwingSignal } from './strategies/SwingStrategy';
import { analyzeBreakoutSignal } from './strategies/BreakoutStrategy';
import { analyzeScalpSignal } from './strategies/ScalpStrategy';
import { analyzePinballSignal } from './strategies/PinballStrategy';
import { analyzeRSIExpert } from './rsiExpert'; // NEW // NEW
import { getMacroContext, formatMacroForAI, type MacroContext } from './macroService';
import {
    detectBullishDivergence, calculateIchimokuLines, calculateIchimokuCloud,
    calculateBollingerStats, calculateSMA, calculateEMA, calculateMACD,
    calculateEMAArray, calculateStdDev, calculateRSI, calculateStochRSI,
    calculateRSIArray, calculateCumulativeVWAP, calculateAutoFibs, calculateFractals, // NEW
    calculateATR, calculateADX, calculatePivotPoints, formatVolume,
    calculateZScore, calculateSlope // NEW
} from './mathUtils';
import { calculateVolumeProfile } from './volumeProfile';
import { detectOrderBlocks } from './orderBlocks';
import { detectHarmonicPatterns } from './harmonicPatterns'; // NEW
import { detectFVG } from './fairValueGaps';
import { calculatePOIs } from './confluenceEngine';
import { analyzeSessionContext, getCurrentSessionSimple } from './sessionExpert'; // NEW: Session Logic
import { detectMarketRegime } from './marketRegimeDetector';
import { detectGenericDivergence } from './divergenceDetector'; // NEW
import { selectStrategies } from './strategySelector';
import { calculateDCAPlan } from './dcaCalculator';
import { getExpertVolumeAnalysis } from './volumeExpertService'; // NEW: Expert Volume Service


// PRIMARY: Binance Vision (CORS friendly for public data)
const BINANCE_API_BASE = 'https://data-api.binance.vision/api/v3';
const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/stream?streams=';

// FALLBACK: CoinCap (Very reliable for frontend)
const COINCAP_API_BASE = 'https://api.coincap.io/v2';

// List of known major memes to filter for the "Meme" view
const MEME_SYMBOLS = [
    'DOGE', 'SHIB', 'PEPE', 'WIF', 'FLOKI', 'BONK', 'BOME', 'MEME', 'PEOPLE',
    'DOGS', 'TURBO', 'MYRO', 'NEIRO', '1000SATS', 'ORDI', 'BABYDOGE', 'MOODENG',
    'PNUT', 'ACT', 'POPCAT', 'SLERF', 'BRETT', 'GOAT', 'MOG', 'SPX', 'HIPPO', 'LADYS',
    'CHILLGUY', 'LUCE', 'PENGU'
];

// UTILITY: Fetch with Timeout to prevent blocking UI
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 8000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

export const fetchCryptoData = async (mode: 'volume' | 'memes' = 'volume'): Promise<MarketData[]> => {
    try {
        const data = await fetchBinanceMarkets(mode);
        if (data.length === 0) throw new Error("Empty Binance Data");
        return data;
    } catch (error) {
        console.warn("Binance API failed/blocked, switching to CoinCap fallback...", error);
        return await fetchCoinCapMarkets(mode);
    }
};

// --- BINANCE FETCH STRATEGY ---
const fetchBinanceMarkets = async (mode: 'volume' | 'memes'): Promise<MarketData[]> => {
    try {
        const response = await fetchWithTimeout(`${BINANCE_API_BASE}/ticker/24hr`);
        if (!response.ok) throw new Error(`Binance returned ${response.status}`);

        const data = await response.json();

        // Ignored symbols (Stablecoins, Leverage tokens, Non-tradable)
        const ignoredPatterns = [
            'USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'USDPUSDT', 'EURUSDT', 'DAIUSDT', 'BUSDUSDT',
            'UPUSDT', 'DOWNUSDT', 'BULLUSDT', 'BEARUSDT', 'USDT', 'PAXGUSDT',
            'USDEUSDT', 'USD1USDT', 'BFUSDUSDT', 'AEURUSDT' // Added problematic symbols causing 400
        ];

        let filteredData = data.filter((ticker: any) => {
            const symbol = ticker.symbol;
            return symbol.endsWith('USDT') &&
                !ignoredPatterns.includes(symbol) &&
                !symbol.includes('DOWN') &&
                !symbol.includes('UP');
        });

        if (mode === 'memes') {
            filteredData = filteredData.filter((ticker: any) => {
                const baseSymbol = ticker.symbol.replace('USDT', '');
                // Check specific list or 1000-prefix (e.g. 1000SATS, 1000PEPE sometimes used)
                return MEME_SYMBOLS.includes(baseSymbol) || MEME_SYMBOLS.includes(baseSymbol.replace('1000', ''));
            });
            // Sort memes by Volume too
            filteredData = filteredData.sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
        } else {
            // Default: Top 50 by Volume
            filteredData = filteredData
                .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
                .slice(0, 50);
        }

        return filteredData.map((ticker: any) => {
            const rawSymbol = ticker.symbol.replace('USDT', '');
            return {
                id: ticker.symbol, // Binance Symbol ID
                symbol: `${rawSymbol}/USDT`,
                price: parseFloat(ticker.lastPrice),
                change24h: parseFloat(ticker.priceChangePercent),
                rsi: 50, // Placeholder, calculated properly in detailed analysis
                volume: formatVolume(parseFloat(ticker.quoteVolume)),
                trend: parseFloat(ticker.priceChangePercent) > 0.5 ? 'bullish' : 'bearish'
            };
        });
    } catch (e) {
        throw e;
    }
};

// --- COINCAP FETCH STRATEGY (FALLBACK) ---
const fetchCoinCapMarkets = async (mode: 'volume' | 'memes'): Promise<MarketData[]> => {
    try {
        const response = await fetchWithTimeout(`${COINCAP_API_BASE}/assets?limit=100`);
        if (!response.ok) return [];

        const json = await response.json();
        let assets = json.data;

        if (mode === 'memes') {
            assets = assets.filter((asset: any) =>
                MEME_SYMBOLS.includes(asset.symbol.toUpperCase())
            );
        } else {
            assets = assets.slice(0, 50);
        }

        return assets.map((asset: any) => ({
            id: asset.id, // CoinCap ID (e.g. 'bitcoin') - Important for candles
            symbol: `${asset.symbol}/USDT`,
            price: parseFloat(asset.priceUsd),
            change24h: parseFloat(asset.changePercent24Hr),
            rsi: 50,
            volume: formatVolume(parseFloat(asset.volumeUsd24Hr)),
            trend: parseFloat(asset.changePercent24Hr) > 0.5 ? 'bullish' : 'bearish'
        }));
    } catch (e) {
        return [];
    }
};

// General subscription for the main scanner
export const subscribeToLivePrices = (marketData: MarketData[], callback: (data: Record<string, number>) => void) => {
    const sampleId = marketData[0]?.id || '';
    const isBinance = sampleId === sampleId.toUpperCase() && sampleId.includes('USDT');

    if (isBinance) {
        // "Safe Mode" WebSocket:
        // 1. Strict Filter: Only connect to Top liquid assets to prevent "Invalid Symbol" disconnects
        // 2. Stream Cap: Max 15 streams to prevent URL overflow
        const MAX_STREAMS = 15;
        const SAFE_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'LINKUSDT', 'TRXUSDT', 'MATICUSDT', 'LTCUSDT', 'UNIUSDT', 'ATOMUSDT', 'SUIUSDT', 'NEARUSDT', 'APTUSDT'];

        const validStreams = marketData
            .map(m => m.id)
            .filter(id => SAFE_SYMBOLS.includes(id))
            .slice(0, MAX_STREAMS)
            .map(id => id.toLowerCase() + '@miniTicker');

        // Use Binance Vision endpoint (more stable for browsers)
        const VISION_WS = 'wss://data-stream.binance.vision/stream?streams=';
        const url = `${VISION_WS}${validStreams.join('/')}`;
        const ws = new WebSocket(url);

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.data && msg.data.s && msg.data.c) {
                    const displaySymbol = msg.data.s.replace('USDT', '/USDT');
                    callback({ [displaySymbol]: parseFloat(msg.data.c) });
                }
            } catch (e) { }
        };
        return () => ws.close();
    } else {
        const ids = marketData.map(m => m.id).join(',');
        const ws = new WebSocket(`wss://ws.coincap.io/prices?assets=${ids}`);
        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                const update: Record<string, number> = {};
                Object.keys(msg).forEach(key => {
                    const item = marketData.find(m => m.id === key);
                    if (item) {
                        update[item.symbol] = parseFloat(msg[key]);
                    }
                });
                callback(update);
            } catch (e) { }
        };
        return () => ws.close();
    }
};

export const getFearAndGreedIndex = async (): Promise<FearAndGreedData | null> => {
    try {
        const response = await fetchWithTimeout('https://api.alternative.me/fng/', {}, 3000);
        if (!response.ok) return null;
        const json = await response.json();
        return json.data[0];
    } catch (e) {
        return null;
    }
};

// --- HELPER FUNCTIONS ---

const mapBinanceToCoinCap = (symbol: string) => {
    const map: Record<string, string> = { 'BTCUSDT': 'bitcoin', 'ETHUSDT': 'ethereum', 'SOLUSDT': 'solana', 'DOGEUSDT': 'dogecoin', 'BNBUSDT': 'binance-coin', 'XRPUSDT': 'xrp', 'ADAUSDT': 'cardano' };
    return map[symbol];
}

// NEW: FUNDAMENTAL TIER CALCULATOR
// Approximates tier based on Symbol (Hardcoded Elite) or Volume/Memes
const calculateFundamentalTier = (symbol: string, isMeme: boolean): FundamentalTier => {
    // S TIER: The Kings (Store of Value / L1 Std)
    const S_TIER = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
    if (S_TIER.includes(symbol)) return 'S';

    // C TIER: Memes & Low Cap Speculation
    if (isMeme) return 'C';
    const C_TIER_PATTERNS = ['PEPE', 'DOGE', 'SHIB', 'BONK', 'WIF', 'FLOKI', '1000SATS', 'ORDI'];
    if (C_TIER_PATTERNS.some(p => symbol.includes(p))) return 'C';

    // A TIER: Established Blue Chips (Defi/L1/L2 High Vol)
    const A_TIER = ['XRPUSDT', 'ADAUSDT', 'LINKUSDT', 'AVAXUSDT', 'DOTUSDT', 'TRXUSDT', 'TONUSDT', 'SUIUSDT', 'APTUSDT'];
    if (A_TIER.includes(symbol)) return 'A';

    // B TIER: The rest (Mid Caps)
    return 'B';
};

const fetchCandles = async (symbolId: string, interval: string): Promise<{ timestamp: number, close: number, volume: number, high: number, low: number, open: number }[]> => {
    const isBinance = symbolId === symbolId.toUpperCase() && symbolId.endsWith('USDT');

    try {
        if (isBinance) {
            // Fetching 1000 candles to ensure deep data for EMA200 calculation (Institutional Precision)
            const res = await fetchWithTimeout(`${BINANCE_API_BASE}/klines?symbol=${symbolId}&interval=${interval}&limit=1000`, {}, 8000);
            if (!res.ok) throw new Error("Binance Candle Error");
            const data = await res.json();
            return data.map((d: any[]) => ({
                timestamp: d[0],
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4]),
                volume: parseFloat(d[5])
            }));
        } else {
            const intervalMap: Record<string, string> = {
                '15m': 'm15',
                '1h': 'h1',
                '4h': 'h4',
                '1d': 'd1',
                '1w': 'w1'
            };
            const ccInterval = intervalMap[interval] || 'h1'; // Default to h1 if unknown
            const res = await fetchWithTimeout(`${COINCAP_API_BASE}/candles?exchange=binance&interval=${ccInterval}&baseId=${symbolId}&quoteId=tether`, {}, 4000);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data.map((d: any) => ({
                timestamp: d.period,
                open: parseFloat(d.open),
                high: parseFloat(d.high),
                low: parseFloat(d.low),
                close: parseFloat(d.close),
                volume: parseFloat(d.volume)
            }));
        }
    } catch (e) {
        // Retry with CoinCap logic if Binance fails (or vice versa handled by mapBinanceToCoinCap caller)
        if (isBinance) {
            const fallbackId = mapBinanceToCoinCap(symbolId);
            if (fallbackId) {
                try {
                    const intervalMap: Record<string, string> = {
                        '15m': 'm15',
                        '1h': 'h1',
                        '4h': 'h4',
                        '1d': 'd1',
                        '1w': 'w1'
                    };
                    const ccInterval = intervalMap[interval] || 'h1';
                    const res = await fetchWithTimeout(`${COINCAP_API_BASE}/candles?exchange=binance&interval=${ccInterval}&baseId=${fallbackId}&quoteId=tether`, {}, 4000);
                    if (!res.ok) return [];
                    const json = await res.json();
                    return json.data.map((d: any) => ({
                        timestamp: d.period,
                        open: parseFloat(d.open),
                        high: parseFloat(d.high),
                        low: parseFloat(d.low),
                        close: parseFloat(d.close),
                        volume: parseFloat(d.volume)
                    }));
                } catch (err) { return []; }
            }
        }
        return [];
    }
};

// NEW: Market Risk Detector (Volatility & Manipulation Proxy)
export const getMarketRisk = async (): Promise<MarketRisk> => {
    try {
        // Use BTCUSDT as proxy for general market volatility AND volume manipulation
        const candles = await fetchCandles('BTCUSDT', '1h');
        if (candles.length < 24) return { level: 'LOW', note: 'Normal', riskType: 'NORMAL' };

        const currentCandle = candles[candles.length - 1]; // Latest open candle
        const prevCandles = candles.slice(candles.length - 25, candles.length - 1);

        // 1. VOLATILITY CHECK
        const ranges = prevCandles.map(c => (c.high - c.low) / c.open);
        const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
        const currentRange = (currentCandle.high - currentCandle.low) / currentCandle.open;

        // 2. MANIPULATION CHECK (Volume Anomaly)
        const volumes = prevCandles.map(c => c.volume);
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const currentVolume = currentCandle.volume;
        const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;

        // --- RISK LOGIC ---

        // Case A: Whale Manipulation (Massive Volume + Potential Churn)
        // If volume is > 3.5x average, someone is aggressively entering/exiting BTC
        if (volumeRatio > 3.5) {
            return {
                level: 'HIGH',
                note: `🐋 BALLENAS DETECTADAS: Volumen BTC anormal (x${volumeRatio.toFixed(1)}). Posible manipulación.`,
                riskType: 'MANIPULATION'
            };
        }

        // Case B: High Volatility (News Impact)
        // If volatility is 3x avg or > 2.5% absolute in 1h
        if (currentRange > avgRange * 3 || currentRange > 0.025) {
            return {
                level: 'HIGH',
                note: '🚨 NOTICIAS/VOLATILIDAD: BTC moviéndose agresivamente. Mercado inestable.',
                riskType: 'VOLATILITY'
            };
        }

        // Case C: Medium Caution
        if (currentRange > avgRange * 1.8) {
            return { level: 'MEDIUM', note: '⚠️ Volatilidad superior al promedio.', riskType: 'VOLATILITY' };
        }

        if (volumeRatio > 2.0) {
            return { level: 'MEDIUM', note: '⚠️ Volumen BTC elevado. Precaución.', riskType: 'MANIPULATION' };
        }

        return { level: 'LOW', note: 'Condiciones estables.', riskType: 'NORMAL' };
    } catch (e) {
        return { level: 'LOW', note: 'Riesgo desconocido', riskType: 'NORMAL' };
    }
};

export { getMacroContext }; // Re-export for AI Advisor structured access

export const getMacroData = async (): Promise<string> => {
    try {
        const macro = await getMacroContext();
        return formatMacroForAI(macro);
    } catch (e) {
        console.warn("Error fetching macro context for AI:", e);
        return "Macro Data Unavailable (Using Technicals Only)";
    }
};

export const getMarketContextForAI = async (): Promise<string> => {
    return getMacroData();
};

// --- TECHNICAL ANALYSIS ENGINE ---

// NEW: Returns STRUCTURED DATA for the AI (No String parsing needed)
export const getRawTechnicalIndicators = async (symbolDisplay: string): Promise<TechnicalIndicators | null> => {
    // Ensure we strip any existing USDT suffix (with or without slash) to avoid "BTCUSDTUSDT"
    const rawSymbol = symbolDisplay.replace('/USDT', '').replace(/USDT$/, '');
    const binanceSymbol = `${rawSymbol}USDT`;

    try {
        // PARALLEL FETCH: 15m (Main) + 1H (Fractal) + 4H (Supreme) + 1D (Bias) + 1W (Cycle)
        // AND NEW: EXPERT VOLUME ANALYSIS (Parallelized)
        const [candles, candles1h, candles4h, candles1d, candles1w, volumeExpert] = await Promise.all([
            fetchCandles(binanceSymbol, '15m'),
            fetchCandles(binanceSymbol, '1h').catch(() => []),
            fetchCandles(binanceSymbol, '4h').catch(() => []),
            fetchCandles(binanceSymbol, '1d').catch(() => []), // NEW: 1D Fetch
            fetchCandles(binanceSymbol, '1w').catch(() => []),  // NEW: 1W Fetch
            getExpertVolumeAnalysis(binanceSymbol).catch(e => undefined) // NEW: Expert Volume (Fail-safe)
        ]);

        if (candles.length < 50) return null;

        const prices = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);

        // --- FRACTAL ANALYSIS (1H & 4H & 1D & 1W) ---
        let fractalAnalysis: any = undefined; // Using any temporarily to bypass strict type check if interface isn't fully updated

        // 1H Analysis
        if (candles1h.length >= 200) {
            const prices1h = candles1h.map(c => c.close);
            const ema200_1h = calculateEMA(prices1h, 200);
            const price1h = prices1h[prices1h.length - 1];

            fractalAnalysis = {
                ema200_1h,
                price_1h: price1h,
                trend_1h: price1h > ema200_1h ? 'BULLISH' : 'BEARISH',
                structure: (price1h > ema200_1h) ? 'ALIGNED' : 'DIVERGENT'
            };
        }

        // 4H Analysis (Supreme Validation)
        if (candles4h.length >= 200 && fractalAnalysis) {
            const prices4h = candles4h.map(c => c.close);
            const ema200_4h = calculateEMA(prices4h, 200);
            const price4h = prices4h[prices4h.length - 1];

            fractalAnalysis = {
                ...fractalAnalysis,
                ema200_4h,
                price_4h: price4h,
                trend_4h: price4h > ema200_4h ? 'BULLISH' : 'BEARISH'
            };
        }

        // 1D Analysis (Bias)
        if (candles1d.length >= 200 && fractalAnalysis) {
            const prices1d = candles1d.map(c => c.close);
            const ema200_1d = calculateEMA(prices1d, 200);
            const price1d = prices1d[prices1d.length - 1];

            fractalAnalysis = {
                ...fractalAnalysis,
                ema200_1d,
                price_1d: price1d,
                trend_1d: price1d > ema200_1d ? 'BULLISH' : 'BEARISH'
            };
        }

        // 1W Analysis (Market Cycle & Aggregation) - NEW
        if (candles1w.length >= 50 && fractalAnalysis) {
            const prices1w = candles1w.map(c => c.close);
            // We use EMA50 on Weekly as a proxy for "Bull/Bear Market" line (institutional standard)
            const ema50_1w = calculateEMA(prices1w, 50);
            const price1w = prices1w[prices1w.length - 1];
            const rsi1w = calculateRSI(prices1w, 14);

            fractalAnalysis = {
                ...fractalAnalysis,
                ema50_1w,
                price_1w: price1w,
                trend_1w: price1w > ema50_1w ? 'BULLISH' : 'BEARISH',
                rsi_1w: rsi1w
            };
        }
        // Calcs
        const currentPrice = prices[prices.length - 1];
        const rsi = calculateRSI(prices, 14);
        const rsiArray = calculateRSIArray(prices, 14); // NEW: Needed for Expert Analysis
        const stochRsi = calculateStochRSI(prices, 14);
        const adx = calculateADX(highs, lows, prices, 14);
        const atr = calculateATR(highs, lows, prices, 14);
        const ema20 = calculateEMA(prices, 20);
        const ema50 = calculateEMA(prices, 50);
        const ema100 = calculateEMA(prices, 100);
        const ema200 = calculateEMA(prices, 200);
        const vwap = calculateCumulativeVWAP(highs, lows, prices, volumes);

        const avgVol = calculateSMA(volumes, 20);
        const rvol = avgVol > 0 ? (volumes[volumes.length - 1] / avgVol) : 0;

        const macd = calculateMACD(prices);
        const pivots = calculatePivotPoints(highs, lows, prices);
        const bb = calculateBollingerStats(prices);
        const fibs = calculateAutoFibs(highs, lows, ema200);
        const ichimokuData = calculateIchimokuData(highs, lows, prices);

        // NEW: Fractal & Harmonic Analysis
        const { fractalHighs, fractalLows } = calculateFractals(highs, lows);
        const harmonicPatterns = detectHarmonicPatterns(prices, highs, lows, fractalHighs, fractalLows);

        // Determine Alignment
        let emaAlignment: 'BULLISH' | 'BEARISH' | 'CHAOTIC' = 'CHAOTIC';
        if (ema20 > ema50 && ema50 > ema100 && ema100 > ema200) emaAlignment = 'BULLISH';
        if (ema20 < ema50 && ema50 < ema100 && ema100 < ema200) emaAlignment = 'BEARISH';

        // NEW: Advanced Market Structure Calculations
        const volumeProfile = calculateVolumeProfile(candles, atr);
        const { bullishOB, bearishOB } = detectOrderBlocks(candles, atr, currentPrice);
        const { bullishFVG, bearishFVG } = detectFVG(candles, atr, currentPrice);

        // NEW: Expert EMA Metrics (Z-Score & Slope)
        const zScore = calculateZScore(prices, ema200);
        const emaSlope = calculateSlope(calculateEMAArray(prices, 200), 10);

        // NEW: EXPERT MACD & RSI ANALYSIS (Missing in previous version)
        const macdDivergence = detectGenericDivergence(candles, macd.histogramValues, 'MACD_HIST');
        const isSqueeze = bb.bandwidth < 10 && Math.abs(macd.histogram) < (currentPrice * 0.0005);
        const rsiExpertResults = analyzeRSIExpert(prices, rsiArray);

        // Calculate Confluence Analysis
        const confluenceAnalysis = calculatePOIs(
            currentPrice,
            fibs,
            {
                p: pivots.p,
                r1: pivots.r1,
                s1: pivots.s1,
                r2: (pivots.p - pivots.s1) + pivots.r1,
                s2: pivots.p - (pivots.r1 - pivots.s1)
            },
            ema200,
            ema50,
            atr,
            volumeProfile,
            bullishOB,
            bearishOB,
            bullishFVG,
            bearishFVG
        );

        // NEW: Calculate Fundamental Tier for Expert Analysis
        // We reuse the meme detector logic (basic check against list)
        const isMeme = MEME_SYMBOLS.some(m => binanceSymbol.includes(m));
        const tier = calculateFundamentalTier(binanceSymbol, isMeme);

        const result: TechnicalIndicators = {
            symbol: symbolDisplay,
            price: currentPrice,
            rsi,
            stochRsi,
            adx,
            atr,
            rvol,
            vwap,
            ema20,
            ema50,
            ema100,
            ema200,
            zScore,
            emaSlope,
            macdDivergence, // NEW
            isSqueeze,      // NEW
            rsiExpert: {    // NEW
                range: rsiExpertResults.range.type,
                target: rsiExpertResults.reversalTarget?.active ? rsiExpertResults.reversalTarget.targetPrice : null,
                targetType: rsiExpertResults.reversalTarget?.type || null
            },
            macd: {
                line: macd.macdLine,
                signal: macd.signalLine,
                histogram: macd.histogram
            },
            bollinger: {
                upper: bb.upper,
                lower: bb.lower,
                middle: bb.sma, // Using SMA as middle band
                bandwidth: bb.bandwidth
            },
            pivots: {
                p: pivots.p,
                r1: pivots.r1,
                s1: pivots.s1,
                r2: (pivots.p - pivots.s1) + pivots.r1, // Simple R2 approx
                s2: pivots.p - (pivots.r1 - pivots.s1)  // Simple S2 approx
            },
            fibonacci: {
                level0: fibs.level0,
                level0_236: fibs.level0_236,
                level0_382: fibs.level0_382,
                level0_5: fibs.level0_5,
                level0_618: fibs.level0_618,
                level0_65: fibs.level0_65,  // NEW
                level0_786: fibs.level0_786,
                level0_886: fibs.level0_886, // NEW
                level1: fibs.level1,
                tp1: fibs.tp1,
                tp2: fibs.tp2,
                tp3: fibs.tp3,
                tp4: fibs.tp4,
                tp5: fibs.tp5
            },
            harmonicPatterns, // NEW

            // NEW: Expert Volume Data Analysis
            volumeExpert,

            tier, // NEW: Tier for Risk Management (S/A/B/C)
            ichimokuData: ichimokuData || undefined, // NEW
            trendStatus: {
                emaAlignment,
                goldenCross: ema50 > ema200,
                deathCross: ema50 < ema200
            },
            // NEW: Advanced Market Structure (Máximo Potencial)
            volumeProfile: {
                poc: volumeProfile.poc,
                valueAreaHigh: volumeProfile.valueAreaHigh,
                valueAreaLow: volumeProfile.valueAreaLow
            },
            orderBlocks: {
                bullish: bullishOB.map(ob => ({
                    price: ob.price,
                    strength: ob.strength,
                    mitigated: ob.mitigated
                })),
                bearish: bearishOB.map(ob => ({
                    price: ob.price,
                    strength: ob.strength,
                    mitigated: ob.mitigated
                }))
            },
            fairValueGaps: {
                bullish: bullishFVG.map(fvg => ({
                    midpoint: fvg.midpoint,
                    size: fvg.size,
                    filled: fvg.filled
                })),
                bearish: bearishFVG.map(fvg => ({
                    midpoint: fvg.midpoint,
                    size: fvg.size,
                    filled: fvg.filled
                }))
            },

            // NEW: Session Analysis Injection
            sessionAnalysis: analyzeSessionContext(currentPrice, volumes[volumes.length - 1], candles1h),

            confluenceAnalysis: {
                topSupports: confluenceAnalysis.topSupports,
                topResistances: confluenceAnalysis.topResistances
            },
            technicalReasoning: '',
            invalidated: false
        };

        // NEW: Market Regime Detection (Autonomous Strategy Selection)
        const marketRegime = detectMarketRegime(result);

        return {
            ...result,
            marketRegime,
            fractalAnalysis // CRITICAL: Include fractal analysis in return object
        };

    } catch (e) {
        return null;
    }
}

// Legacy function kept for string compatibility if needed elsewhere, 
// but upgraded to use the structured data to ensure consistency.
export const getTechnicalAnalysis = async (symbolDisplay: string): Promise<string> => {
    const data = await getRawTechnicalIndicators(symbolDisplay);
    if (!data) return `No se pudo conectar al mercado para ${symbolDisplay}.`;

    return `
DATOS TÉCNICOS AVANZADOS PARA ${data.symbol}:
- Precio Actual: $${data.price}
- Estructura EMA (20/50/100/200): $${data.ema20.toFixed(4)} / $${data.ema50.toFixed(4)} / $${data.ema100.toFixed(4)} / $${data.ema200.toFixed(4)}
- RSI (14, Wilder): ${data.rsi.toFixed(2)}
- MACD Hist: ${data.macd.histogram.toFixed(4)}
- Bollinger: Sup $${data.bollinger.upper.toFixed(4)} / Inf $${data.bollinger.lower.toFixed(4)}
- ATR: $${data.atr.toFixed(4)}
`.trim();
};

export const fetchDetailedMarketData = getRawTechnicalIndicators;

export const subscribeToSymbol = (symbol: string, onUpdate: (data: any) => void, onError: (error: any) => void) => {
    // Implementación básica de suscripción para un solo símbolo
    // Reutiliza la lógica de subscribeToLivePrices pero filtrando
    const dummyMarketData: MarketData[] = [{ id: symbol, symbol: symbol, price: 0, change24h: 0, rsi: 0, volume: '0', trend: 'neutral' }];
    return subscribeToLivePrices(dummyMarketData, (data) => {
        if (data[symbol]) {
            onUpdate({ symbol, price: data[symbol] });
        }
    });
};

// --- AUTONOMOUS QUANT ENGINE v4.0 (API INDEPENDENT) ---

export const scanMarketOpportunities = async (style: TradingStyle): Promise<AIOpportunity[]> => {
    // 1. Get market data based on selected style
    // MEME_SCALP uses specific meme list, others use top volume
    const mode = style === 'MEME_SCALP' ? 'memes' : 'volume';
    const market = await fetchCryptoData(mode);

    // 2. CHECK MARKET RISK (News Filter)
    const risk = await getMarketRisk();
    const isHighRisk = risk.level === 'HIGH';

    // 3. GET MACRO CONTEXT (NEW: Correlaciones macroeconómicas)
    let macroContext: MacroContext | null = null;
    try {
        macroContext = await getMacroContext();
        console.log(`[Scanner] Macro Context: BTC ${macroContext.btcRegime.regime} (${macroContext.btcRegime.strength}%), BTC.D ${macroContext.btcDominance.current.toFixed(1)}% (${macroContext.btcDominance.trend})`);
    } catch (error) {
        console.warn('[Scanner] Macro context unavailable, proceeding without macro filters:', error);
    }
    if (!market || market.length === 0) throw new Error("No market data available");

    // Scan all candidates if Memes (usually < 40), or top 60 for general (Increased from 40 for better coverage)
    const topCandidates = style === 'MEME_SCALP' ? market : market.slice(0, 60);

    const validMathCandidates: AIOpportunity[] = [];

    await Promise.all(topCandidates.map(async (coin) => {
        try {
            // Determine interval based on strategy
            const interval = style === 'SWING_INSTITUTIONAL' || style === 'ICHIMOKU_CLOUD' ? '4h' : '15m';

            const candles = await fetchCandles(coin.id, interval);
            if (candles.length < 200) return; // Need deeper history for EMA 200

            const prices = candles.map(c => c.close);
            const volumes = candles.map(c => c.volume);
            const highs = candles.map(c => c.high);
            const lows = candles.map(c => c.low);

            let score = 0;
            let detectionNote = "";
            let signalSide: 'LONG' | 'SHORT' = 'LONG'; // Default

            // Educational Metrics to pass to UI
            let specificTrigger = "";
            let structureNote = "";

            // Use Closed Candle for Confirmation (No Repainting)
            const checkIndex = prices.length - 2;

            // CALCULATE NEW PRECISION METRICS FOR SCANNER
            const vwap = calculateCumulativeVWAP(highs, lows, prices, volumes);
            const stochRsi = calculateStochRSI(prices, 14);
            const rsi = calculateRSI(prices.slice(0, checkIndex + 1), 14);
            const rsiArray = calculateRSIArray(prices.slice(0, checkIndex + 1), 14); // NEW: Needed for Expert Analysis

            // NEW: Institutional Logic Integration
            const { fractalHighs, fractalLows } = calculateFractals(highs.slice(0, checkIndex + 1), lows.slice(0, checkIndex + 1));
            // Ensure AutoFibs uses the correct fractal logic internally or passed if upgraded (currently passing manually computed fibs)
            const fibs = calculateAutoFibs(highs, lows, calculateEMA(prices, 200));

            const harmonicPatterns = detectHarmonicPatterns(prices.slice(0, checkIndex + 1), highs.slice(0, checkIndex + 1), lows.slice(0, checkIndex + 1), fractalHighs, fractalLows);
            const ema200 = calculateEMA(prices.slice(0, checkIndex + 1), 200);
            const currentPrice = prices[checkIndex];
            const avgVol = calculateSMA(volumes, 20);
            const rvol = avgVol > 0 ? (volumes[checkIndex] / avgVol) : 0;

            // NEW: DETERMINE FUNDAMENTAL TIER
            const tier = calculateFundamentalTier(coin.id, style === 'MEME_SCALP');


            // --- FILTRO DE VOLUMEN MÍNIMO (Calidad Profesional) ---
            // No operar activos sin liquidez suficiente (Ajustado a 0.5 para permitir Asia Session/Ranges)
            if (rvol < 0.5) {
                console.log(`[Scanner] ${coin.symbol} descartado por volumen bajo (RVOL: ${rvol.toFixed(2)}x)`);
                return; // Skip this opportunity
            }

            // Common structure check
            const trendDist = ((currentPrice - ema200) / ema200) * 100;
            structureNote = trendDist > 0 ? `Tendencia Alcista (+${trendDist.toFixed(1)}% sobre EMA200)` : `Tendencia Bajista (${trendDist.toFixed(1)}% bajo EMA200)`;

            // --- AUTONOMOUS STRATEGY SELECTION ---

            // 1. Calculate Missing Indicators for Regime Detection
            const ema20 = calculateEMA(prices.slice(0, checkIndex + 1), 20);
            const ema50 = calculateEMA(prices.slice(0, checkIndex + 1), 50);
            const ema100 = calculateEMA(prices.slice(0, checkIndex + 1), 100);
            const macd = calculateMACD(prices.slice(0, checkIndex + 1));
            const bb = calculateBollingerStats(prices.slice(0, checkIndex + 1), 20, 2);
            const pivots = calculatePivotPoints(highs.slice(0, checkIndex + 1), lows.slice(0, checkIndex + 1), prices.slice(0, checkIndex + 1));
            const adx = calculateADX(highs.slice(0, checkIndex + 1), lows.slice(0, checkIndex + 1), prices.slice(0, checkIndex + 1), 14);
            const atr = calculateATR(highs.slice(0, checkIndex + 1), lows.slice(0, checkIndex + 1), prices.slice(0, checkIndex + 1), 14);

            // NEW: Calculate Order Blocks and Confluence for strategies
            const volumeProfile = calculateVolumeProfile(candles.slice(0, checkIndex + 1), atr);
            const { bullishOB, bearishOB } = detectOrderBlocks(candles.slice(0, checkIndex + 1), atr, currentPrice);
            const { bullishFVG, bearishFVG } = detectFVG(candles.slice(0, checkIndex + 1), atr, currentPrice);

            // NEW: Expert EMA Metrics (Z-Score & Slope)
            const zScore = calculateZScore(prices.slice(0, checkIndex + 1), ema200);
            const emaSlope = calculateSlope(calculateEMAArray(prices.slice(0, checkIndex + 1), 200), 10);

            // NEW: EXPERT MACD & RSI ANALYSIS
            const macdDivergence = detectGenericDivergence(candles, macd.histogramValues, 'MACD_HIST');
            const isSqueeze = bb.bandwidth < 10 && Math.abs(macd.histogram) < (currentPrice * 0.0005);

            // NEW: EXPERT VOLUME ANALYSIS (Scanner Level)
            let volumeExpert = undefined;
            try {
                // Only fetch for coins that pass basic filters to save API calls
                if (rvol > 0.3) {
                    volumeExpert = await getExpertVolumeAnalysis(coin.symbol).catch(() => undefined);
                }
            } catch (e) { }

            // NEW: EXPERT RSI (Cardwell)
            const rsiExpertResults = analyzeRSIExpert(prices.slice(0, checkIndex + 1), rsiArray.slice(0, checkIndex + 1));

            // Calculate Confluence for resistances/supports
            const confluenceAnalysis = calculatePOIs(
                currentPrice,
                fibs,
                pivots,
                ema200,
                ema50,
                atr,
                volumeProfile,
                bullishOB,
                bearishOB,
                bullishFVG,
                bearishFVG
            );

            // Extract resistances for Breakout Strategy
            const resistances = confluenceAnalysis.topResistances.map(r => r.price);

            // 2. Construct TechnicalIndicators for Regime Detection
            const techIndicators: TechnicalIndicators = {
                symbol: coin.symbol,
                price: currentPrice,
                rsi, stochRsi, adx, atr, rvol, vwap,
                ema20, ema50, ema100, ema200,
                zScore, // NEW
                emaSlope, // NEW
                macdDivergence, // NEW
                isSqueeze, // NEW
                rsiExpert: {
                    range: rsiExpertResults.range.type,
                    target: rsiExpertResults.reversalTarget?.active ? rsiExpertResults.reversalTarget.targetPrice : null,
                    targetType: rsiExpertResults.reversalTarget?.type || null
                },
                macd: { line: macd.macdLine, signal: macd.signalLine, histogram: macd.histogram },
                bollinger: { upper: bb.upper, lower: bb.lower, middle: bb.sma, bandwidth: bb.bandwidth },
                pivots,
                fibonacci: fibs,
                harmonicPatterns: harmonicPatterns, // NEW: Include Harmonics
                volumeExpert, // NEW: Include for Strategy Logic
                technicalReasoning: "",
                invalidated: false,
                trendStatus: {
                    emaAlignment: (ema20 > ema50 && ema50 > ema100) ? 'BULLISH' : (ema20 < ema50 && ema50 < ema100) ? 'BEARISH' : 'CHAOTIC',
                    goldenCross: ema50 > ema200,
                    deathCross: ema50 < ema200
                }
            };

            // 3. Detect Regime & Select Strategies
            const marketRegime = detectMarketRegime(techIndicators);
            const selection = selectStrategies(marketRegime);

            let totalScore = 0;
            let totalWeight = 0;
            let primaryStrategy = selection.activeStrategies[0]?.id; // Default to first
            let strategyDetails: string[] = [];

            // 4. Execute Selected Strategies
            for (const strategy of selection.activeStrategies) {
                const strategyId = strategy.id;
                const weight = strategy.weight;
                if (weight === 0) continue;

                let result = null;
                let strategyName = "";

                if (strategyId === 'ichimoku_dragon') {
                    result = analyzeIchimoku(highs, lows, prices);
                    strategyName = "Ichimoku Cloud";
                } else if (strategyId === 'breakout_momentum') {
                    result = analyzeBreakoutSignal(
                        prices.slice(0, checkIndex + 1),
                        highs.slice(0, checkIndex + 1),
                        lows.slice(0, checkIndex + 1),
                        rvol,
                        resistances // NEW: Pasar resistencias para validación
                    );
                    strategyName = "Breakout Momentum";
                } else if (strategyId === 'smc_liquidity') {
                    result = analyzeSwingSignal(
                        prices.slice(0, checkIndex + 1),
                        highs.slice(0, checkIndex + 1),
                        lows.slice(0, checkIndex + 1),
                        fibs,
                        volumes.slice(0, checkIndex + 1), // NEW: Pasar volumes para validación
                        { bullishOB, bearishOB } // NEW: Pasar Order Blocks
                    );
                    strategyName = "SMC Liquidity";
                } else if (strategyId === 'quant_volatility') {
                    // NEW: Pinball Strategy integration (Priority)
                    const slope200 = calculateSlope(calculateEMAArray(prices.slice(0, checkIndex + 1), 200), 10);
                    const pinballResult = analyzePinballSignal(
                        prices.slice(0, checkIndex + 1),
                        lows.slice(0, checkIndex + 1),
                        highs.slice(0, checkIndex + 1),
                        ema50,
                        ema200,
                        slope200,
                        adx
                    );

                    if (pinballResult) {
                        result = pinballResult;
                        strategyName = "Institutional Pinball";
                    } else {
                        result = analyzeScalpSignal(prices.slice(0, checkIndex + 1), vwap, rsi);
                        strategyName = "Quant Volatility";
                    }
                } else if (strategyId === 'meme_hunter') {
                    result = analyzeMemeSignal(prices.slice(0, checkIndex + 1), vwap, rvol, rsi, stochRsi);
                    strategyName = "Meme Hunter";
                }

                if (result) {
                    // Weighted Score Accumulation - TODAS las estrategias contribuyen
                    totalScore += result.score * weight;
                    totalWeight += weight;

                    // Solo agregamos detalles de estrategias fuertes para el mensaje
                    if (result.score > 50) {
                        strategyDetails.push(`${strategyName}: ${result.detectionNote}`);
                    }

                    // Update signal details from the highest weighted strategy
                    if (strategyId === primaryStrategy || !specificTrigger) {
                        signalSide = result.signalSide;
                        specificTrigger = result.specificTrigger;
                        detectionNote = result.detectionNote;
                    }
                }
            }

            // Normalize Score
            score = totalWeight > 0 ? totalScore : 0;

            // Combine notes
            if (strategyDetails.length > 0) {
                detectionNote = strategyDetails.join(" | ");
            }

            // ═══════════════════════════════════════════════════════════════
            // 5. EXPERT BOOSTERS (Institutional Edge)
            // ═══════════════════════════════════════════════════════════════
            // These high-quality setups should push a "Good" trade to "Great" (Premium/God Mode)

            // A) TTM Squeeze (Volatilidad Explosiva Inminente)
            if (isSqueeze) {
                totalScore += 10;
                detectionNote += " | ⚡ TTM Squeeze (Explosión)";
            }

            // B) RSI Cardwell Target (Proyección Institucional)
            if (rsiExpertResults.reversalTarget?.active) {
                // Validate Alignment
                const targetIsBullish = rsiExpertResults.reversalTarget.type === 'POSITIVE';
                const targetIsBearish = rsiExpertResults.reversalTarget.type === 'NEGATIVE';

                if ((signalSide === 'LONG' && targetIsBullish) || (signalSide === 'SHORT' && targetIsBearish)) {
                    totalScore += 15; // High confidence setup ALIGNED
                    detectionNote += ` | 🎯 Cardwell Target ($${rsiExpertResults.reversalTarget.targetPrice.toLocaleString()})`;
                }
            }

            // C) Super Range (Momentum)
            if (rsiExpertResults.range.type.includes('SUPER')) {
                // Super Range is momentum driven. If Bull Range -> Long. If Bear Range -> Short.
                const isBullRange = rsiExpertResults.range.type.includes('BULL');
                const isBearRange = rsiExpertResults.range.type.includes('BEAR');

                if ((signalSide === 'LONG' && isBullRange) || (signalSide === 'SHORT' && isBearRange)) {
                    totalScore += 10;
                    detectionNote += " | 🚀 Super Range Momentum";
                }
            }

            // D) MACD Divergence
            if (macdDivergence) {
                const divIsBullish = macdDivergence.type.includes('BULLISH');
                const divIsBearish = macdDivergence.type.includes('BEARISH');

                if ((signalSide === 'LONG' && divIsBullish) || (signalSide === 'SHORT' && divIsBearish)) {
                    totalScore += 10;
                    detectionNote += ` | ⚠️ Div ${macdDivergence.type}`;
                } else {
                    // Divergence against us! Warning/Penalty
                    totalScore -= 10;
                    detectionNote += ` | ⛔ Div Opuesta (${macdDivergence.type})`;
                }
            }

            // Cap Score at 99
            if (totalScore > 99) totalScore = 99;
            score = totalWeight > 0 ? totalScore : 0; // Re-assign filtered score

            // --- FILTERING BY RISK ---
            // If Risk is High (News OR Manipulation), we only accept VERY high scores
            const threshold = isHighRisk ? 70 : 50; // BALANCED: Estricto pero permite oportunidades reales

            // --- APPLY MACRO FILTERS (NEW) ---
            let finalScore = score;
            if (macroContext) {
                finalScore = applyMacroFilters(score, coin.symbol, signalSide, macroContext);
            }

            // ═══════════════════════════════════════════════════════════════
            // INSTITUTIONAL GRADE FILTERING (Professional Trader Philosophy)
            // ═══════════════════════════════════════════════════════════════
            // Tier System:
            // 🔥 GOD MODE (90+): Perfect alignment across all timeframes + 4+ confluence factors
            // ⭐ PREMIUM (70-89): Strong confluence, 2-3 timeframes aligned
            // ✅ VALID (50-69): Technically sound but lower confluence
            // ⚠️ MODERATE (35-49): Risky, only for experienced traders
            //
            // PRINCIPLE: "Quality over Quantity" - Show only GOD MODE + PREMIUM by default
            // This is how institutional traders operate: Few trades, high conviction, big payoff.
            // ═══════════════════════════════════════════════════════════════

            const PREMIUM_THRESHOLD = 60;  // Adjusted: Show VALID+ signals (60+) to avoid "Empty Screen" syndrome
            const GOD_MODE_THRESHOLD = 90; // Perfect setups

            // Risk-adjusted threshold
            const minimumThreshold = isHighRisk ? 80 : PREMIUM_THRESHOLD;

            // --- BUILD MATH OPPORTUNITY (AUTONOMOUS) ---

            // [INTELLIGENT AUDIT] Log "Near Misses"
            if (finalScore < minimumThreshold && finalScore > 40) {
                console.log(`[Scanner Audit] 📉 ${coin.symbol} rechazado por Score (${Math.round(finalScore)}/${minimumThreshold}). Razón: ${detectionNote}`);
            }

            if (finalScore >= minimumThreshold) {
                // NEW: Usar precio de confirmación de señal (vela cerrada)
                const signalPrice = prices[checkIndex]; // Precio donde se confirmó la señal
                const livePrice = prices[prices.length - 1]; // Precio actual (para referencia)

                // NEW: Validar vigencia de la señal
                const priceMove = ((livePrice - signalPrice) / signalPrice) * 100;
                const maxPriceMove = 5.0; // 5% de tolerancia (más flexible para mercados volátiles)

                // Si el precio se movió mucho, la señal está obsoleta
                if (Math.abs(priceMove) > maxPriceMove) {
                    console.log(`[Scanner Audit] ⚠️ ${coin.symbol} señal obsoleta (Movimiento: ${priceMove.toFixed(2)}%)`);
                    return; // Skip this opportunity
                }

                // --- FRACTAL DRAGON STRATEGY: LAZY 1H VALIDATION (NEW) ---
                // Solo si el candidato es prometedor, validamos la estructura mayor (1H)
                try {
                    const candles1h = await fetchCandles(coin.id, '1h');
                    if (candles1h.length >= 200) {
                        const prices1h = candles1h.map(c => c.close);
                        const ema200_1h = calculateEMA(prices1h, 200);
                        const currentPrice1h = prices1h[prices1h.length - 1];

                        // REGLA DE ORO: No operar contra la estructura de 1H (AJUSTADO: Menos restrictivo)
                        let fractalPenalty = 0;
                        let fractalNote = "";
                        const distanceFrom1hEMA = Math.abs((currentPrice1h - ema200_1h) / ema200_1h) * 100;

                        if (signalSide === 'LONG') {
                            if (currentPrice1h < ema200_1h) {
                                // Solo descartamos si está MUY lejos (>5%) de la EMA200 1H
                                if (distanceFrom1hEMA > 5) {
                                    fractalPenalty = 100;
                                    fractalNote = `⛔ Estructura 1H Muy Bajista (${distanceFrom1hEMA.toFixed(1)}% bajo EMA200)`;
                                } else {
                                    fractalNote = "⚠️ Cerca de EMA200 1H (Precaución)";
                                }
                            } else {
                                fractalNote = "✅ Confirmado por Estructura 1H";
                            }
                        } else { // SHORT
                            if (currentPrice1h > ema200_1h) {
                                // Solo descartamos si está MUY lejos (>5%) de la EMA200 1H
                                if (distanceFrom1hEMA > 5) {
                                    fractalPenalty = 100;
                                    fractalNote = `⛔ Estructura 1H Muy Alcista (${distanceFrom1hEMA.toFixed(1)}% sobre EMA200)`;
                                } else {
                                    fractalNote = "⚠️ Cerca de EMA200 1H (Precaución)";
                                }
                            } else {
                                fractalNote = "✅ Confirmado por Estructura 1H";
                            }
                        }

                        if (fractalPenalty > 0) {
                            console.log(`[Scanner Audit] ❌ ${coin.symbol} rechazado por Fractal (${fractalNote})`);
                            return; // Descartar candidato
                        }

                        // Añadir nota de confirmación
                        detectionNote += ` | ${fractalNote}`;

                        // NEW: VALIDACIÓN FRACTAL 4H (Para todas las señales prometedoras)
                        // Validamos 4H para asegurar alineación con estructura superior
                        try {
                            const candles4h = await fetchCandles(coin.id, '4h');
                            if (candles4h.length >= 200) {
                                const prices4h = candles4h.map(c => c.close);
                                const ema200_4h = calculateEMA(prices4h, 200);
                                const currentPrice4h = prices4h[prices4h.length - 1];

                                const distanceFrom4hEMA = Math.abs((currentPrice4h - ema200_4h) / ema200_4h) * 100;

                                // Penalización moderada si estructura 4H diverge
                                if (signalSide === 'LONG' && currentPrice4h < ema200_4h && distanceFrom4hEMA > 3) {
                                    finalScore *= 0.85; // Penalización moderada
                                    detectionNote += " | ⚠️ Estructura 4H bajista";
                                } else if (signalSide === 'SHORT' && currentPrice4h > ema200_4h && distanceFrom4hEMA > 3) {
                                    finalScore *= 0.85;
                                    detectionNote += " | ⚠️ Estructura 4H alcista";
                                } else if (
                                    (signalSide === 'LONG' && currentPrice4h > ema200_4h) ||
                                    (signalSide === 'SHORT' && currentPrice4h < ema200_4h)
                                ) {
                                    detectionNote += " | ✅ Confirmado 4H";
                                }
                            }
                        } catch (err4h) {
                            // Silently fail, 4H validation is not critical
                        }

                        // NEW: ELDER'S IMPULSE SYSTEM CHECK (Daily Alignment)
                        // Expert Doc: "Never trade against the Weekly/Daily Tide"
                        if (techIndicators.fractalAnalysis?.trend_1d) {
                            const trend1d = techIndicators.fractalAnalysis.trend_1d;
                            const isPinball = strategyDetails.some(s => s.includes("Institutional Pinball"));

                            if (signalSide === 'LONG' && trend1d === 'BEARISH') {
                                // STRICT FILTER: Elder says NO LONGs if Daily is Bearish
                                if (!macdDivergence && !isPinball) {
                                    finalScore *= 0.5; // Kill the score
                                    detectionNote += " | ⛔ Contra-Tendencia Diaria (Elder Rule)";
                                } else {
                                    detectionNote += " | ⚠️ Contra-Tendencia (Validado por Pinball/Div)";
                                }
                            } else if (signalSide === 'SHORT' && trend1d === 'BULLISH') {
                                if (!macdDivergence && !isPinball) {
                                    finalScore *= 0.5;
                                    detectionNote += " | ⛔ Contra-Tendencia Diaria (Elder Rule)";
                                } else {
                                    detectionNote += " | ⚠️ Contra-Tendencia (Validado por Pinball/Div)";
                                }
                            } else {
                                // ALIGNED!
                                finalScore += 5; // Boost score for Elder Alignment
                                detectionNote += " | 🌊 Marea a favor (Elder Aligned)";
                            }
                        }
                    }
                } catch (err) {
                    console.warn(`[Scanner] Falló validación 1H para ${coin.symbol}, procediendo con precaución.`);
                }

                const atr = calculateATR(highs.slice(0, checkIndex + 1), lows.slice(0, checkIndex + 1), prices.slice(0, checkIndex + 1), 14);

                // NEW: Regime-Aware DCA Calculation (Autonomous)
                const dcaPlan = calculateDCAPlan(
                    signalPrice,
                    { supportPOIs: [], resistancePOIs: [], topSupports: [], topResistances: [] }, // Fallback to Fibs/ATR for scanner
                    atr,
                    signalSide,
                    marketRegime,
                    fibs,
                    tier // NEW: Pass Tier for Dynamic Stop Loss
                );

                // --- FINAL SCORE ADJUSTMENT (CORRELATION FILTER) ---
                // Dynamic Sensitivity Analysis

                let finalPrimarySide = signalSide; // Use signalSide as primarySide for this context
                let currentFinalScore = finalScore; // Use a new variable to avoid conflict with outer finalScore
                let filterNote = "";

                // Assuming btcCrashMode, btcTrend, and strategyId are available in this scope or passed in
                // For this example, let's assume they are available or derived.
                // If not, they would need to be passed as arguments or calculated.
                const btcCrashMode = macroContext?.btcRegime.regime === 'BEAR' && macroContext?.btcRegime.volatilityStatus === 'HIGH';
                const btcRegime = macroContext?.btcRegime.regime || 'RANGE';
                const strategyId = getStrategyId(style); // Fixed: Use 'style' argument

                if (btcCrashMode && finalPrimarySide === 'LONG') {
                    // SCENARIO 1: CRASH MODE -> BLOCK LONGS (Hard Filter)
                    // Unless it's a massive discount / oversold bounce (Mean Reversion)
                    if (strategyId !== 'quant_volatility') { // Allow scalps
                        currentFinalScore = 0;
                        filterNote = " (Blocked by BTC Crash)";
                    }
                } else if (btcRegime === 'BEAR' && finalPrimarySide === 'LONG') {
                    // SCENARIO 2: BEAR TREND -> PENALTY ON LONGS
                    // Require higher quality setup
                    if (currentFinalScore < 85) {
                        currentFinalScore *= 0.5; // Penalize weak longs
                        filterNote = " (Penalized: Trend Mismatch)";
                    } else {
                        filterNote = " (Decoupled Runner)";
                    }
                } else if (btcRegime === 'BULL' && finalPrimarySide === 'SHORT') {
                    // SCENARIO 3: BULL TREND -> PENALTY ON SHORTS
                    if (currentFinalScore < 85) {
                        currentFinalScore *= 0.5;
                        filterNote = " (Penalized: Trend Mismatch)";
                    }
                }

                // --- FILTER: MIN SCORE ---
                // Institutional Grade Quality Control
                const MIN_SCORE = 60; // Standard

                if (currentFinalScore < MIN_SCORE) return;

                // Update the main finalScore with the adjusted value
                finalScore = currentFinalScore;
                detectionNote += filterNote; // Add filter note to detectionNote

                const decimals = signalPrice > 1000 ? 2 : signalPrice > 1 ? 4 : 6;
                const format = (n: number) => parseFloat(n.toFixed(decimals));

                const finalNote = isHighRisk ? `[⚠️ RIESGO ALTO] ${detectionNote}` : detectionNote;

                // VWAP Dist % calculation (usando signalPrice)
                const vwapDist = ((signalPrice - vwap) / vwap) * 100;

                // Determine signal quality tier for UI badge
                const signalTier = finalScore >= GOD_MODE_THRESHOLD ? '🔥 GOD MODE' : '⭐ PREMIUM';

                // --- INSTITUTIONAL METADATA ---
                const session = getCurrentSessionSimple();
                const rrRatio = dcaPlan.entries.length > 0 && dcaPlan.stopLoss > 0
                    ? Math.abs((dcaPlan.takeProfits.tp3.price - dcaPlan.entries[0].price) / (dcaPlan.entries[0].price - dcaPlan.stopLoss))
                    : 0;

                const mathOpp: AIOpportunity = {
                    // Institutional Metadata
                    timeframe: interval,
                    session: session.session,
                    tier: tier, // NEW: Tier logic
                    riskRewardRatio: parseFloat(rrRatio.toFixed(2)),

                    id: Date.now().toString() + Math.random(),
                    symbol: coin.symbol,
                    timestamp: Date.now(),
                    signalTimestamp: candles[checkIndex].timestamp,
                    strategy: `${signalTier} (${marketRegime.regime})`, // Show Quality + Regime
                    side: signalSide,
                    confidenceScore: Math.round(finalScore),
                    entryZone: {
                        min: format(dcaPlan.entries[2].price), // Entry 3 (Deepest)
                        max: format(dcaPlan.entries[0].price), // Entry 1 (Closest)
                        aggressive: format(dcaPlan.entries[0].price),
                        signalPrice: format(signalPrice)
                    },
                    stopLoss: format(dcaPlan.stopLoss),
                    takeProfits: {
                        tp1: format(dcaPlan.takeProfits.tp1.price),
                        tp2: format(dcaPlan.takeProfits.tp2.price),
                        tp3: format(dcaPlan.takeProfits.tp3.price)
                    },
                    technicalReasoning: finalNote,
                    metrics: {
                        rvol: format(rvol),
                        rsi: format(rsi),
                        vwapDist: format(vwapDist),
                        structure: structureNote,
                        specificTrigger: specificTrigger,
                        zScore: techIndicators.zScore,
                        emaSlope: techIndicators.emaSlope,
                        rsiExpert: {
                            range: techIndicators.rsiExpert?.range || 'NEUTRAL',
                            target: techIndicators.rsiExpert?.target || null
                        },
                        isSqueeze: isSqueeze, // NEW
                        macdDivergence: macdDivergence?.description, // NEW
                        volumeExpert: volumeExpert // NEW: Pass to UI
                    },
                    dcaPlan: dcaPlan, // NEW: Pasar el plan completo
                    harmonicPatterns: harmonicPatterns, // NEW: Pasar patrones armónicos
                    invalidated: false
                };

                validMathCandidates.push(mathOpp);
            }

        } catch (e) { return null; }
    }));

    // Return top 10 best opportunities only (Quality over Quantity)
    return validMathCandidates
        .sort((a, b) => b.confidenceScore - a.confidenceScore)
        .slice(0, 10);
};

// --- MATH HELPERS (ROBUST) ---

// Helper to map TradingStyle (Enum) to Strategy ID (Context)
function getStrategyId(style: TradingStyle): string {
    switch (style) {
        case 'SCALP_AGRESSIVE': return 'quant_volatility';
        case 'SWING_INSTITUTIONAL': return 'smc_liquidity';
        case 'ICHIMOKU_CLOUD': return 'ichimoku_dragon';
        case 'MEME_SCALP': return 'meme_hunter';
        case 'BREAKOUT_MOMENTUM': return 'breakout_momentum';
        default: return (style as string).toLowerCase();
    }
}

/**
 * Aplica filtros macroeconómicos al score de una señal
 * @param baseScore - Score original de la estrategia (0-100)
            if (candles.length < 200) return; // Need deeper history for EMA 200
 
            const prices = candles.map(c => c.close);
            const volumes = candles.map(c => c.volume);
            const highs = candles.map(c => c.high);
            const lows = candles.map(c => c.low);
 
            let score = 0;
            let detectionNote = "";
            let signalSide: 'LONG' | 'SHORT' = 'LONG'; // Default
 
            // Educational Metrics to pass to UI
            let specificTrigger = "";
            let structureNote = "";
 
            // Use Closed Candle for Confirmation (No Repainting)
            const checkIndex = prices.length - 2;
 
            // CALCULATE NEW PRECISION METRICS FOR SCANNER
            const vwap = calculateCumulativeVWAP(highs, lows, prices, volumes);
            const stochRsi = calculateStochRSI(prices, 14);
            const rsi = calculateRSI(prices.slice(0, checkIndex + 1), 14);
            const fibs = calculateAutoFibs(highs, lows, calculateEMA(prices, 200));
            const ema200 = calculateEMA(prices.slice(0, checkIndex + 1), 200);
            const currentPrice = prices[checkIndex];
            const avgVol = calculateSMA(volumes, 20);
                    metrics: {
                        rvol: format(rvol),
                        rsi: format(rsi),
                        vwapDist: format(vwapDist),
                        structure: structureNote,
                        specificTrigger: specificTrigger
                    }
                };
 
                validMathCandidates.push(mathOpp);
            }
 
        } catch (e) { return null; }
    }));
 
    // Return pure math results instantly
    return validMathCandidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
};
 
// --- MATH HELPERS (ROBUST) ---
 
// Helper to map TradingStyle (Enum) to Strategy ID (Context)
function getStrategyId(style: TradingStyle): string {
    switch (style) {
        case 'SCALP_AGRESSIVE': return 'quant_volatility';
        case 'SWING_INSTITUTIONAL': return 'smc_liquidity';
        case 'ICHIMOKU_CLOUD': return 'ichimoku_dragon';
        case 'MEME_SCALP': return 'meme_hunter';
        case 'BREAKOUT_MOMENTUM': return 'breakout_momentum';
        default: return (style as string).toLowerCase();
    }
}
 
/**
 * Aplica filtros macroeconómicos al score de una señal
 * @param baseScore - Score original de la estrategia (0-100)
 * @param symbol - Símbolo del activo (ej: "BTC/USDT")
 * @param signalSide - Dirección de la señal ('LONG' | 'SHORT')
 * @param macro - Contexto macroeconómico
 * @returns Score ajustado por correlaciones macro
 */
function applyMacroFilters(
    baseScore: number,
    symbol: string,
    signalSide: 'LONG' | 'SHORT',
    macro: MacroContext
): number {
    let adjustedScore = baseScore;
    const isBTC = symbol === 'BTC/USDT' || symbol === 'BTCUSDT';

    // --- REGLA 0: PRECAUCIÓN EN VOLATILIDAD EXTREMA (Ajustado: No kill switch total) ---
    // Si hay mucha volatilidad pero sin dirección clara, reducir confianza pero no eliminar
    if (macro.btcRegime.volatilityStatus === 'HIGH' && macro.btcRegime.regime === 'RANGE') {
        console.log(`[MacroFilter] Alta volatilidad en rango para ${symbol}: Reduciendo confianza`);
        adjustedScore *= 0.7; // Reducción moderada (antes era kill switch total)
    }

    // --- REGLA 1: Régimen de BTC afecta a TODAS las altcoins (Ajustado: Menos agresivo) ---
    if (!isBTC && signalSide === 'LONG') {
        if (macro.btcRegime.regime === 'BEAR') {
            adjustedScore *= 0.7; // Penalizar moderadamente (antes 0.5x era muy agresivo)
        } else if (macro.btcRegime.regime === 'RANGE') {
            adjustedScore *= 0.9; // Penalización leve (antes 0.85x)
        }
    }

    // --- REGLA 2: BTC Dominance (Rotación de Capital) - Ajustado ---
    if (!isBTC) {
        const { trend, current } = macro.btcDominance;
        if (trend === 'RISING' || current > 55) {
            adjustedScore *= 0.85; // Capital fluyendo a BTC (antes 0.75x era muy agresivo)
        } else if (trend === 'FALLING' && current < 50) {
            adjustedScore *= 1.15; // Alt season
        }
    }

    // --- REGLA 3: USDT Dominance (Correlación Inversa / Miedo) - Ajustado ---
    // Si USDT.D sube, el mercado cripto baja (Flight to stablecoins)
    if (macro.usdtDominance.trend === 'RISING') {
        if (signalSide === 'LONG') {
            adjustedScore *= 0.75; // Precaución en LONGs (antes 0.6x era muy agresivo)
        } else {
            adjustedScore *= 1.2; // Buen momento para SHORT
        }
    }

    // --- REGLA 4: SNIPER SHORTS (La recomendación del experto) ---
    // En Bear Market + BTC.D subiendo (o USDT.D subiendo), los shorts en Alts son oro.
    if (!isBTC && signalSide === 'SHORT') {
        const isBearishContext = macro.btcRegime.regime === 'BEAR';
        const liquidityDraining = macro.btcDominance.trend === 'RISING' || macro.usdtDominance.trend === 'RISING';

        if (isBearishContext && liquidityDraining) {
            adjustedScore *= 1.5; // Boost agresivo
        }
    }

    // --- REGLA 5: BTC Específico ---
    if (isBTC && signalSide === 'LONG') {
        if (macro.btcRegime.regime === 'BEAR') adjustedScore *= 0.7;
        else if (macro.btcRegime.regime === 'BULL') adjustedScore *= 1.1;
    }

    return Math.min(adjustedScore, 100);
}
