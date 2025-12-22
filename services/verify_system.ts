import { calculateFractals, calculateAutoFibs } from './mathUtils';
import { detectHarmonicPatterns } from './harmonicPatterns';
import { generateDCAExecutionPlan } from './dcaReportGenerator';
import { calculatePOIs } from './confluenceEngine';

// --- MOCK DATA GENERATION ---
// Create a fake chart with a Harmonic Pattern (Bullish Gartley)
const prices: number[] = [];
const highs: number[] = [];
const lows: number[] = [];

// X=100, A=150, B=120 (0.618 ret), C=140, D=112 (0.786 ret)
const points = [
    { p: 100, type: 'LOW' },  // X
    { p: 150, type: 'HIGH' }, // A
    { p: 120, type: 'LOW' },  // B
    { p: 140, type: 'HIGH' }, // C
    { p: 112, type: 'LOW' }   // D
];

let idx = 0;
// Generate 5 candles per leg to simulate movement
points.forEach((pt, i) => {
    if (i === 0) return;
    const prev = points[i - 1];
    const steps = 10;
    const stepSize = (pt.p - prev.p) / steps;

    for (let j = 0; j <= steps; j++) {
        const p = prev.p + (stepSize * j);
        prices.push(p);
        highs.push(p + 1);
        lows.push(p - 1);
    }
});

// Force fractal points at the peaks/valleys
// We need to verify calculateFractals finds them.
// Note: calculateFractals needs 2 candles before and 2 after.
// Our simple linear generation might miss exact fractal "shape" (peak surrounded by lower highs).
// Let's rely on the direct math check or injecting specific fractal shapes if needed.
// For now, let's assume the previous unit test validated Fractals and focus on HARMONICS + REPORT.

// Manually passing fractal points as if they were detected (to test Harmonics isolation)
// Indexes approx: X=0, A=10, B=20, C=30, D=40
const fractalHighs = [{ price: 150, index: 10 }, { price: 140, index: 30 }];
const fractalLows = [{ price: 100, index: 0 }, { price: 120, index: 20 }, { price: 112, index: 40 }];

console.log("--- 1. TESTING HARMONICS DETECTION ---");
const patterns = detectHarmonicPatterns(prices, highs, lows, fractalHighs, fractalLows);
console.log("Patterns Found:", patterns.length);
if (patterns.length > 0) {
    console.log("Pattern Type:", patterns[0].type);
    console.log("Direction:", patterns[0].direction);
    if (patterns[0].type === 'GARTLEY') console.log("✅ Custom Gartley Detected");
} else {
    console.log("❌ No patterns found (Check mocks)");
}

console.log("\n--- 2. TESTING FRACTAL FIBONACCI LEVELS ---");
// Simulate AutoFibs
const fibs = calculateAutoFibs(highs, lows, 130); // EMA 130
console.log("Fib 0.618:", fibs.level0_618);
console.log("Fib 0.65 (New):", fibs.level0_65);
console.log("Fib 0.886 (New):", fibs.level0_886);
if (fibs.level0_65 && fibs.level0_886) console.log("✅ Institutional Levels Present");
else console.log("❌ Missing Institutional Levels");

console.log("\n--- 3. TESTING REPORT GENERATION (DCA) ---");
// Mock Confluence Analysis
const ca = {
    score: 80,
    supportPOIs: [],
    resistancePOIs: [],
    topSupports: [],
    topResistances: []
};

// Mock Market Regime
const regime = {
    regime: 'RANGE',
    confidence: 80,
    volatilityStatus: 'NORMAL',
    description: 'Testing',
    action: 'DCA',
    strategyId: 'test'
};

const report = generateDCAExecutionPlan(
    115, // Current Price (near D point)
    2.5, // ATR
    fibs, // Passed Fibs
    ca as any, // Mock CA
    regime as any,
    'LONG'
);

// CHECK FOR KEYWORDS IN REPORT
const hasGolden = report.includes("0.618");
const hasInstitutional = report.includes("0.65");
const hasDeep = report.includes("0.886");
const hasPhilosophy = report.includes("Promediación Inteligente");

console.log("Report Length:", report.length);
console.log("Mentions 0.618?", hasGolden);
console.log("Mentions 0.65  (Sniper)?", hasInstitutional);
console.log("Mentions 0.886 (Deep)?", hasDeep);
console.log("Contains Philosophy?", hasPhilosophy);

if (hasInstitutional && hasDeep) {
    console.log("✅ REPORT VERIFIED: Contains new Institutional Logic.");
} else {
    console.log("❌ REPORT FAILED: Missing new logic text.");
    console.log(report.substring(0, 500)); // Print preview to debug
}
