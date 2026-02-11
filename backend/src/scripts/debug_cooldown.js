
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Polyfill minimal fetch for Supabase using axios
// Supabase needs fetch. We can try to use 'cross-fetch' if installed, or just use axios directly for the query REST API 
// to avoid Supabase client issues if that's the blocker.
// BUT, let's try to just use valid node-fetchv2 if available, or just direct axios calls to Supabase REST API.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Stats: Missing ENV");
    process.exit(1);
}

async function run() {
    try {
        console.log("🔍 Checking SOL/USDT History via Axios...");

        // Direct REST query to Supabase (Bypassing check_cooldown.ts complexities)
        const endpoint = `${SUPABASE_URL}/rest/v1/signals_audit?symbol=eq.SOL/USDT&side=eq.SHORT&order=created_at.desc&limit=20`;

        const response = await axios.get(endpoint, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const trades = response.data;
        console.log(`📊 Found ${trades.length} recent SOL/USDT SHORT trades.`);

        // Analyze Timing
        let violations = 0;
        for (let i = 0; i < trades.length - 1; i++) {
            const current = trades[i];
            const next = trades[i + 1]; // Older trade

            const timeDiff = new Date(current.created_at).getTime() - new Date(next.closed_at || next.created_at).getTime();
            const timeDiffMinutes = timeDiff / 60000;

            console.log(`   - Trade ${current.id} created ${timeDiffMinutes.toFixed(1)} mins after previous trade closure.`);

            if (timeDiffMinutes < 60 && timeDiffMinutes > 0) {
                console.log(`     🚨 VIOLATION: Created within 60m cooldown!`);
                violations++;
            }
        }

        if (violations > 0) {
            console.log("\n❌ CONCLUSION: Machine Gun Logic Confirmed. The Cooldown is NOT working.");
        } else {
            console.log("\n✅ CONCLUSION: No obvious cooldown violations found in last 20 trades.");
        }

    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) console.error("Data:", e.response.data);
    }
}

run();
