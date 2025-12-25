
import { calculateFractals } from './mathUtils';

// --- TYPES ---
export interface ChartPattern {
    type: 'HEAD_SHOULDERS' | 'INV_HEAD_SHOULDERS' | 'DOUBLE_TOP' | 'DOUBLE_BOTTOM' | 'RISING_WEDGE' | 'FALLING_WEDGE' | 'BULL_FLAG' | 'BEAR_FLAG';
    signal: 'BULLISH' | 'BEARISH';
    confidence: number; // 0 to 1
    priceTarget?: number;
    invalidationLevel?: number;
    description: string;
}

// --- MAIN DETECTOR ---
export const detectChartPatterns = (
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[]
): ChartPattern[] => {
    const patterns: ChartPattern[] = [];
    const { fractalHighs, fractalLows } = calculateFractals(highs, lows);

    // Need minimal history
    if (fractalHighs.length < 3 || fractalLows.length < 3) return patterns;

    // 1. Detect Head & Shoulders (Bearish) & Inverse (Bullish)
    const hs = detectHeadAndShoulders(fractalHighs, fractalLows, volumes);
    if (hs) patterns.push(hs);

    // 2. Detect Double Tops & Bottoms (Reversal)
    const dt = detectDoubleTopBottom(fractalHighs, fractalLows);
    if (dt) patterns.push(dt);

    // 3. Detect Wedges (Converging structure)
    const wedge = detectWedge(fractalHighs, fractalLows);
    if (wedge) patterns.push(wedge);

    return patterns;
};

// --- PATTERN LOGIC ---

// 1. Head & Shoulders
// Bearish: Left Shoulder High < Head High > Right Shoulder High
// Inverse: Left Shoulder Low > Head Low < Right Shoulder Low
function detectHeadAndShoulders(
    fHighs: { price: number, index: number }[],
    fLows: { price: number, index: number }[],
    volumes: number[]
): ChartPattern | null {
    // Look at last 3 High Fractals for Bearish H&S
    const h3 = fHighs[fHighs.length - 1]; // Right Shoulder (Potential)
    const h2 = fHighs[fHighs.length - 2]; // Head
    const h1 = fHighs[fHighs.length - 3]; // Left Shoulder

    // Check basic geometry: Head significantly higher than shoulders
    if (h2.price > h1.price && h2.price > h3.price) {
        // Check alignment of shoulders (roughly equal height)
        const shoulderDiff = Math.abs(h1.price - h3.price);
        const avgShoulderHeight = (h1.price + h3.price) / 2;
        const tolerance = avgShoulderHeight * 0.02; // 2% tolerance

        if (shoulderDiff < tolerance) {
            // Check Neckline (Lows between peaks)
            // We need lows between h1-h2 and h2-h3
            // Simplified: Pattern valid if Head is "sticking out"
            return {
                type: 'HEAD_SHOULDERS',
                signal: 'BEARISH',
                confidence: 0.85, // High confidence structure
                invalidationLevel: h2.price, // Stop above Head
                priceTarget: h1.price - (h2.price - h1.price), // Projected move
                description: 'Hombro-Cabeza-Hombro detectado. Señal bajista clásica de reversión.'
            };
        }
    }

    // Look at last 3 Low Fractals for Inverse H&S
    const l3 = fLows[fLows.length - 1];
    const l2 = fLows[fLows.length - 2];
    const l1 = fLows[fLows.length - 3];

    if (l2.price < l1.price && l2.price < l3.price) {
        const shoulderDiff = Math.abs(l1.price - l3.price);
        const avgShoulderDepth = (l1.price + l3.price) / 2;
        const tolerance = avgShoulderDepth * 0.02;

        if (shoulderDiff < tolerance) {
            return {
                type: 'INV_HEAD_SHOULDERS',
                signal: 'BULLISH',
                confidence: 0.85,
                invalidationLevel: l2.price, // Stop below Head
                priceTarget: l1.price + (l1.price - l2.price),
                description: 'HCH Invertido detectado. Señal alcista de acumulación.'
            };
        }
    }

    return null;
}

