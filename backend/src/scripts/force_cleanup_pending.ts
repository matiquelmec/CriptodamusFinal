import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function forceCleanup() {
    console.log("🧹 FORZANDO LIMPIEZA DE SEÑALES PENDIENTES (STALE PENDING)...");

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
        console.error("❌ Falta configuración de Supabase.");
        process.exit(1);
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    // 1. Obtener todas las PENDING/OPEN
    const { data: signals, error } = await supabase
        .from('signals_audit')
        .select('*')
        .in('status', ['PENDING', 'OPEN']);

    if (error || !signals) {
        console.error("❌ Error al leer señales:", error?.message);
        return;
    }

    console.log(`📊 Total de señales PENDIENTES analizadas: ${signals.length}`);

    let expiredCount = 0;
    const updates = [];

    const now = Date.now();

    for (const sig of signals) {
        const createdAt = new Date(sig.created_at).getTime();
        const ageHours = (now - createdAt) / (1000 * 60 * 60);

        // Regla: 15m = 4h, Otros = 48h
        const limit = sig.timeframe === '15m' ? 4 : 48;

        if (ageHours > limit) {
            updates.push({
                id: sig.id,
                status: 'EXPIRED',
                closed_at: now,
                final_price: sig.entry_price, // Neutral reference
                pnl_percent: 0
            });
            expiredCount++;
        }
    }

    if (expiredCount > 0) {
        console.log(`⚠️ Encontradas ${expiredCount} señales caducadas. Actualizando...`);

        // Actualizar en lotes (o uno por uno si son pocos, aquí uno por uno para simplicidad en script)
        for (const upd of updates) {
            await supabase.from('signals_audit').update({
                status: upd.status,
                closed_at: upd.closed_at,
                final_price: upd.final_price,
                pnl_percent: upd.pnl_percent
            }).eq('id', upd.id);
        }
        console.log(`✅ ¡Limpieza Exitosa! ${expiredCount} señales marcadas como EXPIRED.`);
    } else {
        console.log("✅ El sistema está limpio. Todas las señales pendientes están dentro del tiempo válido.");
    }

    process.exit(0);
}

forceCleanup();
