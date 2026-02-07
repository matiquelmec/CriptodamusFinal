
import dotenv from 'dotenv';
dotenv.config();

import { getExpertVolumeAnalysis } from './services/volumeExpert';

async function verifySOL() {
    console.log("🔍 DIAGNOSTIC: Testing SOL/USDT Volume Analysis");
    console.log("-----------------------------------------------");

    try {
        const symbol = 'SOL/USDT';
        console.log(`👉 Requesting Analysis for: ${symbol}`);

        const start = Date.now();
        const analysis = await getExpertVolumeAnalysis(symbol);
        const duration = Date.now() - start;

        console.log(`⏱️ Latency: ${duration}ms`);
        console.log("\n📊 RESULTS:");
        console.log("----------------------------------------");

        const oiVal = analysis.derivatives.openInterestValue;
        const funding = analysis.derivatives.fundingRate;
        const prem = analysis.coinbasePremium.gapPercent;

        const oiDisplay = oiVal ? `$${(oiVal / 1_000_000).toFixed(2)}M` : 'N/A';

        console.log(`🔹 Open Interest Value: ${oiDisplay}`);
        console.log(`🔹 Funding Rate:        ${funding.toFixed(6)}%`);
        console.log(`🔹 Coinbase Premium:    ${prem.toFixed(4)}%`);
        console.log(`🔹 CVD Trend:           ${analysis.cvd.trend}`);

        if (!oiVal) {
            console.error("\n❌ CRITICAL: Open Interest is NULL. Fetch failed.");
            // Check Env
            console.log("   Checking Environment...");
            console.log(`   BIFROST_URL: ${process.env.BIFROST_URL || "UNDEFINED"}`);
        } else {
            console.log("\n✅ SUCCESS: Data looks valid.");
        }

    } catch (e) {
        console.error("\n❌ UNHANDLED EXCEPTION:", e);
    }
}

verifySOL();
