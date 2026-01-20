
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function cleanupDebug() {
    console.log("🧹 Cleaning up DEBUG signals...");

    const { error } = await supabase
        .from('signals_audit')
        .delete()
        .like('symbol', 'DEBUG%');

    if (error) {
        console.error("❌ Cleanup failed:", error);
    } else {
        console.log("✅ Cleanup successful. Removed DEBUG signals.");
    }
    process.exit(0);
}

cleanupDebug();
