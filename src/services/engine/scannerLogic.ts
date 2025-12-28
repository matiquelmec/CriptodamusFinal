/**
 * SCANNER LOGIC - PIPELINE ORCHESTRATOR
 * 
 * This file coordinates the new modular trading pipeline:
 * 1. Data Fetching (Binance/CoinCap)
 * 2. Indicator Calculation (Math)
 * 3. Advanced Analysis (Institutional)
 * 4. Strategy Execution (Regime Based)
 * 5. Scoring & Filtering (Risk Management)
 */

import { AIOpportunity, TradingStyle, TechnicalIndicators, MarketRisk } from '../../types';
import { TradingConfig } from '../../config/tradingConfig';

// --- PIPELINE MODULES ---
import { IndicatorCalculator } from './pipeline/IndicatorCalculator';
import { AdvancedAnalyzer } from './pipeline/AdvancedAnalyzer';
import { StrategyRunner } from './pipeline/StrategyRunner';
import { StrategyScorer } from './pipeline/StrategyScorer';
import { FilterEngine } from './pipeline/FilterEngine';

// --- SERVICES ---
import { getMacroContext, type MacroContext } from '../macroService';
import { calculateDCAPlan } from '../dcaCalculator';
import { fetchCryptoData, fetchCandles } from '../api/binanceApi';
import { getMarketRisk, calculateFundamentalTier } from './riskEngine';

import { calculateEMA } from '../mathUtils';

export const scanMarketOpportunities = async (style: TradingStyle): Promise<AIOpportunity[]> => {
    // 0. INITIALIZATION
    console.log(`[Scanner] PIPELINE START: ${style} mode...`);

    // 1. DATA INGESTION
    const mode = style === 'MEME_SCALP' ? 'memes' : 'volume'; // 'memes' uses MEME_SYMBOLS from API (legacy) or we filter later
    let market: any[] = [];
    try {
        market = await fetchCryptoData(mode);
        console.log(`[Scanner] Tickers Loaded: ${market.length}`);
    } catch (e) {
        console.error("[Scanner] DATA ERROR:", e);
        throw new Error("EXCHANGE_OFFLINE");
    }

    // 2. RISK & CONTEXT
    const risk = await getMarketRisk();
    let macroContext: MacroContext | null = null;
    try {
        macroContext = await getMacroContext();
    } catch (e) { console.warn("[Scanner] Macro Context unavailable"); }

    const topCandidates = style === 'MEME_SCALP' ? market : market.slice(0, 60);
    const opportunities: AIOpportunity[] = [];

    // 3. PARALLEL PROCESSING
    await Promise.all(topCandidates.map(async (coin) => {
        try {
            const interval = style === 'SWING_INSTITUTIONAL' || style === 'ICHIMOKU_CLOUD' ? '4h' : '15m';
            const candles = await fetchCandles(coin.id, interval);
            if (candles.length < 200) return;

            // --- STAGE 1: INDICATORS ---
            const indicators = IndicatorCalculator.compute(coin.symbol, candles);

            // Inject missing price/symbol data that calculator might not set fully
            indicators.symbol = coin.symbol;
            indicators.price = candles[candles.length - 1].close;

            // --- STAGE 2: ADVANCED ANALYSIS (Institutional) ---
            const advancedData = await AdvancedAnalyzer.compute(
                coin.symbol,
                candles,
                indicators.atr,
                indicators.price,
                indicators.fibonacci,
                indicators.pivots,
                indicators.ema200,
                indicators.ema50
            );

            // Merge Advanced Data into Indicators
            Object.assign(indicators, advancedData);

            // Tier Calculation (Legacy/Config hybrid)
            const tier = calculateFundamentalTier(coin.id, style === 'MEME_SCALP');
            indicators.tier = tier;

            // --- STAGE 3: STRATEGY EXECUTION ---
            const highs = candles.map(c => c.high);
            const lows = candles.map(c => c.low);
            const prices = candles.map(c => c.close);
            const volumes = candles.map(c => c.volume);

            const strategyResult = StrategyRunner.run(indicators, risk, highs, lows, prices, volumes);

            // Skip if no valid signal found
            if (strategyResult.primaryStrategy && strategyResult.primaryStrategy.signal === 'NEUTRAL') {
                return;
            }

            const signalSide: 'LONG' | 'SHORT' = (strategyResult.primaryStrategy?.signal === 'SHORT') ? 'SHORT' : 'LONG';
            const baseScoreResult = StrategyScorer.score(coin.symbol, indicators);

            let totalScore = baseScoreResult.score + (strategyResult.primaryStrategy?.score || 0) + strategyResult.scoreBoost;
            let reasoning = [...baseScoreResult.reasoning, ...strategyResult.details];

            // Apply Macro Filters (Context Awareness)
            if (macroContext) {
                totalScore = applyMacroFilters(totalScore, coin.symbol, signalSide, macroContext);
            }

            // --- STAGE 4.5: SMART MTF VERIFICATION (Architect Check) ---
            // "The Architect verifies the Macro Structure before demolition"
            // We only check for Freeze Strategy or High Confidence setups to save API calls
            if (strategyResult.primaryStrategy?.id === 'FREEZE_STRATEGY' || totalScore > 75) {
                // If we are scanning 15m, check 4H. If scanning 4H, this check is redundant (self-check) or needs 1D.
                // Assuming default run is 15m for opportunities.
                if (interval === '15m') {
                    const isMacroAligned = await verifyMacroTrend(coin.id, signalSide);
                    if (!isMacroAligned) {
                        console.log(`[Smart MTF] Discarding ${coin.symbol} - Macro 4H Mismatch (Architect Veto)`);
                        return; // DISCARD: Counter-trend to macro
                    }
                }
            }

            // --- STAGE 5: FILTERING & OUTPUT ---
            const opportunity: AIOpportunity = {
                id: coin.id,
                symbol: coin.symbol,
                timestamp: Date.now(),
                timeframe: interval,
                session: "GLOBAL", // Fallback until session context is strictly typed
                riskRewardRatio: 2.5, // Calc dynamically if possible
                strategy: strategyResult.primaryStrategy?.id || baseScoreResult.strategies[0] || 'hybrid_algo',
                side: signalSide,
                confidenceScore: Math.round(Math.min(100, totalScore)),
                entryZone: {
                    min: indicators.price * 0.995,
                    max: indicators.price * 1.005,
                    currentPrice: indicators.price
                },
                stopLoss: indicators.price * 0.98, // Placeholder default, DCA calculator refines this
                takeProfits: { tp1: 0, tp2: 0, tp3: 0 }, // Placeholder
                technicalReasoning: reasoning.join(". "),
                invalidated: false,
                metrics: {
                    rvol: indicators.rvol,
                    rsi: indicators.rsi,
                    vwapDist: ((indicators.price - indicators.vwap) / indicators.vwap) * 100,
                    structure: indicators.trendStatus.emaAlignment,
                    specificTrigger: strategyResult.primaryStrategy?.reason || baseScoreResult.reasoning[0] || "Technical Setup",
                    zScore: indicators.zScore,
                    emaSlope: indicators.emaSlope,
                    isSqueeze: indicators.isSqueeze,
                    volumeExpert: advancedData.volumeExpert,
                    macdDivergence: indicators.macdDivergence?.type // String check
                },
                chartPatterns: indicators.chartPatterns,
                freezeSignal: undefined, // Add if computed
                tier: tier
            };

            // Calculate DCA Plan (Institutional Money Management)
            // Fix: Pass decomposed arguments matching calculateDCAPlan signature
            const dcaPlan = calculateDCAPlan(
                indicators.price,
                indicators.confluenceAnalysis || { topResistances: [], topSupports: [], poiScore: 0, levels: [], supportPOIs: [], resistancePOIs: [] }, // Safe fallback
                indicators.atr,
                signalSide,
                indicators.marketRegime,
                indicators.fibonacci,
                tier || 'B',
                { // Predictive Targets
                    rsiReversal: indicators.rsiExpert?.target || undefined,
                    liquidationCluster: undefined, // Add if available
                    orderBookWall: undefined // Add if available
                }
            );
            opportunity.dcaPlan = dcaPlan;
            opportunity.stopLoss = dcaPlan.stopLoss;
            opportunity.takeProfits = {
                tp1: dcaPlan.takeProfits.tp1.price,
                tp2: dcaPlan.takeProfits.tp2.price,
                tp3: dcaPlan.takeProfits.tp3.price
            };

            // FINAL GATEKEEPER
            const gate = FilterEngine.shouldDiscard(opportunity, risk, style);
            if (!gate.discarded) {
                opportunities.push(opportunity);
            }

        } catch (err) {
            console.warn(`[Scanner] Error processing ${coin.symbol}:`, err);
        }
    }));

    console.log(`[Scanner] PIPELINE COMPLETE: Found ${opportunities.length} opportunities.`);
    return opportunities.sort((a, b) => b.confidenceScore - a.confidenceScore);
};

