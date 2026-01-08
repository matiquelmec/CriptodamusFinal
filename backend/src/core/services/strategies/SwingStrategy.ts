import { TechnicalIndicators } from '../../types';

export function analyzeSwingSignal(
    prices: number[],
    highs: number[],
    lows: number[],
    indicators: TechnicalIndicators // Now receiving full indicators object
): { score: number; signalSide: 'LONG' | 'SHORT' | 'NEUTRAL'; detectionNote: string; specificTrigger?: string } {

    // -------------------------------------------------------------------------
    // INSTITUTIONAL SMC LOGIC (V2 PRO)
    // Core Philosophy: Liquidity Sweeps + Displacement + Order Flow Validation
    // -------------------------------------------------------------------------

    const currentPrice = prices[prices.length - 1];
    const currentHigh = highs[highs.length - 1];
    const currentLow = lows[lows.length - 1];
    const prevClose = prices[prices.length - 2];

    // 1. DATA EXTRACTION
    const fractals = indicators.fractals;
    const cvd = indicators.cvd;
    const orderBlocks = indicators.orderBlocks;

    // Safe guard for minimal data
    if (!fractals || !cvd || !orderBlocks) {
        return { score: 0, signalSide: 'NEUTRAL', detectionNote: "Datos insuficientes (Fractals/CVD/OB) para análisis SMC." };
    }

    let score = 0;
    let signalSide: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
    let detectionNote = "";
    let specificTrigger = "";

    // 2. IDENTIFY LIQUIDITY ZONES (FRACTALS)
    // We assume indicators.fractals returns arrays of PRICE LEVELS of the fractal points.
    // If empty, we can't operate.

    const lastSwingLow = fractals.bullish && fractals.bullish.length > 0 ? fractals.bullish[fractals.bullish.length - 1] : null;
    const lastSwingHigh = fractals.bearish && fractals.bearish.length > 0 ? fractals.bearish[fractals.bearish.length - 1] : null;

    // 3. DETECT SWINGS (SFP - Swing Failure Pattern)

    // --- BULLISH SFP (Long Setup) ---
    // Criteria:
    // A. Previous Fractal Low exists.
    // B. Current Low went BELOW that Fractal Low (Sweep).
    // C. Current Close is ABOVE that Fractal Low (Rejection).

    // We also check 'currentPrice' (Close) vs lastSwingLow
    // To be safe, let's assume lastSwingLow is a number.
    if (lastSwingLow !== null && currentLow < lastSwingLow && currentPrice > lastSwingLow) {

        // Step A: We have a SWEEP.
        let confluenceScore = 0;
        let reasons: string[] = [];

        // CVD Validation
        // We need to check if CVD is diverging locally. 
        // Simple check: Is the last CVD higher than the CVD 2 candles ago? Or just positive slope?
        // Let's compare last 2 points.
        if (cvd.length >= 2) {
            const lastCVD = cvd[cvd.length - 1];
            const prevCVD = cvd[cvd.length - 2];

            // If Price is making a low (which it is, by definition of SFP local low)
            // But CVD is rising or holding (Absorption)
            if (lastCVD > prevCVD) {
                confluenceScore += 2;
                reasons.push("Absorción (CVD)");
            }
        }

        // Order Block Confluence
        // Are we sweeping INTO a Bullish OB?
        if (orderBlocks.bullish) {
            const inBullishOB = orderBlocks.bullish.some((ob: any) =>
                currentLow >= ob.low && currentLow <= ob.high && !ob.mitigated
            );

            if (inBullishOB) {
                confluenceScore += 2;
                reasons.push("Test Bullish OB");
            }
        }

        // Final Scoring for Long
        // We require at least ONE confirmation (CVD or OB) to consider it "Pro" check
        // Or if the sweep is very clean (Hammer candle). 
        // Let's be strict: Score 0 unless validated.

        if (confluenceScore >= 2) {
            score = 80 + (confluenceScore * 5); // Max 100
            signalSide = 'LONG';
            specificTrigger = 'SFP_BULLISH';
            detectionNote = `💎 SMC LONG: Barrido de Liquidez (SFP) en ${lastSwingLow}. Confirmación: ${reasons.join(' + ')}.`;
        }
    }

    // --- BEARISH SFP (Short Setup) ---
    else if (lastSwingHigh !== null && currentHigh > lastSwingHigh && currentPrice < lastSwingHigh) {
        let confluenceScore = 0;
        let reasons: string[] = [];

        // CVD Validation
        if (cvd.length >= 2) {
            const lastCVD = cvd[cvd.length - 1];
            const prevCVD = cvd[cvd.length - 2];

            // Price High, CVD Dropping (Exhaustion/Selling)
            if (lastCVD < prevCVD) {
                confluenceScore += 2;
                reasons.push("CVD Bearish Div");
            }
        }

        // OB Confluence
        if (orderBlocks.bearish) {
            const inBearishOB = orderBlocks.bearish.some((ob: any) =>
                currentHigh >= ob.low && currentHigh <= ob.high && !ob.mitigated
            );

            if (inBearishOB) {
                confluenceScore += 2;
                reasons.push("Test Bearish OB");
            }
        }

        if (confluenceScore >= 2) {
            score = 80 + (confluenceScore * 5);
            signalSide = 'SHORT';
            specificTrigger = 'SFP_BEARISH';
            detectionNote = `💎 SMC SHORT: Barrido de Liquidez (SFP) en ${lastSwingHigh}. Confirmación: ${reasons.join(' + ')}.`;
        }
    }

    return {
        score,
        signalSide,
        detectionNote,
        specificTrigger
    };
}
