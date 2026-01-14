import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

async function debug() {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

    // Get the BTC signal
    const { data: signals } = await supabase
        .from('signals_audit')
        .select('*')
        .eq('id', 330);

    const signal = signals![0];
    const currentPrice = 96900; // Live price

    console.log('Signal:', {
        symbol: signal.symbol,
        side: signal.side,
        status: signal.status,
        tp1: signal.tp1,
        tp3: signal.tp3,
        stage: signal.stage
    });

    let updates: any = {};
    let shouldClose = false;

    // FASE 2: Position Management
    const isActive = signal.status === 'ACTIVE' || signal.status === 'PARTIAL_WIN';
    if (isActive) {
        const basePrice = signal.activation_price || signal.entry_price;
        const currentStage = signal.stage || 0;
        const slHit = (signal.side === 'LONG') ? currentPrice <= signal.stop_loss : currentPrice >= signal.stop_loss;

        if (!slHit) {
            // TP Check
            const tp1Hit = (signal.side === 'LONG') ? currentPrice >= signal.tp1 : currentPrice <= signal.tp1;
            if (tp1Hit && currentStage < 1) {
                updates.status = 'PARTIAL_WIN';
                updates.stage = 1;
                console.log('TP1 Triggered!');
            }

            const tp3Hit = (signal.side === 'LONG') ? currentPrice >= signal.tp3 : currentPrice <= signal.tp3;
            if (tp3Hit) {
                shouldClose = true;
                updates.status = 'WIN';
                updates.stage = 3;
                console.log('TP3 Triggered!');
            }
        }
    }

    console.log('Calculated Updates:', updates);
    console.log('Should Close:', shouldClose);
}

debug();
