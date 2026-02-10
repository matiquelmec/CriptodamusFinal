
/**
 * DIAGNOSTIC SCRIPT: SIGNAL SILENCE AUDITOR (FIXED)
 * 
 * Runs the exact same logic as the live scanner but:
 * 1. Prints verbose logs for EACH asset.
 * 2. Explicitly states WHY an asset was discarded (RVOL, Score, ADX, etc.).
 * 3. Does not place trades or send notifications.
 */

import { TradingConfig } from '../core/config/tradingConfig';
import { fetchCryptoData, fetchCandles } from '../core/services/api/binanceApi';
import { IndicatorCalculator } from '../core/services/engine/pipeline/IndicatorCalculator';
import { StrategyScorer } from '../core/services/engine/pipeline/StrategyScorer';
import { FilterEngine } from '../core/services/engine/pipeline/FilterEngine';
import { AssetClassifier } from '../core/services/engine/pipeline/AssetClassifier';
import { getMarketRisk } from '../core/services/engine/riskEngine';

async function runAudit() {
    console.log("🕵️‍♂️ STARTING SIGNAL SILENCE AUDIT...");
    console.log("---------------------------------------------------");
    console.log(`Config Mode: ${TradingConfig.TOURNAMENT_MODE ? '🏆 TOURNAMENT (Elite 9)' : '🌍 GLOBAL'}`);
    console.log(`Min Score: ${TradingConfig.scoring.min_score_entry}`);
    console.log(`Filters: Vol>$${(TradingConfig.scoring.filters.min_volume_24h / 1000000).toFixed(1)}M, ADX>${TradingConfig.scoring.filters.min_adx}`);
    console.log("---------------------------------------------------\n");

    // 1. Fetch General Market Data (for Volume 24h)
    console.log("📡 Fetching Market Context (24h Tickers)...");
    let marketData: any[] = [];
    try {
        marketData = await fetchCryptoData('volume');
    } catch (e) {
        console.warn("⚠️ Generalized Ticker Fetch Failed, wil proceed with limited data.");
    }

    const assets = TradingConfig.assets.tournament_list;
    // const assets = ['BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'SOLUSDT', 'DOGEUSDT', 'PAXGUSDT']; // Test subset

    console.log(`✅ Analyzing ${assets.length} Selected Assets...\n`);

    const risk = await getMarketRisk();
    // 1.5 Analyze Market Intelligence (Systemic Risk)
    console.log("🧠 Analyzing Market Intelligence...");
    const { correlationAnalyzer } = await import('../core/services/risk/CorrelationAnalyzer');
    let intelligenceState = { state: 'normal', highCorrRatio: 0 };
    try {
        const intelligence = await correlationAnalyzer.analyze([], { price: 0, change24h: 0 }); // Mock BTC data for speed
        intelligenceState = {
            state: intelligence.state,
            highCorrRatio: intelligence.metrics ? (intelligence.metrics.highCorrPairs / intelligence.metrics.totalPairs) : 0
        };
        console.log(`🧠 Intelligence State: ${intelligence.state.toUpperCase()} (High Corr: ${(intelligenceState.highCorrRatio * 100).toFixed(1)}%)`);
        if (intelligence.state === 'systemic_risk') {
            console.log("⚠️ SYSTEMIC RISK ACTIVE: -15 Point Penalty will be applied.");
        }
    } catch (e) {
        console.warn("⚠️ Market Intelligence Failed", e);
    }
    console.log("---------------------------------------------------\n");

    // 2. Analyze Each Asset
    for (const symbol of assets) {
        process.stdout.write(`🔍 Analyzing ${symbol}... `);

        try {
            // A. Fetch Candles
            const candles = await fetchCandles(symbol, '15m');
            if (!candles || candles.length < 50) {
                console.log(`❌ INSUFFICIENT CANDLES: ${candles?.length || 0}`);
                continue;
            }

            // B. Get Volume 24h from Ticker Data
            const ticker = marketData.find(m => m.symbol === symbol);
            // Fallback volume calculation if ticker missing (approximate from last 96 15m candles? No, just use 0)
            const volume24h = ticker ? parseFloat(ticker.volume) * parseFloat(ticker.price) : 0;
            // Note: binanceApi fetchCryptoData returns volume as quote volume usually, or base. 
            // Let's assume the filter expects Quote Volume (USDT).

            // C. Indicators
            const indicators = IndicatorCalculator.compute(symbol, candles);

            if (!indicators || indicators.invalidated) {
                console.log(`❌ INVALID DATA: ${indicators?.technicalReasoning || 'Unknown error'}`);
                continue;
            }

            // D. Scoring (Pre-Filter)
            let longResult = StrategyScorer.score(symbol, indicators, 'LONG');
            let shortResult = StrategyScorer.score(symbol, indicators, 'SHORT');

            // Apply Systemic Risk Penalty (Mirroring ScannerLogic.ts)
            if (intelligenceState.state === 'systemic_risk') {
                longResult.score -= 15;
                longResult.reasoning.push(`🧠 RESGO SISTÉMICO (-15)`);
                shortResult.score -= 15;
                shortResult.reasoning.push(`🧠 RESGO SISTÉMICO (-15)`);
            }

            // Determine best side
            const bestSide = longResult.score > shortResult.score ? 'LONG' : 'SHORT';
            const bestResult = longResult.score > shortResult.score ? longResult : shortResult;

            // E. Filter Check
            const mockOpp: any = {
                symbol: symbol,
                side: bestSide,
                confidenceScore: bestResult.score,
                metrics: {
                    adx: indicators.adx, // Fix: Direct access
                    volume24h: volume24h,
                    rvol: indicators.rvol, // Fix: Direct access
                    rsi: indicators.rsi
                },
                technicalReasoning: bestResult.reasoning.join(', '),
                strategy: 'audit_test'
            };

            const filterResult = FilterEngine.shouldDiscard(mockOpp, risk, 'SWING_INSTITUTIONAL');

            if (filterResult.discarded) {
                console.log(`🔴 DISCARDED`);
                console.log(`   --> reason: ${filterResult.reason}`);
                console.log(`   --> Score: ${bestResult.score.toFixed(0)} / ${TradingConfig.scoring.min_score_entry}`);
                console.log(`   --> ADX: ${indicators.adx.toFixed(1)} | RVOL: ${indicators.rvol.toFixed(2)} | RSI: ${indicators.rsi.toFixed(1)}`);
                // console.log(`   --> Reasoning: ${bestResult.reasoning.slice(0, 1).join(' | ')}`);
            } else {
                console.log(`🟢 PASSED! (POTENTIAL SIGNAL)`);
                console.log(`   --> Score: ${bestResult.score.toFixed(0)}`);
                console.log(`   --> Side: ${bestSide}`);
                console.log(`   --> Reasoning: ${bestResult.reasoning.join('\n      ')}`);
            }

        } catch (e: any) {
            console.log(`⚠️ ERROR: ${e.message}`);
        }
        console.log("---------------------------------------------------");
    }
}

runAudit().catch(console.error);
