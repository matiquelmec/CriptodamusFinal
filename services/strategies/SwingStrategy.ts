
import { calculateEMA, calculateRSIArray, detectBullishDivergence } from '../mathUtils';

export interface SwingSignal {
    score: number;
    signalSide: 'LONG' | 'SHORT';
    detectionNote: string;
    specificTrigger: string;
}

export const analyzeSwingSignal = (
    prices: number[],
    highs: number[],
    lows: number[],
    fibs: any // Using any for now to avoid importing complex types, or I can define the shape
): SwingSignal | null => {
    const checkIndex = prices.length - 1;
    const currentPrice = prices[checkIndex];

    const lastLow = lows[checkIndex];
    const lastHigh = highs[checkIndex];

    // Lookback increased to 20 for better swing structure detection
    // Ensure we have enough data
    if (checkIndex < 20) return null;

    const prev20Lows = Math.min(...lows.slice(checkIndex - 20, checkIndex));
    const prev20Highs = Math.max(...highs.slice(checkIndex - 20, checkIndex));

    const ema50 = calculateEMA(prices, 50);
    const ema200 = calculateEMA(prices, 200);
    const isBullishTrend = ema50 > ema200;

    // CHECK FIBONACCI PROXIMITY (Golden Pocket)
    // fibs.level0_618 is the Golden Pocket level
    const distToGolden = Math.abs((currentPrice - fibs.level0_618) / currentPrice);
    const nearGoldenPocket = distToGolden < 0.015; // Within 1.5%

    // CHECK DIVERGENCES
    const rsiArray = calculateRSIArray(prices, 14);
    const hasBullishDiv = detectBullishDivergence(prices, rsiArray, lows);

    // SFP Logic (Swing Failure Pattern)
    if (isBullishTrend && lastLow < prev20Lows && currentPrice > prev20Lows) {
        let score = 80;
        let extraNotes = [];

        if (nearGoldenPocket) {
            score += 10;
            extraNotes.push("Golden Pocket");
        }
        if (hasBullishDiv) {
            score += 5;
            extraNotes.push("Divergencia RSI");
        }

        const detectionNote = `SMC Sniper: Barrido de Liquidez${extraNotes.length > 0 ? ' + ' + extraNotes.join(' + ') : ''}.`;
        const specificTrigger = `SFP (Swing Failure Pattern)${hasBullishDiv ? ' + Bull Div' : ''}`;

        return {
            score,
            signalSide: 'LONG',
            detectionNote,
            specificTrigger
        };
    } else if (!isBullishTrend && lastHigh > prev20Highs && currentPrice < prev20Highs) {
        return {
            score: 80,
            signalSide: 'SHORT',
            detectionNote: "SMC Setup: Rechazo de Estructura Bajista (SFP).",
            specificTrigger: "SFP Bajista (Máximo previo barrido)"
        };
    }

    return null;
};
