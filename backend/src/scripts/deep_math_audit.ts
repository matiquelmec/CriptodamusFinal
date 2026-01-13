import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function deepAudit() {
    console.log("🔬 INICIANDO AUDITORÍA MATEMÁTICA PROFUNDA...");

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
        process.exit(1);
    }
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    const { data: signals, error } = await supabase
        .from('signals_audit')
        .select('*');

    if (error || !signals) {
        console.error("❌ Error DB:", error);
        return;
    }

    console.log(`📊 Re-calculando matemáticas para ${signals.length} señales...`);
    let inconsistencies = 0;

    signals.forEach(s => {
        let issues = [];

        // 1. Math Check (Solo para Cerradas)
        if (['WIN', 'LOSS'].includes(s.status)) {
            const expectedPnL = ((s.final_price - s.entry_price) / s.entry_price) * 100 * (s.side === 'LONG' ? 1 : -1);
            const storedPnL = s.pnl_percent;

            // Tolerancia de 0.01% para errores de punto flotante
            if (Math.abs(expectedPnL - storedPnL) > 0.01) {
                issues.push(`Math Mismatch: Stored ${storedPnL.toFixed(4)}% vs Calc ${expectedPnL.toFixed(4)}%`);
            }
        }

        // 2. Logic Check (Precios Relativos) - Para TODOS
        // Stop Loss no debería estar a más del 20% de distancia (salvo casos extremos, pero raro en scalping)
        const slDist = Math.abs((s.stop_loss - s.entry_price) / s.entry_price);
        if (slDist > 0.20 && s.stop_loss > 0) {
            issues.push(`Suspicious SL Distance: ${(slDist * 100).toFixed(1)}% from Entry`);
        }

        // TP1 no debería estar a más del 50% de distancia
        const tpDist = Math.abs((s.tp1 - s.entry_price) / s.entry_price);
        if (tpDist > 0.50) {
            issues.push(`Suspicious TP1 Distance: ${(tpDist * 100).toFixed(1)}% from Entry`);
        }

        if (issues.length > 0) {
            console.log(`--------------------------------------------------`);
            console.log(`⚠️ ALERTA [ID: ${s.id} | ${s.symbol} | ${s.status}]`);
            console.log(`   Prices: Entry ${s.entry_price} | SL ${s.stop_loss} | TP ${s.tp1}`);
            console.log(`   Issues: ${issues.join(' + ')}`);
            inconsistencies++;
        }
    });

    if (inconsistencies === 0) {
        console.log("✅ MATEMÁTICAS PERFECTAS. Precios y PnL son 100% consistentes.");
    } else {
        console.log(`❌ Se encontraron ${inconsistencies} inconsistencias matemáticas o lógicas.`);
    }

    process.exit(0);
}

deepAudit();
