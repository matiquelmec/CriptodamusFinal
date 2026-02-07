
import { checkKernelSecurity } from '../core/services/engine/riskEngine';
import { MarketRisk } from '../core/types';
import { TradingConfig } from '../core/config/tradingConfig';

// MOCK DATA
const MOCK_PNL_SAFE = 1.5;
const MOCK_PNL_DANGER = -4.9;
const MOCK_PNL_CRASH = -5.1;

const MOCK_RISK_SAFE: MarketRisk = { level: 'LOW', note: 'Safe', riskType: 'NORMAL' };
const MOCK_RISK_VOLATILITY: MarketRisk = { level: 'HIGH', note: 'Volatility Spike', riskType: 'VOLATILITY' };
const MOCK_RISK_MANIPULATION: MarketRisk = { level: 'HIGH', note: 'Whale Activity', riskType: 'MANIPULATION' };

console.log("🛡️ KERNEL SECURITY VERIFICATION PROTOCOL 🛡️\n");
console.log(`CONFIG: Max Daily Loss: -${TradingConfig.kernel.max_daily_loss_percent}% | Volatility Shutdown: Enabled`);

// SCENARIO 1: NORMAL DAY
console.log("\n🧪 TEST 1: Normal Day (PnL +1.5%, Low Risk)");
const result1 = checkKernelSecurity(MOCK_PNL_SAFE, MOCK_RISK_SAFE);
if (result1.status === 'OK') console.log("✅ PASS: System operational.");
else console.log("❌ FAIL: System halted incorrectly.", result1);

// SCENARIO 2: NEAR MISS
console.log("\n🧪 TEST 2: Near Miss (PnL -4.9%, Low Risk)");
const result2 = checkKernelSecurity(MOCK_PNL_DANGER, MOCK_RISK_SAFE);
if (result2.status === 'OK') console.log("✅ PASS: System operational (Warning Zone).");
else console.log("❌ FAIL: System halted prematurely.", result2);

// SCENARIO 3: EQUITY CRASH (The "Fury" Limit)
console.log("\n🧪 TEST 3: Equity Crash (PnL -5.1%, Low Risk)");
const result3 = checkKernelSecurity(MOCK_PNL_CRASH, MOCK_RISK_SAFE);
if (result3.status === 'HALTED' && result3.reason?.includes('EQUITY PROTECTION')) {
    console.log("✅ PASS: EQUITY PROTECTION TRIGGERED.");
    console.log(`   └─ Reason: ${result3.reason}`);
} else {
    console.log("❌ FAIL: Failed to protect equity.", result3);
}

// SCENARIO 4: BLACK SWAN (Volatility)
console.log("\n🧪 TEST 4: Black Swan Event (PnL 0%, High Volatility)");
const result4 = checkKernelSecurity(0, MOCK_RISK_VOLATILITY);
if (result4.status === 'HALTED' && result4.reason?.includes('BLACK SWAN')) {
    console.log("✅ PASS: BLACK SWAN SHIELD TRIGGERED.");
    console.log(`   └─ Reason: ${result4.reason}`);
} else {
    console.log("❌ FAIL: Failed to detect volatility event.", result4);
}

// SCENARIO 5: WHALE MANIPULATION
console.log("\n🧪 TEST 5: Whale Manipulation (PnL 0%, High Manipulation)");
const result5 = checkKernelSecurity(0, MOCK_RISK_MANIPULATION);
if (result5.status === 'HALTED' && result5.reason?.includes('BLACK SWAN')) {
    console.log("✅ PASS: WHALE SHIELD TRIGGERED.");
    console.log(`   └─ Reason: ${result5.reason}`);
} else {
    console.log("❌ FAIL: Failed to detect manipulation.", result5);
}

console.log("\n🛡️ VERIFICATION COMPLETE.");
