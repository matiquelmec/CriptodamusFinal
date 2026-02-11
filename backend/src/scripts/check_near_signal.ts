
// Script: CHECK_NEAR_SIGNAL.ts
// Objective: Find any trace of NEAR/USDT in signals_audit table.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load Environment
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing SUPABASE credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNearSignal() {
    console.log("🔍 Scanning DB for NEAR/USDT signals (Last 24h)...");

    // Check signals created in the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('signals_audit')
        .select('*')
        .eq('symbol', 'NEAR/USDT')
        .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).getTime()) // Assuming created_at is timestamp number or check conversion
        .order('created_at', { ascending: false });

    if (error) {
        console.error("❌ DB Error:", error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log("⚠️ No NEAR/USDT signals found in DB (Last 24h).");
        console.log("This implies the signal was REJECTED BEFORE INSERTION (Scanner Filter) or Insert Failed.");
    } else {
        console.log(`✅ Found ${data.length} records for NEAR/USDT:`);
        data.forEach(sig => {
            const date = new Date(sig.created_at).toLocaleString();
            console.log(`[${sig.id}] ${date} | Status: ${sig.status} | Score: ${sig.confidence_score} | Strategy: ${sig.strategy}`);
            console.log(`   Reasoning: ${sig.technical_reasoning?.substring(0, 100)}...`);
        });
    }
}

checkNearSignal();
