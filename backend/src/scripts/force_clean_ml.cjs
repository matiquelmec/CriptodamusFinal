
const { createClient } = require('@supabase/supabase-js');
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

// Try using service key if available, else anon
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

async function forceCleanML() {
    console.log("🧠 [Brain-Reset] Wiping ML Memory (model_predictions)...");

    try {
        // Delete ALL rows using valid filter
        // Option 1: not('id', 'is', null) - Safe and universal
        const { error, count } = await supabase
            .from('model_predictions')
            .delete({ count: 'exact' })
            .not('id', 'is', null);

        if (error) {
            console.error("❌ Error erasing model_predictions:", error.message);
            console.log("💡 Tip: If this fails due to RLS, you must use SQL Editor in Supabase Dashboard.");
            console.log("👉 Query: TRUNCATE TABLE model_predictions;");
        } else {
            console.log(`✅ SUCCESS: Erased ${count} predictions.`);
            console.log("✨ Brain Health should now be RESET (0%).");
        }
    } catch (e) {
        console.error("❌ Unexpected error:", e.message);
    }
}

forceCleanML();
