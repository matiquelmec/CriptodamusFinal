import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function inspectLosses() {
    console.log("🔍 INSPECCIONANDO PÉRDIDAS RECIENTES (DIAGNÓSTICO)...");

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
        process.exit(1);
    }
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    const { data: signals } = await supabase
        .from('signals_audit')
        .select('*')
        .eq('status', 'LOSS')
        .order('closed_at', { ascending: false })
        .limit(5);

    if (!signals || signals.length === 0) {
        console.log("✅ No se encontraron señales LOSS recientes.");
        return;
    }

    signals.forEach(s => {
        console.log("---------------------------------------------------");
        console.log(`ID: ${s.id} | ${s.symbol} ${s.side}`);
        console.log(`Entry: ${s.entry_price}`);
        console.log(`SL: ${s.stop_loss}`);
        console.log(`Final (Close): ${s.final_price}`);
        console.log(`PnL: ${s.pnl_percent}%`);
        console.log(`Calc Check: (( ${s.final_price} - ${s.entry_price} ) / ${s.entry_price} ) * 100 = ${((s.final_price - s.entry_price) / s.entry_price) * 100}`);
    });

    process.exit(0);
}

inspectLosses();
