
import { scanMarketOpportunities } from '../core/services/engine/scannerLogic';
import { TradingConfig } from '../core/config/tradingConfig';

async function runVerification() {
    console.log("🚀 Starting Phase 3 Verification: Adaptive Thresholds & Macro Context...");

    try {
        // Force Tournament Mode to limit the number of assets scanned and speed up the test
        TradingConfig.TOURNAMENT_MODE = true;
        console.log("🏆 Tournament Mode: ENABLED (for testing purposes)");

        // Run the scanner
        console.log("Running scanMarketOpportunities('SCALPING_M15')...");
        // Cast string to TradingStyle to avoid TS error
        const opportunities = await scanMarketOpportunities('SCALPING_M15' as any);

        console.log(`\n✅ Scanner completed. Found ${opportunities.length} opportunities.`);

        if (opportunities.length > 0) {
            const opp = opportunities[0];
            console.log("\n--- Opportunity Inspection ---");
            console.log(`Symbol: ${opp.symbol}`);
            console.log(`Confidence Score: ${opp.confidenceScore}`);
            console.log(`Tier: ${opp.tier}`);
            // Access metrics safely
            if (opp.metrics && opp.metrics.marketRegime) {
                console.log(`Regime (Derived):`, opp.metrics.marketRegime);
            } else {
                console.log(`Regime (Derived): N/A (Check console logs for 'Macro Derived')`);
            }

            console.log("\n--- DCA Plan Inspection ---");
            if (opp.dcaPlan) {
                console.log(`Stop Loss: ${opp.dcaPlan.stopLoss}`);
                console.log(`Entries:`, opp.dcaPlan.entries);
                console.log(`Take Profits:`, opp.dcaPlan.takeProfits);
            } else {
                console.warn("⚠️ DCA Plan is MISSING!");
            }

            console.log("\n--- Analysis & Reasoning ---");
            console.log(opp.technicalReasoning);
            if (opp.reasoning) console.log(opp.reasoning);
        } else {
            console.log("ℹ️ No opportunities found (this might be normal depending on market conditions).");
            console.log("Check console logs for 'Macro Derived' messages to verify regime injection.");
        }

    } catch (error) {
        console.error("❌ Verification Failed:", error);
    }
}

runVerification();
