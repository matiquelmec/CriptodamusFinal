import { calculateEMA, detectPinballState } from '../mathUtils';
import { TechnicalIndicators } from '../../types';

export interface PinballSignal {
    score: number;
    signalSide: 'LONG' | 'SHORT';
    detectionNote: string;
    specificTrigger: string;
}

export const analyzePinballSignal = (
    prices: number[],
    indicators: TechnicalIndicators // Standardized Signature
): PinballSignal | null => {
    const currentPrice = prices[prices.length - 1];
    const slope200 = indicators.emaSlope;
    const ema50 = indicators.ema50 || calculateEMA(prices, 50);
    const ema200 = indicators.ema200 || calculateEMA(prices, 200);
    const orderBlocks = indicators.orderBlocks;
    const rsi = indicators.rsi;

    // 1. FILTER: EMA200 Slope must be significant (trending market)
    const validSlope = (slope200 !== undefined) ? slope200 : 0;
    const isSecularBull = validSlope > 0;
    const isSecularBear = validSlope < 0;

    // 2. DETECT ZONE
    const trend = ema50 > ema200 ? 'BULLISH' : 'BEARISH';
    const pinballState = detectPinballState(currentPrice, ema50, ema200, trend);

    if (!pinballState) return null;

    let score = 0;

    // 3. INSTITUTIONAL EXECUTION (The Bounce)
    // We only take the bounce if we are sitting on an Order Block

    if (trend === 'BULLISH' && isSecularBull) {
        const distTo200 = (currentPrice - ema200) / currentPrice;

        if (distTo200 < 0.03 && distTo200 > -0.01) { // Near EMA200

            // INSTITUTIONAL CHECK: Is there a Buyer OB here?
            let hasOBSupport = false;
            if (orderBlocks && orderBlocks.bullish) {
                hasOBSupport = orderBlocks.bullish.some(ob =>
                    currentPrice >= ob.low * 0.99 && currentPrice <= ob.high * 1.01
                );
            }

            if (hasOBSupport) {
                score = 90; // God Tier Setup (EMA200 + OB)
                if (rsi < 45) score += 5;

                return {
                    score,
                    signalSide: 'LONG',
                    detectionNote: `💎 Pinball Institutional: Rebote perfecto en EMA200 + Order Block Alcista. Confluencia técnica máxima.`,
                    specificTrigger: "Bounce EMA200 + Bullish OB"
                };
            }
        }
    } else if (trend === 'BEARISH' && isSecularBear) {
        const distTo200 = (ema200 - currentPrice) / currentPrice;

        if (distTo200 < 0.03 && distTo200 > -0.01) {

            // INSTITUTIONAL CHECK: Is there a Seller OB here?
            let hasOBResistance = false;
            if (orderBlocks && orderBlocks.bearish) {
                hasOBResistance = orderBlocks.bearish.some(ob =>
                    currentPrice >= ob.low * 0.99 && currentPrice <= ob.high * 1.01
                );
            }

            if (hasOBResistance) {
                score = 90;
                if (rsi > 55) score += 5;

                return {
                    score,
                    signalSide: 'SHORT',
                    detectionNote: `💎 Pinball Institutional: Rechazo perfecto en EMA200 + Order Block Bajista.`,
                    specificTrigger: "Reject EMA200 + Bearish OB"
                };
            }
        }
    }

    return null;
};
