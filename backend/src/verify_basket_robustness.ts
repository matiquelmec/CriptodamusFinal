
import dotenv from 'dotenv';
dotenv.config();

import { getExpertVolumeAnalysis } from './services/volumeExpert';

// Basket of diverse assets to test robustness
const BASKET = [
    'BTC/USDT',      // Major
    'ETH/USDT',      // Major
    'SOL/USDT',      // High Vol L1 (The original issue)
    'PEPE/USDT',     // 1000-Prefix Candidate (1000PEPE vs PEPE)
    'WIF/USDT',      // Meme / Spot-heavy
    'DOGE/USDT'      // Legacy Meme
];

async function runRobustnessTest() {
    console.log("🛡️ ROBUSTNESS TEST: Tactical Analysis Pipeline");
    console.log("==============================================");
    console.log(`Testing Basket: ${BASKET.join(', ')}\n`);

    let passed = 0;
    let failed = 0;

    for (const symbol of BASKET) {
        try {
            console.log(`👉 Testing: ${symbol}...`);
            const start = Date.now();
            const analysis = await getExpertVolumeAnalysis(symbol);
            const duration = Date.now() - start;

            const oiVal = analysis.derivatives.openInterestValue;
            const oiDisplay = oiVal ? `$${(oiVal / 1_000_000).toFixed(2)}M` : 'N/A';
            const funding = analysis.derivatives.fundingRate;

            // Check validation
            const isNull = oiVal === null;
            const isZero = oiVal === 0;

            console.log(`   ⏱️ ${duration}ms | OI: ${oiDisplay} | Funding: ${funding.toFixed(6)}%`);

            if (isNull) {
                console.warn(`   ⚠️ WARNING: Data Missing (N/A). Check network/timeouts for ${symbol}.`);
                // For this test, N/A is technically a "pass" on stability (no crash), but a "fail" on data.
                // However, since we want to prove robustness, we want REAL data.
                failed++;
            } else if (isZero) {
                console.error(`   ❌ FAILURE: Data is ZERO. This should be impossible with new logic.`);
                failed++;
            } else {
                console.log(`   ✅ VALID`);
                passed++;
            }

        } catch (e) {
            console.error(`   ❌ CRITICAL ERROR for ${symbol}:`, e);
            failed++;
        }
        console.log("----------------------------------------------");
    }

    console.log(`\n📊 SUMMARY: ${passed}/${BASKET.length} Passed.`);
    if (failed > 0) {
        console.log("⚠️ Some assets failed to retrieve data. Check logs.");
    } else {
        console.log("🚀 ALL SYSTEMS ROBUST.");
    }
}

runRobustnessTest();
