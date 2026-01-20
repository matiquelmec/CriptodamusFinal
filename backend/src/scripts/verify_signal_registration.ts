
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { signalAuditService } from '../services/signalAuditService';

// Mimic the load
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

async function testRegistration() {
    console.log("🧪 Testing Signal Registration Logic (ESM)...");

    try {
        const mockOpportunity = {
            id: `debug_reg_${Date.now()}`,
            symbol: 'DEBUG/USDT',
            side: 'LONG',
            strategy: 'DebugStrategy',
            timeframe: '15m',
            confidenceScore: 99,
            entryZone: { min: 50000, max: 50100 },
            stopLoss: 49000,
            takeProfits: { tp1: 51000, tp2: 52000, tp3: 55000 },
            technicalReasoning: 'Debug insertion test',
            mlPrediction: { probability: 88, signal: 'BULLISH', confidence: 88 },
            dcaPlan: null
        };

        // We need to simulate how the scanner calls it.
        // Scanner calls: registerSignals([opp])
        console.log("👉 Calling registerSignals([mockOpportunity])...");

        // Mock Supabase if it's not initialized in the service automatically
        // BUT signalAuditService usually initializes itself in constructor or Init()
        // We will assume it's self-contained. 

        await signalAuditService.registerSignals([mockOpportunity] as any);

        console.log("✅ Registration call completed without throwing!");
    } catch (e: any) {
        console.error("❌ Registration Failed:", e);
        console.error("   Message:", e.message);
    }
    process.exit(0);
}

testRegistration();
