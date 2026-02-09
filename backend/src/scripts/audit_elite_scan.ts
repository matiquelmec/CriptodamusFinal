
import { fetchCryptoData, fetchCandles } from '../core/services/api/binanceApi';
import { IndicatorCalculator } from '../core/services/engine/pipeline/IndicatorCalculator'; // FIXED IMPORT
import { StrategyRunner } from '../core/services/engine/pipeline/StrategyRunner';
import { FilterEngine } from '../core/services/engine/pipeline/FilterEngine';
import { TradingConfig } from '../core/config/tradingConfig';
import { MarketRisk } from '../core/types';

/**
 * 🕵️ AUDIT ELITE SCAN (SURGICAL)
 * Target: The 9 Assets from 'tournament_list'.
 * Goal: Find exactly why NONE are triggering.
 */

async function runEliteAudit() {
    console.log("🕵️ STARTING ELITE AUDIT (TOURNAMENT MODE)...");

    // 1. Load Elite List
    const eliteList = TradingConfig.assets.tournament_list; // e.g., BTCUSDT, ETHUSDT...
    console.log(`🎯 Targets: ${eliteList.join(', ')}`);

    // 2. Fetch Market Data
    console.log("📡 Fetching Market Data...");
    const allMarketData = await fetchCryptoData('volume');

    // Filter for Elite 9
    const eliteData = allMarketData.filter(d => eliteList.includes(d.id) || eliteList.includes(d.id.replace('USDT', '')));

    if (eliteData.length === 0) {
        console.error("❌ CRITICAL: Could not find ANY Elite assets in market data!");
        return;
    }

    console.log(`✅ Found data for ${eliteData.length}/${eliteList.length} assets.`);

    // Mock Risk (Low to give best chance)
    const mockRisk: MarketRisk = { level: 'LOW', riskType: 'STABLE', score: 20 };

    for (const asset of eliteData) {
        process.stdout.write(`\n🔍 Analyzing ${asset.symbol} [${asset.price}]... `);

        // 3. Fetch Candles (15m default)
        // Note: StrategyRunner often needs context candles (4h) for MTF logic.
        // We will fetch them to give the strategy a fair chance.
        const candles = await fetchCandles(asset.id, '15m');
        const contextCandles = await fetchCandles(asset.id, '4h');

        if (candles.length < 50) {
            console.log("❌ Not enough data");
            continue;
        }

        // 4. Calc Indicators (Using the correct Pipeline Calculator)
        // IndicatorCalculator.compute(symbol, candles)
        const indicators = IndicatorCalculator.compute(asset.symbol, candles);

        // 5. Run Strategies
        const prices = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const volumes = candles.map(c => c.volume);

        // Pass 4h candles as context
        const strategyResult = StrategyRunner.run(indicators, mockRisk, highs, lows, prices, volumes, contextCandles);

        if (!strategyResult.primaryStrategy || strategyResult.primaryStrategy.signal === 'NEUTRAL') {
            console.log(`⚠️ REJECTED: Strategies are NEUTRAL.`);
            // check details
            if (strategyResult.details.length > 0) {
                console.log(`   Internal Strategy Notes: ${strategyResult.details.join(', ')}`);
            } else {
                console.log(`   (No signals detected by any strategy)`);
            }
            continue;
        }

        const stratName = strategyResult.primaryStrategy.id;
        const score = (strategyResult.primaryStrategy.score || 0) + (strategyResult.scoreBoost || 0);

        console.log(`💡 STRATEGY FOUND: ${stratName} (Score: ${score})`);

        // 6. Test Filters
        const mockOpp = {
            symbol: asset.symbol,
            confidenceScore: score,
            metrics: {
                volume24h: asset.rawVolume,
                rvol: indicators.rvol,
                rsi: indicators.rsi,
                adx: indicators.adx
            },
            strategy: stratName,
            side: strategyResult.primaryStrategy.signal,
            technicalReasoning: [strategyResult.primaryStrategy.reason]
        };

        const filterResult = FilterEngine.shouldDiscard(mockOpp as any, mockRisk, 'SWING_INSTITUTIONAL');

        if (filterResult.discarded) {
            console.log(`❌ DISCARDED by FILTER: ${filterResult.reason}`);
            if (filterResult.reason?.includes('RVOL')) console.log(`   👉 RVOL Value: ${indicators.rvol?.toFixed(2)} vs Limit 1.8`);
            if (filterResult.reason?.includes('Score')) console.log(`   👉 Score Value: ${score} vs Limit ${TradingConfig.scoring.min_score_entry}`);
        } else {
            console.log(`✅ **PASSED ALL CHECKS**! This should be a signal!`);
        }
    }
}

runEliteAudit();
