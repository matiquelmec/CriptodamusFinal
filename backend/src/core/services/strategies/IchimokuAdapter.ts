import { calculateIchimokuData, analyzeIchimokuSignal } from '../ichimokuStrategy';

export interface IchimokuResult {
    score: number;
    signalSide: 'LONG' | 'SHORT';
    detectionNote: string;
    specificTrigger: string;
    stopLoss: number;
    isFresh?: boolean;
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

    // 4. Freshness Check (Sniper Logic)
    // Calculate signal for PREVIOUS candle to see if this is a new event or old news
    const prevCloudData = calculateIchimokuData(
        highs.slice(0, -1),
        lows.slice(0, -1),
        closes.slice(0, -1)
    );

    let isFresh = true;
    if (prevCloudData) {
        const prevSignal = analyzeIchimokuSignal(prevCloudData);
        // It is FRESH if the previous signal was NOT the same side or was NEUTRAL
        // If previous was LONG and current is LONG, it is NOT fresh (Continuation)
        if (prevSignal.side === signal.side) {
            isFresh = false;
        }
    }

    // 5. Map to Scanner Format
    return {
        score: signal.score,
        signalSide: signal.side === 'LONG' ? 'LONG' : 'SHORT',
        detectionNote: isFresh ? `🚀 FRESH: ${signal.reason}` : `🔁 CONTINUATION: ${signal.reason}`,
        specificTrigger: signal.trigger,
        stopLoss: signal.stopLoss,
        isFresh: isFresh
    };
};
