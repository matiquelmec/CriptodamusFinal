import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function cleanupDuplicates() {
    console.log("🧹 INICIANDO LIMPIEZA DE DUPLICADOS (DEDUPLICACIÓN RETROACTIVA)...");

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
        process.exit(1);
    }
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    // 1. Obtener todas las señales vivas (PENDING, OPEN, ACTIVE)
    const { data: signals } = await supabase
        .from('signals_audit')
        .select('*')
        .in('status', ['PENDING', 'OPEN', 'ACTIVE']) // Ahora incluimos ACTIVE
        .order('created_at', { ascending: true }); // Los más viejos primero (Keepers)

    if (!signals) return;

    const seen = new Set<string>();
    const toDelete = [];

    for (const sig of signals) {
        const key = `${sig.symbol}-${sig.side}`; // Ej: BTCUSDT-LONG

        if (seen.has(key)) {
            // Ya vimos uno más viejo (el original), este es un duplicado nuevo -> BORRAR
            toDelete.push(sig.id);
        } else {
            // Este es el original (Oldest), lo guardamos en el Set
            seen.add(key);
        }
    }

    console.log(`📊 Análisis: ${signals.length} total. ${seen.size} únicos. ${toDelete.length} duplicados a borrar.`);

    if (toDelete.length > 0) {
        const { error } = await supabase
            .from('signals_audit')
            .delete()
            .in('id', toDelete);

        if (!error) console.log(`✅ ${toDelete.length} Duplicados eliminados correctamente.`);
        else console.error("❌ Error al borrar duplicates:", error);
    } else {
        console.log("✅ No se encontraron duplicados.");
    }
    process.exit(0);
}

cleanupDuplicates();
