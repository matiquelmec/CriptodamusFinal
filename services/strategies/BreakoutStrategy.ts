
import { calculateBollingerStats } from '../mathUtils';

export interface BreakoutSignal {
    score: number;
    signalSide: 'LONG' | 'SHORT';
    detectionNote: string;
    specificTrigger: string;
}

export const analyzeBreakoutSignal = (
    prices: number[],
    highs: number[],
    lows: number[],
    rvol: number
): BreakoutSignal | null => {
    const checkIndex = prices.length - 1;
    const currentPrice = prices[checkIndex];

    // Ensure enough data for 20 periods
    if (checkIndex < 20) return null;

    // DONCHIAN CHANNEL LOGIC (20 Periods)
    // We look at the PAST 20 candles (excluding current) to define the channel
    const pastHighs = highs.slice(checkIndex - 20, checkIndex);
    const pastLows = lows.slice(checkIndex - 20, checkIndex);
    const maxHigh20 = Math.max(...pastHighs);
    const minLow20 = Math.min(...pastLows);

    // Volatility Expansion Check
    const { bandwidth } = calculateBollingerStats(prices);
    // Previous bandwidth (approximate by removing last candle)
    const prevBandwidth = calculateBollingerStats(prices.slice(0, checkIndex)).bandwidth;
    const isExpanding = bandwidth > prevBandwidth;

    // 1. BULLISH BREAKOUT
    if (currentPrice > maxHigh20 && rvol > 1.5 && isExpanding) {
        const score = 75 + Math.min((rvol * 5), 20);
        return {
            score,
            signalSide: 'LONG',
            detectionNote: `Donchian Breakout: Ruptura de Máximo de 20 periodos con Expansión.`,
            specificTrigger: `Price > ${maxHigh20} (20p High) + RVOL ${rvol.toFixed(1)}x`
        };
    }
    // 2. BEARISH BREAKDOWN
    else if (currentPrice < minLow20 && rvol > 1.5 && isExpanding) {
        const score = 75 + Math.min((rvol * 5), 20);
        return {
            score,
            signalSide: 'SHORT',
            detectionNote: `Donchian Breakdown: Pérdida de Soporte de 20 periodos.`,
            specificTrigger: `Price < ${minLow20} (20p Low) + RVOL ${rvol.toFixed(1)}x`
        };
    }

    return null;
};
