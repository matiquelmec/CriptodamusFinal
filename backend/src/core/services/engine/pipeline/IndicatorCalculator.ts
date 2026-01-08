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
    calculateCVD, detectCVDDivergence, // NEW: Order Flow
    calculateADX, calculateCumulativeVWAP, calculatePivotPoints, calculateRSIArray, calculateRVOL // NEW: God Mode Imports
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

        // GOD MODE: Activated Real Calculations
        const adx = calculateADX(highs, lows, closes, 14);
        const vwap = calculateCumulativeVWAP(highs, lows, closes, volumes);
        const pivots = calculatePivotPoints(highs, lows, closes);

        // 3. Institutional Levels (Fibs, Order Blocks - approximated via Fractal Highs/Lows)
        const fibLevels = calculateAutoFibs(highs, lows, bb.sma);

        // 4. Pattern Detection
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
        const isGoldenState = ema50 > ema200;
        const isDeathState = ema50 < ema200;
        const goldenCross = ema50 > ema200 && (closes.length > 1 ? calculateEMA(closes.slice(0, -1), 50) <= calculateEMA(closes.slice(0, -1), 200) : false);
        const deathCross = ema50 < ema200 && (closes.length > 1 ? calculateEMA(closes.slice(0, -1), 50) >= calculateEMA(closes.slice(0, -1), 200) : false);


        // Divergence Check (Heavy)
        const rsiArray = calculateRSIArray(closes, 14);
        const rsiDivergence: TechnicalIndicators['rsiDivergence'] = detectBullishDivergence(closes, rsiArray, lows) ?
            { type: 'BULLISH', strength: 0.8, description: 'RSI Bullish Divergence' } as any : null;

        // 6. ORDER FLOW (CVD) & STRUCTURE
        const cvd = calculateCVD(volumes, takerBuyVolumes);
        const cvdDivergence = detectCVDDivergence(closes, cvd, lows, highs);
        const fractals = calculateFractals(highs, lows);

        return {
            symbol,
            price: closes[closes.length - 1],
            // --- Basic ---
            rsi,
            adx,
            // ema9 not in type
            ema20,
            ema50,
            ema100,
            ema200,
            macd,
            bollinger: {
                upper: bb.upper,
                lower: bb.lower,
                middle: bb.sma,
                bandwidth: bb.bandwidth
            },

            // --- Detailed Moving Averages ---
            sma5: calculateEMA(closes, 5),
            sma10: calculateEMA(closes, 10),
            sma30: calculateEMA(closes, 30),

            // --- Advanced ---
            atr,
            zScore,
            emaSlope,
            vwap,
            pivots,
            fibonacci: fibLevels,

            // --- Ichimoku ---
            ichimokuData: {
                tenkan: ichimoku.tenkan,
                kijun: ichimoku.kijun,
                senkouA: ichimoku.senkouA,
                senkouB: ichimoku.senkouB,
                chikou: closes[closes.length - 26] || closes[closes.length - 1],
                currentPrice: closes[closes.length - 1],
                chikouSpanFree: true,
                chikouDirection: 'NEUTRAL',
                futureCloud: ichimoku.senkouA > ichimoku.senkouB ? 'BULLISH' : 'BEARISH',
                cloudThickness: Math.abs((ichimoku.senkouA - ichimoku.senkouB) / ichimoku.senkouB) * 100,
                priceVsKijun: 0,
                tkSeparation: 0
            },
            // ichimoku: removed (not in type)

            // --- Patterns & Structure (SMC) ---
            nPattern,
            boxTheory,
            chartPatterns,
            fractals: {
                bullish: fractals.fractalLows.map(f => f.price),
                bearish: fractals.fractalHighs.map(f => f.price)
            },

            // --- Order Flow ---
            cvd, // NEW
            cvdDivergence, // NEW
            rsiDivergence,

            // --- Analysis Meta ---
            rvol: calculateRVOL(volumes, 20),
            rsiFreeze: calculateRSI(closes, 9),
            stochRsi,
            technicalReasoning: "Calculated via IndicatorCalculator",
            invalidated: false,
            trendStatus: {
                emaAlignment,
                goldenCross,
                deathCross
            }
        };
    }
}
