
import { IndicatorCalculator } from './engine/pipeline/IndicatorCalculator';

// Mock candles (minimal needed for calc)
const mockCandles = Array(300).fill(0).map((_, i) => ({
    open: 100 + i,
    high: 105 + i,
    low: 95 + i,
    close: 102 + i,
    volume: 1000
}));

try {
    console.log("Running IndicatorCalculator Test...");
    const result = IndicatorCalculator.compute("BTC/USDT", mockCandles);

    console.log("Keys in Result:", Object.keys(result));

    // CHECK 1: Fibonacci
    if (result.fibonacci) {
        console.log("✅ Success: 'fibonacci' property exists.");
        if (result.fibonacci.level0_236 !== undefined) {
            console.log("✅ Validation Passed: level0_236 is accessible.");
        } else {
            console.error("❌ Error: level0_236 is undefined inside fibonacci object.");
            process.exit(1);
        }
    } else {
        console.error("❌ Failure: 'fibonacci' property is MISSING.");
        process.exit(1);
    }

    // CHECK 2: Pivots (s2)
    if (result.pivots) {
        console.log("✅ Success: 'pivots' property exists.");
        if (result.pivots.s2 !== undefined) {
            console.log("✅ Validation Passed: pivots.s2 is accessible.");
        } else {
            console.error("❌ Failure: 'pivots.s2' is undefined.");
            process.exit(1);
        }
    } else {
        console.error("❌ Failure: 'pivots' property is MISSING. (Did you Rename pivotPoints -> pivots?)");
        process.exit(1);
    }

    // CHECK 3: Bollinger (upper)
    if (result.bollinger) {
        console.log("✅ Success: 'bollinger' property exists.");
        if (result.bollinger.upper !== undefined) {
            console.log("✅ Validation Passed: bollinger.upper is accessible.");
        } else {
            console.error("❌ Failure: 'bollinger.upper' is undefined.");
            process.exit(1);
        }
    } else {
        console.error("❌ Failure: 'bollinger' property is MISSING. (Did you rename bollingerBands -> bollinger?)");
        process.exit(1);
    }

    console.log("🎉 ALL CHECKS PASSED. CODE IS SAFE TO PUSH.");

} catch (e) {
    console.error("Test Crash:", e);
    process.exit(1);
}
