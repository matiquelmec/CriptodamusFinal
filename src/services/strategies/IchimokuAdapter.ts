import { calculateIchimokuData, analyzeIchimokuSignal } from '../ichimokuStrategy';

export interface IchimokuResult {
    score: number;
    signalSide: 'LONG' | 'SHORT';
    detectionNote: string;
    specificTrigger: string;
    stopLoss: number;
}

export const analyzeIchimoku = (
    highs: number[],
    lows: number[],
    closes: number[]
): IchimokuResult | null => {
    // 1. Get Full Data
    const cloudData = calculateIchimokuData(highs, lows, closes);

    if (!cloudData) return null;

    // 2. Analyze Signal
    const signal = analyzeIchimokuSignal(cloudData);

    // 3. Filter weak signals
    if (signal.side === 'NEUTRAL' || signal.score < 60) {
        return null;
    }

    // 4. Map to Scanner Format
    return {
        score: signal.score,
        signalSide: signal.side === 'LONG' ? 'LONG' : 'SHORT',
        detectionNote: signal.reason,
        specificTrigger: signal.trigger,
        stopLoss: signal.stopLoss
    };
};
