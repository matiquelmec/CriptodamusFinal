
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Force load from root
const envPath = path.resolve(process.cwd(), '.env');
console.log(`📂 Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_KEY in .env");
    console.log("URL:", supabaseUrl ? "FOUND" : "MISSING");
    console.log("KEY:", supabaseKey ? "FOUND" : "MISSING");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySignals() {
    console.log("\n📡 Connecting to Supabase...");

    // 1. Check Total Count
    const { count, error: countError } = await supabase
        .from('signals_audit')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error("❌ Connection Failed:", countError.message);
        return;
    }
    console.log(`✅ Connection OK. Total Signals in DB: ${count}`);

    // 2. Check Active Signals
    const { data: active, error: activeError } = await supabase
        .from('signals_audit')
        .select('id, symbol, status, stop_loss, entry_price, final_price, updated_at')
        .in('status', ['ACTIVE', 'OPEN', 'PARTIAL_WIN'])
        .order('updated_at', { ascending: false });

    if (activeError) {
        console.error("❌ Query Failed:", activeError.message);
        return;
    }

    if (!active || active.length === 0) {
        console.log("⚠️ No ACTIVE signals found.");
    } else {
        console.log(`\n📊 Found ${active.length} Active Signals:`);
        active.forEach(s => {
            console.log(`   - ${s.symbol} [${s.status}]: SL=${s.stop_loss} | Price=${s.final_price} | Updated=${new Date(s.updated_at).toLocaleTimeString()}`);
        });

        // 3. Highlight PAXG specific
        const paxg = active.find(s => s.symbol.includes('PAXG'));
        if (paxg) {
            console.log(`\n🏆 PAXG STATUS: SL is ${paxg.stop_loss}`);
        } else {
            console.log("\n⚠️ PAXG is NOT in ACTIVE list (maybe Closed or Pending?)");
        }
    }
}

verifySignals();
