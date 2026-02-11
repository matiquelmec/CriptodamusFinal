
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Absolute path to .env in backend root
const envPath = 'c:/Users/Matías Riquelme/Desktop/CriptodamusFinal-main - copia/backend/.env';

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.error('❌ .env not found at ' + envPath);
    process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing DB credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
        .from('signals_audit')
        .select('*')
        .gte('created_at', today.getTime())
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ SQL Error:', error);
    } else {
        console.log(`📊 Found ${data.length} active/pending signals.`);
        data.forEach(s => {
            console.log(`[${s.status}] ${s.symbol} | Stage: ${s.stage} | Created: ${new Date(s.created_at).toLocaleString()}`);
        });
    }
}

run();
