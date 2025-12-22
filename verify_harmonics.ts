import { detectHarmonicPatterns } from './services/harmonicPatterns';

// Mock Data: Bullish Gartley
// X (Low), A (High), B (0.618 Retrace), C (0.786 Retrace of AB), D (0.786 Retrace of XA)

const prices: number[] = [];
const highs: number[] = [];
const lows: number[] = [];

// X = 100
// A = 200
// B = 200 - (100 * 0.618) = 138.2
// C = 138.2 + ((200 - 138.2) * 0.786) approx 186.7
// D = 200 - (100 * 0.786) = 121.4

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
    // Fill gaps
    for (let k = 0; k < 5; k++) {
        prices.push(pt.p);
        highs.push(pt.p);
        lows.push(pt.p);
        idx++;
    }
    // Register fractal manually to skip full calculation
    if (pt.type === 'HIGH') fractalHighs.push({ price: pt.p, index: idx - 3 });
    else fractalLows.push({ price: pt.p, index: idx - 3 });
});

console.log("--- TEST HARMONICS ---");
const patterns = detectHarmonicPatterns(prices, highs, lows, fractalHighs, fractalLows);
console.log(`Patterns Found: ${patterns.length}`);

if (patterns.length > 0) {
    const p = patterns[0];
    console.log(`Type: ${p.type}`); // Should be GARTLEY
    console.log(`Direction: ${p.direction}`); // Should be BULLISH
    console.log(`Confidence: ${p.confidence}`);

    if (p.type === 'GARTLEY' && p.direction === 'BULLISH') {
        console.log("SUCCESS: Bullish Gartley detected.");
    } else {
        console.error("FAIL: Incorrect pattern detected.");
    }
} else {
    console.error("FAIL: No pattern detected.");
}
