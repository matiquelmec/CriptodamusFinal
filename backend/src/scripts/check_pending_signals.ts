import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function checkPending() {
    console.log("🔍 CONTANDO SEÑALES PENDIENTES...");
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) process.exit(1);

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    const { data: pending, error } = await supabase
        .from('signals_audit')
        .select('*', { count: 'exact' })
        .eq('status', 'PENDING');

    if (error) {
        console.error(error);
        return;
    }

    const count = pending?.length || 0;
    console.log(`✅ TOTAL PENDIENTES: ${count}`);

    // Optional: Breakdown by Age
    if (count > 0) {
        const now = Date.now();
        const fresh = pending.filter(s => (now - new Date(s.created_at).getTime()) < 4 * 60 * 60 * 1000).length;
        console.log(`   - Frescas (< 4h): ${fresh}`);
        console.log(`   - Antiguas (> 4h): ${count - fresh}`);
    }

    process.exit(0);
}
checkPending();
