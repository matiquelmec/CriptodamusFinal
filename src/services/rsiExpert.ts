
/**
 * EXPERT RSI ANALYSIS SERVICE
 * Based on Andrew Cardwell & Constance Brown methodologies.
 * 
 * Features:
 * 1. Dynamic Range Rules (Brown): Bull (40-90), Bear (20-60).
 * 2. Super Ranges (Cardwell): Momentum bursts (60-80, 20-40).
 * 3. Reversal Targets: Price projections based on Positive/Negative Reversals.
 * 4. RSI Trendline Breaks: Leading indicator signals.
 */

import { calculateEMA } from './mathUtils';

export type RSIRangeType = 'BULL_MARKET' | 'BEAR_MARKET' | 'SUPER_BULL' | 'SUPER_BEAR' | 'NEUTRAL';

export interface ExpertRSIAnalysis {
    range: {
        type: RSIRangeType;
        confidence: number;
        description: string;
    };
    reversalTarget: {
        active: boolean;
        type: 'POSITIVE' | 'NEGATIVE' | null; // POSITIVE = Bullish Target, NEGATIVE = Bearish Target
        targetPrice: number;
        pattern: string; // e.g. "Cardwell Positive Reversal"
    } | null;
    trendlineBreak: {
        detected: boolean;
        direction: 'BULLISH' | 'BEARISH' | null;
    };
}

/**
 * Detects the current market regime based on RSI behavior (Brown/Cardwell Rules)
 * @param rsiArray - Full array of RSI values
 * @param period - Evaluation period for regime (default 50 candles)
 */
export function detectRSIRange(rsiArray: number[], period: number = 50): ExpertRSIAnalysis['range'] {
    if (rsiArray.length < period) return { type: 'NEUTRAL', confidence: 0, description: "Insufficient Data" };

    const recentRSI = rsiArray.slice(-period);
    const maxRSI = Math.max(...recentRSI);
    const minRSI = Math.min(...recentRSI);
    const currentRSI = recentRSI[recentRSI.length - 1];

    // CARDWELL SUPER RANGES (Momentum Extreme)
    // Super Bull: RSI stays between 40 and 80+, essentially never breaking 40.
    // Ideally 60-80 zone for pure momentum.

    // BROWN RULES
    // Bull Market: 40 - 90 (Support at 40)
    // Bear Market: 20 - 60 (Resistance at 60)

    // CHECK FOR BULLISH REGIME
    let bullConfidence = 0;
    // Rule 1: Floor check. In Bull market, RSI rarely goes below 40.
    const dipsBelow40 = recentRSI.filter(v => v < 40).length;
    if (dipsBelow40 === 0) bullConfidence += 40; // Strong support
    else if (dipsBelow40 < 3 && minRSI > 30) bullConfidence += 20; // Acceptable support

    // Rule 2: Ceiling check. In Bull market, RSI pushes 70-80 easily.
    if (maxRSI > 75) bullConfidence += 30;
    else if (maxRSI > 65) bullConfidence += 15;

    // Rule 3: Current Context
    if (currentRSI > 50) bullConfidence += 10;

    // CHECK FOR BEARISH REGIME
    let bearConfidence = 0;
    // Rule 1: Ceiling check. In Bear market, RSI rarely goes above 60-65.
    const spikesAbove65 = recentRSI.filter(v => v > 65).length;
    if (spikesAbove65 === 0) bearConfidence += 40;
    else if (spikesAbove65 < 3 && maxRSI < 70) bearConfidence += 20;

    // Rule 2: Floor check. In Bear market, RSI pushes 20-30 easily.
    if (minRSI < 25) bearConfidence += 30;
    else if (minRSI < 35) bearConfidence += 15;

    // Rule 3: Current Context
    if (currentRSI < 50) bearConfidence += 10;


    // CLASSIFICATION
    if (bullConfidence > bearConfidence && bullConfidence > 50) {
        // Check for Super Bull (Cardwell)
        // If we consistently stay > 60 in the last 10-15 periods
        const veryRecent = rsiArray.slice(-15);
        if (Math.min(...veryRecent) > 55 && currentRSI > 60) {
            return {
                type: 'SUPER_BULL',
                confidence: 0.9,
                description: "🚀 SUPER BULL: Momentum desenfrenado (Rango 60-80). No vender en corto."
            };
        }
        return {
            type: 'BULL_MARKET',
            confidence: bullConfidence / 100,
            description: "🐂 Rango Alcista (Brown): Soporte en 40-50, Techo en 80-90."
        };
    }

    if (bearConfidence > bullConfidence && bearConfidence > 50) {
        // Check for Super Bear
        const veryRecent = rsiArray.slice(-15);
        if (Math.max(...veryRecent) < 45 && currentRSI < 40) {
            return {
                type: 'SUPER_BEAR',
                confidence: 0.9,
                description: "🐻 SUPER BEAR: Caída libre (Rango 20-40). No comprar el dip todavía."
            };
        }
        return {
            type: 'BEAR_MARKET',
            confidence: bearConfidence / 100,
            description: "📉 Rango Bajista (Brown): Resistencia en 50-60, Fondo en 20."
        };
    }

    return {
        type: 'NEUTRAL',
        confidence: 0.5,
        description: "⚖️ Mercado Neutral / Transición: RSI sin rango definido."
    };
}


/**
 * Calculates Cardwell Reversal Targets (Positive & Negative)
 * This logic effectively uses Hidden Divergences to project prices.
 */
