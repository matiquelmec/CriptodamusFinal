
import { signalAuditService } from '../services/signalAuditService';
import { AIOpportunity } from '../core/types';
import dotenv from 'dotenv';
dotenv.config();

async function testRegistration() {
    console.log("--- Signal Registration Diagnostic ---");

    // 1. Mock Opportunity (High Quality)
    const mockOpp: AIOpportunity = {
        id: 'TEST_BTC_LONG',
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: 95000, // Reasonable entry
        stopLoss: 93000,
        takeProfits: { tp1: 98000, tp2: 101000, tp3: 105000 },
        confidenceScore: 85,
        strategy: 'swing_institutional',
        timeframe: '15m',
        technicalReasoning: ['Manual Test Injection'],
        metrics: {
            adx: 30,
            rsi: 40,
            rvol: 1.5,
            volume24h: 1000000000
        }
    };

    console.log(`Injecting Mock Signal: ${mockOpp.symbol} ${mockOpp.side} (Score: ${mockOpp.confidenceScore})`);

    try {
        await signalAuditService.registerSignals([mockOpp]);
        console.log("✅ Registration call completed.");
    } catch (e: any) {
        console.error("❌ Registration FAILED:", e.message);
    }
}

testRegistration();
