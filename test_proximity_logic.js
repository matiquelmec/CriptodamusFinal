const { calculateDCAPlan } = require('./backend/src/core/services/dcaCalculator');

async function testProximity() {
    console.log("🧪 Testing Proximity Logic (Professional Mode)...");

    const signalPrice = 91000;
    const atr = 1500; // Std BTC ATR

    const confluence = {
        topResistances: [
            { price: 105000, score: 10, factors: ["Major Resistance"], type: 'RESISTANCE' },
            { price: 110000, score: 8, factors: ["Fib Ext"], type: 'RESISTANCE' }
        ],
        topSupports: [],
        poiScore: 10,
        levels: [],
        supportPOIs: [],
        resistancePOIs: []
    };

    // Simulate the call that would happen in the scanner
    const dcaPlan = calculateDCAPlan(
        signalPrice,
        confluence,
        atr,
        'SHORT',
        { regime: 'TRENDING', strength: 0.8 },
        undefined,
        'S'
    );

    console.log(`\n--- DCA PLAN RESULTS ---`);
    console.log(`Signal Price: $${signalPrice}`);
    console.log(`Average Entry (WAP): $${dcaPlan.averageEntry.toFixed(2)}`);
    console.log(`Proximity Penalty (Backend Logic): ${dcaPlan.proximityScorePenalty || 0}`);

    if ((dcaPlan.proximityScorePenalty || 0) > 15) {
        console.log("✅ SUCCESS: Strong proximity penalty detected for distant entry (> 15% gap).");
    } else {
        console.log("❌ FAILURE: Penalty not strong enough or missing.");
    }

    console.log("\nEntries:");
    dcaPlan.entries.forEach(e => {
        const dist = Math.abs(e.price - signalPrice) / signalPrice * 100;
        console.log(`- Level ${e.level}: $${e.price.toFixed(2)} [Gap: ${dist.toFixed(1)}%] (${e.factors.join(", ")})`);
    });
}

testProximity().catch(console.error);
