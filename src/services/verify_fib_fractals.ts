import { calculateFractals, calculateAutoFibs } from './mathUtils';

// Mock Data: Uptrend with a clear pullback
const highs: number[] = [];
const lows: number[] = [];
const closes: number[] = [];

// Generar tendencia
for (let i = 0; i < 50; i++) {
    const price = 100 + i * 2;
    highs.push(price + 2);
    lows.push(price - 2);
    closes.push(price);
}

// Generar Fractal High en 200
highs[48] = 205; // Peak
highs[49] = 200;
highs[47] = 200;
highs[46] = 198;
highs[45] = 196;

// Retracement
for (let i = 0; i < 20; i++) {
    const price = 200 - i;
    highs.push(price + 1);
    lows.push(price - 1);
    closes.push(price);
}

const ema200 = 100; // Force Uptrend

console.log("--- TEST FRACTALS ---");
const { fractalHighs, fractalLows } = calculateFractals(highs, lows);
console.log(`Fractal Highs Found: ${fractalHighs.length}`);
if (fractalHighs.length > 0) console.log("Last Fractal High:", fractalHighs[fractalHighs.length - 1]);

console.log("\n--- TEST AUTO FIBS ---");
const fibs = calculateAutoFibs(highs, lows, ema200);
console.log("Trend:", fibs.trend);
console.log("Level 0 (Top):", fibs.level0);
console.log("Level 1 (Bottom):", fibs.level1);
console.log("Golden Pocket Top (0.618):", fibs.level0_618);
if ('level0_65' in fibs) console.log("Golden Pocket Low (0.65):", fibs.level0_65);
if ('level0_886' in fibs) console.log("Deep (0.886):", fibs.level0_886);

// Validations
if (fibs.level0_65 && fibs.level0_886) {
    console.log("SUCCESS: New institutional levels detected.");
} else {
    console.error("FAIL: Missing institutional levels.");
}
