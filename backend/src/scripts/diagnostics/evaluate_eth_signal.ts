
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchCandles } from './core/services/api/binanceApi';
import { IndicatorCalculator } from './core/services/engine/pipeline/IndicatorCalculator';
import { StrategyRunner } from './core/services/engine/pipeline/StrategyRunner';
import { FilterEngine } from './core/services/engine/pipeline/FilterEngine';
import { getMarketRisk } from './core/services/engine/riskEngine';
import { TradingStyle } from './core/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function evaluateSignal() {
    const symbol = 'ETHUSDT';
    console.log(`🔍 Evaluating Signal for ${symbol}...`);

    try {
        // 1. Fetch Data
        console.log("📊 Fetching 15m and 4H candles...");
        const candles15m = await fetchCandles(symbol, '15m');
        const candles4h = await fetchCandles(symbol, '4h');

        if (candles15m.length < 200) {
            console.error("❌ Not enough 15m candles data");
            return;
        }

        const currentPrice = candles15m[candles15m.length - 1].close;
        console.log(`💲 Current Price: $${currentPrice.toFixed(2)}`);

        // 2. Compute Indicators
        console.log("🧮 Computing Indicators...");
        const indicators = IndicatorCalculator.compute(symbol, candles15m);
        // Inject price manually as ScannerLogic does
        indicators.price = currentPrice;

        // 3. Get Risk
        // Mock risk if getMarketRisk requires DB or complex setup, or try to run it.
        // We'll try running it, if it fails we mock.
        let risk;
        try {
            risk = await getMarketRisk();
        } catch (e) {
            console.warn("⚠️ Could not fetch real market risk, using default MEDIUM.");
            risk = { level: 'MEDIUM', note: 'Simulation Default', riskType: 'NORMAL' } as any;
        }

        // 4. Run Strategy
        console.log("🧠 Running Strategy Runner...");
        const highs = candles15m.map(c => c.high);
        const lows = candles15m.map(c => c.low);
        const prices = candles15m.map(c => c.close);
        const volumes = candles15m.map(c => c.volume);

        const strategyResult = StrategyRunner.run(indicators, risk, highs, lows, prices, volumes);

        // 5. Output Results
        console.log("\n===========================================");
        console.log(`🤖 SYSTEM EVALUATION FOR ${symbol}`);
        console.log("===========================================");
        console.log(`Time: ${new Date().toISOString()}`);
        console.log(`Market Regime: ${strategyResult.marketRegime.regime}`);

        if (strategyResult.primaryStrategy) {
            console.log(`\n🎯 PRIMARY SIGNAL: ${strategyResult.primaryStrategy.signal}`);
            console.log(`Strategy: ${strategyResult.primaryStrategy.id}`);
            console.log(`Score: ${strategyResult.primaryStrategy.score}`);
            console.log(`Reason: ${strategyResult.primaryStrategy.reason}`);
        } else {
            console.log(`\n⚪ SIGNAL: NEUTRAL (No primary strategy triggered)`);
        }

        console.log("\n📋 DETAILS:");
        strategyResult.details.forEach(d => console.log(`- ${d}`));

        console.log("\n🛡️ FILTER CHECK:");
        const opportunityMock = {
            symbol: symbol,
            confidenceScore: strategyResult.primaryStrategy?.score || 0,
            metrics: {
                adx: indicators.adx,
                volume24h: 10000000, // Dummy
                rvol: indicators.rvol,
                rsi: indicators.rsi
            },
            strategy: strategyResult.primaryStrategy?.id || '',
            side: strategyResult.primaryStrategy?.signal || 'NEUTRAL',
            technicalReasoning: 'Simulation'
        };
        const style: TradingStyle = 'SCALP_AGRESSIVE'; // Assuming this style based on "15m" and "Scalp" context
        const filterResult = FilterEngine.shouldDiscard(opportunityMock as any, risk, style);

        if (filterResult.discarded) {
            console.log(`❌ DISCARDED: ${filterResult.reason}`);
        } else {
            console.log(`✅ PASSED FILTERS`);
        }

        console.log("\n📊 KEY INDICATORS:");
        console.log(`RSI: ${indicators.rsi.toFixed(2)}`);
        console.log(`ADX: ${indicators.adx.toFixed(2)}`);
        console.log(`EMA Alignment: ${indicators.trendStatus.emaAlignment}`);
        console.log(`RVOL: ${indicators.rvol.toFixed(2)}`);
        if (indicators.cvdDivergence) console.log(`CVD Divergence: ${indicators.cvdDivergence}`);

        // ... (Previous Filter output)

        // 6. DCA/ENTRY VERIFICATION
        console.log("\n💰 DCA ENTRY VERIFICATION:");
        // Import check
        const { calculateDCAPlan } = await import('./core/services/dcaCalculator');

        const signalSide = strategyResult.primaryStrategy?.signal === 'SHORT' ? 'SHORT' : 'LONG';
        const dcaPlan = calculateDCAPlan(
            currentPrice,
            { topResistances: [], topSupports: [], poiScore: 0, levels: [], supportPOIs: [], resistancePOIs: [] }, // Mock Confluence
            indicators.atr,
            signalSide,
            strategyResult.marketRegime,
            indicators.fibonacci as any
        );

        console.log(`Signal Side: ${signalSide}`);
        console.log(`Calculated Entries (Current Price Reference: $${currentPrice.toFixed(2)}):`);
        dcaPlan.entries.forEach(e => {
            console.log(`- Entry ${e.level}: $${e.price.toFixed(2)} (${e.positionSize}%) - Factor: ${e.factors.join(', ')}`);
        });

        const entry1 = dcaPlan.entries[0].price;
        const diff = Math.abs(entry1 - 2916);

        console.log(`\n🕵️ INVESTIGATION RESULT:`);
        if (Math.abs(currentPrice - 2916) < 50) {
            console.log("✅ Price Match: Market is near user signal ($2916). Signal is FRESH.");
        } else if (diff < 20) {
            console.log("⚠️ Limit Order Logic: System is holding $2916 level despite price drop.");
        } else {
            console.log("🚨 STALE SIGNAL CONFIRMED: Current Market Entry ($" + entry1.toFixed(0) + ") != User Signal ($2916).");
            console.log("The user's signal was generated when price was ~$2916.");
        }

    } catch (e: any) {
        console.error("❌ Evaluation Failed:", e);
    }
}

evaluateSignal();
