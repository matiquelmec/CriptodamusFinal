
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

async function verifyUpdates() {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

    // Check if any active signals exist now (user might need to wait for new ones)
    // or if the code works for new signals.
    console.log("Monitoring for Active Signals with PnL updates...");

    const check = async () => {
        const { data } = await supabase
            .from('signals_audit')
            .select('symbol, status, pnl_percent, final_price, last_sync')
            .in('status', ['ACTIVE', 'PARTIAL_WIN']);

        if (data && data.length > 0) {
            console.log("✅ Active Signals Found:");
            console.table(data);
        } else {
            console.log("⏳ No active signals yet. Waiting for market action...");
        }
    }

    check();
}

verifyUpdates();
