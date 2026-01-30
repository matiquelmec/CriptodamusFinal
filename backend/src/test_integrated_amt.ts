
import { scanMarketOpportunities } from './core/services/engine/scannerLogic';
import { TradingConfig } from './core/config/tradingConfig';

async function runIntegratedTest() {
    console.log("🚀 STARTING INTEGRATED AMT TEST...");

    // We run a scalp scan specifically to look for bubbles/micro-moves
    const opportunities = await scanMarketOpportunities('SCALP_AGRESSIVE');

    console.log(`\nFound ${opportunities.length} opportunities.`);

    opportunities.forEach(opt => {
        console.log(`\n--- [${opt.symbol}] Score: ${opt.confidenceScore} ---`);
        if (opt.reasoning) {
            console.log(`Reasoning:\n${opt.reasoning.join('\n')}`);

            if (opt.reasoning.some(r => r.includes('Bubble') || r.includes('AMT Location') || r.includes('Absorption'))) {
                console.log("✅ SUCCESS: AMT Factor Detected in reasoning!");
            }
        }
    });

    if (opportunities.length === 0) {
        console.log("⚠️ No opportunities found. This might be due to strict filters. Check if data ingestion worked.");
    }
}

runIntegratedTest().catch(console.error);