// 2. Double Top / Bottom
function detectDoubleTopBottom(
    fHighs: { price: number, index: number }[],
    fLows: { price: number, index: number }[]
): ChartPattern | null {
    // Double Top: Last 2 highs are similar
    const h2 = fHighs[fHighs.length - 1];
    const h1 = fHighs[fHighs.length - 2];

    const topDiff = Math.abs(h1.price - h2.price);
    const avgHeight = (h1.price + h2.price) / 2;

    if (topDiff < avgHeight * 0.015) { // 1.5% tolerance (tight)
        return {
            type: 'DOUBLE_TOP',
            signal: 'BEARISH',
            confidence: 0.75,
            invalidationLevel: Math.max(h1.price, h2.price) * 1.01,
            description: `Doble Techo en ${avgHeight.toFixed(2)}. Resistencia validada dos veces.`
        };
    }

    // Double Bottom
    const l2 = fLows[fLows.length - 1];
    const l1 = fLows[fLows.length - 2];

    const botDiff = Math.abs(l1.price - l2.price);
    const avgDepth = (l1.price + l2.price) / 2;

    if (botDiff < avgDepth * 0.015) {
        return {
            type: 'DOUBLE_BOTTOM',
            signal: 'BULLISH',
            confidence: 0.75,
            invalidationLevel: Math.min(l1.price, l2.price) * 0.99,
            description: `Doble Suelo en ${avgDepth.toFixed(2)}. Soporte validado.`
        };
    }

    return null;
}

// 3. Wedges (Strict)
function detectWedge(
    fHighs: { price: number, index: number }[],
    fLows: { price: number, index: number }[]
): ChartPattern | null {
    // Need at least 3 points each to verify conversion
    if (fHighs.length < 3 || fLows.length < 3) return null;

    // Check last 3 highs and 3 lows
    // Rising Wedge: Highs rising, Lows rising, but converging
    // Falling Wedge: Highs falling, Lows falling, but converging only (slope difference)

    // Simplified Detection:
    // Falling Wedge (Bullish): Lower Highs AND Lower Lows
    const h3 = fHighs[fHighs.length - 1]; // recent
    const h2 = fHighs[fHighs.length - 2];
    const h1 = fHighs[fHighs.length - 3]; // oldest

    const l3 = fLows[fLows.length - 1];
    const l2 = fLows[fLows.length - 2];
    const l1 = fLows[fLows.length - 3];

    // Falling Wedge
    const isLowerHighs = h3.price < h2.price && h2.price < h1.price;
    const isLowerLows = l3.price < l2.price && l2.price < l1.price;

    if (isLowerHighs && isLowerLows) {
        // Check convergence? Slope calculation is ideal but complex here.
        // If range is tightening, it's a wedge.
        const range1 = h1.price - l1.price;
        const range3 = h3.price - l3.price;

        if (range3 < range1 * 0.8) { // Range contracted by 20%
            return {
                type: 'FALLING_WEDGE',
                signal: 'BULLISH',
                confidence: 0.80,
                description: 'Cuña Descendente. Compresión de precio y agotamiento de vendedores.',
                invalidationLevel: l3.price * 0.98
            };
        }
    }

    // Rising Wedge (Bearish)
    const isHigherHighs = h3.price > h2.price && h2.price > h1.price;
    const isHigherLows = l3.price > l2.price && l2.price > l1.price;

    if (isHigherHighs && isHigherLows) {
        const range1 = h1.price - l1.price;
        const range3 = h3.price - l3.price;

        if (range3 < range1 * 0.8) {
            return {
                type: 'RISING_WEDGE',
                signal: 'BEARISH',
                confidence: 0.80,
                description: 'Cuña Ascendente. Compresión alcista indicando posible agotamiento.',
                invalidationLevel: h3.price * 1.02
            };
        }
    }

    return null;
}
