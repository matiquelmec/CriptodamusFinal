
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Fix .env loading
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNearSignal() {
    console.log("🔍 Searching for NEAR signals...");

    // Search for NEAR/USDT in recent signals
    const { data, error } = await supabase
        .from('signals_audit')
        .select('*')
        .ilike('symbol', 'NEAR%')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error("❌ Error fetching signal:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("⚠️ No NEAR signal found.");
        return;
    }

    const signal = data[0];
    console.log(`✅ Signal Found: ID ${signal.id}`);

    // Check distinct DCA columns
    if (signal.dca_plan) {
        console.log("Found structured 'dca_plan':");
        console.log(JSON.stringify(signal.dca_plan, null, 2));
    }

    // Check if technical_reasoning contains the JSON (Legacy format?)
    if (typeof signal.technical_reasoning === 'string' && signal.technical_reasoning.includes('{"dca":')) {
        console.log("Found DCA inside technical_reasoning string:");
        try {
            const parsed = JSON.parse(signal.technical_reasoning);
            console.log(JSON.stringify(parsed.dca, null, 2));
        } catch (e) {
            console.log("RAW reasoning (could not parse):", signal.technical_reasoning);
        }
    } else {
        console.log("Technical Reasoning:", signal.technical_reasoning);
    }

    // Print Entry Zone just in case
    console.log("Entry Zone:", signal.entry_zone);
}

checkNearSignal();
