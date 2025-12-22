export interface HarmonicPattern {
    type: 'GARTLEY' | 'BAT' | 'BUTTERFLY' | 'CRAB';
    direction: 'BULLISH' | 'BEARISH';
    startIndex: number;
    endIndex: number;
    points: { X: number; A: number; B: number; C: number; D: number };
    prz: number; // Potential Reversal Zone
    stopLoss: number;
    takeProfits: [number, number];
    confidence: number; // 0-100 score based on ratio precision
}

interface SwingPoint {
    price: number;
    index: number;
    type: 'HIGH' | 'LOW';
}

/**
 * Detects Harmonic Patterns in the provided candles using Fractally identified swings.
 */
export function detectHarmonicPatterns(
    prices: number[],
    highs: number[],
    lows: number[],
    fractalHighs: { price: number; index: number }[],
    fractalLows: { price: number; index: number }[]
): HarmonicPattern[] {
    const patterns: HarmonicPattern[] = [];

    // Combine highs/lows into a single chronological sequence of swings
    const swings: SwingPoint[] = [
        ...fractalHighs.map(f => ({ price: f.price, index: f.index, type: 'HIGH' as const })),
        ...fractalLows.map(f => ({ price: f.price, index: f.index, type: 'LOW' as const }))
    ].sort((a, b) => a.index - b.index);

    if (swings.length < 5) return [];

    // Iterate through sets of 5 consecutive swing points (X, A, B, C, D candidates)
    for (let i = swings.length - 1; i >= 4; i--) {
        const D = swings[i];
        const C = swings[i - 1];
        const B = swings[i - 2];
        const A = swings[i - 3];
        const X = swings[i - 4];

        // Ensure alternating High/Low sequence
        if (D.type === C.type) continue; // Should effectively not happen if fractals are alternating well, but safer to check

        // Check for Bullish Patterns (Start High, Down, Up, Down, Up?? No. M or W shape)
        // Bullish Harmonic shape is 'M' (X high, A low, B high, C low, D high?? WAIT)
        // Let's visualize Bullish Gartley: X(Low) -> A(High) -> B(Low) -> C(High) -> D(Low)
        // It's a "W" shape variation. Prices reverse UP from D.

        // Bullish: X=Low, A=High, B=Low, C=High, D=Low
        if (X.type === 'LOW' && A.type === 'HIGH' && B.type === 'LOW' && C.type === 'HIGH' && D.type === 'LOW') {
            const pattern = checkBullishRatios(X.price, A.price, B.price, C.price, D.price, X.index, D.index);
            if (pattern) patterns.push(pattern);
        }

        // Bearish: X=High, A=Low, B=High, C=Low, D=High (M shape)
        if (X.type === 'HIGH' && A.type === 'LOW' && B.type === 'HIGH' && C.type === 'LOW' && D.type === 'HIGH') {
            const pattern = checkBearishRatios(X.price, A.price, B.price, C.price, D.price, X.index, D.index);
            if (pattern) patterns.push(pattern);
        }

        // Optimization: Don't look too far back if we found a recent one? 
        // Expert mode wants thoroughness, but let's limit to most recent 2-3 candidates to avoid noise.
        if (patterns.length >= 2) break;
    }

    return patterns;
}

const ERROR_MARGIN = 0.05; // 5% tolerance for ratios

function almostEqual(a: number, b: number, tolerance: number = ERROR_MARGIN): boolean {
    return Math.abs(a - b) <= (b * tolerance);
}

