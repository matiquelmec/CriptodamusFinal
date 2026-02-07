import { EconomicService } from './core/services/economicService';
import { DataIntegrityGuard } from './core/services/engine/pipeline/DataIntegrityGuard';
import dotenv from 'dotenv';
import path from 'path';

// Load Env (Robustly)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runSecurityAudit() {
    console.log("🛡️ [Security Audit] Testing Nuclear Shield & Integrity Guard...");

    // 1. TEST ECONOMIC SHIELD
    console.log("\n1. Testing Economic Service (Nuclear Shield)...");
    try {
        const shield = await EconomicService.checkNuclearStatus();
        console.log("   - Active:", shield.isActive);
        console.log("   - Imminent:", shield.isImminent);
        console.log("   - Reason:", shield.reason);
        console.log("   - Source:", shield.isCached ? 'CACHE' : 'LIVE');

        if (shield.isActive && shield.isImminent) {
            console.error("   ❌ BLOCKING DETECTED: Sniper Shield is blocking signals!");
        } else {
            console.log("   ✅ Shield Status: PASS (Not blocking)");
        }

    } catch (e: any) {
        console.error("   ❌ Economic Service Crashed:", e.message);
    }

    // 2. TEST DATA INTEGRITY GUARD
    console.log("\n2. Testing Data Integrity Guard...");
    try {
        // Mock Context
        const mockContext = {
            globalData: { isDataValid: true, goldPrice: 2024, btcDominance: 50 }, // Healthy mock
            newsSentiment: { summary: "Positive", headlineCount: 10 },
            economicShield: { reason: "OK", isActive: false },
            isPreFlight: true
        };

        const report = await DataIntegrityGuard.getSystemIntegrityReport(mockContext);
        console.log("   - Score:", report.score);
        console.log("   - Status:", report.status);
        console.log("   - Stale Sources:", report.staleSources);
        console.log("   - Missing Critical:", report.missingCritical);

        if (report.status === 'HALTED') {
            console.error("   ❌ BLOCKING DETECTED: Integrity Guard is HALTING the system!");
        } else {
            console.log("   ✅ Integrity Status: PASS");
        }

    } catch (e: any) {
        console.error("   ❌ Data Integrity Guard Crashed:", e.message);
    }
}

runSecurityAudit();
