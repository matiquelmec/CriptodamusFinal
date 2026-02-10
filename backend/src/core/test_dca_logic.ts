
import { calculateDCAPlan } from './services/dcaCalculator';
import { ConfluenceAnalysis } from './services/confluenceEngine';

// Mock Data for PAXG (Gold) - Low Volatility Scenario
const MOCK_PRICE = 2700.00;
const MOCK_ATR = 1.00; // Very Low ATR (~0.03%)
const MOCK_CONFLUENCE: ConfluenceAnalysis = {
    topSupports: [],
    topResistances: [],
    zones: [],
    trend: 'BULLISH',
    score: 80
};

console.log("--- TEST 1: Low Volatility (Standard) ---");
const plan1 = calculateDCAPlan(
    MOCK_PRICE,
    MOCK_CONFLUENCE,
    MOCK_ATR,
    'LONG'
);

console.log(`Entry: ${plan1.averageEntry}`);
console.log(`StopLoss: ${plan1.stopLoss}`);
const dist1 = ((MOCK_PRICE - plan1.stopLoss) / MOCK_PRICE) * 100;
console.log(`SL Distance: ${dist1.toFixed(4)}%`);
console.log(`Min Req: 0.8%`);

if (dist1 < 0.8) console.error("FAILED: SL too tight!");
else console.log("PASSED: SL respects floor.");


console.log("\n--- TEST 2: High Volatility (Momentum) ---");
const MOCK_ATR_VOL = 20.00; // High ATR
const plan2 = calculateDCAPlan(
    MOCK_PRICE,
    MOCK_CONFLUENCE,
    MOCK_ATR_VOL,
    'LONG'
);

console.log(`Entry: ${plan2.averageEntry}`);
console.log(`StopLoss: ${plan2.stopLoss}`);
const dist2 = ((MOCK_PRICE - plan2.stopLoss) / MOCK_PRICE) * 100;
console.log(`SL Distance: ${dist2.toFixed(4)}%`);
