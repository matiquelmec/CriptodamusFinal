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
    calculateZScore, calculateSlope, calculateBoxTheory, detectNPattern // NEW: Freeze Utils
} from './mathUtils';
import { calculateVolumeProfile } from './volumeProfile';
import { detectOrderBlocks } from './orderBlocks';
import { HarmonicPattern, detectHarmonicPatterns } from './harmonicPatterns';
import { detectChartPatterns } from './chartPatterns'; // NEW
import { detectFVG } from './fairValueGaps';
import { calculatePOIs } from './confluenceEngine';
import { analyzeSessionContext, getCurrentSessionSimple } from './sessionExpert'; // NEW: Session Logic
import { detectMarketRegime } from './marketRegimeDetector';
import { detectGenericDivergence } from './divergenceDetector'; // NEW
import { selectStrategies } from './strategySelector';
import { calculateDCAPlan } from './dcaCalculator';
import { getExpertVolumeAnalysis } from './volumeExpertService'; // NEW: Expert Volume Service

// TERMINAL: Imported Modules (Phase 2 Refactor)
import {
    fetchCryptoData,
    fetchCandles,
    MEME_SYMBOLS
} from './api/binanceApi';
import {
    getMarketRisk,
    calculateFundamentalTier
} from './engine/riskEngine';
// NEW: Import logic from engine/scannerLogic
import { scanMarketOpportunities } from './engine/scannerLogic';

// Export functions that are used externally but not used internally in this file
export {
    subscribeToLivePrices,
    getFearAndGreedIndex,
    subscribeToSymbol
} from './api/binanceApi';

// Export functions that ARE imported and used internally
export { fetchCryptoData, fetchCandles, MEME_SYMBOLS };
export { getMarketRisk };
export { scanMarketOpportunities }; // Re-export for compatibility





// --- HELPER FUNCTIONS ---



// NEW: Market Risk Detector (Volatility & Manipulation Proxy)


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

        // NEW: Freeze Strategy Indicators
        const sma5 = calculateSMA(prices, 5);
        const sma10 = calculateSMA(prices, 10);
        const sma30 = calculateSMA(prices, 30);
        const rsiFreeze = calculateRSI(prices, 9); // RSI 9 for Freeze
        const boxTheory = calculateBoxTheory(highs, lows, prices);
        const nPattern = detectNPattern(highs, lows, prices);

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
        const rsiDivergence = detectGenericDivergence(candles, rsiArray, 'RSI'); // FIXED: Added missing variable
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
            rsiDivergence,  // NEW request: Regular RSI Divergence
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
            invalidated: false,

            // NEW: FREEZE STRATEGY DATA
            sma5,
            sma10,
            sma30,
            rsiFreeze,
            boxTheory,
            nPattern
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



// --- AUTONOMOUS QUANT ENGINE v4.0 (API INDEPENDENT) ---
// Logic moved to src/services/engine/scannerLogic.ts for Web Worker support


// --- MATH HELPERS (ROBUST) ---
