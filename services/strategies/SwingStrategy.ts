
import { calculateEMA, calculateRSIArray, detectBullishDivergence, calculateSMA } from '../mathUtils';

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
    fibs: any, // Using any for now to avoid importing complex types, or I can define the shape
    volumes?: number[], // NEW: Para validar volumen en barridos
    orderBlocks?: { // NEW: Order Blocks ya calculados
        bullishOB: Array<{ price: number; strength: number; mitigated: boolean }>;
        bearishOB: Array<{ price: number; strength: number; mitigated: boolean }>;
    }
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

        // NEW: VALIDACIÓN DE VOLUMEN EN EL BARRIDO (Institucional)
        // Un barrido de liquidez real debe tener volumen significativo
        if (volumes && volumes.length > checkIndex) {
            const avgVolume = calculateSMA(volumes, 20);
            const volumeOnSweep = volumes[checkIndex];
            const volumeRatio = avgVolume > 0 ? volumeOnSweep / avgVolume : 0;

            if (volumeRatio < 1.2) {
                // Barrido sin volumen = débil (posible fake-out)
                score -= 15;
            } else if (volumeRatio > 2.0) {
                // Barrido con volumen fuerte = institucional
                score += 10;
                extraNotes.push("Vol Fuerte");
            }
        }

        // NEW: BONUS POR ORDER BLOCK CERCANO
        // Si hay un OB bullish cerca, es zona institucional de compra
        if (orderBlocks && orderBlocks.bullishOB) {
            const nearOB = orderBlocks.bullishOB.some(ob =>
                !ob.mitigated && Math.abs(ob.price - currentPrice) / currentPrice < 0.01
            );
            if (nearOB) {
                score += 10;
                extraNotes.push("Order Block");
            }
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
        let score = 80;
        let extraNotes = [];

        // NEW: VALIDACIÓN DE VOLUMEN EN BARRIDO BAJISTA
        if (volumes && volumes.length > checkIndex) {
            const avgVolume = calculateSMA(volumes, 20);
            const volumeOnSweep = volumes[checkIndex];
            const volumeRatio = avgVolume > 0 ? volumeOnSweep / avgVolume : 0;

            if (volumeRatio < 1.2) {
                score -= 15;
            } else if (volumeRatio > 2.0) {
                score += 10;
                extraNotes.push("Vol Fuerte");
            }
        }

        // NEW: BONUS POR ORDER BLOCK BAJISTA CERCANO
        if (orderBlocks && orderBlocks.bearishOB) {
            const nearOB = orderBlocks.bearishOB.some(ob =>
                !ob.mitigated && Math.abs(ob.price - currentPrice) / currentPrice < 0.01
            );
            if (nearOB) {
                score += 10;
                extraNotes.push("Order Block");
            }
        }

        const detectionNote = `SMC Setup: Rechazo de Estructura Bajista (SFP)${extraNotes.length > 0 ? ' + ' + extraNotes.join(' + ') : ''}.`;

        return {
            score,
            signalSide: 'SHORT',
            detectionNote,
            specificTrigger: "SFP Bajista (Máximo previo barrido)"
        };
    }

    return null;
};
