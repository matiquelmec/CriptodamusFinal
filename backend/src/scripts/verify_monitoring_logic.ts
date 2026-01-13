
import { signalAuditService } from '../services/signalAuditService';
import { AIOpportunity } from '../core/types';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function verifyLogic() {
    console.log("🧪 Starting Professional Monitoring Logic Verification...");

    // Mock Opportunity
    const mockOpp: AIOpportunity = {
        id: 'TEST-SIG-' + Date.now(),
        symbol: 'TESTBTC/USDT',
        side: 'LONG',
        strategy: 'TEST_STRAT',
        timeframe: '15m',
        confidenceScore: 90,
        timestamp: Date.now(),
        entryZone: { min: 99000, max: 100000, currentPrice: 100000 },
        stopLoss: 99000,
        takeProfits: { tp1: 101000, tp2: 102000, tp3: 105000 },
        technicalReasoning: "Test",
        invalidated: false,
        session: "NY",
        riskRewardRatio: 2.5
    };

    // 1. Register Mock Signal
    console.log("\n1️⃣ Registering First Signal (Should Succeed)...");
    await signalAuditService.registerSignals([mockOpp]);

    // 2. Register Duplicate (Should Fail/Skip)
    console.log("\n2️⃣ Registering Duplicate Signal (Should be SKIPPED)...");
    await signalAuditService.registerSignals([mockOpp]);

    // 3. Verify DB State
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

    // Check Count
    const { count } = await supabase
        .from('signals_audit')
        .select('*', { count: 'exact', head: true })
        .eq('symbol', 'TESTBTC/USDT');

    console.log(`\n📊 DB Count: ${count} (Expected: 1)`);

    if (count !== 1) {
        console.error("❌ Single Position Enforcement FAILED. Duplicate signals registered.");
    } else {
        console.log("✅ Single Position Enforcement VERIFIED.");
    }

    // Check Logic
    const { data } = await supabase
        .from('signals_audit')
        .select('*')
        .eq('symbol', 'TESTBTC/USDT')
        .limit(1);

    if (data && data[0]) {
        const sig = data[0];
        console.log("\n📊 Signal Verification:");
        console.log(`   ID: ${sig.id}`);
        console.log(`   Detailed Status: ${sig.status}`);
        console.log(`   Plan Entry: ${sig.entry_price}`);
        console.log(`   Real Activation: ${sig.activation_price}`);
        console.log(`   Fees Paid: ${sig.fees_paid}`);

        if (sig.activation_price && sig.fees_paid > 0) {
            console.log("   ✅ Real PnL Logic Verified (Slippage & Fees applied)");
        } else {
            console.error("   ❌ Failed: No activation price or fees calculated.");
        }

        // Cleanup
        console.log("\n🧹 Cleaning up test data...");
        await supabase.from('signals_audit').delete().eq('symbol', 'TESTBTC/USDT');
        console.log("   ✅ Cleanup Complete");
    } else {
        console.error("❌ Failed: Signal not found in DB.");
    }
}

verifyLogic();
