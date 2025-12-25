
import { analyzeRSIExpert } from './rsiExpert';

// Mock Data Utilities
function createTrend(start: number, count: number, step: number): number[] {
    return Array.from({ length: count }, (_, i) => start + (i * step));
}

function createRSITrend(values: number[]): number[] {
    return values;
}

// TEST 1: CARDWELL BULLISH RANGE
// RSI bouncing between 40 and 80
console.log("\n--- TEST 1: CARDWELL BULLISH RANGE ---");
const prices1 = createTrend(100, 50, 1);
const rsi1 = Array(50).fill(0).map((_, i) => 45 + (Math.sin(i * 0.5) * 35)); // 10 to 80 range? 45-35=10, 45+35=80.
// Let's force it to be purely > 40
const rsiBull = Array(60).fill(0).map((_, i) => 60 + Math.sin(i) * 15); // 45 to 75
const result1 = analyzeRSIExpert(prices1, rsiBull);
console.log("Range Detected:", result1.range.type); // Expect BULL_MARKET or SUPER_BULL if high enough


// TEST 2: POSITIVE REVERSAL (Hidden Bullish)
// Price: Higher Low
// RSI: Lower Low
console.log("\n--- TEST 2: POSITIVE REVERSAL (TARGET) ---");
const prices2 = [
    100, 105, 110, 100, // W Pivot (Low) -> Price 100
    115, 120, 125,      // X Pivot (High) -> Price 125
    105, 102, 105       // Y Pivot (Low) -> Price 102 (Higher Low vs 100)
];
const rsi2 = [
    40, 50, 60, 40,     // W Pivot (Low) -> RSI 40
    70, 80, 70,         // X Pivot
    35, 30, 35          // Y Pivot (Low) -> RSI 30 (Lower Low vs 40)
];

// Logic: Price Higher Low (102 > 100) AND RSI Lower Low (30 < 40)
// Target = X + (Y - W) = 125 + (102 - 100) = 127
const result2 = analyzeRSIExpert(prices2, rsi2);
if (result2.reversalTarget) {
    console.log("Reversal Detected:", result2.reversalTarget.type);
    console.log("Target Price:", result2.reversalTarget.targetPrice);
    console.log("Pattern:", result2.reversalTarget.pattern);
} else {
    console.log("No reversal detected.");
}
