
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function auditBrainHealth() {
    console.log("🧠 Auditing Brain Health Data Source...");

    // 1. Check Database directly
    const { count, error } = await supabase
        .from('model_predictions')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error("❌ DB API Error:", error.message);
    } else {
        console.log(`📊 Rows in 'model_predictions' (DB): ${count}`);
    }

    // 2. Check Running API (if accessible)
    try {
        // Use localhost as typical dev environment
        const res = await axios.get('http://localhost:3001/api/ml/stats');
        console.log(`🌐 API '/api/ml/stats' Returns:`, res.data);

        if (count === 0 && res.data.globalWinRate > 0) {
            console.log("\n⚠️ DISCREPANCY DETECTED!");
            console.log("   The Database is EMPTY (0 records).");
            console.log("   The API is returning OLD DATA (Active In-Memory Cache).");
            console.log("   Solution: The Backend Server needs a RESTART to clear memory.");
        } else {
            console.log("\n✅ Data is consistent.");
        }

    } catch (e: any) {
        console.log("⚠️ Could not reach local API (Server might be stopped or different port).");
        console.log("   Error:", e.message);
    }

    process.exit(0);
}

auditBrainHealth();
