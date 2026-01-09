import { HarmonicPattern } from '../types/types-advanced';
import { calculateFractals } from './mathUtils';

/**
 * Institutional Harmonic Detection Engine
 * 
 * Harmonics are the "Geometric Laws" of the market. 
 * They identify Potential Reversal Zones (PRZ) where Fibonacci ratios 
 * across 5 points (XABCD) converge.
 */

export const detectHarmonicPatterns = (
    highs: number[],
    lows: number[]
): HarmonicPattern[] => {
    const patterns: HarmonicPattern[] = [];
    const { fractalHighs, fractalLows } = calculateFractals(highs, lows);

    // Combine all fractals and sort by index to get chronological structure
    const allFractals = [...fractalHighs, ...fractalLows].sort((a, b) => a.index - b.index);

    // We need at least 5 points for an XABCD pattern
    if (allFractals.length < 5) return patterns;

    // Slide window of 5 points to detect patterns
    for (let i = 0; i <= allFractals.length - 5; i++) {
        const p1 = allFractals[i];     // X
        const p2 = allFractals[i + 1]; // A
        const p3 = allFractals[i + 2]; // B
        const p4 = allFractals[i + 3]; // C
        const p5 = allFractals[i + 4]; // D (Potential)

        const pattern = validateXABCD(p1, p2, p3, p4, p5);
        if (pattern) {
            // Check if D is recent (within last N candles) 
            // This ensures we only trade ACTIVE harmonics
            const lastCandleIndex = highs.length - 1;
            if (lastCandleIndex - p5.index < 20) {
                patterns.push(pattern);
            }
        }
    }

    return patterns;
};

function validateXABCD(X: any, A: any, B: any, C: any, D: any): HarmonicPattern | null {
    // Basic Direction Check
    const isBullish = X.price < A.price; // XA is up (Bullish Harmonic usually ends with D as a buy point)

    // Leg Lengths
    const XA = Math.abs(A.price - X.price);
    const AB = Math.abs(B.price - A.price);
    const BC = Math.abs(C.price - B.price);
    const CD = Math.abs(D.price - C.price);
    const XD = Math.abs(D.price - X.price);

    // Fibonacci Ratios
    const b_xa = AB / XA;
    const c_ab = BC / AB;
    const d_bc = CD / BC;
    const d_xa = Math.abs(D.price - X.price) / XA; // This is actually AD/XA or similar depending on pattern

    // --- 1. GARTLEY ---
    // B: 0.618 of XA
    // D: 0.786 of XA (PRZ)
    if (isNear(b_xa, 0.618, 0.05) && isNear(d_xa, 0.786, 0.05)) {
        return {
            type: 'GARTLEY',
            direction: isBullish ? 'BULLISH' : 'BEARISH',
            prz: D.price,
            confidence: 0.9,
            ratios: { b_xa, c_ab, d_bc }
        };
    }

    // --- 2. BAT ---
    // B: 0.382 or 0.50 of XA
    // D: 0.886 of XA (PRZ)
    if ((isNear(b_xa, 0.382, 0.05) || isNear(b_xa, 0.5, 0.05)) && isNear(d_xa, 0.886, 0.05)) {
        return {
            type: 'BAT',
            direction: isBullish ? 'BULLISH' : 'BEARISH',
            prz: D.price,
            confidence: 0.85,
            ratios: { b_xa, c_ab, d_bc }
        };
    }

    // --- 3. BUTTERFLY (Extension Pattern) ---
    // B: 0.786 of XA
    // D: 1.27 to 1.618 of XA
    if (isNear(b_xa, 0.786, 0.05) && (isNear(d_xa, 1.27, 0.07) || isNear(d_xa, 1.618, 0.07))) {
        return {
            type: 'BUTTERFLY',
            direction: isBullish ? 'BULLISH' : 'BEARISH',
            prz: D.price,
            confidence: 0.88,
            ratios: { b_xa, c_ab, d_bc }
        };
    }

    // --- 4. CRAB (Extreme Extension) ---
    // B: 0.382 to 0.618 of XA
    // D: 1.618 of XA
    if (b_xa <= 0.618 && isNear(d_xa, 1.618, 0.05)) {
        return {
            type: 'CRAB',
            direction: isBullish ? 'BULLISH' : 'BEARISH',
            prz: D.price,
            confidence: 0.82,
            ratios: { b_xa, c_ab, d_bc }
        };
    }

    return null;
}

function isNear(val: number, target: number, tolerance: number): boolean {
    return Math.abs(val - target) <= tolerance;
}
