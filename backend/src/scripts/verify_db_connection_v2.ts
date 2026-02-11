
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Robust Path Resolution (Go up 3 levels from backend/src/scripts to root)
const envPath = path.join(__dirname, '../../../../.env');
console.log(`📂 Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    console.error("Debug: URL found?", !!supabaseUrl);
    console.error("Debug: Key found?", !!supabaseKey);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyConnection() {
    console.log("🕵️ Verifying Supabase Query Access...");
    try {
        const { data, error, count } = await supabase
            .from('system_metadata')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error("❌ DB CONNECTION FAILED:", error.message);
            process.exit(1);
        } else {
            console.log("✅ DB CONNECTION SUCCESSFUL");
            console.log(`📊 Table 'system_metadata' accessible. Rows: ${count}`);
            process.exit(0);
        }
    } catch (e: any) {
        console.error("❌ UNEXPECTED ERROR:", e.message);
        process.exit(1);
    }
}

verifyConnection();
