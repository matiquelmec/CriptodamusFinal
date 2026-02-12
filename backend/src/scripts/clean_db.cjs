
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Force load env from backend/.env
const envPath = path.resolve(process.cwd(), 'backend', '.env');
console.log(`Loading env from: ${envPath}`);
dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase Credentials in .env");
    process.exit(1);
}

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'count=exact'
};

async function cleanHistoryDirect() {
    console.log("🧹 Starting History Cleanup (Direct REST API)...");

    try {
        // 1. Delete CLOSED trades via REST
        // Filter: status NOT IN (PENDING, ACTIVE, OPEN, PARTIAL_WIN)
        // URL Encoding needed for filters
        const signalsUrl = `${SUPABASE_URL}/rest/v1/signals_audit?status=not.in.(PENDING,ACTIVE,OPEN,PARTIAL_WIN)`;

        const signalRes = await axios.delete(signalsUrl, { headers });
        // Axios returns data directly? Count is in headers?
        // Supabase returns count in Content-Range header if requested?
        // With Prefer: count=exact, it might return empty body but range header.
        // Actually, let's just log success.
        console.log(`✅ Signals Cleanup Status: ${signalRes.status} ${signalRes.statusText}`);
    } catch (e) {
        console.error("❌ Failed to clean signals:", e.response ? e.response.data : e.message);
    }

    try {
        // 2. Clear predictions
        // Filter: id != 0000... (delete all logic)
        const predsUrl = `${SUPABASE_URL}/rest/v1/model_predictions?id=neq.00000000-0000-0000-0000-000000000000`;
        const predRes = await axios.delete(predsUrl, { headers });
        console.log(`✅ Predictions Cleanup Status: ${predRes.status} ${predRes.statusText}`);
    } catch (e) {
        console.error("❌ Failed to clean predictions:", e.response ? e.response.data : e.message);
    }

    console.log("✨ REST Cleanup Complete.");
}

cleanHistoryDirect();
