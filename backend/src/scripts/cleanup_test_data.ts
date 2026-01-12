import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function cleanupTestData() {
    console.log("🧹 INICIANDO LIMPIEZA DE DATOS DE PRUEBA...");

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
        console.error("❌ Falta configuración de Supabase.");
        process.exit(1);
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    // 1. Eliminar señales de prueba (AUDIT_TEST_STRATEGY)
    console.log("-> Eliminando señales con estrategia 'AUDIT_TEST_STRATEGY'...");

    const { count, error } = await supabase
        .from('signals_audit')
        .delete({ count: 'exact' })
        .eq('strategy', 'AUDIT_TEST_STRATEGY');

    if (error) {
        console.error("❌ Error al eliminar:", error.message);
    } else {
        console.log(`✅ Se eliminaron ${count} señales de prueba.`);
    }

    console.log("\n🏁 LIMPIEZA COMPLETADA. El historial ahora debería estar limpio.");
}

cleanupTestData();