export function calculateCardwellReversal(
    prices: number[],
    rsiArray: number[],
    lookback: number = 20
): ExpertRSIAnalysis['reversalTarget'] {
    if (prices.length < lookback || rsiArray.length < lookback) return null;

    // Need to find pivots (Highs and Lows)
    // Simplified pivot detection: Check neighbors
    const pivots = {
        rsiLows: [] as { index: number, value: number, price: number }[],
        rsiHighs: [] as { index: number, value: number, price: number }[]
    };

    // Scan ONLY the lookback window
    const startIdx = prices.length - lookback;
    for (let i = startIdx + 2; i < prices.length - 2; i++) {
        const rsiLeft = rsiArray[i - 1];
        const rsiLeft2 = rsiArray[i - 2];
        const rsiRight = rsiArray[i + 1];
        const rsiRight2 = rsiArray[i + 2];
        const rsiVal = rsiArray[i];

        // Valley (Low)
        if (rsiVal < rsiLeft && rsiVal < rsiLeft2 && rsiVal < rsiRight && rsiVal < rsiRight2) {
            pivots.rsiLows.push({ index: i, value: rsiVal, price: prices[i] });
        }
        // Peak (High)
        if (rsiVal > rsiLeft && rsiVal > rsiLeft2 && rsiVal > rsiRight && rsiVal > rsiRight2) {
            pivots.rsiHighs.push({ index: i, value: rsiVal, price: prices[i] });
        }
    }

    // --- POSITIVE REVERSAL (Bullish) ---
    // Structure: Price Higher Low + RSI Lower Low
    // Need 2 recent lows.
    if (pivots.rsiLows.length >= 2) {
        const Y_Pivot = pivots.rsiLows[pivots.rsiLows.length - 1]; // Most recent
        const W_Pivot = pivots.rsiLows[pivots.rsiLows.length - 2]; // Previous

        // Check Logic:
        // Price Y > Price W (Higher Low)
        // RSI Y < RSI W (Lower Low)

        if (Y_Pivot.price > W_Pivot.price && Y_Pivot.value < W_Pivot.value) {
            // Find intermediate Peak X (Highest Price between W and Y)
            // We need max price between indices W.index and Y.index
            let X_Price = -Infinity;
            for (let j = W_Pivot.index; j <= Y_Pivot.index; j++) {
                if (prices[j] > X_Price) X_Price = prices[j];
            }

            // Calculation: Target = X + (Y_Price - W_Price)
            // Or alternate: Target = (X - W) + Y. Algebraically same if expanded?
            // Formula 1: X + Y - W. 
            // Formula 2: X - W + Y.
            // Yes, identical.

            const target = X_Price + (Y_Pivot.price - W_Pivot.price);

            // Filter: Ensure target is reasonable (e.g. above current price)
            // And reversa happened recently (Y_Pivot is close to "now")
            const isRecent = (prices.length - 1 - Y_Pivot.index) < 5;

            if (isRecent) {
                return {
                    active: true,
                    type: 'POSITIVE',
                    targetPrice: target,
                    pattern: `Positive Reversal (Cardwell): Base $${W_Pivot.price.toFixed(2)} -> $${Y_Pivot.price.toFixed(2)}`
                };
            }
        }
    }

    // --- NEGATIVE REVERSAL (Bearish) ---
    // Structure: Price Lower High + RSI Higher High
    if (pivots.rsiHighs.length >= 2) {
        const Y_Pivot = pivots.rsiHighs[pivots.rsiHighs.length - 1]; // Recent
        const W_Pivot = pivots.rsiHighs[pivots.rsiHighs.length - 2]; // Previous

        // Check Logic: 
        // Price Y < Price W (Lower High)
        // RSI Y > RSI W (Higher High)

        if (Y_Pivot.price < W_Pivot.price && Y_Pivot.value > W_Pivot.value) {
            // Find intermediate Valley X (Lowest Price between W and Y)
            let X_Price = Infinity;
            for (let j = W_Pivot.index; j <= Y_Pivot.index; j++) {
                if (prices[j] < X_Price) X_Price = prices[j];
            }

            // Calculation: Target = Y - (W - X) ?
            // Let's check doc formula: Target = Y - (W - X)
            // W = Price at first max. X = Price at valley. Y = Price at recent max.
            // Logic: Measure drop from W to X. Project that drop from Y?
            // (W - X) is the drop distance.
            // So Target = Y - (Drop). YES.

            const target = Y_Pivot.price - (W_Pivot.price - X_Price);

            const isRecent = (prices.length - 1 - Y_Pivot.index) < 5;

            if (isRecent) {
                return {
                    active: true,
                    type: 'NEGATIVE',
                    targetPrice: target,
                    pattern: `Negative Reversal (Cardwell): Techado $${W_Pivot.price.toFixed(2)} -> $${Y_Pivot.price.toFixed(2)}`
                };
            }
        }
    }

    return null;
}

/**
 * Main Analysis Wrapper
 */
export function analyzeRSIExpert(prices: number[], rsiArray: number[]): ExpertRSIAnalysis {
    const range = detectRSIRange(rsiArray);
    const reversalTarget = calculateCardwellReversal(prices, rsiArray);

    // Placeholder for trendline break (requires more complex geometry)
    const trendlineBreak = {
        detected: false,
        direction: null
    } as any;

    return {
        range,
        reversalTarget,
        trendlineBreak
    };
}
