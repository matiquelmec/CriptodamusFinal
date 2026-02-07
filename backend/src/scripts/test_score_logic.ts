import { TradingConfig } from '../core/config/tradingConfig';
import { scanMarketOpportunities } from '../core/services/engine/scannerLogic';
import { SignalAuditService } from '../services/signalAuditService';
import { createClient } from '@supabase/supabase-js';

// --- INITIAL CONFIG ---
console.log("\n🚀 [Diagnostic] Starting Score Logic & Pipeline Test...");
console.log(`📋 [Config] TOURNAMENT_MODE: ${TradingConfig.TOURNAMENT_MODE}`);
console.log(`📋 [Config] Min Score Entry: ${TradingConfig.scoring.min_score_entry}`);
// @ts-ignore
console.log(`📋 [Config] Min Score To List: ${TradingConfig.scoring.min_score_to_list || 'UNDEFINED (Code defaults to 75)'}`);

if (TradingConfig.TOURNAMENT_MODE) {
    console.log(`🏆 [Tournament] Elite 9 Assets: ${TradingConfig.assets.tournament_list.join(', ')}`);
}

// --- DATABASE CHECK ---
const checkDatabase = async () => {
    console.log("\n🧪 [Database] Testing Connection...");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;

    if (!url || !key) {
        console.error("❌ [Database] Missing SUPABASE_URL or SUPABASE_KEY in environment.");
        return;
    }

    try {
        const supabase = createClient(url, key);
        const { data, error } = await supabase.from('signals_audit').select('count', { count: 'exact', head: true });

        if (error) {
            console.error(`❌ [Database] Connection Failed: ${error.message}`);
        } else {
            console.log(`✅ [Database] Connection OK. Signal Count: ${data === null ? 'Unknown (Head)' : 'Access Verified'}`);
        }
    } catch (e: any) {
        console.error(`❌ [Database] Exception: ${e.message}`);
    }
};

// --- PIPELINE DRY RUN ---
const runPipelineTest = async () => {
    console.log("\n🧪 [Pipeline] Running Dry-Run Scan (SWING_INSTITUTIONAL)...");

    // Force 'Inform Only' mode usually handled by env or logic, but here we just run logic
    // The scannerLogic itself prints logs.

    try {
        console.time("ScanDuration");
        // We use SWING_INSTITUTIONAL as it's the main strategy
        const opportunities = await scanMarketOpportunities('SWING_INSTITUTIONAL');
        console.timeEnd("ScanDuration");

        console.log(`\n📊 [Results] Opportunities Found: ${opportunities.length}`);

        if (opportunities.length === 0) {
            console.warn("⚠️ [Results] No strong opportunities found. Check individual asset logs above for rejection reasons.");
        } else {
            opportunities.forEach(op => {
                console.log(`✅ [Opportunity] ${op.symbol} (${op.side}) - Score: ${op.confidenceScore}`);
                console.log(`   └─ Strategy: ${op.strategy} | Stage: ${op.stage || 0} | Reason: ${op.technicalReasoning?.slice(0, 50)}...`);
            });
        }

        // Check specifically for the score gap issue
        // We can't see discarded ones easily without modifying scannerLogic, BUT
        // if we see scores between 65 and 75 here, it confirms the fix worked!
        const fixedOpportunites = opportunities.filter(op => op.confidenceScore >= 65 && op.confidenceScore < 75);
        if (fixedOpportunites.length > 0) {
            console.log(`\n🎉 [Verification] SUCCESS! Found ${fixedOpportunites.length} signals that would have been blocked before (Score 65-75).`);
            fixedOpportunites.forEach(op => console.log(`   - ${op.symbol}: ${op.confidenceScore}`));
        } else if (opportunities.length > 0) {
            console.log(`\nℹ️ [Verification] All found signals are > 75. Hard to say if fix helped without lower scores appearing.`);
        }

    } catch (e: any) {
        console.error(`❌ [Pipeline] CRITICAL ERROR: ${e.message}`, e);
    }
};

// --- EXECUTION ---
(async () => {
    await checkDatabase();
    await runPipelineTest();
    process.exit(0);
})();
