/**
 * PIPELINE STAGE 2: INDICATOR CALCULATOR
 * 
 * Responsible for transforming raw price candles into advanced technical indicators.
 * Uses mathUtils.ts for the heavy lifting but orchestrates the data preparation.
 */

import {
    calculateRSI, calculateMACD, calculateBollingerStats,
    calculateSlope, calculateATR, calculateZScore,
    calculateAutoFibs, calculateStochRSI, calculateIchimokuCloud,
    calculateFractals, detectNPattern, calculateBoxTheory,
    detectBullishDivergence, calculateEMA,
    calculateCVD, detectCVDDivergence // NEW: Order Flow
} from '../../mathUtils';
import { detectChartPatterns } from '../../chartPatterns';
import { TradingConfig } from '../../../config/tradingConfig';
import { TechnicalIndicators } from '../../../types';

export class IndicatorCalculator {

    /**
     * Compute all technical indicators for a given set of candles
     * @param symbol - The trading pair symbol
     * @param candles - Array of candles { open, high, low, close, volume }
     */
    static compute(symbol: string, candles: any[]): TechnicalIndicators {
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const closes = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        // Extract Taker Buy Volume (or 0.5 * Volume if missing) for CVD
        const takerBuyVolumes = candles.map(c => c.takerBuyBaseVolume || (c.volume * 0.5));

        // 1. Basic Indicators (RSI, MACD, BB)
        const rsi = calculateRSI(closes, TradingConfig.indicators.rsi.period);
        const macdRaw = calculateMACD(closes,
            TradingConfig.indicators.macd.fast,
            TradingConfig.indicators.macd.slow,
            TradingConfig.indicators.macd.signal
        );
        const macd = {
            line: macdRaw.macdLine,
            signal: macdRaw.signalLine,
            histogram: macdRaw.histogram
        };
        const bb = calculateBollingerStats(closes,
            TradingConfig.indicators.bollinger.period,
            TradingConfig.indicators.bollinger.std_dev
        );

        const ema20 = calculateEMA(closes, 20);
        const ema50 = calculateEMA(closes, 50);
        const ema100 = calculateEMA(closes, 100);
        const ema200 = calculateEMA(closes, 200);

        // 2. Advanced Indicators (ATR, Z-Score, Slope)
        const atr = calculateATR(highs, lows, closes, 14);
        const zScore = calculateZScore(closes, bb.sma, 20); // Using BB SMA (20) as baseline for Z
        const emaSlope = calculateSlope(closes, 10); // 10-period slope

        // 3. Institutional Levels (Fibs, Order Blocks - approximated via Fractal Highs/Lows)
        // Note: Full Order Block detection requires the volumeExpertService, which is a separate pipeline stage.
        // Here we calculate the "Auto Fibs" which are fractal-based.
        const fibLevels = calculateAutoFibs(highs, lows, bb.sma); // Passing SMA/EMA approximation 

        // 4. Pattern Detection

        // Simple Chart Pattern logic (e.g. N-Pattern)
        const nPattern = detectNPattern(highs, lows, closes);
        const boxTheory = calculateBoxTheory(highs, lows, closes);

        // 5. Derived Computations
        const stochRsi = calculateStochRSI(closes, 14);
        const ichimoku = calculateIchimokuCloud(highs, lows);

        // Chart Patterns (Institutional)
        const chartPatterns = detectChartPatterns(highs, lows, closes, volumes);

        // Trend Status Calculation
        let emaAlignment: 'BULLISH' | 'BEARISH' | 'CHAOTIC' = 'CHAOTIC';
        if (ema20 > ema50 && ema50 > ema100 && ema100 > ema200) emaAlignment = 'BULLISH';
        else if (ema20 < ema50 && ema50 < ema100 && ema100 < ema200) emaAlignment = 'BEARISH';

        // Crosses (using current candle values)
        const goldenCross = ema50 > ema200 && (closes.length > 1 ? calculateEMA(closes.slice(0, -1), 50) <= calculateEMA(closes.slice(0, -1), 200) : false);
        const deathCross = ema50 < ema200 && (closes.length > 1 ? calculateEMA(closes.slice(0, -1), 50) >= calculateEMA(closes.slice(0, -1), 200) : false);
        // Note: Full historical cross check requires arrays, here we check simple current state or immediate cross if we had previous values. 
        // For efficiency, we simplistically flag if 50 > 200 as Gold-ish state or rely on dedicated crossover detector if needed. 
        // Let's stick to state:
        const isGoldenState = ema50 > ema200;
        const isDeathState = ema50 < ema200;


        // Divergence Check (Heavy)
        // Need RSI Array for divergence, calculateRSI returns single value, 
        // need to refactor or use internal helper if we want array.
        // Assuming mathUtils has a helper or we re-calc implementation:
        // For now, we use the detected flag from a specialized check if available.
        // Let's implement a quick RSI array generator for divergence check
        // Note: compute() should stay relatively fast.

        // Note: compute() should stay relatively fast.

        // 6. ORDER FLOW (CVD)
        const cvdLine = calculateCVD(volumes, takerBuyVolumes);
        const cvdDivergence = detectCVDDivergence(closes, cvdLine, lows, highs);

        return {
            symbol: symbol,
            price: closes[closes.length - 1],
            rvol: 0, // Calculated later or needs mathUtils support
            technicalReasoning: "",
            invalidated: false,
            trendStatus: {
                emaAlignment,
                goldenCross: isGoldenState, // Simplified for state
                deathCross: isDeathState
            },
            rsi,
            macd,
            bollinger: { // Renamed from bollingerBands
                upper: bb.upper,
                lower: bb.lower,
                middle: bb.sma,
                bandwidth: bb.bandwidth // approx
            },
            pivots: { // Renamed from pivotPoints
                p: 0, r1: 0, s1: 0, r2: 0, s2: 0 // Ideally calculated from Daily candles, might be missing here if only providing 4h/1h
            },
            adx: 0, // Expensive, enable if needed
            atr,
            vwap: 0, // Requires clean session data
            ema20,
            ema50,
            ema100,
            ema200,
            stochRsi,
            zScore,
            emaSlope,

            fibonacci: fibLevels, // Renamed to match interface
            ichimokuData: {
                tenkan: ichimoku.tenkan,
                kijun: ichimoku.kijun,
                senkouA: ichimoku.senkouA,
                senkouB: ichimoku.senkouB,
                chikou: closes[closes.length - 26] || closes[closes.length - 1], // Lagging span approx
                currentPrice: closes[closes.length - 1],
                chikouSpanFree: true, // Default
                chikouDirection: 'NEUTRAL',
                futureCloud: ichimoku.senkouA > ichimoku.senkouB ? 'BULLISH' : 'BEARISH',
                cloudThickness: Math.abs((ichimoku.senkouA - ichimoku.senkouB) / ichimoku.senkouB) * 100,
                priceVsKijun: 0,
                tkSeparation: 0
            },

            // Custom additions for our pipeline
            nPattern,
            boxTheory,
            chartPatterns, // NEW: Active
            cvd: cvdLine, // NEW
            cvdDivergence // NEW
        }; // Casting valid by structure now
    }
}
