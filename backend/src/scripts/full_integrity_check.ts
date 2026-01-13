import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function integrityCheck() {
    console.log("🔍 INICIANDO AUDITORÍA INTEGRAL DE DATOS (HEALTH CHECK)...");

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

    console.log(`📊 Analizando ${signals.length} registros...`);
    let issues = 0;

    signals.forEach(s => {
        let problematic = false;
        let reasons = [];

        // 1. Check Prices
        if (s.entry_price <= 0) {
            reasons.push(`Entry Price Zero/Neg: ${s.entry_price}`);
            problematic = true;
        }
        if (['WIN', 'LOSS'].includes(s.status) && s.final_price <= 0) {
            reasons.push(`Final Price Zero/Neg: ${s.final_price}`);
            problematic = true;
        }

        // 2. Check PnL Reality
        if (s.status === 'WIN' && s.pnl_percent <= 0) {
            reasons.push(`WIN with Negative/Zero PnL: ${s.pnl_percent}%`);
            problematic = true;
        }
        if (s.status === 'LOSS' && s.pnl_percent >= 0) {
            reasons.push(`LOSS with Positive/Zero PnL: ${s.pnl_percent}%`);
            problematic = true;
        }

        // 3. Extreme Anomalies (Glitches)
        if (s.pnl_percent < -20) {
            reasons.push(`Extreme LOSS (< -20%): ${s.pnl_percent}%`);
            problematic = true;
        }
        if (s.pnl_percent > 500) {
            reasons.push(`Extreme WIN (> 500%): ${s.pnl_percent}%`);
            problematic = true;
        }

        // 4. Time Travel
        if (new Date(s.created_at).getTime() > Date.now() + 60000) { // 1 min buffer
            reasons.push(`Future Creation Date`);
            problematic = true;
        }

        if (problematic) {
            console.log(`⚠️ ANOMALÍA DETECTADA [ID: ${s.id} | ${s.symbol}]: ${reasons.join(', ')}`);
            issues++;
        }
    });

    if (issues === 0) {
        console.log("✅ INTEGRIDAD AL 100%. No se encontraron anomalías.");
    } else {
        console.log(`❌ Se encontraron ${issues} registros problemáticos.`);
    }

    process.exit(0);
}

integrityCheck();
