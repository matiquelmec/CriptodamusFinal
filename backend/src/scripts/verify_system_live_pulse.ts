
import { fetchCryptoData, fetchCandles } from './core/services/api/binanceApi';
import { IndicatorCalculator } from './core/services/engine/pipeline/IndicatorCalculator';
import { AdvancedAnalyzer } from './core/services/engine/pipeline/AdvancedAnalyzer';
import { StrategyRunner } from './core/services/engine/pipeline/StrategyRunner';
import { getMarketRisk } from './core/services/engine/riskEngine';
import { fetchGlobalMarketData } from './services/globalMarketService';
import { fetchCryptoSentiment } from './services/newsService';
import { getExpertVolumeAnalysis } from './services/volumeExpert';

import { AIOpportunity, TechnicalIndicators } from './core/types';

// Minimal Pulse Check Script
async function runLivePulse() {
    console.log("⚡ STARTING SYSTEM PULSE CHECK (Real Data)...");

    try {
        // 1. DATA INGESTION TEST
        console.log("Testing Binance Connectivity...");
        const candles = await fetchCandles('BTCUSDT', '15m');

        console.log(`✅ Candles Fetched: ${candles.length} candles.`);
        if (candles.length < 50) throw new Error("Not enough candles fetched.");

        // 2. INDICATOR CALCULATION
        console.log("Computing Indicators...");
        const indicators = IndicatorCalculator.compute('BTCUSDT', candles);

        indicators.symbol = 'BTCUSDT';
        indicators.price = candles[candles.length - 1].close;

        console.log(`✅ Basic Indicators Computed. RSI: ${indicators.rsi.toFixed(2)}, ADX: ${indicators.adx.toFixed(2)}`);

        // 3. ADVANCED ANALYSIS (Institutional)
        console.log("Fetching God Mode Data (AdvancedAnalyzer)...");
        const advancedData = await AdvancedAnalyzer.compute(
            'BTCUSDT',
            candles,
            indicators.atr,
            indicators.price,
            indicators.fibonacci,
            indicators.pivots,
            indicators.ema200,
            indicators.ema50
        );
        Object.assign(indicators, advancedData);

        // Verify Data Quality
        const hasFractals = indicators.fractals && (indicators.fractals.bullish.length > 0 || indicators.fractals.bearish.length > 0);
        const hasOrderBlocks = indicators.orderBlocks && (indicators.orderBlocks.bullish.length > 0 || indicators.orderBlocks.bearish.length > 0);

        console.log(`🔍 Institutional Data Check:`);
        console.log(`   - Fractals: ${hasFractals ? '✅ OK' : '❌ MISSING'}`);
        console.log(`   - Order Blocks: ${hasOrderBlocks ? '✅ OK' : '❌ MISSING (Required for Pinball/SMC)'}`);

        // 4. EXPERT VOLUME (CVD/OI)
        console.log("Fetching Expert Volume (CVD/OI)...");
        const volumeAnalysis = await getExpertVolumeAnalysis('BTCUSDT');
        if (volumeAnalysis) {
            indicators.cvd = volumeAnalysis.cvd.cvdSeries;
            indicators.volumeExpert = volumeAnalysis;
            console.log(`   - CVD Series: ${indicators.cvd && indicators.cvd.length > 0 ? '✅ OK' : '❌ MISSING'}`);
            console.log(`   - Open Interest: ${(volumeAnalysis.derivatives?.openInterestValue || 0) > 0 ? '✅ OK' : '❌ MISSING'}`);
        } else {
            console.log(`❌ Volume Analysis Failed (IsNull)`);
        }

        // 5. STRATEGY EXECUTION
        console.log("Running Strategy Engine...");
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const prices = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        const risk = await getMarketRisk();

        const result = StrategyRunner.run(indicators, risk, highs, lows, prices, volumes);

        console.log("\n📊 STRATEGY RESULTS (BTCUSDT 15m):");
        console.log("-------------------------------------------------");
        if (result.primaryStrategy) {
            console.log(`Strategy: ${result.primaryStrategy.id.toUpperCase()}`);
            console.log(`Signal: ${result.primaryStrategy.signal}`);
            console.log(`Score: ${result.primaryStrategy.score}`);
            console.log(`Reason: ${result.primaryStrategy.reason}`);
            console.log(`Details: ${result.details.join(' | ')}`);
        } else {
            console.log("Result: NEUTRAL (No Strategy Triggered)");
            console.log(`Reasoning: ${result.details.join(' ')}`);
        }
        console.log("-------------------------------------------------");

        if (hasOrderBlocks && indicators.cvd && indicators.cvd.length > 0) {
            console.log("\n🏆 SYSTEM STATUS: ROBUST & INTELLIGENT.");
            console.log("Institutional Data is flowing. Strategies are processing it.");
        } else {
            console.log("\n⚠️ SYSTEM STATUS: DEGRADED.");
            console.log("Missing critical institutional data (CVD or OrderBlocks). Strategies may fail safely.");
        }

    } catch (e) {
        console.error("\n❌ SYSTEM PULSE FAILED:", e);
        process.exit(1);
    }
}

runLivePulse();
