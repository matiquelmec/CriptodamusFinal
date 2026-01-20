
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function inspectPredictions() {
    console.log("🧠 Inspecting Model Predictions...");

    // 1. Total Count
    const { count: total } = await supabase.from('model_predictions').select('*', { count: 'exact', head: true });
    console.log(`- Total Rows: ${total}`);

    // 2. Completed Predictions (With Outcome)
    const { data: completed, error } = await supabase
        .from('model_predictions')
        .select('*')
        .not('actual_outcome', 'is', null)
        .limit(5);

    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log(`- Completed Rows (Outcome != null): ${completed.length} (showing first 5)`);
        if (completed.length > 0) {
            console.log(JSON.stringify(completed, null, 2));
        } else {
            console.log("  (None found. So Win Rate calculation should be based on 0 records.)");
        }
    }
    process.exit(0);
}

inspectPredictions();
