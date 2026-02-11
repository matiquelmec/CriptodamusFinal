
import { signalAuditService } from '../services/signalAuditService';
import { AIOpportunity } from '../core/types';
import dotenv from 'dotenv';
dotenv.config();

async function testShortRegistration() {
    console.log("--- Short Signal Registration Diagnostic ---");

    // Mock SHORT Opportunity (High Quality)
    // BTC Price is 67024. Let's try to enter at 67100.
    const mockOpp: AIOpportunity = {
        id: 'TEST_BTC_SHORT_123',
        symbol: 'BTCUSDT',
        side: 'SHORT',
        entryPrice: 67100, // Above current price
        stopLoss: 68000,
        takeProfits: { tp1: 66000, tp2: 65000, tp3: 63000 },
        confidenceScore: 85,
        strategy: 'swing_institutional',
        timeframe: '15m',
        technicalReasoning: ['Manual Short Test'],
        entryZone: { currentPrice: 67024, max: 67100, min: 66900 },
        metrics: {
            adx: 30,
            rsi: 60,
            rvol: 1.5,
            volume24h: 1000000000
        }
    };

    console.log(`Injecting Mock SHORT: ${mockOpp.symbol} (Score: ${mockOpp.confidenceScore})`);

    try {
        await signalAuditService.registerSignals([mockOpp]);
        console.log("✅ Registration call completed.");
    } catch (e: any) {
        console.error("❌ Registration FAILED:", e.message);
    }
}

testShortRegistration();
