import { calculatePOIs } from './backend/src/core/services/confluenceEngine.ts';

async function testGodMode() {
    console.log("🧪 Testing God Mode Confluence (Liquidity Integration)...");

    const currentPrice = 91000;
    const atr = 1500;

    // Mock Technical Data
    const fibs = { level0_618: 91100 }; // Very close to current
    const pivots = { p: 91000 };
    const obSupport = [{ price: 91100, strength: 8, mitigated: false }]; // OB at same level as Fib

    // 1. BASE TEST: Technical Confluence Only
    console.log("\nScenario 1: Technical Confluence (Fib + OB)");
    const techOnly = calculatePOIs(
        currentPrice, fibs, pivots, 90000, 90500, atr,
        { poc: 0 }, obSupport, [], [], []
    );

    const bestSupport = techOnly.topSupports[0];
    console.log(`- Top Support Price: $${bestSupport.price.toFixed(2)}`);
    console.log(`- Score: ${bestSupport.score}`);
    console.log(`- Factors: ${bestSupport.factors.join(", ")}`);

    // 2. GOD MODE TEST: Technical + Order Book Wall
    console.log("\nScenario 2: God Mode (Fib + OB + Wall)");
    const orderBook = {
        bidWall: { price: 91100, strength: 100, volume: 5000 },
        askWall: null,
        buyingPressure: 1.5,
        spoofing: false
    };

    const godMode = calculatePOIs(
        currentPrice, fibs, pivots, 90000, 90500, atr,
        { poc: 0 }, obSupport, [], [], [], [],
        orderBook, []
    );

    const godSupport = godMode.topSupports[0];
    console.log(`- Top Support Price: $${godSupport.price.toFixed(2)}`);
    console.log(`- Score: ${godSupport.score}`);
    console.log(`- Factors: ${godSupport.factors.join(", ")}`);

    if (godSupport.factors.includes("🔱 GOD MODE CONFLUENCE")) {
        console.log("✅ SUCCESS: God Mode Confluence triggered by Liquidity Wall.");
    } else {
        console.log("❌ FAILURE: God Mode label missing.");
    }

    if (godSupport.score >= 12) {
        console.log("✅ SUCCESS: Score reflects high institutional commitment.");
    } else {
        console.log(`❌ FAILURE: Score too low (${godSupport.score})`);
    }

    // 3. LIQ MAGNET TEST
    console.log("\nScenario 3: Liquidation Magnet");
    const liqClusters = [
        { priceMin: 92000, priceMax: 92100, strength: 80, type: 'SHORT_LIQ' }
    ];

    const magnetAnalysis = calculatePOIs(
        currentPrice, fibs, pivots, 90000, 90500, atr,
        { poc: 0 }, [], [], [], [], [],
        null, liqClusters
    );

    const res = magnetAnalysis.topResistances.find(r => r.factors.some(f => f.includes('🧲')));
    if (res) {
        console.log(`✅ SUCCESS: Liquidation Cluster recognized as Magnet at $${res.price.toFixed(0)}`);
    } else {
        console.log("❌ FAILURE: Liquidation Magnet not found in POIs.");
    }
}

testGodMode().catch(console.error);
