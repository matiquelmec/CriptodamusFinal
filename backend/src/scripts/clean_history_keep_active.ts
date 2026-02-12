
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';

// Polyfill global fetch for Supabase
if (!globalThis.fetch) {
    globalThis.fetch = fetch as any;
    globalThis.Headers = fetch.Headers as any;
    globalThis.Request = fetch.Request as any;
    globalThis.Response = fetch.Response as any;
}

// Force load env from root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase Credentials in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanHistoryKeepActive() {
    console.log("🧹 Starting History Cleanup (Preserving Active Signals)...");

    // 1. Delete CLOSED trades from signals_audit
    // We keep: PENDING, ACTIVE, OPEN, PARTIAL_WIN
    const { error: deleteSignalError, count: deletedSignals } = await supabase
        .from('signals_audit')
        .delete({ count: 'exact' })
        .not('status', 'in', '("PENDING","ACTIVE","OPEN","PARTIAL_WIN")');

    if (deleteSignalError) {
        console.error("❌ Error erasing signals_audit:", deleteSignalError.message);
    } else {
        console.log(`✅ Erased ${deletedSignals} closed signals.`);
    }

    // 2. Clear outdated predictions
    const { error: deletePredError, count: deletedPreds } = await supabase
        .from('model_predictions')
        .delete({ count: 'exact' })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Hack to delete all

    if (deletePredError) {
        console.error("❌ Error erasing model_predictions:", deletePredError.message);
    } else {
        console.log(`✅ Erased ${deletedPreds} model predictions.`);
    }

    console.log("✨ Cleanup Complete. Active signals preserved.");
}

cleanHistoryKeepActive();
