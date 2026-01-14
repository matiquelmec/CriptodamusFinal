import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

async function rectify() {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

    console.log('🛡️ [Rectify] Buscando señales WIN con PnL negativo...');

    const { data: signals, error } = await supabase
        .from('signals_audit')
        .select('id, symbol, side, pnl_percent, status')
        .eq('status', 'WIN')
        .lte('pnl_percent', 0);

    if (error) {
        console.error('❌ Error al consultar Supabase:', error.message);
        return;
    }

    if (!signals || signals.length === 0) {
        console.log('✅ No se encontraron señales corruptas. El sistema está íntegro.');
        return;
    }

    console.log(`⚠️ Se encontraron ${signals.length} señales falsas ganadoras. Rectificando...`);

    let correctedCount = 0;
    for (const sig of signals) {
        const { error: updateError } = await supabase
            .from('signals_audit')
            .update({ status: 'LOSS' })
            .eq('id', sig.id);

        if (!updateError) {
            console.log(`✅ ID ${sig.id} (${sig.symbol}): WIN -> LOSS (PnL: ${sig.pnl_percent.toFixed(2)}%)`);
            correctedCount++;
        } else {
            console.error(`❌ Error al rectificar ID ${sig.id}:`, updateError.message);
        }
    }

    console.log(`🎉 Limpieza terminada. ${correctedCount} señales rectificadas correctamente.`);
}

rectify();
