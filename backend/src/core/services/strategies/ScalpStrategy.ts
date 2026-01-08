
import { calculateBollingerStats } from '../mathUtils';
import { TechnicalIndicators } from '../../types';

export interface ScalpSignal {
    score: number;
    signalSide: 'LONG' | 'SHORT';
    detectionNote: string;
    specificTrigger: string;
}

export const analyzeScalpSignal = (
    prices: number[],
    indicators: TechnicalIndicators // Standardized Signature
): ScalpSignal | null => {
    const checkIndex = prices.length - 1;
    const currentPrice = prices[checkIndex];

    // Indicators
    const vwap = indicators.vwap;
    const rsi = indicators.rsi;
    const cvd = indicators.cvd; // Institutional Flow

    // SCALP: BOLLINGER SQUEEZE + MOMENTUM + VWAP
    const { bandwidth, sma: sma20 } = calculateBollingerStats(prices);

    const historicalBandwidths = [];
    // Look back 20-50 periods to find min bandwidth
    for (let i = 20; i < 50; i++) {
        if (checkIndex - i < 20) break; // Ensure we have at least 20 candles for Bollinger calc
        const slice = prices.slice(0, checkIndex + 1 - i);
        historicalBandwidths.push(calculateBollingerStats(slice).bandwidth);
    }

    if (historicalBandwidths.length === 0) return null;

    const minHistBandwidth = Math.min(...historicalBandwidths);

    // Allow slightly more breathing room (1.2x) because we have strict momentum filters now
    const isSqueeze = bandwidth <= minHistBandwidth * 1.2;

    if (isSqueeze) {
        // ROBUST FILTER: Price must be on the correct side of VWAP AND SMA20, with RSI supporting
        const isBullish = currentPrice > vwap && currentPrice > sma20 && rsi > 52;
        const isBearish = currentPrice < vwap && currentPrice < sma20 && rsi < 48;

        // INSTITUTIONAL FILTER: CVD Confirming Trend?
        let cvdAligned = true; // Default true if no data, be aggressive on scalps
        if (cvd && cvd.length > 5) {
            const cvdSlope = cvd[cvd.length - 1] - cvd[cvd.length - 5]; // 5 candle slope
            if (isBullish && cvdSlope < 0) cvdAligned = false; // Price Up, Money Out -> FAKE
            if (isBearish && cvdSlope > 0) cvdAligned = false;
        }

        if (isBullish && cvdAligned) {
            return {
                score: 80,
                signalSide: 'LONG',
                detectionNote: "Institutional Scalp: Squeeze Compresivo + CVD Flow Alcista.",
                specificTrigger: `Squeeze (BW ${bandwidth.toFixed(2)}%) + RSI > 52 + CVD Align`
            };
        } else if (isBearish && cvdAligned) {
            return {
                score: 80,
                signalSide: 'SHORT',
                detectionNote: "Institutional Scalp: Squeeze Compresivo + CVD Flow Bajista.",
                specificTrigger: `Squeeze (BW ${bandwidth.toFixed(2)}%) + RSI < 48 + CVD Align`
            };
        }
    }

    return null;
};
