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
        console.error("[Scanner] CRITICAL: Exchange Data Unavailable", e);
        throw new Error("EXCHANGE_CRITICAL_FAILURE"); // Fail Loud: Stop pipeline
    }

    // 2. RISK & CONTEXT
    const risk = await getMarketRisk();
    let macroContext: MacroContext | null = null;
    try {
        macroContext = await getMacroContext();
    } catch (e) {
        console.error("[Scanner] CRITICAL: Macro Context Failed. Aborting to prevent blind trading.", e);
        throw new Error("MACRO_CONTEXT_FAILURE"); // Fail Loud: Context is required for "God Mode"
    }

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

            // Apply Technical Context (ADX Range Filter) - HARDENING
            totalScore = applyTechnicalContext(totalScore, indicators, strategyResult.primaryStrategy?.id);

            // --- STAGE 4.5: SMART MTF VERIFICATION (Architect Check) ---
            // "The Architect verifies the Macro Structure before demolition"
            // We only check for Freeze Strategy or High Confidence setups to save API calls
            // --- STAGE 4.5: SMART MTF VERIFICATION (Architect Check) ---
            // "The Architect verifies the Macro Structure before demolition"
            let macroCompass: MacroCompass | undefined;

            // We only check for Freeze Strategy or High Confidence setups to save API calls
            if (strategyResult.primaryStrategy?.id === 'FREEZE_STRATEGY' || totalScore > 75) {
                // If we are scanning 15m, check 4H. If scanning 4H, this check is redundant (self-check) or needs 1D.
                if (interval === '15m') {
                    const compassResult = await verifyMacroTrend(coin.id, signalSide);
                    macroCompass = compassResult;

                    if (!compassResult.aligned) {
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
                    macdDivergence: indicators.macdDivergence?.type, // String check
                    fractalAnalysis: macroCompass ? {
                        trend_4h: macroCompass.trend4h,
                        ema200_4h: macroCompass.ema200_4h,
                        price_4h: macroCompass.price
                    } : undefined
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
            // Individual coin failure is acceptable, but we log it clearly
            // console.warn(`[Scanner] Skipped ${coin.symbol}:`, err); 
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
// --- HELPER: SMART ARCHITECT CHECK (MTF) ---
interface MacroCompass {
    aligned: boolean;
    trend4h: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    ema200_4h: number;
    price: number;
}

async function verifyMacroTrend(symbolId: string, signalSide: 'LONG' | 'SHORT'): Promise<MacroCompass> {
    try {
        const candles4h = await fetchCandles(symbolId, '4h');
        if (!candles4h || candles4h.length < 200) {
            return { aligned: true, trend4h: 'NEUTRAL', ema200_4h: 0, price: 0 }; // Benefit of doubt
        }

        const closes = candles4h.map(c => c.close);
        const currentPrice = closes[closes.length - 1];
        const ema200 = calculateEMA(closes, 200);

        const trend4h = currentPrice > ema200 ? 'BULLISH' : 'BEARISH';

        let aligned = false;
        if (signalSide === 'LONG') aligned = currentPrice > ema200;
        else aligned = currentPrice < ema200;

        return { aligned, trend4h, ema200_4h: ema200, price: currentPrice };

    } catch (e) {
        return { aligned: true, trend4h: 'NEUTRAL', ema200_4h: 0, price: 0 };
    }
}

// --- HELPER: TECHNICAL CONTEXT (ADX RANGE FILTER) ---
function applyTechnicalContext(
    baseScore: number,
    indicators: TechnicalIndicators,
    strategyId: string | undefined
): number {
    let adjustedScore = baseScore;

    // Range Filter (ADX < 25)
    if (indicators.adx < 25) {
        // Strategies that THRIVE in ranges or are counter-trend/reversal based
        // exempting them from the penalty.
        const isRangeFriendly =
            strategyId === 'mean_reversion' ||
            strategyId === 'divergence_hunter' || // Pinball/Div
            strategyId === 'freeze_protocol' ||   // Reversal
            strategyId === 'smc_liquidity';       // Often SFP based

        if (!isRangeFriendly) {
            // Penalize Trend Following Strategies in Range (Kill Switch)
            // e.g. Breakout, Ichimoku, Quant Volatility (Scalping trend)
            adjustedScore *= 0.5;
        }
    }

    return adjustedScore;
}
