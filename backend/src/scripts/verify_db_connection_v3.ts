
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ES Module compatible dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to .env (root)
const envPath = join(__dirname, '../../../../.env');
console.log(`📂 Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn("⚠️ Env vars missing via relative path. Trying default loading...");
    dotenv.config(); // Try default load
}

if (!process.env.SUPABASE_URL) {
    console.error("❌ CRITICAL: Still missing SUPABASE_URL");
    process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function verifyConnection() {
    console.log("🕵️ Verifying Supabase Query Access...");
    try {
        const { count, error } = await supabase
            .from('system_metadata')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error("❌ DB CONNECTION FAILED:", error.message);
        } else {
            console.log("✅ DB CONNECTION SUCCESSFUL");
            console.log(`📊 Table 'system_metadata' accessible. Rows: ${count}`);
        }
    } catch (e: any) {
        console.error("❌ UNEXPECTED ERROR:", e.message);
    }
}

verifyConnection();
