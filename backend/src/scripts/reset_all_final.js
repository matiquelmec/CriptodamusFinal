
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function finalCleanup() {
    console.log("🧹 [Reset] Final Deep Cleanup Starting...");

    // 1. Audit Logs (Preserve PAXG)
    const { data: keepData, error: keepError } = await supabase
        .from('signals_audit')
        .select('id')
        .eq('symbol', 'PAXG/USDT')
        .in('status', ['ACTIVE', 'PARTIAL_WIN', 'OPEN', 'PENDING'])
        .order('created_at', { ascending: false })
        .limit(1);

    const idsToKeep = keepData ? keepData.map(s => s.id) : [];

    if (idsToKeep.length > 0) {
        console.log(`🛡️ Preserving PAXG ID: ${idsToKeep[0]}`);
        await supabase.from('signals_audit').delete().filter('id', 'not.in', `(${idsToKeep.join(',')})`);
    } else {
        console.log("⚠️ No active PAXG found, clearing everything.");
        await supabase.from('signals_audit').delete().neq('id', -1);
    }

    // 2. Clear ML Metrics (Brain Health)
    console.log("🧠 Clearing Brain Health (model_predictions)...");
    const { error: mlError } = await supabase.from('model_predictions').delete().neq('id', -1);

    if (mlError) console.error("❌ ML Reset Error:", mlError.message);
    else console.log("✅ Brain Health reset successful.");

    console.log("✨ All specified data cleaned.");
}

finalCleanup().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
