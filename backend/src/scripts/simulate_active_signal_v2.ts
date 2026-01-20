
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function createTestSignal() {
    console.log("🧪 Creando señal de prueba simplificada (TEST_BTC_LONG)...");

    const entryPrice = 90000;
    const currentPrice = 91500; // Profit

    // Minimal insert with known columns
    const { data, error } = await supabase.from('signals_audit').insert({
        symbol: 'TEST/USDT',
        side: 'LONG',
        timeframe: '15m',
        strategy: 'TestStrategy',
        entry_price: entryPrice,
        final_price: currentPrice,
        status: 'ACTIVE',
        pnl_percent: 1.66,
        activation_price: entryPrice,
        fees_paid: 0,
        max_price_reached: entryPrice,
        stage: 0,
        created_at: Date.now()
    }).select();

    if (error) {
        console.error("❌ Error creando señal:", error);
    } else {
        console.log("✅ Señal ACTIVA creada exitosamente!");
        console.log("🆔 ID:", data[0].id);
        console.log("👀 Revisa el frontend ahora. Deberías ver 'TEST/USDT' con estado LIVE y PnL positivo.");
    }
    process.exit(0);
}

createTestSignal();
