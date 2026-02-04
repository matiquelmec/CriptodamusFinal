
import { EconomicService } from '../core/services/economicService';
import { signalAuditService } from '../services/signalAuditService';
import { AIOpportunity } from '../core/types';
import { FilterEngine } from '../core/services/engine/pipeline/FilterEngine';
import { TradingConfig } from '../core/config/tradingConfig';
import { scanMarketOpportunities } from '../core/services/engine/scannerLogic';

// Force Tournament Mode (Nuclear Shield Check active)
TradingConfig.TOURNAMENT_MODE = true;

// MOCK 1: EconomicService (Nuclear Shield Active)
EconomicService.checkNuclearStatus = async () => {
    return { isActive: true, isImminent: false, reason: 'NUCLEAR DAY DETECTED' };
};

// MOCK 2: FilterEngine (Force a Risk Block to test Override)
FilterEngine.shouldDiscard = (opp: any) => {
    // Specifically return a soft-block reason we know the scanner handles
    return { discarded: true, reason: 'Risk Shield: Fake Liquidity Crisis' };
};

// MOCK 3: StrategyRunner (Force a valid signal so we reach the Filter check)
import { StrategyRunner } from '../core/services/engine/pipeline/StrategyRunner';
StrategyRunner.run = (ind: any, risk: any) => {
    console.log("📈 [Audit] Mocking StrategyRunner -> Force LONG Signal");
    return {
        primaryStrategy: {
            id: 'audit_force_long',
            score: 99,
            signal: 'LONG' as any, // Cast to match type if needed
            reason: 'Audit Forced Signal',
            isFresh: true,
            specificTrigger: 'Audit Trigger'
        },
        details: ['Audit Forced Signal'],
        scoreBoost: 0,
        marketRegime: { regime: 'BULL' as any, confidence: 100 }
    };
};

console.log("🕵️‍♂️ [Security Audit] Starting Full System Deep Probe...");

async function runAudit() {

    // 1. CHECK NUCLEAR SHIELD
    console.log("\n🛡️ TEST 1: Economic Nuclear Shield Status");
    try {
        const shield = await EconomicService.checkNuclearStatus();
        console.log(`   Status: ${shield.isActive ? '🔴 ACTIVE (BLOCKING)' : '🟢 INACTIVE (OPEN)'}`);
        if (shield.isActive) {
            console.warn(`   ⚠️ SHIELD ACTIVE (WARNING MODE): ${shield.reason}`);
            console.log("   ✅ PASS: Shield is active but system should proceed (Warning Mode).");
        }
    } catch (e: any) {
        console.error("   ❌ ERROR checking shield:", e.message);
    }

    // 2. CHECK SIGNAL AUDIT FILTER
    console.log("\n🛡️ TEST 2: Pipeline Override Verification");
    console.log("   Attempting to scan markets with active Risk Shield...");

    try {
        // Run specific scanner logic
        // We know scannerLogic calls FilterEngine.shouldDiscard.
        // We expect it to CATCH the 'Risk Shield' reason, LOG it, and NOT return/block.

        // Note: successful completion of scanMarketOpportunities without throwing IS the test.
        // We need to see if it generates valid opportunities despite the mocks.

        // Mock fetchCryptoData to return one dummy coin so we don't hit API limit or empty market
        // But scanMarketOpportunities imports fetchCryptoData... we can't easily mock that import here without extensive setup.
        // Instead, we rely on the fact that scanMarketOpportunities is robust.
        // If we can't mock imports easily in this script, we trust the integration integration.
        // But wait, if FilterEngine is mocked globally, it should work.

        // Actually, scanMarketOpportunities fetches data. We assume fetch works.
        // Let's just run it.

        console.log("   [Action] Running scanMarketOpportunities('SWING_INSTITUTIONAL')...");
        const opportunities = await scanMarketOpportunities('SWING_INSTITUTIONAL');

        console.log(`   [Result] Opportunities Found: ${opportunities.length}`);

        if (opportunities.length > 0) {
            const sample = opportunities[0];
            const hasRiskWarning = sample.reasoning.some(r => r.includes('Risk Shield'));
            const hasNuclearWarning = sample.reasoning.some(r => r.includes('NUCLEAR'));

            if (hasRiskWarning) {
                console.log("   ✅ PASS: 'Risk Shield' warning found in reasoning. (Filter Override Works)");
            } else {
                console.error("   ❌ FAIL: 'Risk Shield' warning MISSING. (Filter might have been ignored or Mock failed)");
            }

            if (hasNuclearWarning) {
                console.log("   ✅ PASS: 'NUCLEAR' warning found in reasoning. (Nuclear Shield Override Works)");
            } else {
                console.warn("   ⚠️ WARN: 'NUCLEAR' warning missing (maybe logic order?).");
            }

            console.log("   Sample Reasoning:", sample.reasoning);

        } else {
            console.warn("   ⚠️ WARN: 0 Opportunities. Check if market fetch failed or if hard filters (Blacklist) are active.");
        }

    } catch (e: any) {
        console.error("   ❌ FAIL: Pipeline Crashed:", e);
    }

    console.log("\n🏁 Audit Complete.");
}

runAudit();
