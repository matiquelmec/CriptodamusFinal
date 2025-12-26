
import { calculateEMA, calculateSlope, detectPinballState, calculateRSI } from '../mathUtils';
import { TechnicalIndicators } from '../../types';

export interface PinballSignal {
    score: number;
    signalSide: 'LONG' | 'SHORT';
    detectionNote: string;
    specificTrigger: string;
}

export const analyzePinballSignal = (
    prices: number[],
    lows: number[],
    highs: number[],
    ema50: number,
    ema200: number,
    slope200: number, // Must be provided (Slope of EMA200)
    adx: number
): PinballSignal | null => {
    const currentPrice = prices[prices.length - 1];

    // 1. FILTER: EMA200 Slope must be significant (trending market)
    // Expert Doc: "Un Golden Cross es mucho más potente si la EMA 200 ya se ha aplanado o está comenzando a subir."
    // For Pinball, we want to trade WITH the secular trend.
    const validSlope = (slope200 !== undefined && !isNaN(slope200)) ? slope200 : 0;
    const isSecularBull = validSlope > 0.02; // Threshold for positive slope
    const isSecularBear = validSlope < -0.02;

    // 2. DETECT ZONE
    const trend = ema50 > ema200 ? 'BULLISH' : 'BEARISH';
    const pinballState = detectPinballState(currentPrice, ema50, ema200, trend);

    if (!pinballState) return null;

    // 3. EXECUTION LOGIC (The Bounce)
    // We need to see if price is bouncing off EMA200 or Reclaiming EMA50?
    // Let's simplify: detect if we are in the "Value Zone" and have a trigger candle?
    // Ideally visualization just highlights the zone. 
    // But for a signal, we want a 'Hammer' at EMA200 or 'Reclaim' of EMA50.

    // Let's look for Reclaim of EMA50 (Aggressive) or Bounce from EMA200 (Conservative)
    // For this automated check, we check Proximity to EMA200 + Reversal Candle

    let score = 0;

    if (trend === 'BULLISH' && isSecularBull) {
        // We are in the zone (Price < 50, Price > 200)
        // Check Distance to EMA200
        const distTo200 = (currentPrice - ema200) / currentPrice;

        if (distTo200 < 0.02) { // Within 2% of EMA200
            score = 85;
            // Bonus: RSI Oversold in this dip?
            const rsi = calculateRSI(prices, 14);
            if (rsi < 45) score += 5; // Healthy pullback RSI

            return {
                score,
                signalSide: 'LONG',
                detectionNote: `Estrategia Pinball (Alcista): Precio comprimido entre EMA50 y EMA200. Zona de valor institucional. EMA200 con pendiente positiva.`,
                specificTrigger: "Rebote en EMA200"
            };
        }
    } else if (trend === 'BEARISH' && isSecularBear) {
        const distTo200 = (ema200 - currentPrice) / currentPrice;

        if (distTo200 < 0.02) {
            score = 85;
            const rsi = calculateRSI(prices, 14);
            if (rsi > 55) score += 5; // Healthy rally RSI in downtrend

            return {
                score,
                signalSide: 'SHORT',
                detectionNote: `Estrategia Pinball (Bajista): Precio atrapado entre EMA50 y EMA200. Zona de recarga de cortos. EMA200 con pendiente negativa.`,
                specificTrigger: "Rechazo en EMA200"
            };
        }
    }

    return null;
};
