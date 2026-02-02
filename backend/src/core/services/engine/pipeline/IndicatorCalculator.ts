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
    detectBullishDivergence, detectBearishDivergence, calculateEMA,
    calculateCVD, detectCVDDivergence, // NEW: Order Flow
    calculateADX, calculateCumulativeVWAP, calculatePivotPoints, calculateRSIArray, calculateRVOL // NEW: God Mode Imports
} from '../../mathUtils';
import { detectChartPatterns } from '../../chartPatterns';
import { TradingConfig } from '../../../config/tradingConfig';
import { TechnicalIndicators } from '../../../types';
import { IndicatorIntegrityShield } from './IndicatorIntegrityShield'; // NEW: Integrity Shield
import { systemAlerts } from '../../../../services/systemAlertService';

export class IndicatorCalculator {

    /**
     * Compute all technical indicators for a given set of candles
     * @param symbol - The trading pair symbol
     * @param candles - Array of candles { open, high, low, close, volume }
     */
    static compute(symbol: string, candles: any[]): TechnicalIndicators {
        // --- STAGE 0: INPUT INTEGRITY ---
        const MIN_CANDLES = 150; // Required for reliable EMA200
        if (!candles || candles.length < MIN_CANDLES) {
            console.warn(`[Calculator] ⚠️ INSUFFICIENT DATA for ${symbol}: ${candles?.length || 0}/${MIN_CANDLES} candles.`);
            return this.createPlaceholderIndicators(symbol, `INSUFFICIENT_DATA_${candles?.length}`);
        }

        try {
            const highs = candles.map(c => Number(c.high));
            const lows = candles.map(c => Number(c.low));
            const closes = candles.map(c => Number(c.close));
            const volumes = candles.map(c => Number(c.volume));
            // Extract Taker Buy Volume (or 0.5 * Volume if missing) for CVD
            const takerBuyVolumes = candles.map(c => Number(c.takerBuyBaseVolume || (c.volume * 0.5)));

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
            let rsiDivergence: TechnicalIndicators['rsiDivergence'] = null;

            if (detectBullishDivergence(closes, rsiArray, lows)) {
                rsiDivergence = { type: 'BULLISH', strength: 0.8, description: 'RSI Bullish Divergence' } as any;
            } else if (detectBearishDivergence(closes, rsiArray, highs)) {
                rsiDivergence = { type: 'BEARISH', strength: 0.8, description: 'RSI Bearish Divergence' } as any;
            }

            // 6. ORDER FLOW (CVD) & STRUCTURE
            const cvd = calculateCVD(volumes, takerBuyVolumes);
            const cvdDivergence = detectCVDDivergence(closes, cvd, lows, highs);
            const fractals = calculateFractals(highs, lows);

            const finalIndicators: TechnicalIndicators = {
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
                    chikouSpanFree: (closes[closes.length - 1] > Math.max(ichimoku.senkouA, ichimoku.senkouB)) || (closes[closes.length - 1] < Math.min(ichimoku.senkouA, ichimoku.senkouB)),
                    chikouDirection: closes[closes.length - 1] > (closes[closes.length - 26] || 0) ? 'BULLISH' : 'BEARISH',
                    futureCloud: ichimoku.senkouA > ichimoku.senkouB ? 'BULLISH' : 'BEARISH',
                    cloudThickness: Math.abs((ichimoku.senkouA - ichimoku.senkouB) / (ichimoku.senkouB || 1.0)) * 100,
                    priceVsKijun: closes[closes.length - 1] - ichimoku.kijun,
                    tkSeparation: Math.abs(ichimoku.tenkan - ichimoku.kijun)
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

            // --- FINAL INTEGRITY AUDIT ---
            const shieldResult = IndicatorIntegrityShield.validate(finalIndicators);
            if (!shieldResult.isValid) {
                systemAlerts.logVeto(symbol, `INDICATOR_CORRUPTION: ${shieldResult.error}`, { indicators: finalIndicators });
                finalIndicators.invalidated = true;
                finalIndicators.technicalReasoning = `[SHIELD_REJECTED] ${shieldResult.error}`;
            }

            return finalIndicators;

        } catch (err: any) {
            systemAlerts.logAlert({
                symbol,
                severity: 'HIGH',
                category: 'CALCULATION_ERROR',
                message: `PIPELINE_ERROR: ${err.message}`
            });
            return this.createPlaceholderIndicators(symbol, `PIPELINE_ERROR: ${err.message}`);
        }
    }

    private static createPlaceholderIndicators(symbol: string, reason: string): TechnicalIndicators {
        return {
            symbol,
            price: 0,
            rsi: 50,
            adx: 0,
            ema20: 0,
            ema50: 0,
            ema100: 0,
            ema200: 0,
            macd: { line: 0, signal: 0, histogram: 0 },
            bollinger: { upper: 0, lower: 0, middle: 0, bandwidth: 0 },
            sma5: 0, sma10: 0, sma30: 0,
            atr: 0, zScore: 0, emaSlope: 0, vwap: 0, pivots: {} as any, fibonacci: {} as any,
            ichimokuData: {} as any,
            nPattern: { detected: false, type: 'BULLISH', entryPrice: 0, stopLoss: 0 },
            boxTheory: { active: false, high: 0, low: 0, level0_5: 0, signal: 'NEUTRAL' },
            chartPatterns: [],
            fractals: { bullish: [], bearish: [] },
            cvd: [],
            cvdDivergence: 'NONE' as any,
            rsiDivergence: null,
            rvol: 0,
            rsiFreeze: 50,
            stochRsi: { k: 50, d: 50 },
            technicalReasoning: `[SYSTEM_SHIELD] Rejected: ${reason}`,
            invalidated: true,
            trendStatus: { emaAlignment: 'CHAOTIC', goldenCross: false, deathCross: false }
        };
    }
}