function checkBullishRatios(X: number, A: number, B: number, C: number, D: number, idxX: number, idxD: number): HarmonicPattern | null {
    const XA = A - X;
    const AB = A - B;
    const BC = C - B;
    const CD = C - D;
    const AD = A - D; // Retracement of XA by D (for Gartley/Bat) or Extension for Crab/Butterfly

    // Ratios
    const ratio_XB = AB / XA; // B retracement of XA
    const ratio_AC = BC / AB; // C retracement of AB
    const ratio_BD = CD / BC; // D extension of BC
    const ratio_XD = (A - D) / XA; // D retracement of XA (Wait, D is low. Price diff is X to D? No. D level relative to XA range)
    // For Bullish: D is below A. Retracement = (A-D)/(A-X) = (A-D)/XA
    // Wait, standard def: B point retracement = (A-B)/(A-X).
    // D point retracement = (A-D)/(A-X).

    // Correct Calculation of Retracements relative to XA Leg
    const bRetracement = (A - B) / (A - X);
    const dRetracement = (A - D) / (A - X); // Note: For extension patterns, D is below X, so this > 1.0

    // 1. GARTLEY (Bullish)
    // B = 0.618 of XA
    // D = 0.786 of XA
    if (almostEqual(bRetracement, 0.618)) {
        if (almostEqual(dRetracement, 0.786)) {
            return createPattern('GARTLEY', 'BULLISH', X, A, B, C, D, idxX, idxD, 0.786);
        }
    }

    // 2. BAT (Bullish)
    // B = 0.382 - 0.50 of XA
    // D = 0.886 of XA
    if (bRetracement >= 0.382 - ERROR_MARGIN && bRetracement <= 0.50 + ERROR_MARGIN) {
        if (almostEqual(dRetracement, 0.886)) {
            return createPattern('BAT', 'BULLISH', X, A, B, C, D, idxX, idxD, 0.886);
        }
    }

    // 3. BUTTERFLY (Bullish) - Extension
    // B = 0.786 of XA
    // D = 1.272 or 1.618 of XA (External retracement, D below X)
    // Calculation: Total drop A to D vs Rise X to A?
    // Convention: Extension > 1.0 means D crossed X.
    const dExtension = (A - D) / (A - X);

    if (almostEqual(bRetracement, 0.786)) {
        if (almostEqual(dExtension, 1.272) || almostEqual(dExtension, 1.618)) {
            return createPattern('BUTTERFLY', 'BULLISH', X, A, B, C, D, idxX, idxD, dExtension);
        }
    }

    // 4. CRAB (Bullish) - Deep Extension
    // B = 0.382 - 0.618
    // D = 1.618 of XA
    if (bRetracement >= 0.382 - ERROR_MARGIN && bRetracement <= 0.618 + ERROR_MARGIN) {
        if (almostEqual(dExtension, 1.618)) {
            return createPattern('CRAB', 'BULLISH', X, A, B, C, D, idxX, idxD, 1.618);
        }
    }

    return null;
}

function checkBearishRatios(X: number, A: number, B: number, C: number, D: number, idxX: number, idxD: number): HarmonicPattern | null {
    // Bearish: X(High) -> A(Low) -> B(High) -> C(Low) -> D(High)
    // XA is Down. AB is Up.
    const XA_integrity = X - A;

    // B Retracement: (B - A) / (X - A)
    const bRetracement = (B - A) / (X - A);
    // D Retracement: (D - A) / (X - A)
    // Note: If D > X, this > 1.0 (Extension)
    const dRetracement = (D - A) / (X - A);

    // 1. GARTLEY (Bearish)
    // B = 0.618
    // D = 0.786
    if (almostEqual(bRetracement, 0.618)) {
        if (almostEqual(dRetracement, 0.786)) {
            return createPattern('GARTLEY', 'BEARISH', X, A, B, C, D, idxX, idxD, 0.786);
        }
    }

    // 2. BAT (Bearish)
    // B = 0.382 - 0.50
    // D = 0.886
    if (bRetracement >= 0.382 - ERROR_MARGIN && bRetracement <= 0.50 + ERROR_MARGIN) {
        if (almostEqual(dRetracement, 0.886)) {
            return createPattern('BAT', 'BEARISH', X, A, B, C, D, idxX, idxD, 0.886);
        }
    }

    // 3. BUTTERFLY (Bearish)
    // B = 0.786
    // D = 1.27 or 1.618 (Extension above X)
    if (almostEqual(bRetracement, 0.786)) {
        if (almostEqual(dRetracement, 1.272) || almostEqual(dRetracement, 1.618)) {
            return createPattern('BUTTERFLY', 'BEARISH', X, A, B, C, D, idxX, idxD, dRetracement);
        }
    }

    // 4. CRAB (Bearish)
    // B = 0.382 - 0.618
    // D = 1.618
    if (bRetracement >= 0.382 - ERROR_MARGIN && bRetracement <= 0.618 + ERROR_MARGIN) {
        if (almostEqual(dRetracement, 1.618)) {
            return createPattern('CRAB', 'BEARISH', X, A, B, C, D, idxX, idxD, 1.618);
        }
    }

    return null;
}

function createPattern(
    type: HarmonicPattern['type'],
    direction: 'BULLISH' | 'BEARISH',
    X: number, A: number, B: number, C: number, D: number,
    startIdx: number, endIdx: number,
    dRatio: number
): HarmonicPattern {
    const xaHeight = Math.abs(X - A);
    const stopLoss = direction === 'BULLISH'
        ? X - (xaHeight * 0.1) // Below X
        : X + (xaHeight * 0.1); // Above X

    // Standard Targets: TP1 = 0.382 of AD, TP2 = 0.618 of AD
    const adHeight = Math.abs(A - D);
    const tp1 = direction === 'BULLISH' ? D + (adHeight * 0.382) : D - (adHeight * 0.382);
    const tp2 = direction === 'BULLISH' ? D + (adHeight * 0.618) : D - (adHeight * 0.618);

    // Calculate confidence based on pattern clarity (simple heuristic for now)
    const confidence = 85;

    return {
        type,
        direction,
        startIndex: startIdx,
        endIndex: endIdx,
        points: { X, A, B, C, D },
        prz: D,
        stopLoss,
        takeProfits: [tp1, tp2],
        confidence
    };
}
