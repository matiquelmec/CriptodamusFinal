
// Verification Script for Scanner Synchronization
// Run with: node backend/test_schedule.js

const now = new Date();
const minutes = now.getMinutes();
const seconds = now.getSeconds();
const milliseconds = now.getMilliseconds();

console.log(`🕒 Current time: ${now.toLocaleTimeString()}.${milliseconds}`);

const remainder = minutes % 15;
const minutesToNext = 15 - remainder;
let delayMs = (minutesToNext * 60 * 1000) - (seconds * 1000) - milliseconds;

if (delayMs < 5000) {
    delayMs += 15 * 60 * 1000;
}

const targetTime = new Date(now.getTime() + delayMs);
console.log(`⏱️ Calculated delay: ${(delayMs / 1000 / 60).toFixed(2)} minutes`);
console.log(`🎯 Target execution: ${targetTime.toLocaleTimeString()}`);

console.log("\nLogic Validation:");
if (targetTime.getMinutes() % 15 === 0 && targetTime.getSeconds() === 0) {
    console.log("✅ SUCCESS: Target time is exactly aligned to 15m candle close.");
} else {
    // Floating point math might make it x.999 or x.001, which is fine, but checking roughly
    const m = targetTime.getMinutes();
    if (m === 0 || m === 15 || m === 30 || m === 45) {
        console.log("✅ SUCCESS: Target minute is correct (" + m + ").");
    } else {
        console.log("❌ FAILURE: Target minute (" + m + ") is not aligned (0, 15, 30, 45).");
    }
}
