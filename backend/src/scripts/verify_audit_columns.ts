
import { signalAuditService } from '../services/signalAuditService';
import { savePrediction } from '../ml/inference';
import { AIOpportunity } from '../core/types';

async function runVerification() {
    console.log("🚀 Starting Verification: ML & Audit Persistence");

    const symbol = 'TESTBTC';
    const mockId = 'test_' + Date.now();

    // 1. Verify ML Prediction Persistence
    console.log("🧠 1. Simulating ML Prediction...");
    await savePrediction(symbol, 0.75, 'v1_verify');
    console.log("✅ ML Prediction saved. Check 'model_predictions' table.");

    // 2. Verify Audit Metric Tracking
    console.log("📊 2. Simulating Signal Audit Lifecycle...");

    const mockOpp: AIOpportunity = {
        id: mockId,
        symbol: symbol,
        timestamp: Date.now(),
        timeframe: '15m',
        side: 'LONG',
        strategy: 'verification_test',
        confidenceScore: 90,
        entryZone: { min: 49500, max: 50500, currentPrice: 50100 },
        takeProfits: { tp1: 51000, tp2: 52000, tp3: 53000 },
        stopLoss: 49000,
        session: 'LONDON',
        riskRewardRatio: 2.5,
        technicalReasoning: 'Verification Reasoning',
        invalidated: false
    };

    // Register Signal (PENDING)
    await (signalAuditService as any).registerSignals([mockOpp]);
    console.log("➡️ Signal Registered (PENDING)");

    // Simulate Entry (ACTIVE)
    console.log("➡️ Simulating Entry Trigger (50000)...");
    await (signalAuditService as any).processPriceTick(symbol, 50000);

    // Simulate Max Price Reach
    console.log("➡️ Simulating Moon Wick (51500)...");
    await (signalAuditService as any).processPriceTick(symbol, 51500);

    // Hit TP1 (PARTIAL_WIN + Stage 1)
    console.log("➡️ Simulating TP1 Hit (51100)...");
    await (signalAuditService as any).processPriceTick(symbol, 51100);

    // Hit TP2
    console.log("➡️ Simulating TP2 Hit (52100)...");
    await (signalAuditService as any).processPriceTick(symbol, 52100);

    // Hit TP3 (Closing with WIN)
    console.log("➡️ Simulating TP3 Hit (53100)...");
    await (signalAuditService as any).processPriceTick(symbol, 53100);

    console.log("🏁 Verification Cycle Complete.");
}

runVerification().catch(console.error);
