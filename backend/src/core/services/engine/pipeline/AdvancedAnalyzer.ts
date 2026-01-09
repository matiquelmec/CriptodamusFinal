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
import { OrderBookAnalysis, LiquidationCluster } from '../../../types/types-advanced';
import { getExpertVolumeAnalysis } from '../../volumeExpertService';
import { detectGenericDivergence } from '../../divergenceDetector';
import { analyzeRSIExpert } from '../../rsiExpert';
import { detectHarmonicPatterns } from '../../harmonicDetector';
import { detectChartPatterns } from '../../chartPatterns';

export class AdvancedAnalyzer {

    static async compute(
        symbol: string,
        candles: any[],
        atr: number,
        currentPrice: number,
        fibs: any,
        pivots: any,
        ema200: number,
        ema50: number,
        harmonicPatterns: any[] = [],
        orderBook?: OrderBookAnalysis,
        liquidationClusters: LiquidationCluster[] = []
    ) {
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const closes = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);

        // 1. Institutional Structures (Safe Wrapped)
        let volumeProfile: any, bullishOB: any[] = [], bearishOB: any[] = [], bullishFVG: any[] = [], bearishFVG: any[] = [];
        let harmonics: any[] = [], structuralPatterns: any[] = [];

        try {
            volumeProfile = calculateVolumeProfile(candles, atr);
            const obs = detectOrderBlocks(candles, atr, currentPrice);
            bullishOB = obs.bullishOB;
            bearishOB = obs.bearishOB;
            const fvgs = detectFVG(candles, atr, currentPrice);
            bullishFVG = fvgs.bullishFVG;
            bearishFVG = fvgs.bearishFVG;

            // AWAKENED: Geometric Layer
            harmonics = detectHarmonicPatterns(highs, lows);
            structuralPatterns = detectChartPatterns(highs, lows, closes, volumes);

        } catch (err) {
            console.warn(`[AdvancedAnalyzer] Error calculating structures for ${symbol}`, err);
            volumeProfile = { poc: 0, valueAreaHigh: 0, valueAreaLow: 0, totalVolume: 0 };
            bullishOB = []; bearishOB = []; bullishFVG = []; bearishFVG = [];
            harmonics = []; structuralPatterns = [];
        }

        // 2. Expert Volume (Async/External)
        // We handle this gracefully if it fails (not blocking)
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
        const rsiArray = (await import('../../mathUtils')).calculateRSIArray(prices, 14);
        const rsiExpertResults = analyzeRSIExpert(prices, rsiArray);


        // 4. Confluence
        const confluence = calculatePOIs(
            currentPrice, fibs, pivots, ema200, ema50, atr,
            volumeProfile, bullishOB, bearishOB, bullishFVG, bearishFVG,
            harmonics, orderBook, liquidationClusters, structuralPatterns
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
            cvdDivergence: cvdDivergence?.type, // string description
            chartPatterns: structuralPatterns,
            harmonics
        };
    }
}
