
import { calculateBollingerStats } from '../mathUtils';

export interface ScalpSignal {
    score: number;
    signalSide: 'LONG' | 'SHORT';
    detectionNote: string;
    specificTrigger: string;
}

export const analyzeScalpSignal = (
    prices: number[],
    vwap: number,
    rsi: number
): ScalpSignal | null => {
    const checkIndex = prices.length - 1;
    const currentPrice = prices[checkIndex];

    // SCALP: BOLLINGER SQUEEZE + MOMENTUM + VWAP
    const { bandwidth, sma: sma20 } = calculateBollingerStats(prices);

    const historicalBandwidths = [];
    // Look back 20-50 periods to find min bandwidth
    for (let i = 20; i < 50; i++) {
        if (checkIndex - i < 0) break;
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

        if (isBullish) {
            return {
                score: 80,
                signalSide: 'LONG',
                detectionNote: "Quant Squeeze: Compresión de volatilidad con Momentum Alcista.",
                specificTrigger: `Squeeze (BW ${bandwidth.toFixed(2)}%) + RSI > 52 + Price > VWAP`
            };
        } else if (isBearish) {
            return {
                score: 80,
                signalSide: 'SHORT',
                detectionNote: "Quant Squeeze: Compresión de volatilidad con Momentum Bajista.",
                specificTrigger: `Squeeze (BW ${bandwidth.toFixed(2)}%) + RSI < 48 + Price < VWAP`
            };
        }
    }

    return null;
};
