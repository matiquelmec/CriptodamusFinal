
// MOCK CONFIG
const config = { max_daily_loss_percent: 5.0, volatility_shutdown_multiplier: 3.0 };

// TYPE DEFINITIONS
interface MarketRisk { level: string; note: string; riskType: string; }

// LOGIC
function checkKernelSecurity(dailyPnLPercent: number, risk: MarketRisk) {
    // 1. EQUITY CURVE
    if (dailyPnLPercent <= -config.max_daily_loss_percent) {
        return { status: 'HALTED', reason: `EQUITY PROTECTION: ${dailyPnLPercent.toFixed(2)}%` };
    }
    // 2. BLACK SWAN
    if (risk.level === 'HIGH' && (risk.riskType === 'VOLATILITY' || risk.riskType === 'MANIPULATION')) {
        return { status: 'HALTED', reason: `BLACK SWAN: ${risk.note}` };
    }
    return { status: 'OK', reason: null };
}

// TEST CASES
const tests = [
    { name: "Normal", pnl: 1.0, risk: { level: 'LOW', riskType: 'NORMAL', note: 'OK' }, exp: 'OK' },
    { name: "Crash (-5.1%)", pnl: -5.1, risk: { level: 'LOW', riskType: 'NORMAL', note: 'OK' }, exp: 'HALTED' },
    { name: "Black Swan", pnl: 0.0, risk: { level: 'HIGH', riskType: 'VOLATILITY', note: 'Spike' }, exp: 'HALTED' }
];

console.log("🛡️ KERNEL LOGIC TEST\n");
tests.forEach(t => {
    const res = checkKernelSecurity(t.pnl, t.risk);
    const ok = res.status === t.exp;
    console.log(`${ok ? '✅' : '❌'} ${t.name}: ${res.status} (${res.reason || 'OK'})`);
});
