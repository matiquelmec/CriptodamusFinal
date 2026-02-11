
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanLogs() {
    console.log("🧹 [Reset] Starting Audit Log Cleanup...");

    // 1. Identify the PAXG signal to keep
    const { data: keepData, error: keepError } = await supabase
        .from('signals_audit')
        .select('id, symbol, status')
        .eq('symbol', 'PAXG/USDT')
        .in('status', ['ACTIVE', 'PARTIAL_WIN', 'OPEN', 'PENDING'])
        .order('created_at', { ascending: false })
        .limit(1);

    if (keepError) {
        console.error("❌ Error finding signals to keep:", keepError.message);
        return;
    }

    const idsToKeep = keepData.map(s => s.id);
    console.log(`🛡️ Preserving PAXG Signal(s) with IDs: ${idsToKeep.join(', ')}`);

    // 2. Delete everything else
    if (idsToKeep.length > 0) {
        const { error: deleteError } = await supabase
            .from('signals_audit')
            .delete()
            .neq('symbol', 'PAXG/USDT') // Secondary safety: don't delete any PAXG for now if we want to be super safe
            .not('id', 'in', `(${idsToKeep.join(',')})`); // Fixed syntax for array-ish inclusion in some versions or usually use .not('id', 'in', idsToKeep)

        // Correction for Supabase JS syntax if necessary:
        const { error: finalDeleteError } = await supabase
            .from('signals_audit')
            .delete()
            .filter('id', 'not.in', `(${idsToKeep.join(',')})`);

        if (finalDeleteError) {
            console.error("❌ Error deleting logs:", finalDeleteError.message);
        } else {
            console.log("✅ Audit logs reset successfully! (Only active PAXG preserved)");
        }
    } else {
        console.warn("⚠️ No active PAXG signal found. Deleting ALL logs.");
        const { error: deleteAllError } = await supabase
            .from('signals_audit')
            .delete()
            .neq('id', -1); // Deletes all

        if (deleteAllError) {
            console.error("❌ Error deleting all logs:", deleteAllError.message);
        } else {
            console.log("✅ All audit logs reset successfully.");
        }
    }
}

cleanLogs();
