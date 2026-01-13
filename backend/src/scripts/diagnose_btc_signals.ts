
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function diagnose() {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

    console.log("🔍 Diagnosing BTCUSDT Signals (Last 24h)...");

    const { data, error } = await supabase
        .from('signals_audit')
        .select('*')
        .eq('symbol', 'BTCUSDT')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error || !data) {
        console.error("❌ DB Error or No Data:", error);
        return;
    }

    console.log(`✅ Found ${data.length} records.`);

    console.log("--------------------------------------------------------------------------------");
    console.log("| ID       | Status | Side  | Strategy        | Created  | Entry    | PnL    ");
    console.log("--------------------------------------------------------------------------------");

    data.forEach(s => {
        const id = (s.id || 'N/A').substring(0, 8);
        const status = s.status || 'N/A';
        const side = s.side || 'N/A';
        const strat = (s.strategy || 'UNKNOWN').substring(0, 15);
        const created = s.created_at ? new Date(Number(s.created_at)).toLocaleTimeString() : 'N/A';
        const entry = s.entry_price || 0;
        const pnl = s.pnl_percent !== undefined && s.pnl_percent !== null ? s.pnl_percent.toFixed(2) + '%' : 'N/A';

        console.log(`| ${id} | ${status.padEnd(6)} | ${side.padEnd(5)} | ${strat.padEnd(15)} | ${created} | $${entry} | ${pnl}`);
    });
    console.log("--------------------------------------------------------------------------------");

    // Check for "Perfect Duplicates" (Same Strategy, Created < 5 mins apart)
    console.log("\n🕵️ Logic Analysis:");
    for (let i = 0; i < data.length - 1; i++) {
        const curr = data[i];
        const next = data[i + 1];

        const timeDiff = Math.abs(Number(curr.created_at) - Number(next.created_at)) / 60000;
        if (curr.side === next.side && timeDiff < 15) {
            console.warn(`⚠️ POTENTIAL DUPLICATE Found!`);
            console.warn(`   Signal 1: ${curr.id} (${new Date(Number(curr.created_at)).toLocaleTimeString()})`);
            console.warn(`   Signal 2: ${next.id} (${new Date(Number(next.created_at)).toLocaleTimeString()})`);
            console.warn(`   Time Diff: ${timeDiff.toFixed(1)} min`);
            if (curr.strategy === next.strategy) console.warn("   🔥 SAME STRATEGY (Bug confirmed)");
            else console.log("   ℹ️ Different Strategies (Acceptable if logic differs)");
        }
    }
}

diagnose();
