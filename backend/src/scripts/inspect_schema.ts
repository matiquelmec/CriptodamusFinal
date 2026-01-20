
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function inspectRow() {
    const { data, error } = await supabase.from('signals_audit').select('*').limit(1);

    if (error) {
        console.error("Error fetching:", error);
    } else if (data && data.length > 0) {
        console.log("KEYS:\n" + Object.keys(data[0]).join("\n"));
    } else {
        console.log("No rows found to inspect.");
    }
    process.exit(0);
}

inspectRow();
