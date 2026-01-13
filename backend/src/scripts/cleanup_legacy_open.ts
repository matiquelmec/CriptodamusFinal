import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function cleanupLegacy() {
    console.log("🧹 LIMPIEZA DE SEÑALES LEGACY 'OPEN'...");
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) process.exit(1);

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    // 1. Obtener señales 'OPEN' viejas (> 6 horas)
    const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);

    const { data: openSignals, error } = await supabase
        .from('signals_audit')
        .select('*')
        .eq('status', 'OPEN');

    if (error || !openSignals) {
        console.error("Error fetching OPEN signals:", error);
        return;
    }

    const outdated = openSignals.filter(s => Number(s.created_at) < sixHoursAgo);

    console.log(`🔎 Total 'OPEN': ${openSignals.length}`);
    console.log(`🗑️ Candidatos a borrar (Viejas): ${outdated.length}`);

    if (outdated.length > 0) {
        for (const sig of outdated) {
            const { error: updError } = await supabase
                .from('signals_audit')
                .update({
                    status: 'EXPIRED',
                    closed_at: Date.now()
                })
                .eq('id', sig.id);

            if (!updError) process.stdout.write('.');
        }
        console.log("\n✅ Limpieza completada.");
    } else {
        console.log("✅ No hay señales basura.");
    }
    process.exit(0);
}
cleanupLegacy();
