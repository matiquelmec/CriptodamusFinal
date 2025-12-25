
import { detectGenericDivergence } from './divergenceDetector';

// MOCK DATA FOR HIDDEN BULLISH DIVERGENCE (Trend Continuation)
// Price: Higher Low (HL)
// MACD: Lower Low (LL)

const candles = [
    { high: 100, low: 80, close: 90 }, // Low 80
    { high: 110, low: 90, close: 100 },
    { high: 120, low: 100, close: 110 },
    { high: 130, low: 110, close: 120 }, // Pullback starts
    { high: 125, low: 85, close: 115 }   // Low 85 (Higher Low vs 80)
];

const macdValues = [
    -10, // Low -10
    -5,
    5,
    10,
    -15  // Low -15 (Lower Low vs -10)
];

console.log("--- TEST: Hidden Bullish Divergence (MACD) ---");
const result = detectGenericDivergence(candles, macdValues, 'MACD', 5);

if (result && result.type === 'HIDDEN_BULLISH') {
    console.log("✅ SUCCESS: Detected Hidden Bullish Divergence");
    console.log(result.description);
} else {
    console.error("❌ FAILURE: Did not detect Hidden Bullish Divergence");
    console.log("Result:", result);
}

// MOCK DATA FOR REGULAR BEARISH (Reversal)
// Price: Higher High
// MACD: Lower High

const candlesBear = [
    { high: 100, low: 80, close: 90 }, // High 100
    { high: 110, low: 90, close: 100 },
    { high: 120, low: 100, close: 110 },
    { high: 125, low: 110, close: 120 },
    { high: 130, low: 85, close: 115 }   // High 130 (Higher High)
];

const macdValuesBear = [
    10, // High 10
    15,
    12,
    11,
    8   // High 8 (Lower High)
];

console.log("\n--- TEST: Regular Bearish Divergence (MACD) ---");
const resultBear = detectGenericDivergence(candlesBear, macdValuesBear, 'MACD', 5);

if (resultBear && resultBear.type === 'BEARISH') {
    console.log("✅ SUCCESS: Detected Regular Bearish Divergence");
    console.log(resultBear.description);
} else {
    console.error("❌ FAILURE: Did not detect Regular Bearish Divergence");
    console.log("Result:", resultBear);
}
