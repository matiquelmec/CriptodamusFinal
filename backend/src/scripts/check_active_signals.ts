import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function checkActive() {
    console.log("🔍 LISTANDO SEÑALES ACTIVAS...");
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) process.exit(1);

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    const { data: active, error } = await supabase
        .from('signals_audit')
        .select('*')
        .eq('status', 'ACTIVE');

    if (error) {
        console.error(error);
        return;
    }

    if (!active || active.length === 0) {
        console.log("ℹ️ No hay señales ACTIVAS.");
    } else {
        console.log(`✅ ${active.length} Señales ACTIVAS:`);
        active.forEach(s => console.log(`   * ${s.symbol} ${s.side} ($${s.entry_price})`));
    }
    process.exit(0);
}
checkActive();
