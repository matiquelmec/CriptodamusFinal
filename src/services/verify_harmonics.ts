import { detectHarmonicPatterns } from './harmonicPatterns';

// Mock Data: Bullish Gartley
const prices: number[] = [];
const highs: number[] = [];
const lows: number[] = [];

// X = 100, A = 200, B = 138.2, C = 186.7, D = 121.4
const points = [
    { p: 100, type: 'LOW' }, // X
    { p: 200, type: 'HIGH' }, // A
    { p: 138.2, type: 'LOW' }, // B (0.618)
    { p: 186.7, type: 'HIGH' }, // C
    { p: 121.4, type: 'LOW' } // D (0.786)
];

let idx = 0;
const fractalHighs: any[] = [];
const fractalLows: any[] = [];

points.forEach((pt, i) => {
    for (let k = 0; k < 5; k++) {
        prices.push(pt.p);
        highs.push(pt.p);
        lows.push(pt.p);
        idx++; // 0-4, 5-9...
    }
    // Register fractal manually
    // Index of the "peak" logic depends on where we verify.
    // detectHarmonicPatterns uses the index property stored in fractal objects.
    if (pt.type === 'HIGH') fractalHighs.push({ price: pt.p, index: idx - 3 });
    else fractalLows.push({ price: pt.p, index: idx - 3 });
});

console.log("--- TEST HARMONICS ---");
const patterns = detectHarmonicPatterns(prices, highs, lows, fractalHighs, fractalLows);
console.log(`Patterns Found: ${patterns.length}`);

if (patterns.length > 0) {
    const p = patterns[0];
    console.log(`Type: ${p.type}`);
    console.log(`Direction: ${p.direction}`);
    console.log(`Confidence: ${p.confidence}`);

    if (p.type === 'GARTLEY' && p.direction === 'BULLISH') {
        console.log("SUCCESS: Bullish Gartley detected.");
    } else {
        console.error("FAIL: Incorrect pattern detected.");
    }
} else {
    console.error("FAIL: No pattern detected.");
}
