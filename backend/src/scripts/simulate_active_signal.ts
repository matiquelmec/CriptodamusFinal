
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function createTestSignal() {
    console.log("🧪 Creando señal de prueba (TEST_BTC_LONG)...");

    const entryPrice = 100000; // Hypothetical BTC entry
    const currentPrice = 100500; // 0.5% profit

    const { data, error } = await supabase.from('signals_audit').insert({
        symbol: 'TEST/USDT',
        side: 'LONG',
        timeframe: '15m',
        strategy: 'TestStrategy',
        entry_price: entryPrice,
        final_price: currentPrice,
        status: 'ACTIVE',
        pnl_percent: 0.5,
        created_at: Date.now(),
        // Add fake metadata to ensure it passes any frontend filters
        metadata: {
            leverage: 10,
            risk: 'low'
        }
    }).select();

    if (error) {
        console.error("❌ Error creando señal:", error);
    } else {
        console.log("✅ Señal ACTIVA creada exitosamente!");
        console.log("🆔 ID:", data[0].id);
        console.log("👀 Revisa el frontend ahora. Deberías ver 'TEST/USDT' con estado LIVE.");
    }
    process.exit(0);
}

createTestSignal();
