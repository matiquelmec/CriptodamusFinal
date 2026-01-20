
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function createTestSignal() {
    console.log("🧪 Creando señal de prueba COMPLETA (TEST/USDT)...");

    const entryPrice = 90000;
    const currentPrice = 91500;

    // Generate a random signal ID
    const signalId = `test_sig_${Date.now()}`;

    const { data, error } = await supabase.from('signals_audit').insert({
        signal_id: signalId, // LIKELY REQUIRED
        symbol: 'TEST/USDT',
        side: 'LONG',
        status: 'ACTIVE',
        strategy: 'TestStrategy',
        timeframe: '15m',
        entry_price: entryPrice,
        tp1: entryPrice * 1.02,
        tp2: entryPrice * 1.05,
        tp3: entryPrice * 1.10,
        stop_loss: entryPrice * 0.98,
        confidence_score: 85,
        created_at: Date.now(),
        final_price: currentPrice,
        pnl_percent: 1.66,
        stage: 0,
        activation_price: entryPrice,
        fees_paid: 0,
        max_price_reached: entryPrice,
        realized_pnl_percent: 0,
        ml_probability: 0.85
    }).select();

    if (error) {
        console.error("❌ Error creando señal:", error);
    } else {
        console.log("✅ Señal ACTIVA creada exitosamente!");
        console.log("🆔 DB ID:", data[0].id);
        console.log("👀 Revisa el frontend ahora.");
    }
    process.exit(0);
}

createTestSignal();
