
import { StrategyScorer } from '../core/services/engine/pipeline/StrategyScorer';
import { TechnicalIndicators } from '../core/types';

async function runTest() {
    console.log("🧪 STARTING PSYCHOLOGIST HACK VERIFICATION...");

    const mockIndicators: Partial<TechnicalIndicators> = {
        symbol: 'BTC/USDT',
        price: 50000,
        ema20: 49950, // Very close (0.1% distance)
        trendStatus: { emaAlignment: 'BULLISH', goldenCross: false, deathCross: false },
        rsi: 55,
        volumeExpert: {
            derivatives: {
                buySellRatio: 1.2, // Normal ratio
                openInterest: 1000,
                openInterestValue: 50000000,
                fundingRate: 0.0001,
                fundingRateDaily: 0.0003
            },
            cvd: { current: 0, trend: 'NEUTRAL', divergence: null, candleDelta: 0 },
            coinbasePremium: { index: 0, gapPercent: 0, signal: 'NEUTRAL' },
            liquidity: { bidAskSpread: 0, marketDepthScore: 50 }
        } as any
    };

    // TEST 1: Normal Sentiment (No Penalty)
    console.log("\n[TEST 1] Testing Normal Sentiment (Ratio 1.2)...");
    const result1 = StrategyScorer.score('BTCUSDT', mockIndicators as any, 'LONG');
    console.log(`Score: ${result1.score}`);
    console.log(`Reasoning: ${result1.reasoning.join(' | ')}`);
    const hasPenalty1 = result1.reasoning.some(r => r.includes('Psicólogo'));
    console.log(`Penalty Applied: ${hasPenalty1 ? '❌ YES (Expected NO)' : '✅ NO'}`);

    // TEST 2: Crowded Long Sentiment (Penalty Expected)
    console.log("\n[TEST 2] Testing Crowded Long (Ratio 3.5 > 2.5)...");
    const crowdedIndicators = { ...mockIndicators };
    crowdedIndicators.volumeExpert = {
        ...mockIndicators.volumeExpert,
        derivatives: { ...mockIndicators.volumeExpert!.derivatives, buySellRatio: 3.5 }
    } as any;

    const result2 = StrategyScorer.score('BTCUSDT', crowdedIndicators as any, 'LONG');
    console.log(`Score: ${result2.score}`);
    console.log(`Reasoning: ${result2.reasoning.join(' | ')}`);
    const hasPenalty2 = result2.reasoning.some(r => r.includes('Psicólogo'));
    console.log(`Penalty Applied: ${hasPenalty2 ? '✅ YES (-45)' : '❌ NO'}`);

    // TEST 3: Crowded Short Sentiment (Penalty Expected)
    console.log("\n[TEST 3] Testing Crowded Short (Ratio 0.2 < 0.4)...");
    const shortIndicators = { ...mockIndicators };
    shortIndicators.price = 49950;
    shortIndicators.ema20 = 50000; // Close to EMA
    shortIndicators.volumeExpert = {
        ...mockIndicators.volumeExpert,
        derivatives: { ...mockIndicators.volumeExpert!.derivatives, buySellRatio: 0.2 }
    } as any;

    const result3 = StrategyScorer.score('BTCUSDT', shortIndicators as any, 'SHORT');
    console.log(`Score: ${result3.score}`);
    console.log(`Reasoning: ${result3.reasoning.join(' | ')}`);
    const hasPenalty3 = result3.reasoning.some(r => r.includes('Psicólogo'));
    console.log(`Penalty Applied: ${hasPenalty3 ? '✅ YES (-45)' : '❌ NO'}`);

    console.log("\n✨ VERIFICATION FINISHED.");
}

runTest().catch(console.error);
