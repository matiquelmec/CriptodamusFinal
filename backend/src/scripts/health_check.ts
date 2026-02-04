
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from backend root
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Stats: Missing SUPABASE credentials in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runAudit() {
    console.log("🔍 [Audit] Starting Dynamic Flow Verification...");
    console.log("------------------------------------------------");

    // 1. Verify Signals Persistence (Scanner -> DB)
    const { data: signals, error: sigError } = await supabase
        .from('signals_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (sigError) {
        console.error("❌ [Audit] Failed to fetch signals:", sigError.message);
    } else {
        if (signals && signals.length > 0) {
            console.log(`✅ [Audit] Found ${signals.length} recent signals in DB.`);
            const latest = signals[0];
            const ageMins = (Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60);
            console.log(`   - Latest Signal: ${latest.symbol} (${latest.side})`);
            console.log(`   - Strategy: ${latest.strategy}`);
            console.log(`   - Age: ${ageMins.toFixed(1)} minutes ago`);
            console.log(`   - Status: ${latest.status}`);

            if (ageMins < 60) {
                console.log("   ✅ Data is FRESH (< 1 hour)");
            } else {
                console.warn("   ⚠️ Data is STALE (> 1 hour). Scanner might be down or market quiet.");
            }
        } else {
            console.warn("⚠️ [Audit] No signals found in DB. Scanner might be inactive or empty DB.");
        }
    }

    console.log("------------------------------------------------");

    // 2. Verify ML Predictions (Brain -> DB)
    const { data: preds, error: mlError } = await supabase
        .from('model_predictions')
        .select('*')
        .order('prediction_time', { ascending: false })
        .limit(3);

    if (mlError) {
        console.error("❌ [Audit] Failed to fetch ML predictions:", mlError.message);
    } else {
        if (preds && preds.length > 0) {
            console.log(`✅ [Audit] Found ${preds.length} recent ML predictions.`);
            const latest = preds[0];
            const ageMins = (Date.now() - new Date(latest.prediction_time).getTime()) / (1000 * 60);
            console.log(`   - Latest Prediction: ${latest.symbol} -> ${latest.predicted_signal} (${(latest.probability * 100).toFixed(1)}%)`);
            console.log(`   - Age: ${ageMins.toFixed(1)} minutes ago`);
        } else {
            console.warn("⚠️ [Audit] No ML predictions found. ML Engine might be off.");
        }
    }

    console.log("------------------------------------------------");

    // 3. Verify Live API Status (Server Memory)
    try {
        console.log("🌐 [Audit] Checking Live API Status (localhost:3001)...");
        // Using dynamic import for node-fetch if needed, or simple http
        // Since we are in ts_node, we can use built-in fetch if node 18+, or standard http
        // Let's use a simple distinct Fetch approach
        const response = await fetch('http://localhost:3001/api/v1/market/signals');
        if (response.ok) {
            const json: any = await response.json();
            console.log(`   ✅ API Status: ${response.status} OK`);
            console.log(`   - System Status: ${json.system_status?.status}`);
            console.log(`   - Message: "${json.system_status?.message}"`);

            if (json.system_status?.status === 'HALTED' || json.system_status?.status === 'PAUSED') {
                console.warn(`   ⚠️ SYSTEM IS BLOCKED (${json.system_status.reason}). Check logs.`);
            } else {
                console.log("   ✅ System is running normally (OPTIMAL/ACTIVE).");
            }
        } else {
            console.warn(`   ⚠️ API responded with ${response.status}. Server might be busy.`);
        }
    } catch (e: any) {
        console.warn("   ⚠️ Could not reach Local API. Server might be down or on different port.", e.message);
    }

    console.log("------------------------------------------------");
    console.log("🏁 [Audit] Verification Complete.");
}

runAudit();
