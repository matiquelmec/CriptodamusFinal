
import { calculateZScore, calculateSlope, detectPinballState } from './mathUtils';

// MOCK DATA
const mockPrices = [
    100, 101, 102, 103, 104, 105, 106, 107, 108, 109, // 0-9
    108, 107, 106, 105, 104, 103, 102, 101, 100, 99,   // 10-19
    98, 97, 96, 95, 94, 93, 92                           // 20-26
];

// 1. VERIFY Z-SCORE
const zScore = calculateZScore(mockPrices, 90, 20); // Price 92, Mean ~102, StdDev ~5
// (92 - 90) / 5 = 0.4?? No, calculateZScore logic:
// Mean of last 20 prices. StdDev of last 20 prices.
// Then (CurrentPrice - EMA200) / StdDev.
// Let's assume EMA200 is 100.
// Current Price is 92.
// Diff is -8.
// If StdDev is 4.
// Z = -2.0.

const ema200 = 100;
const computedZ = calculateZScore(mockPrices, ema200, 20);
console.log(`Test Z-Score (Price 92, EMA 100): ${computedZ.toFixed(2)}`);

// 2. VERIFY SLOPE
const flatSeries = [100, 100, 100, 100, 100];
const steepSeries = [100, 102, 104, 106, 108];
const downSeries = [100, 98, 96, 94, 92];

console.log(`Slope Flat: ${calculateSlope(flatSeries)} (Expected ~0)`);
console.log(`Slope Steep: ${calculateSlope(steepSeries)} (Expected > 0)`);
console.log(`Slope Down: ${calculateSlope(downSeries)} (Expected < 0)`);

// 3. VERIFY PINBALL STATE
// Scenario: Bear Market (EMA50 < EMA200).
// Price bounces up to between 50 and 200.
const ema50_Bear = 90;
const ema200_Bear = 100;
const price_PinballSell = 95;

const state = detectPinballState(price_PinballSell, ema50_Bear, ema200_Bear, 'BEARISH');
console.log(`Pinball State (Bearish, Price 95, 50=90, 200=100): ${state} (Expected PINBALL_SELL)`);

const price_Normal = 85;
const state2 = detectPinballState(price_Normal, ema50_Bear, ema200_Bear, 'BEARISH');
console.log(`Pinball State (Bearish, Price 85): ${state2} (Expected null)`);
