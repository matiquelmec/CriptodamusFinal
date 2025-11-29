
import { MarketData, FearAndGreedData, AIOpportunity, TradingStyle, TechnicalIndicators, MarketRisk } from '../types';
import { hasActiveSession } from './geminiService';
import { analyzeIchimoku } from './strategies/IchimokuAdapter';
import { analyzeMemeSignal } from './strategies/MemeStrategy';
import { analyzeSwingSignal } from './strategies/SwingStrategy';
import { analyzeBreakoutSignal } from './strategies/BreakoutStrategy';
import { analyzeScalpSignal } from './strategies/ScalpStrategy';
import {
    detectBullishDivergence, calculateIchimokuLines, calculateIchimokuCloud,
    calculateBollingerStats, calculateSMA, calculateEMA, calculateMACD,
    calculateEMAArray, calculateStdDev, calculateRSI, calculateStochRSI,
    calculateRSIArray, calculateCumulativeVWAP, calculateAutoFibs,
    calculateATR, calculateADX, calculatePivotPoints, formatVolume
} from './mathUtils';

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
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 4000) => {
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

        // Ignored symbols
        const ignoredPatterns = ['USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'USDPUSDT', 'EURUSDT', 'DAIUSDT', 'BUSDUSDT', 'UPUSDT', 'DOWNUSDT', 'BULLUSDT', 'BEARUSDT', 'USDT', 'PAXGUSDT'];

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
        const validStreams = marketData.map(m => `${m.id.toLowerCase()}@miniTicker`);
        const url = `${BINANCE_WS_BASE}${validStreams.join('/')}`;
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

export const getMacroData = async (): Promise<string> => {
    try {
        const globalRes = await fetchWithTimeout('https://api.coincap.io/v2/global', {}, 3000);
        let btcDominance = "Unknown";
        if (globalRes.ok) {
            const data = await globalRes.json();
            btcDominance = parseFloat(data.data.bitcoinDominancePercentage).toFixed(2);
        }
        return `CONTEXTO MACROECONÓMICO: Dominancia Bitcoin: ${btcDominance}%`;
    } catch (e) {
        return "Macro Data Unavailable";
    }
};

export const getMarketContextForAI = async (): Promise<string> => {
    return getMacroData();
};

// --- TECHNICAL ANALYSIS ENGINE ---

const fetchCandles = async (symbolId: string, interval: string): Promise<{ close: number, volume: number, high: number, low: number, open: number }[]> => {
    const isBinance = symbolId === symbolId.toUpperCase() && symbolId.endsWith('USDT');

    try {
        if (isBinance) {
            // Fetching 205 candles to ensure deep data for EMA200 calculation
            const res = await fetchWithTimeout(`${BINANCE_API_BASE}/klines?symbol=${symbolId}&interval=${interval}&limit=205`, {}, 4000);
            if (!res.ok) throw new Error("Binance Candle Error");
            const data = await res.json();
            return data.map((d: any[]) => ({
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4]),
                volume: parseFloat(d[5])
            }));
        } else {
            const ccInterval = interval === '15m' ? 'm15' : 'h1';
            const res = await fetchWithTimeout(`${COINCAP_API_BASE}/candles?exchange=binance&interval=${ccInterval}&baseId=${symbolId}&quoteId=tether`, {}, 4000);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data.map((d: any) => ({
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
                    const ccInterval = interval === '15m' ? 'm15' : 'h1';
                    const res = await fetchWithTimeout(`${COINCAP_API_BASE}/candles?exchange=binance&interval=${ccInterval}&baseId=${fallbackId}&quoteId=tether`, {}, 4000);
                    if (!res.ok) return [];
                    const json = await res.json();
                    return json.data.map((d: any) => ({
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

const mapBinanceToCoinCap = (symbol: string) => {
    const map: Record<string, string> = { 'BTCUSDT': 'bitcoin', 'ETHUSDT': 'ethereum', 'SOLUSDT': 'solana', 'DOGEUSDT': 'dogecoin', 'BNBUSDT': 'binance-coin', 'XRPUSDT': 'xrp', 'ADAUSDT': 'cardano' };
    return map[symbol];
}

// NEW: Returns STRUCTURED DATA for the AI (No String parsing needed)
export const getRawTechnicalIndicators = async (symbolDisplay: string): Promise<TechnicalIndicators | null> => {
    const rawSymbol = symbolDisplay.replace('/USDT', '');
    const binanceSymbol = `${rawSymbol}USDT`;

    try {
        const candles = await fetchCandles(binanceSymbol, '15m');
        if (candles.length < 50) return null;

        const prices = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);

        // Calcs
        const currentPrice = prices[prices.length - 1];
        const rsi = calculateRSI(prices, 14);
        const stochRsi = calculateStochRSI(prices, 14); // NEW
        const adx = calculateADX(highs, lows, prices, 14);
        const atr = calculateATR(highs, lows, prices, 14);
        const ema20 = calculateEMA(prices, 20);
        const ema50 = calculateEMA(prices, 50);
        const ema100 = calculateEMA(prices, 100);
        const ema200 = calculateEMA(prices, 200);
        const vwap = calculateCumulativeVWAP(highs, lows, prices, volumes); // NEW

        const avgVol = calculateSMA(volumes, 20);
        const rvol = avgVol > 0 ? (volumes[volumes.length - 1] / avgVol) : 0;

        const macd = calculateMACD(prices);
        const pivots = calculatePivotPoints(highs, lows, prices);
        const bb = calculateBollingerStats(prices);
        const fibs = calculateAutoFibs(highs, lows, ema200); // NEW

        // Determine Alignment
        let emaAlignment: 'BULLISH' | 'BEARISH' | 'CHAOTIC' = 'CHAOTIC';
        if (ema20 > ema50 && ema50 > ema100 && ema100 > ema200) emaAlignment = 'BULLISH';
        if (ema20 < ema50 && ema50 < ema100 && ema100 < ema200) emaAlignment = 'BEARISH';

        return {
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
            fibonacci: fibs,
            trendStatus: {
                emaAlignment,
                goldenCross: ema50 > ema200,
                deathCross: ema50 < ema200
            }
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

    if (!market || market.length === 0) throw new Error("No market data available");

    // Scan all candidates if Memes (usually < 40), or top 40 for general
    const topCandidates = style === 'MEME_SCALP' ? market : market.slice(0, 40);

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
            const fibs = calculateAutoFibs(highs, lows, calculateEMA(prices, 200));
            const ema200 = calculateEMA(prices.slice(0, checkIndex + 1), 200);
            const currentPrice = prices[checkIndex];
            const avgVol = calculateSMA(volumes, 20);
            const rvol = avgVol > 0 ? (volumes[checkIndex] / avgVol) : 0;

            // Common structure check
            const trendDist = ((currentPrice - ema200) / ema200) * 100;
            structureNote = trendDist > 0 ? `Tendencia Alcista (+${trendDist.toFixed(1)}% sobre EMA200)` : `Tendencia Bajista (${trendDist.toFixed(1)}% bajo EMA200)`;

            // --- DETERMINISTIC MATH DETECTORS ---

            if (style === 'MEME_SCALP') {
                // MEME HUNTER LOGIC
                const memeResult = analyzeMemeSignal(prices.slice(0, checkIndex + 1), vwap, rvol, rsi, stochRsi);

                if (memeResult) {
                    score = memeResult.score;
                    signalSide = memeResult.signalSide;
                    detectionNote = memeResult.detectionNote;
                    specificTrigger = memeResult.specificTrigger;
                }

            } else if (style === 'ICHIMOKU_CLOUD') {
                // USANDO EL CEREBRO REAL DE ICHIMOKU (Refactorizado)
                const ichimokuResult = analyzeIchimoku(highs, lows, prices);

                if (ichimokuResult) {
                    score = ichimokuResult.score;
                    signalSide = ichimokuResult.signalSide;
                    detectionNote = ichimokuResult.detectionNote;
                    specificTrigger = ichimokuResult.specificTrigger;
                }

            } else if (style === 'SWING_INSTITUTIONAL') {
                const swingResult = analyzeSwingSignal(
                    prices.slice(0, checkIndex + 1),
                    highs.slice(0, checkIndex + 1),
                    lows.slice(0, checkIndex + 1),
                    fibs
                );

                if (swingResult) {
                    score = swingResult.score;
                    signalSide = swingResult.signalSide;
                    detectionNote = swingResult.detectionNote;
                    specificTrigger = swingResult.specificTrigger;
                }

            } else if (style === 'BREAKOUT_MOMENTUM') {
                // DONCHIAN CHANNEL LOGIC (20 Periods)
                const breakoutResult = analyzeBreakoutSignal(
                    prices.slice(0, checkIndex + 1),
                    highs.slice(0, checkIndex + 1),
                    lows.slice(0, checkIndex + 1),
                    rvol
                );

                if (breakoutResult) {
                    score = breakoutResult.score;
                    signalSide = breakoutResult.signalSide;
                    detectionNote = breakoutResult.detectionNote;
                    specificTrigger = breakoutResult.specificTrigger;
                }

            } else {
                // SCALP (Default)
                const scalpResult = analyzeScalpSignal(prices.slice(0, checkIndex + 1), vwap, rsi);

                if (scalpResult) {
                    score = scalpResult.score;
                    signalSide = scalpResult.signalSide;
                    detectionNote = scalpResult.detectionNote;
                    specificTrigger = scalpResult.specificTrigger;
                }
            }

            // --- FILTERING BY RISK ---
            // If Risk is High (News OR Manipulation), we only accept VERY high scores
            const threshold = isHighRisk ? 85 : 70;

            // --- BUILD MATH OPPORTUNITY (AUTONOMOUS) ---
            if (score >= threshold) {
                const livePrice = prices[prices.length - 1]; // Use live price for entry
                const atr = calculateATR(highs, lows, prices, 14);

                // Algorithmic SL/TP Calculation (Exact Maths)
                let sl = 0;
                let tp1 = 0, tp2 = 0, tp3 = 0;

                const slMult = style === 'MEME_SCALP' ? 2.5 : (interval === '15m' ? 1.5 : 2.0);

                if (signalSide === 'LONG') {
                    sl = livePrice - (atr * slMult);
                    const risk = livePrice - sl;
                    tp1 = livePrice + risk;
                    tp2 = livePrice + (risk * 2);
                    tp3 = livePrice + (risk * 3);
                } else {
                    sl = livePrice + (atr * slMult);
                    const risk = sl - livePrice;
                    tp1 = livePrice - risk;
                    tp2 = livePrice - (risk * 2);
                    tp3 = livePrice - (risk * 3);
                }

                const decimals = livePrice > 1000 ? 2 : livePrice > 1 ? 4 : 6;
                const format = (n: number) => parseFloat(n.toFixed(decimals));

                const finalNote = isHighRisk ? `[⚠️ RIESGO ALTO] ${detectionNote}` : detectionNote;

                // VWAP Dist % calculation
                const vwapDist = ((livePrice - vwap) / vwap) * 100;

                const mathOpp: AIOpportunity = {
                    id: Date.now().toString() + Math.random(),
                    symbol: coin.symbol,
                    timestamp: Date.now(),
                    strategy: getStrategyId(style), // FIXED: Map to correct ID for UI
                    side: signalSide,
                    confidenceScore: Math.floor(score),
                    entryZone: { min: format(livePrice * 0.999), max: format(livePrice * 1.001) },
                    dcaLevel: signalSide === 'LONG' ? format(livePrice - (atr * 0.5)) : format(livePrice + (atr * 0.5)),
                    stopLoss: format(sl),
                    takeProfits: { tp1: format(tp1), tp2: format(tp2), tp3: format(tp3) },
                    technicalReasoning: finalNote,
                    invalidated: false,
                    // NEW: METRICS POPULATION
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
};