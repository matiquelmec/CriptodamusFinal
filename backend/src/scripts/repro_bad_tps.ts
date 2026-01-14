import { calculateDCAPlan } from '../core/services/dcaCalculator';

const indicators = {
    price: 97327.05,
    atr: 882.35,
    marketRegime: { regime: 'TRENDING' },
    confluence: {
        topSupports: [{ price: 97300, score: 5, factors: ['Test Support'], type: 'SUPPORT' }],
        topResistances: []
    },
    fibonacci: { level0_618: 90000, level0_5: 91000, level0_786: 85000 }
};

const plan = calculateDCAPlan(
    indicators.price,
    indicators.confluence as any,
    indicators.atr,
    'LONG',
    indicators.marketRegime as any,
    indicators.fibonacci as any
);

console.log('--- REPRO RESULTS ---');
console.log('Side:', 'LONG');
console.log('Entry 0 Price:', plan.entries[0].price);
console.log('TP1:', plan.takeProfits.tp1.price);
console.log('TP2:', plan.takeProfits.tp2.price);
console.log('TP3:', plan.takeProfits.tp3.price);
console.log('Is Correct (TP1 > Entry):', plan.takeProfits.tp1.price > plan.entries[0].price);
