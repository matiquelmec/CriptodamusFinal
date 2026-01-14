import { calculateDCAPlan } from '../core/services/dcaCalculator';

console.log('--- FINAL INSTITUTIONAL VERIFICATION (BNB REPRO) ---');

const signalPrice = 945.4;
const atr = 5; // Low volatility to test floors
const side = 'LONG';

const plan = calculateDCAPlan(
    signalPrice,
    { topSupports: [], topResistances: [] }, // No POIs to force Fallback/Momentum
    atr,
    side,
    { regime: 'TRENDING' }, // Force Momentum
    undefined,
    'B'
);

console.log('Resulting Plan:');
console.log('Entry 1:', plan.entries[0].price);
console.log('TP1:', plan.takeProfits.tp1.price);
console.log('Stop Loss:', plan.stopLoss);

const tpGap = ((plan.takeProfits.tp1.price - plan.entries[0].price) / plan.entries[0].price) * 100;
const slGap = ((plan.entries[0].price - plan.stopLoss) / plan.entries[0].price) * 100;

console.log(`TP1 Gap: ${tpGap.toFixed(2)}% (Target: >= 0.5%)`);
console.log(`SL Gap: ${slGap.toFixed(2)}% (Target: >= 1.2%)`);

if (tpGap >= 0.5 && slGap >= 1.2 && plan.takeProfits.tp1.price > plan.entries[0].price) {
    console.log('✅ VERIFICATION SUCCESS: Profit integrity and safety floors are ACTIVE.');
} else {
    console.log('❌ VERIFICATION FAILED: Logic still leaky.');
}
