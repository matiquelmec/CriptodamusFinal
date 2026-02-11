
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env from backend root (assuming running from backend dir)
const envPath = path.resolve(process.cwd(), '.env');
console.log(`📂 CWD: ${process.cwd()}`);
console.log(`📄 Loading .env from: ${envPath}`);
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.error('❌ .env file NOT FOUND at ' + envPath);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSignals() {
    console.log('🔍 Checking Active Signals in DB...');

    const { data: signals, error } = await supabase
        .from('signals_audit')
        .select('id, symbol, side, status, stage, entry_price, activation_price, created_at')
        .in('status', ['PENDING', 'ACTIVE', 'OPEN', 'PARTIAL_WIN']);

    if (error) {
        console.error('❌ DB Error:', error);
        return;
    }

    if (!signals || signals.length === 0) {
        console.log('⚠️ No active signals found in DB.');
    } else {
        console.log(`✅ Found ${signals.length} active/pending signals:`);
        console.table(signals.map(s => ({
            symbol: s.symbol,
            side: s.side,
            STATUS: s.status, // Key field to check
            stage: s.stage,
            entry: s.entry_price,
            activated: s.activation_price,
            age_min: ((Date.now() - new Date(s.created_at).getTime()) / 60000).toFixed(1)
        })));
    }
}

checkSignals();
