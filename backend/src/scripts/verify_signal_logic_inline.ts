
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function testInlineLogic() {
    console.log("🧪 Testing Inlined Signal Registration Logic...");

    const opp = {
        id: `debug_inline_${Date.now()}`,
        symbol: 'DEBUG/INLINE',
        side: 'LONG',
        strategy: 'DebugStrategy',
        timeframe: '15m',
        confidenceScore: 99,
        entryZone: { min: 50000, max: 50100 },
        stopLoss: 49000,
        takeProfits: { tp1: 51000, tp2: 52000, tp3: 55000 },
        technicalReasoning: 'Debug insertion test inline',
        mlPrediction: { probability: 88, signal: 'BULLISH', confidence: 88 },
        dcaPlan: null
    };

    // --- LOGIC FROM signalAuditService.ts ---
    let initialStatus = 'PENDING';
    let activationPrice = 0;
    let fees = 0;

    // Simulate entry logic (assume PENDING for now)
    const entryTarget = (opp.entryZone.min + opp.entryZone.max) / 2;

    const payload = {
        signal_id: opp.id,
        symbol: opp.symbol,
        side: opp.side,
        status: initialStatus,
        strategy: opp.strategy,
        timeframe: opp.timeframe,
        entry_price: entryTarget, // Plan Price
        activation_price: activationPrice, // Real Execution Price
        max_price_reached: activationPrice, // Initial extreme is entry
        fees_paid: fees,
        tp1: opp.takeProfits.tp1,
        tp2: opp.takeProfits.tp2,
        tp3: opp.takeProfits.tp3,
        stop_loss: opp.stopLoss,
        confidence_score: opp.confidenceScore,
        ml_probability: opp.mlPrediction ? (opp.mlPrediction.probability / 100) : null,
        stage: 0, // 0 = Entry Phase
        created_at: Date.now(),
        technical_reasoning: JSON.stringify({ dca: opp.dcaPlan || null }) + " | " + (opp.technicalReasoning || '')
    };

    console.log("Payload prepared:", payload);

    const { data, error } = await supabase
        .from('signals_audit')
        .insert(payload)
        .select();

    if (error) {
        console.error("❌ INSERT FAILED:", error);
    } else {
        console.log("✅ INSERT SUCCESS:", data);
    }
    process.exit(0);
}

testInlineLogic();
