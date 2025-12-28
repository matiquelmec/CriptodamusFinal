/**
 * PIPELINE STAGE 2.5: ADVANCED ANALYZER
 * 
 * Computes heavy institutional metrics:
 * - Volume Profile (POC, VAH, VAL)
 * - Order Blocks (Smart Money Concepts)
 * - Fair Value Gaps (FVG)
 * 
 * This is separated from InspectorCalculator to allow for potential 
 * separate thread offloading in the future.
 */

import { calculateVolumeProfile } from '../../volumeProfile';
import { detectOrderBlocks } from '../../orderBlocks';
import { detectFVG } from '../../fairValueGaps';
import { calculatePOIs } from '../../confluenceEngine';
import { getExpertVolumeAnalysis } from '../../volumeExpertService';
import { detectGenericDivergence } from '../../divergenceDetector';
import { analyzeRSIExpert } from '../../rsiExpert';

export class AdvancedAnalyzer {

    static async compute(
        symbol: string,
        candles: any[],
        atr: number,
        currentPrice: number,
        fibs: any,
        pivots: any,
        ema200: number,
        ema50: number
    ) {
        // 1. Institutional Structures (Safe Wrapped)
        let volumeProfile, bullishOB, bearishOB, bullishFVG, bearishFVG;
        try {
            volumeProfile = calculateVolumeProfile(candles, atr);
            const obs = detectOrderBlocks(candles, atr, currentPrice);
            bullishOB = obs.bullishOB;
            bearishOB = obs.bearishOB;
            const fvgs = detectFVG(candles, atr, currentPrice);
            bullishFVG = fvgs.bullishFVG;
            bearishFVG = fvgs.bearishFVG;
        } catch (err) {
            console.warn(`[AdvancedAnalyzer] Error calculating structures for ${symbol}`, err);
            volumeProfile = { poc: 0, valueAreaHigh: 0, valueAreaLow: 0, totalVolume: 0 };
            bullishOB = []; bearishOB = []; bullishFVG = []; bearishFVG = [];
        }

        // 2. Expert Volume (Async/External)
        // We handle this gracefully if it fails (not blocking)
        // Note: In the original scanner, rvol check happened before this.
        // We will assume the caller checks rvol constraints if needed for performance.
        let volumeExpert = undefined;
        let cvdDivergence = undefined;
        try {
            volumeExpert = await getExpertVolumeAnalysis(symbol).catch(() => undefined);

            // CVD Divergence Check
            if (volumeExpert?.cvd?.cvdSeries && volumeExpert?.cvd?.priceSeries) {
                const mockCandles = volumeExpert.cvd.priceSeries.map((p: number) => ({ high: p, low: p, close: p }));
                const cvdValues = volumeExpert.cvd.cvdSeries;
                cvdDivergence = detectGenericDivergence(mockCandles, cvdValues, 'CVD', 5);
                if (cvdDivergence) {
                    volumeExpert.cvd.divergence = cvdDivergence.type;
                }
            }
        } catch (e) { }

        // 3. RSI Expert
        const prices = candles.map(c => c.close);
        // We need RSI Array. IndicatorCalculator calculated single value.
        // For efficiency, we should have calculated the array once and passed it.
        // Ideally IndicatorCalculator returns the array too or we re-calc here.
        // Re-calc specific for Expert module to keep it decoupled for now.
        const rsiArray = (await import('../../mathUtils')).calculateRSIArray(prices, 14);
        const rsiExpertResults = analyzeRSIExpert(prices, rsiArray);


        // 4. Confluence
        const confluence = calculatePOIs(
            currentPrice, fibs, pivots, ema200, ema50, atr,
            volumeProfile, bullishOB, bearishOB, bullishFVG, bearishFVG
        );

        return {
            volumeProfile,
            orderBlocks: { bullish: bullishOB, bearish: bearishOB },
            fairValueGaps: { bullish: bullishFVG, bearish: bearishFVG },
            volumeExpert,
            confluence,
            rsiExpert: {
                range: rsiExpertResults.range.type,
                target: rsiExpertResults.reversalTarget?.active ? rsiExpertResults.reversalTarget.targetPrice : null,
                targetType: rsiExpertResults.reversalTarget?.type || null
            },
            cvdDivergence: cvdDivergence?.type // string description
        };
    }
}
