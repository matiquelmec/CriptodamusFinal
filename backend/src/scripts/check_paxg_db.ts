
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

console.log(`Loaded Env: URL=${supabaseUrl?.substring(0, 15)}..., KEY=${supabaseKey?.substring(0, 5)}...`);

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPaxg() {
    console.log("🔍 Checking PAXG signal in database...");

    // Fetch active PAXG signal
    const { data, error } = await supabase
        .from('signals_audit')
        .select('*')
        .eq('symbol', 'PAXG/USDT')
        .in('status', ['ACTIVE', 'PARTIAL_WIN', 'OPEN'])
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error("❌ Supabase Error:", error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log("⚠️ No active PAXG signal found.");
        return;
    }

    const trade = data[0];
    console.log("\n📊 PAXG Trade State (DB):");
    console.log("-------------------------");
    console.log(`ID: ${trade.id}`);
    console.log(`Status: ${trade.status}`);
    console.log(`Stage: ${trade.stage}`);
    console.log(`Entry: ${trade.entry_price}`);
    console.log(`Activation: ${trade.activation_price}`);
    console.log(`Current Price (Last): ${trade.final_price || trade.last_price}`);
    console.log(`STOP LOSS (DB Value): ${trade.stop_loss}`);
    console.log(`Smart BE Buffer: ${trade.smart_be_buffer}`);
    console.log("-------------------------");

    // Calculate what it SHOULD be
    const currentWAP = trade.activation_price || trade.entry_price;
    const buffer = trade.smart_be_buffer || (currentWAP * 0.0015);
    const smartBE = currentWAP + buffer; // Assuming LONG based on user context

    console.log(`🧮 Calculated Smart BE: ${smartBE.toFixed(4)}`);

    if (Math.abs(trade.stop_loss - smartBE) < 1) {
        console.log("✅ SL matches Smart BE (Logic OK).");
    } else {
        console.log("❌ SL MISMATCH! DB has old value.");
    }
}

checkPaxg();