// --- HELPER: MACRO CONTEXT (Legacy Logic Preserved) ---
function applyMacroFilters(
    baseScore: number,
    symbol: string,
    signalSide: 'LONG' | 'SHORT',
    macro: MacroContext
): number {
    let adjustedScore = baseScore;
    const isBTC = symbol.includes('BTC');

    // Penalize Longs in Bear Market
    if (!isBTC && signalSide === 'LONG') {
        if (macro.btcRegime.regime === 'BEAR') adjustedScore *= 0.7;
        else if (macro.btcRegime.regime === 'RANGE') adjustedScore *= 0.9;
    }

    // Penalize Shorts in Bull Market
    if (!isBTC && signalSide === 'SHORT') {
        if (macro.btcRegime.regime === 'BULL') adjustedScore *= 0.7;
    }

    // Liquidity Drain Check
    if (macro.usdtDominance.trend === 'RISING' && signalSide === 'LONG') {
        adjustedScore *= 0.75;
    }

    return adjustedScore;
}

// --- HELPER: SMART ARCHITECT CHECK (MTF) ---
async function verifyMacroTrend(symbolId: string, signalSide: 'LONG' | 'SHORT'): Promise<boolean> {
    try {
        const candles4h = await fetchCandles(symbolId, '4h');
        if (!candles4h || candles4h.length < 200) return true; // Benefit of doubt

        const closes = candles4h.map(c => c.close);
        const currentPrice = closes[closes.length - 1];
        const ema200 = calculateEMA(closes, 200);

        if (signalSide === 'LONG') {
            return currentPrice > ema200;
        } else {
            return currentPrice < ema200;
        }
    } catch (e) {
        return true;
    }
}
