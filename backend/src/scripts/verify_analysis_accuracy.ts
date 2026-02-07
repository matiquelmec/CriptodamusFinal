
import { fetchCandles } from '../core/services/api/binanceApi';
import { IndicatorCalculator } from '../core/services/engine/pipeline/IndicatorCalculator';
import { AdvancedAnalyzer } from '../core/services/engine/pipeline/AdvancedAnalyzer';
import { StrategyRunner } from '../core/services/engine/pipeline/StrategyRunner';
import { StrategyScorer } from '../core/services/engine/pipeline/StrategyScorer';
import { getMarketRisk } from '../core/services/engine/riskEngine';

process.on('unhandledRejection', (reason, p) => {
    console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

const runAudit = async (symbol = 'BTC') => {
    console.log(`🔍 [AUDIT] Starting Deep Analysis Verification for ${symbol}...`);

    try {
        // 1. Fetch Real Data
        console.log("1. Fetching Real-Time 4h Candles from Binance...");
        const candles = await fetchCandles(symbol, '4h');
        console.log(`   ✅ Loaded ${candles.length} candles.`);
        const lastCandle = candles[candles.length - 1];
        console.log(`   Current Price: ${lastCandle.close}`);

        // 2. Compute Indicators
        console.log("\n2. Computing Core Indicators...");
        const indicators = IndicatorCalculator.compute(symbol, candles);

        // Inject missing
        indicators.symbol = symbol;
        indicators.price = lastCandle.close;

        console.log(`   RSI: ${indicators.rsi.toFixed(2)}`);
        console.log(`   ADX: ${indicators.adx.toFixed(2)}`);
        console.log(`   EMA200: ${indicators.ema200.toFixed(2)} (Trend: ${indicators.trendStatus.emaAlignment})`);
        console.log(`   Volume Z-Score: ${indicators.zScore.toFixed(2)}`);

        // 3. Advanced Analysis
        console.log("\n3. Running Institutional Analyzer...");
        const advanced = await AdvancedAnalyzer.compute(
            symbol,
            candles,
            indicators.atr,
            indicators.price,
            indicators.fibonacci,
            indicators.pivots,
            indicators.ema200,
            indicators.ema50
        );

        console.log(`   Volume Expert: ${advanced.volumeExpert ? JSON.stringify(advanced.volumeExpert).substring(0, 100) + '...' : 'N/A'}`);

        // Order Blocks (Bearish = Resistance, Bullish = Support)
        const resistances = advanced.orderBlocks.bearish;
        if (resistances.length > 0) {
            console.log(`   Resistances Only (Order Blocks): ${resistances.length} (Nearest: ${resistances[0].price})`);
        }

        // FVGs
        const fvgs = [...advanced.fairValueGaps.bullish, ...advanced.fairValueGaps.bearish];
        if (fvgs.length > 0) {
            console.log(`   FVGs Found: ${fvgs.length}`);
        }

        // Merge
        Object.assign(indicators, advanced);

        // 4. Strategy Execution
        console.log("\n4. Executing Strategy Engines...");
        const risk = await getMarketRisk();
        const res = StrategyRunner.run(
            indicators,
            risk,
            candles.map(c => c.high),
            candles.map(c => c.low),
            candles.map(c => c.close),
            candles.map(c => c.volume)
        );

        if (res.primaryStrategy) {
            console.log(`   ✅ STRATEGY TRIGGERED: [${res.primaryStrategy.id.toUpperCase()}]`);
            console.log(`      Side: ${res.primaryStrategy.signal}`);
            console.log(`      Confidence: ${res.primaryStrategy.score}`);
            console.log(`      Reason: ${res.primaryStrategy.reason}`);
        } else {
            console.log("   ℹ️ No Primary Strategy Triggered (Neutral State)");
        }

        // 5. Final Score
        const baseScore = StrategyScorer.score(symbol, indicators);
        const totalScore = baseScore.score + (res.primaryStrategy?.score || 0) + res.scoreBoost;

        console.log("\n5. Final Score Calculation");
        console.log(`   Base Technical Score: ${baseScore.score}`);
        console.log(`   Strategy Bonus: ${res.primaryStrategy?.score || 0}`);
        console.log(`   Boost: ${res.scoreBoost}`);
        console.log(`   -----------------------------`);
        console.log(`   TOTAL CONFIDENCE: ${Math.min(100, totalScore)}/100`);

        if (totalScore > 75) {
            console.log("\n🎯 CONCLUSION: Valid Opportunity Detected.");
        } else {
            console.log("\n💤 CONCLUSION: Weak Signal (Filtered).");
        }

    } catch (e) {
        console.error("Audit Failed:", e);
    }
};

// Run
const target = process.argv[2] || 'BTC';
runAudit(target);
