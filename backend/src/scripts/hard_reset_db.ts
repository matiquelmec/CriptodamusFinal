import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase environment variables. URL:", !!supabaseUrl, "Key:", !!supabaseKey);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function hardReset() {
    console.log("🧹 [DB-Reset] Starting Hard Reset of Audit & Predictions...");

    // 1. Clear model_predictions
    const { error: err1 } = await supabase
        .from('model_predictions')
        .delete()
        .gte('prediction_time', 0); // Delete all by time range to avoid ID issues

    if (err1) console.error("❌ Failed to clear model_predictions:", err1);
    else console.log("✅ model_predictions cleared.");

    // 2. Clear signals_audit
    const { error: err2 } = await supabase
        .from('signals_audit')
        .delete()
        .gte('created_at', 0);

    if (err2) console.error("❌ Failed to clear signals_audit:", err2);
    else console.log("✅ signals_audit cleared.");

    // 3. Clear orderbook_snapshots
    const { error: err3 } = await supabase
        .from('orderbook_snapshots')
        .delete()
        .gte('timestamp', 0); // Cleanup history walls

    if (err3) console.error("❌ Failed to clear orderbook_snapshots:", err3);
    else console.log("✅ orderbook_snapshots cleared.");

    console.log("✨ [DB-Reset] Database is now clean.");
}

hardReset().catch(console.error);
