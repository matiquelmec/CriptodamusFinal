import { calculateBollingerStats } from '../mathUtils';
import { TechnicalIndicators } from '../../types';

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
    indicators: TechnicalIndicators // Standardized Signature
): BreakoutSignal | null => {
    const checkIndex = prices.length - 1;
    const currentPrice = prices[checkIndex];
    const rvol = indicators.rvol || 0;
    const cvd = indicators.cvd; // Clean Order Flow Data

    // Ensure enough data for 20 periods
    if (checkIndex < 20) return null;

    // DONCHIAN CHANNEL LOGIC (20 Periods)
    const pastHighs = highs.slice(checkIndex - 20, checkIndex);
    const pastLows = lows.slice(checkIndex - 20, checkIndex);
    const maxHigh20 = Math.max(...pastHighs);
    const minLow20 = Math.min(...pastLows);

    // Volatility Expansion Check
    const { bandwidth } = calculateBollingerStats(prices);
    const prevBandwidth = calculateBollingerStats(prices.slice(0, checkIndex)).bandwidth;
    const isExpanding = bandwidth > prevBandwidth;

    // 1. BULLISH BREAKOUT
    if (currentPrice > maxHigh20 && rvol > 1.5 && isExpanding) {
        // A. Strong Close Check
        const currentHigh = highs[checkIndex];
        const currentLow = lows[checkIndex];
        const candleRange = currentHigh - currentLow;
        if (candleRange > 0) {
            const closeStrength = (currentPrice - currentLow) / candleRange;
            if (closeStrength < 0.7) return null; // Wick Rejection (Trap)
        }

        // B. INSTITUTIONAL CHECK: CVD VALIDATION (No Divergence)
        // If Price is breaking up, CVD MUST be sloping up or at least not dumping.
        if (cvd && cvd.length > 5) {
            const currentCVD = cvd[cvd.length - 1];
            const prevCVD = cvd[cvd.length - 2];

            // Critical Trap: Price New High but CVD Lower? (Bearish Div) -> Trap
            if (currentCVD < prevCVD) {
                // EXTREME CAUTION: CVD Dropping on Breakout = Absorption/Selling into strength
                return null; // Filtered by Institutional Logic
            }
        }

        let score = 75 + Math.min((rvol * 5), 20);

        return {
            score,
            signalSide: 'LONG',
            detectionNote: `Institutional Breakout: Ruptura validada por CVD y RVOL. Flujo de órdenes acompaña el movimiento.`,
            specificTrigger: `Price > 20p High + CVD Align`
        };
    }
    // 2. BEARISH BREAKDOWN
    else if (currentPrice < minLow20 && rvol > 1.5 && isExpanding) {
        // A. Strong Close Check
        const currentHigh = highs[checkIndex];
        const currentLow = lows[checkIndex];
        const candleRange = currentHigh - currentLow;
        if (candleRange > 0) {
            const closeStrength = (currentPrice - currentLow) / candleRange;
            if (closeStrength > 0.3) return null; // Wick Rejection
        }

        // B. INSTITUTIONAL CHECK: CVD VALIDATION
        if (cvd && cvd.length > 5) {
            const currentCVD = cvd[cvd.length - 1];
            const prevCVD = cvd[cvd.length - 2];

            // Critical Trap: Price New Low but CVD Rising? (Bullish Div) -> Trap
            if (currentCVD > prevCVD) {
                return null; // Filtered (Absorption detected)
            }
        }

        let score = 75 + Math.min((rvol * 5), 20);

        return {
            score,
            signalSide: 'SHORT',
            detectionNote: `Institutional Breakdown: Caída validada por CVD y RVOL. Ventas agresivas confirmadas.`,
            specificTrigger: `Price < 20p Low + CVD Align`
        };
    }

    return null;
};
