import { calculateDCAPlan } from './backend/src/core/services/dcaCalculator';

async function testProximity() {
    console.log("🧪 Testing Proximity Logic...");

    const signalPrice = 91000;
    const atr = 1500; // Std BTC ATR

    const confluence = {
        topResistances: [
            { price: 105000, score: 10, factors: ["Major Resistance"], type: 'RESISTANCE' as any },
            { price: 110000, score: 8, factors: ["Fib Ext"], type: 'RESISTANCE' as any }
        ],
        topSupports: [],
        poiScore: 10,
        levels: [],
        supportPOIs: [],
        resistancePOIs: []
    };

    const dcaPlan = calculateDCAPlan(
        signalPrice,
        confluence as any,
        atr,
        'SHORT',
        { regime: 'TRENDING', strength: 0.8 } as any,
        undefined,
        'S'
    );

    console.log(`\n--- DCA PLAN RESULTS ---`);
    console.log(`Signal Price: $${signalPrice}`);
    console.log(`Average Entry (WAP): $${dcaPlan.averageEntry.toFixed(2)}`);
    console.log(`Proximity Penalty: ${dcaPlan.proximityScorePenalty || 0}`);

    if ((dcaPlan.proximityScorePenalty || 0) > 0) {
        console.log("✅ SUCCESS: Proximity penalty detected for distant entry.");
    } else {
        console.log("❌ FAILURE: No proximity penalty for 15% gap.");
    }

    console.log("\nEntries:");
    dcaPlan.entries.forEach(e => {
        console.log(`- Level ${e.level}: $${e.price.toFixed(2)} (${e.factors.join(", ")})`);
    });
}

testProximity().catch(console.error);
