import { TechnicalIndicators, MarketRisk } from '../../types';

export interface FreezeSignal {
    active: boolean;
    type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidence: number;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    reason: string[];
    confluenceFactors: string[];
}

/**
 * ESTRATEGIA FREEZE (SMART HYBRID)
 * 
 * Logic:
 * 1. Trend Filter: Price vs SMA30 (Essential)
 * 2. Structure Filter: Box Theory 0.5 Retest OR N-Pattern
 * 3. Validation: RSI Freeze (9) Divergence or Level Check
 * 4. Institutional Boost: Order Block / Volume Confluence
 */
export function analyzeFreezeStrategy(
    data: TechnicalIndicators,
    riskProfile: MarketRisk // To filter high risk conditions
    // strategies/mathUtils? No, passed in data.
): FreezeSignal {
    const {
        price, sma5, sma10, sma30, rsiFreeze,
        boxTheory, nPattern,
        orderBlocks, volumeExpert
    } = data;

    // Default Signal
    const signal: FreezeSignal = {
        active: false,
        type: 'NEUTRAL',
        confidence: 0,
        entryPrice: 0,
        stopLoss: 0,
        takeProfit: 0,
        reason: [],
        confluenceFactors: []
    };

    if (!sma5 || !sma10 || !sma30 || !rsiFreeze || !boxTheory) {
        return signal; // Not enough data
    }

    // 1. TREND IDENTIFICATION (SMA 30 Filter)
    const isBullishTrend = price > sma30 && sma10 > sma30;
    const isBearishTrend = price < sma30 && sma10 < sma30;

    // 2. ENTRY TRIGGERS
    let entryFound = false;
    let entryType: 'BULLISH' | 'BEARISH' = 'NEUTRAL' as any;
    let entryReason = "";
    let baseEntryPrice = price;
    let baseStopLoss = 0;

    // A. N-Pattern (High Confidence Structure)
    if (nPattern && nPattern.detected) {
        if (nPattern.type === 'BULLISH' && isBullishTrend) {
            entryFound = true;
            entryType = 'BULLISH';
            entryReason = "N-Pattern Bullish (Break & Retest)";
            baseEntryPrice = nPattern.entryPrice;
            baseStopLoss = nPattern.stopLoss;
        } else if (nPattern.type === 'BEARISH' && isBearishTrend) {
            entryFound = true;
            entryType = 'BEARISH';
            entryReason = "N-Pattern Bearish (Break & Retest)";
            baseEntryPrice = nPattern.entryPrice;
            baseStopLoss = nPattern.stopLoss;
        }
    }

    // B. Box Theory 0.5 Retest (If no N Pattern found yet, or as confluence)
    if (!entryFound && boxTheory.active && boxTheory.signal !== 'NEUTRAL') {
        const distTo05 = Math.abs(price - boxTheory.level0_5) / price;
        const isNear05 = distTo05 < 0.005; // 0.5% tolerance

        if (isNear05) {
            if (boxTheory.signal === 'BULLISH' && isBullishTrend) {
                entryFound = true;
                entryType = 'BULLISH';
                entryReason = "Box Theory 0.5 Retest (Golden Zone)";
                baseEntryPrice = boxTheory.level0_5;
                // Stop Loss Logic for Box: Below the box low? No, strategy says "Tight".
                // Let's put it below the recent local low or 2% below input.
                baseStopLoss = boxTheory.low; // Conservative
            } else if (boxTheory.signal === 'BEARISH' && isBearishTrend) {
                entryFound = true;
                entryType = 'BEARISH';
                entryReason = "Box Theory 0.5 Retest (Bearish Rejection)";
                baseEntryPrice = boxTheory.level0_5;
                baseStopLoss = boxTheory.high;
            }
        }
    }

    if (!entryFound) return signal;

    // 3. RSI FREEZE (9) VALIDATION
    // Bullish: RSI should NOT be Overbought (>80) on entry, ideally rising from <40 or making divergence.
    // Bearish: RSI should NOT be Oversold (<20) on entry.

    // Simple Filter:
    if (entryType === 'BULLISH' && rsiFreeze > 75) return signal; // Don't buy top
    if (entryType === 'BEARISH' && rsiFreeze < 25) return signal; // Don't sell bottom

    signal.active = true;
    signal.type = entryType;
    signal.entryPrice = baseEntryPrice;
    signal.stopLoss = baseStopLoss;
    signal.reason.push(entryReason);
    signal.confidence = 5; // Start base confidence

    // 4. SMART CONFLUENCE (Institutional Boost)

    // A. Order Block Confluence
    if (orderBlocks) {
        if (entryType === 'BULLISH' && orderBlocks.bullish.length > 0) {
            // Check if entry price is inside any bullish OB
            const inOB = orderBlocks.bullish.some(ob => price >= ob.price * 0.99 && price <= ob.price * 1.01);
            if (inOB) {
                signal.confidence += 2;
                signal.confluenceFactors.push("Institutional Order Block Match");
            }
        } else if (entryType === 'BEARISH' && orderBlocks.bearish.length > 0) {
            const inOB = orderBlocks.bearish.some(ob => price >= ob.price * 0.99 && price <= ob.price * 1.01);
            if (inOB) {
                signal.confidence += 2;
                signal.confluenceFactors.push("Institutional Order Block Match");
            }
        }
    }

    // B. Volume / CVD Confluence
    if (volumeExpert && volumeExpert.cvd) {
        if (entryType === 'BULLISH') {
            if (volumeExpert.cvd.trend === 'BULLISH') {
                signal.confidence += 1.5;
                signal.confluenceFactors.push("CVD Flow Aligned (Buying)");
            }
            if (volumeExpert.cvd.divergence?.includes('ABSORPTION')) {
                signal.confidence += 2; // Whale Absorption
                signal.confluenceFactors.push("Whale Absorption Detected");
            }
        } else {
            if (volumeExpert.cvd.trend === 'BEARISH') {
                signal.confidence += 1.5;
                signal.confluenceFactors.push("CVD Flow Aligned (Selling)");
            }
            if (volumeExpert.cvd.divergence?.includes('ABSORPTION')) {
                signal.confidence += 2;
                signal.confluenceFactors.push("Whale Absorption Detected");
            }
        }
    }

    // 5. TARGET CALCULATION (1:1 Ratio Minimum)
    const risk = Math.abs(baseEntryPrice - baseStopLoss);
    if (entryType === 'BULLISH') {
        signal.takeProfit = baseEntryPrice + (risk * 2); // Aim for 1:2
    } else {
        signal.takeProfit = baseEntryPrice - (risk * 2);
    }

    // Cap confidence
    signal.confidence = Math.min(signal.confidence, 10);

    return signal;
}
