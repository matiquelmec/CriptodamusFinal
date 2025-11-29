
import { calculateEMA, calculateBollingerStats } from '../mathUtils';

export interface MemeSignal {
    score: number;
    signalSide: 'LONG' | 'SHORT';
    detectionNote: string;
    specificTrigger: string;
}

export const analyzeMemeSignal = (
    prices: number[],
    vwap: number,
    rvol: number,
    rsi: number,
    stochRsi: { k: number, d: number }
): MemeSignal | null => {
    const checkIndex = prices.length - 1; // Live or last closed candle depending on input
    const currentPrice = prices[checkIndex];
    const ema20 = calculateEMA(prices, 20);

    // ESTRATEGIA 1: EL PUMP (MOMENTUM) - NOW WITH VWAP SAFETY
    if (currentPrice > ema20 && currentPrice > vwap && rvol > 1.8 && rsi > 55) {
        const score = 80 + Math.min(rvol * 3, 15); // Higher volume = Higher score
        return {
            score,
            signalSide: 'LONG',
            detectionNote: `Meme Pump: Volumen Explosivo (x${rvol.toFixed(1)}) + Precio sobre VWAP.`,
            specificTrigger: `RVOL > 1.8 (${rvol.toFixed(2)}x) + RSI Uptrend (${rsi.toFixed(0)})`
        };
    }

    // ESTRATEGIA 2: THE DIP (REBOTE) - NOW WITH STOCH RSI
    const { lower } = calculateBollingerStats(prices);
    if (currentPrice < lower && stochRsi.k < 15) {
        return {
            score: 80,
            signalSide: 'LONG', // Catch the knife safely
            detectionNote: `Meme Oversold: Precio fuera de Bandas + StochRSI en Suelo (${stochRsi.k.toFixed(0)}).`,
            specificTrigger: `StochRSI Sobrevendido (${stochRsi.k.toFixed(0)} < 15) + Break Banda Inf.`
        };
    }

    return null;
};
