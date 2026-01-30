
import { StrategyScorer } from './core/services/engine/pipeline/StrategyScorer';
import { TechnicalIndicators } from './core/types';

async function verifyShortScenario() {
    // ESCENARIO 1: El "Frankenstein" (SHORT con data Alcista)
    // El usuario reportó un SHORT con 88% que tenía "Bullish FVG retest".
    const frankensteinData: Partial<TechnicalIndicators> = {
        price: 88000,
        rsi: 80, // Overbought
        trendStatus: { emaAlignment: 'BEARISH', goldenCross: false, deathCross: true } as any,
        ichimokuData: {
            senkouA: 89000, senkouB: 90000,
        } as any, // Price < Cloud (Bearish)
        rsiDivergence: { type: 'BEARISH' } as any, // Bearish RSI Div
        boxTheory: { active: true, signal: 'BEARISH' } as any,
        zScore: 2.5, // Overbought
        cvdDivergence: 'BEARISH'
    };

    console.log("\n--- TEST: SHORT Signal with BEARISH (Aligned) context ---");
    const result = StrategyScorer.score("BTCUSDT", frankensteinData as TechnicalIndicators, 'SHORT');
    console.log("Score Final:", result.score);
    console.log("Razonamiento:", result.reasoning.join(" | "));
    if (result.score > 70) console.log("✅ SUCCESS: Short correctly scored for Bearish setup");
    else console.log("❌ FAILURE: Short was penalized despite bearish alignment");
}

async function verifyLongScenario() {
    // ESCENARIO 2: Validar LONG Correcto
    const frankensteinData: Partial<TechnicalIndicators> = {
        price: 88000,
        rsi: 25, // Extremedly Oversold (Should penalize SHORT)
        trendStatus: { emaAlignment: 'BULLISH', slope: 0.1, adx: 30 }, // Bullish Trend (Should penalize SHORT)
        ichimokuData: {
            tenkan: 87000, kijun: 86500, senkouA: 85000, senkouB: 84000,
            chikouSpanFree: true, cloudFutureType: 'BULLISH'
        } as any, // Price > Cloud (Strong Bullish, should penalize SHORT)
        fairValueGaps: {
            bullish: [{ top: 88500, bottom: 87500, strength: 10, count: 1 }],
            bearish: []
        }, // Testing BULLISH support (Should NOT boost SHORT)
        volumeProfile: {
            poc: 85000, valueAreaHigh: 89000, valueAreaLow: 83000, totalVolume: 1000,
            lowVolumeNodes: []
        }, // Price > POC (POC is support, should NOT boost SHORT)
        zScore: -2.5, // Extremely Oversold (Bullish reversion, should NOT boost SHORT)
        cvdDivergence: 'BULLISH' // Whale Accumulation (Should NOT boost SHORT)
    };
    console.log("\n--- TEST: LONG Signal with BULLISH context ---");
    const result = StrategyScorer.score('BTCUSDT', frankensteinData as TechnicalIndicators, 'LONG');
    console.log(`Score Final: ${result.score}/100`);

    if (result.score > 70) {
        console.log("✅ SUCCESS: El sistema identificó correctamente la confluencia alcista.");
    } else {
        console.error("❌ FAIL: El score debería ser alto para un contexto coincidente.");
    }
}

async function run() {
    console.log("Iniciando Auditoria de Logica Institucional v2.0...");
    await verifyShortScenario();
    // await verifyLongScenario();
}
run();
