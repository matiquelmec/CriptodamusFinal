import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function cleanupAnomalies() {
    console.log("🧹 LIMPIANDO ANOMALÍAS DE DATOS (GLITCHES)...");

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
        process.exit(1);
    }
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    // Borrar señales con PNL peor que -20% (Imposible con nuestro SL de ~2%)
    // OJO: 'pnl_percent' se almacena como float.
    const { data, error } = await supabase
        .from('signals_audit')
        .delete()
        .lt('pnl_percent', -20)
        .select();

    if (error) {
        console.error("❌ Error:", error);
    } else {
        console.log(`✅ Se eliminaron ${data?.length || 0} señales corruptas (PnL < -20%).`);
        if (data && data.length > 0) {
            data.forEach(s => console.log(`   - Borrado: ${s.symbol} PNL: ${s.pnl_percent}%`));
        }
    }
    process.exit(0);
}

cleanupAnomalies();
