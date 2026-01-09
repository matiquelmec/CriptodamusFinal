import { calculatePOIs } from './backend/src/core/services/confluenceEngine.ts';
import { detectHarmonicPatterns } from './backend/src/core/services/harmonicDetector.ts';
import { detectChartPatterns } from './backend/src/core/services/chartPatterns.ts';

async function testStructuralAwakening() {
    console.log("🧪 Testing Structural Awakening (Geometry + Harmonics)...");

    // Mock Data for a Falling Wedge + Bullish Bat Pattern
    const currentPrice = 90500;
    const atr = 1000;

    // 1. HARMONIC TEST
    // Simplified fractal points for a Bat: X(90k), A(95k), B(92k), C(94k), D(90.5k)
    // Ratios: B is ~0.4 of XA. D is ~0.88 of XA.
    const highs = [90000, 95000, 92000, 94000, 90500]; // Dummy simplified
    // Actually, detectHarmonicPatterns needs real candles to find fractals.
    // Let's mock the fractals directly in the call if we were testing the engine,
    // but here we test the CONFLUENCE of the results.

    const mockHarmonics = [{
        type: 'BAT' as any,
        direction: 'BULLISH' as any,
        prz: 90500,
        confidence: 0.9
    }];

    const mockPatterns = [{
        type: 'FALLING_WEDGE' as any,
        signal: 'BULLISH' as any,
        confidence: 0.8,
        invalidationLevel: 90000,
        description: 'Falling Wedge'
    }];

    const fibs = { level0_618: 90500 } as any;
    const pivots = { p: 90500 } as any;

    console.log("\nScenario: Falling Wedge + Bat Pattern + Fibonacci 0.618");
    const confluence = calculatePOIs(
        currentPrice, fibs, pivots, 90000, 90500, atr,
        { poc: 0 } as any, [], [], [], [],
        mockHarmonics, undefined, [], mockPatterns
    );

    const bestSupport = confluence.topSupports[0];
    console.log(`- Top Support Price: $${bestSupport.price.toFixed(2)}`);
    console.log(`- Score: ${bestSupport.score}`);
    console.log(`- Factors: ${bestSupport.factors.join(", ")}`);

    if (bestSupport.factors.some(f => f.includes("BAT"))) {
        console.log("✅ SUCCESS: Harmonic Pattern integrated into POI.");
    } else {
        console.log("❌ FAILURE: Harmonic Pattern missing from factors.");
    }

    if (bestSupport.factors.some(f => f.includes("WEDGE"))) {
        console.log("✅ SUCCESS: Chart Pattern integrated into POI.");
    } else {
        console.log("❌ FAILURE: Chart Pattern missing from factors.");
    }

    if (bestSupport.score >= 12) {
        console.log("✅ SUCCESS: Combined structural score reflects institutional grade confluene.");
    } else {
        console.log(`❌ FAILURE: Score too low (${bestSupport.score})`);
    }
}

testStructuralAwakening().catch(console.error);
