import { TechnicalIndicators, DivergenceType } from '../../types';
import { MarketRegime } from '../../types/types-advanced';

export interface FailedAuctionSignal {
    side: 'LONG' | 'SHORT' | 'NEUTRAL';
    confidence: number;
    reason: string;
}

/**
 * STRATEGY: FAILED AUCTION (SFP - Swing Failure Pattern)
 * Inspired by Fabio Valentino / AMT
 * 
 * Logic:
 * 1. Market must be in RANGING or EXTREME regime.
 * 2. Price breaks a key horizontal level (Range High/Low or Prev Day H/L).
 * 3. Immediate snap-back into range.
 * 4. Order Flow confirmation (Absorption or CVD snap-back).
 */
export function analyzeFailedAuction(
    indicators: TechnicalIndicators,
    regime: MarketRegime,
    currentPrice: number
): FailedAuctionSignal {
    const isRange = regime.regime === 'RANGING' || regime.regime === 'EXTREME';
    if (!isRange) return { side: 'NEUTRAL', confidence: 0, reason: "Market not in Range balance." };

    const { rsi, bollinger, pivots, volumeExpert } = indicators;
    const { poc, valueAreaHigh, valueAreaLow } = indicators.volumeProfile || { poc: 0, valueAreaHigh: 0, valueAreaLow: 0 };

    // 1. Detection: Looking for "Failed Auction" at range extremes
    const isAtHigh = currentPrice > valueAreaHigh * 0.99;
    const isAtLow = currentPrice < valueAreaLow * 1.01;

    // 2. Order Flow Evidence: Absorption (Sellers trapped at bottom or buyers at top)
    const absorption = volumeExpert?.cvd?.absorption;
    const cvdTrend = volumeExpert?.cvd?.trend;

    // 3. Setup: Failed Auction at Top (SFP SHORT)
    if (isAtHigh && (absorption === 'BEARISH' || cvdTrend === 'BEARISH')) {
        return {
            side: 'SHORT',
            confidence: 85,
            reason: `Failed Auction at High ($${valueAreaHigh.toFixed(2)}). Institutional absorption detected.`
        };
    }

    // 4. Setup: Failed Auction at Bottom (SFP LONG)
    if (isAtLow && (absorption === 'BULLISH' || cvdTrend === 'BULLISH')) {
        return {
            side: 'LONG',
            confidence: 85,
            reason: `Failed Auction at Low ($${valueAreaLow.toFixed(2)}). Institutional absorption detected.`
        };
    }

    return { side: 'NEUTRAL', confidence: 0, reason: "No Failed Auction pattern detected." };
}
