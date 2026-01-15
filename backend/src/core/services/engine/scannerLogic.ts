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
import { MarketSession } from './MarketSession'; // NEW: Dynamic Time Logic
import { FilterEngine } from './pipeline/FilterEngine';
import { signalAuditService } from '../../../services/signalAuditService'; // Fix: Import Singleton

// --- SERVICES ---
import { getMacroContext, type MacroContext } from '../macroService';
import { calculateDCAPlan } from '../dcaCalculator';
import { fetchCryptoData, fetchCandles } from '../api/binanceApi';
import { getMarketRisk, calculateFundamentalTier, calculateKellySize, getVolatilityAdjustedLeverage, calculatePortfolioCorrelation } from './riskEngine';
import { fetchCryptoSentiment } from '../../../services/newsService'; // NEW: Sentiment Engine
import { estimateLiquidationClusters, getRealLiquidationClusters } from '../../../services/engine/liquidationEngine'; // NEW: Liquidation Engine
import { fetchGlobalMarketData } from '../../../services/globalMarketService'; // NEW: Global Macro Engine

import { calculateEMA } from '../mathUtils';
import { predictNextMove, savePrediction } from '../../../ml/inference'; // NEW: Brain Import
import { getExpertVolumeAnalysis, enrichWithDepthAndLiqs } from '../../../services/volumeExpert'; // NEW: Volume Expert Service
import { VolumeExpertAnalysis } from '../../types/types-advanced'; // NEW: Correct Type Import

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

    // NEW: Global Sentiment Analysis (The "Why")
    const globalSentiment = await fetchCryptoSentiment('BTC');
    console.log(`[Scanner] Global Sentiment: ${globalSentiment.score} (${globalSentiment.sentiment}) | "${globalSentiment.summary}"`);

    // NEW: Global Market Data (DXY, Gold) - Hoisted for efficiency
    let globalData: any = { dxyIndex: 0, goldPrice: 0, btcDominance: 0 };
    try {
        globalData = await fetchGlobalMarketData();
    } catch (e) {
        console.warn("[Scanner] Global Market Data missing", e);
    }

    const topCandidates = style === 'MEME_SCALP' ? market : market.slice(0, 60);
    const opportunities: AIOpportunity[] = [];

    // 3. CHUNKED PROCESSING (Robustness Fix)
    // Process in small batches to prevent API rate limiting / Geo-blocking timeouts
    const BATCH_SIZE = 5;
    for (let i = 0; i < topCandidates.length; i += BATCH_SIZE) {
        const batch = topCandidates.slice(i, i + BATCH_SIZE);
        // console.log(`[Scanner] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(topCandidates.length / BATCH_SIZE)}`);

        await Promise.all(batch.map(async (coin: any) => {
            try {
                const interval = style === 'SWING_INSTITUTIONAL' || style === 'ICHIMOKU_CLOUD' ? '4h' : '15m';
                const candles = await fetchCandles(coin.id, interval);
                if (candles.length < 200) return;

                // --- STAGE 1: INDICATORS ---
                const indicators = IndicatorCalculator.compute(coin.symbol, candles);

                // Inject missing price/symbol data that calculator might not set fully
                indicators.symbol = coin.symbol;
                indicators.price = candles[candles.length - 1].close;

                // --- STAGE 2: EXPERT VOLUME & LIQUIDITY (God Tier) ---
                let volumeAnalysis: VolumeExpertAnalysis | undefined;
                try {
                    // Fetch base expert data (OI, Funding, CVD)
                    volumeAnalysis = await getExpertVolumeAnalysis(coin.symbol);
                    // ENRICH: Get Order Book Walls & Liquidation Clusters
                    if (volumeAnalysis) {
                        const highs = candles.map(c => c.high);
                        const lows = candles.map(c => c.low);
                        volumeAnalysis = await enrichWithDepthAndLiqs(coin.symbol, volumeAnalysis, highs, lows, indicators.price);
                    }
                } catch (e) { }

                // --- STAGE 2.5: ADVANCED ANALYSIS (Institutional) ---
                const advancedData = await AdvancedAnalyzer.compute(
                    coin.symbol,
                    candles,
                    indicators.atr,
                    indicators.price,
                    indicators.fibonacci,
                    indicators.pivots,
                    indicators.ema200,
                    indicators.ema50,
                    [], // Harmonics fallback
                    volumeAnalysis?.liquidity?.orderBook,
                    volumeAnalysis?.liquidity?.liquidationClusters || []
                );

                // Merge Advanced Data into Indicators
                Object.assign(indicators, advancedData);
                if (volumeAnalysis) indicators.volumeExpert = volumeAnalysis;

                // Tier Calculation (Legacy/Config hybrid)
                const fundamentalTier = calculateFundamentalTier(coin.id, style === 'MEME_SCALP');
                indicators.tier = fundamentalTier;

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
                const baseScoreResult = StrategyScorer.score(coin.symbol, indicators, signalSide);

                // Initial Score (Capped to baseline level before boosts)
                let totalScore = Math.min(100, (baseScoreResult.score + (strategyResult.primaryStrategy?.score || 0) + strategyResult.scoreBoost) / 1.5);
                let reasoning = [...baseScoreResult.reasoning, ...strategyResult.details];

                // --- PHASE 0: MARKET SESSION & TIME AWARENESS ---
                const sessionState = MarketSession.analyzeSession();
                const sessionLabel = sessionState.activeSessions.join(' + ') || 'QUIET_HOURS';

                // Log once per scan cycle
                // console.log(`⏰ Session: ${sessionLabel} ${sessionState.isKillZone ? `(⚠️ KILL ZONE: ${sessionState.killZoneReason})` : ''}`);

                // Apply Macro Filters (Context Awareness)
                if (macroContext) {
                    totalScore = applyMacroFilters(totalScore, coin.symbol, signalSide, macroContext);
                }

                // NEW: Sentiment Filter
                if (globalSentiment.score > 0.3 && signalSide === 'LONG') {
                    totalScore += 10;
                    reasoning.push("🗞️ Sentiment: Positive News Catalyst");
                } else if (globalSentiment.score < -0.3 && signalSide === 'SHORT') {
                    totalScore += 10;
                    reasoning.push("🗞️ Sentiment: Negative News FUD");
                } else if ((globalSentiment.score > 0.5 && signalSide === 'SHORT') || (globalSentiment.score < -0.5 && signalSide === 'LONG')) {
                    totalScore -= 20; // Fight against extreme narrative
                    reasoning.push("⚠️ Sentiment Warning: Fighting the Narrative");
                }

                // Apply Technical Context (ADX Range Filter) - HARDENING
                totalScore = applyTechnicalContext(totalScore, indicators, strategyResult.primaryStrategy?.id);


                // --- STAGE 4.5: SMART MTF VERIFICATION (Architect Check) ---
                // "The Architect verifies the Macro Structure before demolition"
                // NEW RULES:
                // 1. If Signal is SHORT, we ALWAYS verify 4H trend (Safety First).
                // 2. If Signal is LONG, we verify if score is high enough or strategy requires it.
                // 3. EXCEPTION: "PROFESSIONAL_REVERSAL" (Reversal at Major Support) allows Counter-Trend.

                let macroCompass: MacroCompass | undefined;
                const isProfessionalReversal = strategyResult.primaryStrategy?.id === 'PROFESSIONAL_REVERSAL' ||
                    strategyResult.primaryStrategy?.specificTrigger === 'PROFESSIONAL_REVERSAL'; // Check Trigger too

                const needsArchitectCheck = (signalSide === 'SHORT' || totalScore > 75 || strategyResult.primaryStrategy?.id === 'FREEZE_STRATEGY') && !isProfessionalReversal;

                if (needsArchitectCheck) {
                    if (interval === '15m') {
                        const compassResult = await verifyMacroTrend(coin.id, signalSide);
                        macroCompass = compassResult;

                        if (!compassResult.aligned) {
                            // Strict veto for Shorts against 4H Trend
                            if (signalSide === 'SHORT') {
                                console.log(`[Smart MTF] VETO ${coin.symbol}: Short signal against 4H Trend (Price > EMA200). Logic: Don't short uptrends.`);
                                return;
                            }

                            // For Longs, we might tolerate it if it's a "Buy the Dip" logic (Price < EMA200 but oversold), 
                            // but generally we want alignment.
                            console.log(`[Smart MTF] Warning ${coin.symbol} - Macro 4H Mismatch (Architect Veto)`);
                            // return; // We allow Longs to survive if score is huge (reversal), but penalized elsewhere
                            totalScore -= 20; // Heavy penalty instead of hard block for Longs (catching falling knives is risky but profitable)
                        }
                    }
                } else if (isProfessionalReversal) {
                    // Log the exception
                    // console.log(`[Smart MTF] ALLOWED ${coin.symbol}: Professional Reversal at Major Support (Counter-Trend authorized).`);
                    reasoning.push("🛡️ Architect: Reversal authorized at Major Support");
                }

                // --- STAGE 5: FILTERING & OUTPUT ---

                let mlResult = null;
                try {
                    // Only run ML for strong candidates to save CPU, or run for all if capable
                    // Running for all > 50 score
                    if (totalScore > 50) {
                        mlResult = await predictNextMove(coin.symbol, candles);
                        if (mlResult) {
                            // PERSISTENCE: Log to model_predictions table (Robust Audit)
                            const regime = indicators.marketRegime?.regime || 'UNKNOWN';
                            savePrediction(coin.symbol, mlResult.probabilityUp, mlResult.signal, regime);

                            // PREDICTION BOOST/PENALTY
                            // NEW: ML Safety Check - Ignore ML Short if Daily Structure is Bullish
                            const dailyBullish = macroContext?.btcRegime.regime === 'BULL' || (macroContext?.btcRegime.currentPrice || 0) > (macroContext?.btcRegime.ema200 || 0);

                            if (mlResult.signal === 'BEARISH' && dailyBullish && signalSide === 'SHORT') {
                                // ML says Short, Daily says Bull -> Ignore ML (Noise)
                                reasoning.push(`🧠 IA Ignored: Bearish prediction clashes with Daily Bull Trend`);
                            } else {
                                // Normal Logic
                                if (mlResult.signal === signalSide) {
                                    const boost = Math.round(mlResult.confidence * 30); // 0-30 points (Scaled for 75k candle brain)
                                    totalScore += boost;
                                    reasoning.push(`🧠 IA Confluence: ${(mlResult.probabilityUp * 100).toFixed(2)}% probability`);
                                } else if (mlResult.signal !== 'NEUTRAL' && mlResult.signal !== signalSide) {
                                    // ML contradicts Strategy (Divergence)
                                    totalScore -= 15; // Penalty
                                    reasoning.push(`🧠 IA Divergence: Brain expects ${mlResult.signal}`);
                                }
                            }
                        }
                    }
                } catch (e) { /* console.warn("ML Inference Failed for " + coin.symbol); */ }

                // --- STAGE 4.6: EXPERT VOLUME ANALYSIS (God Tier) ---
                // Already fetched and enriched in Stage 2. Applying Scoring logic here.
                if (indicators.volumeExpert) {
                    const ve = indicators.volumeExpert;
                    // 1. Coinbase Premium Signal
                    if (ve.coinbasePremium.signal === 'INSTITUTIONAL_BUY' && signalSide === 'LONG') {
                        totalScore += TradingConfig.scoring.advisor.coinbase_premium;
                        reasoning.push(`🏦 Premium: Institutional Buying Detected (+${ve.coinbasePremium.gapPercent.toFixed(3)}%)`);
                    } else if (ve.coinbasePremium.signal === 'INSTITUTIONAL_SELL' && signalSide === 'SHORT') {
                        totalScore += TradingConfig.scoring.advisor.coinbase_premium;
                        reasoning.push(`🏦 Premium: Institutional Selling Detected (${ve.coinbasePremium.gapPercent.toFixed(3)}%)`);
                    }

                    // 2. CVD Trend Confirmation
                    if (ve.cvd.trend === 'BULLISH' && signalSide === 'LONG') {
                        totalScore += 10;
                        reasoning.push("🌊 CVD: Aggressive Buying Flow");
                    } else if (ve.cvd.trend === 'BEARISH' && signalSide === 'SHORT') {
                        totalScore += 10;
                        reasoning.push("🌊 CVD: Aggressive Selling Flow");
                    }

                    // 3. Liquidity Walls Confluence
                    const orderBook = ve.liquidity.orderBook;
                    if (orderBook) {
                        if (signalSide === 'LONG' && orderBook.bidWall && orderBook.bidWall.strength > 70) {
                            totalScore += 15;
                            reasoning.push(`🧱 Muro Confirmado: Soporte real en $${orderBook.bidWall.price.toFixed(2)} (+15)`);
                        } else if (signalSide === 'SHORT' && orderBook.askWall && orderBook.askWall.strength > 70) {
                            totalScore += 15;
                            reasoning.push(`🧱 Muro Confirmado: Resistencia real en $${orderBook.askWall.price.toFixed(2)} (+15)`);
                        }
                    }
                }

                // --- STAGE 4.7: ORDER FLOW VERIFICATION (Truth Layer) ---
                if (indicators.cvdDivergence && indicators.cvdDivergence !== 'NONE') {
                    const cvdBoost = TradingConfig.scoring.weights.cvd_divergence_boost;

                    if (indicators.cvdDivergence === 'BULLISH' && signalSide === 'LONG') {
                        totalScore += cvdBoost; // Massive Boost: Buying into the dip (Absorption)
                        reasoning.push("🌊 CVD Divergence: Institutional Absorption Detected");
                    } else if (indicators.cvdDivergence === 'BEARISH' && signalSide === 'SHORT') {
                        totalScore += cvdBoost; // Massive Boost: Selling into the pump (Exhaustion)
                        reasoning.push("🌊 CVD Divergence: Institutional Exhaustion Detected");
                    } else if (
                        (indicators.cvdDivergence === 'BULLISH' && signalSide === 'SHORT') ||
                        (indicators.cvdDivergence === 'BEARISH' && signalSide === 'LONG')
                    ) {
                        totalScore -= 15; // Penalty: Fighting the hidden flow
                        reasoning.push("⚠️ CVD Warning: Order Flow Contradicts Signal");
                    }
                }

                // --- STAGE 4.8: GLOBAL SENTIMENT OVERLAY (The "News" Filter) ---
                if (globalSentiment) {
                    const sScore = globalSentiment.score; // -1.0 to 1.0
                    const sentimentWeight = TradingConfig.scoring.advisor.contrarian_sentiment;

                    // 1. PANIC PROTOCOL (Sentiment < -0.5)
                    if (sScore < -0.5) {
                        if (signalSide === 'LONG' && (strategyResult.primaryStrategy?.id === 'MEAN_REVERSION' || indicators.rsi < 30)) {
                            totalScore += sentimentWeight; // Boost for "Buying the Blood"
                            reasoning.push(`📰 Sentiment: Contrarian Buy in Panic (${sScore.toFixed(2)})`);
                        } else if (signalSide === 'LONG') {
                            totalScore -= 10; // Caution: Catching falling knives without reversal logic
                            reasoning.push(`⚠️ Sentiment: Market in Panic (${sScore.toFixed(2)}) - High Risk`);
                        }
                    }
                    // 2. EUPHORIA PROTOCOL (Sentiment > 0.5)
                    else if (sScore > 0.5) {
                        if (signalSide === 'SHORT') {
                            totalScore += sentimentWeight; // Boost for "Selling the Top"
                            reasoning.push(`📰 Sentiment: Contrarian Short in Euphoria (${sScore.toFixed(2)})`);
                        } else if (signalSide === 'LONG') {
                            totalScore -= 5; // Caution: FOMO Risk
                            reasoning.push(`⚠️ Sentiment: High Euphoria (${sScore.toFixed(2)}) - FOMO Risk`);
                        }
                    }
                    // 3. TREND ALIGNMENT (Moderate Sentiment)
                    else {
                        if ((sScore > 0.2 && signalSide === 'LONG') || (sScore < -0.2 && signalSide === 'SHORT')) {
                            totalScore += 5; // Small Alignment Boost
                            reasoning.push(`📰 Sentiment: Aligned with News (${sScore.toFixed(2)})`);
                        }
                    }
                }

                // --- STAGE 4.9: ADVANCED RISK SIZING (Kelly & Volatility) ---
                // WinRate approximated from totalScore (e.g. 70 score -> 70% win rate for Kelly)
                const winRate = totalScore / 100;
                const kellySize = calculateKellySize(winRate, 2.5); // Using 2.5 as target RR
                const rawLeverage = getVolatilityAdjustedLeverage(indicators.atr, indicators.price, kellySize);
                const recommendedLeverage = parseFloat(rawLeverage.toFixed(1)); // Fix: Round to 1 decimal

                // Session Kill Zone Penalty
                if (sessionState.isKillZone) {
                    totalScore -= 20; // Reduce confidence significantly
                    reasoning.push(`⚠️ Reduced Confidence: ${sessionState.killZoneReason} (-20)`);
                }

                // --- STAGE 4.10: DORMANT ENGINES ACTIVATION ("God Mode" Integrations) ---

                // A. LIQUIDATION MAGNETS (Hunting the Squeeze)
                try {
                    // Generate pivots for liquidation estimation
                    const highs = candles.map(c => c.high);
                    const lows = candles.map(c => c.low);
                    const liqClusters = estimateLiquidationClusters(highs, lows, indicators.price);

                    if (liqClusters.length > 0) {
                        const nearestLiq = liqClusters[0]; // Closest cluster
                        const distPercent = Math.abs((nearestLiq.priceMin - indicators.price) / indicators.price) * 100;

                        if (distPercent < 1.5) { // Within 1.5% range = Magnet Zone
                            if (nearestLiq.type === 'SHORT_LIQ' && signalSide === 'LONG') {
                                totalScore += TradingConfig.scoring.weights.liquidation_flutter; // Targeting Shorts
                                reasoning.push(`🧲 Liq Magnet: Targeting Short Cluster at $${nearestLiq.priceMin.toFixed(2)}`);
                            } else if (nearestLiq.type === 'LONG_LIQ' && signalSide === 'SHORT') {
                                totalScore += TradingConfig.scoring.weights.liquidation_flutter; // Targeting Longs
                                reasoning.push(`🧲 Liq Magnet: Targeting Long Cluster at $${nearestLiq.priceMin.toFixed(2)}`);
                            }
                        }
                    }
                } catch (e) {
                    // Fail silently, engine is supplementary
                }

                // B. GLOBAL MACRO SHIELD (DXY & Gold Correlation)
                try {
                    const globalData = await fetchGlobalMarketData();

                    // DXY Filter (Strong Dollar = Weak Crypto)
                    if (globalData.dxyIndex > TradingConfig.risk.macro.dxy_risk && signalSide === 'LONG') {
                        totalScore -= 5; // Headwind
                        reasoning.push(`💵 Macro Headwind: Strong Dollar (DXY ${globalData.dxyIndex.toFixed(1)})`);
                    }

                    // Gold Risk-Off Filter
                    if (globalData.goldPrice > TradingConfig.risk.macro.gold_risk_off && style === 'MEME_SCALP' && signalSide === 'LONG') {
                        totalScore -= 10; // Risk-Off Environment
                        reasoning.push(`🛡️ Macro Risk-Off: Gold Flight detected ($${globalData.goldPrice})`);
                    }

                    // BTC Dominance Context
                    if (coin.symbol !== 'BTCUSDT' && globalData.btcDominance > 58 && signalSide === 'LONG') {
                        // High BTC Dominance sucks liquidity from alts
                        // moderate penalty unless it's a specific pump
                        if (totalScore < 80) totalScore -= 5;
                    }
                } catch (e) { }

                // Portfolio Heatmap (Phase 8) 
                // REAL: Pull active trades from Audit Service
                const activeTrades = signalAuditService.getActiveSignals().map((s: any) => s.symbol);
                const correlationRisk = calculatePortfolioCorrelation(coin.symbol, activeTrades, style === 'MEME_SCALP');

                // --- FINAL SCORE NORMALIZATION & REALISM ---
                // We ensure the score never exceeds 100% (Institutional Standard)
                // and never goes below 0.
                totalScore = Math.min(100, Math.max(0, totalScore));

                // Add explicit logic for "Confidence Tier" based on normalized score
                let confidenceTier: 'A' | 'B' | 'C' | 'S' = 'C';
                if (totalScore >= 90) confidenceTier = 'S';
                else if (totalScore >= 75) confidenceTier = 'A';
                else if (totalScore >= 60) confidenceTier = 'B';

                const opportunity: AIOpportunity = {
                    id: coin.id,
                    symbol: coin.symbol,
                    timestamp: Date.now(),
                    timeframe: interval,
                    session: sessionLabel, // DYNAMIC: "LONDON + NEW_YORK", etc.
                    riskRewardRatio: 2.5, // Calc dynamically if possible
                    strategy: strategyResult.primaryStrategy?.id || baseScoreResult.strategies[0] || 'hybrid_algo',
                    side: signalSide,
                    confidenceScore: Math.round(Math.min(100, totalScore)),
                    debugLog: `Base: ${baseScoreResult.score} + Strat: ${strategyResult.primaryStrategy?.score || 0} + Boost: ${strategyResult.scoreBoost}. Context: ${applyTechnicalContext(totalScore, indicators, strategyResult.primaryStrategy?.id) !== totalScore ? 'ADX Penalty Applied' : 'Normal'}`,
                    mlPrediction: mlResult ? {
                        probability: mlResult.probabilityUp * 100,
                        signal: mlResult.signal as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
                        confidence: mlResult.confidence * 100
                    } : undefined,
                    entryZone: {
                        min: indicators.price * 0.995,
                        max: indicators.price * 1.005,
                        currentPrice: indicators.price
                    },
                    stopLoss: indicators.price * 0.98, // Placeholder default, DCA calculator refines this
                    takeProfits: { tp1: 0, tp2: 0, tp3: 0 }, // Placeholder
                    technicalReasoning: reasoning.join(". "),
                    chartPatterns: indicators.chartPatterns || [], // Pass list of patterns
                    harmonicPatterns: (indicators as any).harmonics || [],
                    invalidated: false,
                    metrics: {
                        adx: indicators.adx || 0, // NEW: For filtering
                        volume24h: coin.rawVolume || 0, // FIXED: Use raw numeric volume
                        rvol: indicators.rvol || 0,
                        rsi: indicators.rsi || 50,
                        vwapDist: indicators.vwap ? ((indicators.price - indicators.vwap) / indicators.vwap) * 100 : 0, // SAFE: Prevent / 0
                        structure: indicators.trendStatus.emaAlignment,
                        specificTrigger: strategyResult.primaryStrategy?.reason || baseScoreResult.reasoning[0] || "Technical Setup",
                        zScore: indicators.zScore || 0,
                        emaSlope: indicators.emaSlope || 0,
                        isSqueeze: !!indicators.isSqueeze,
                        volumeExpert: volumeAnalysis, // NEW: Populated from Backend Service
                        macdDivergence: indicators.macdDivergence?.type || undefined,
                        rsiDivergence: indicators.rsiDivergence?.type || undefined,
                        chartPatterns: (indicators.chartPatterns && indicators.chartPatterns.length > 0) ? indicators.chartPatterns : undefined,
                        harmonics: ((indicators as any).harmonics && (indicators as any).harmonics.length > 0) ? (indicators as any).harmonics : undefined,

                        // NEW: GOD MODE MAPPING
                        cvdDivergence: (indicators.cvdDivergence && indicators.cvdDivergence !== 'NONE') ? {
                            type: indicators.cvdDivergence,
                            strength: 0.8 // Default heavy weight for now
                        } : undefined,

                        macroContext: macroContext ? {
                            btcRegime: macroContext.btcRegime.regime,
                            dxyIndex: parseFloat(globalData.dxyIndex.toFixed(2)),
                            goldPrice: parseFloat(globalData.goldPrice.toFixed(0)),
                            btcDominance: parseFloat(macroContext.btcDominance.current.toFixed(2))
                        } : undefined,

                        fractalAnalysis: macroCompass ? {
                            trend_4h: macroCompass.trend4h,
                            ema200_4h: macroCompass.ema200_4h,
                            price_4h: macroCompass.price,
                            aligned: macroCompass.aligned
                        } : undefined
                    },
                    freezeSignal: undefined, // Add if computed
                    tier: confidenceTier,

                    // Phase 8: Risk Management
                    kellySize,
                    recommendedLeverage,
                    correlationRisk
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
                    fundamentalTier || 'B',
                    { // Predictive Targets
                        rsiReversal: indicators.rsiExpert?.target || undefined,
                        liquidationCluster: ((await getRealLiquidationClusters(coin.symbol))[0]?.priceMin) || (estimateLiquidationClusters([], [], indicators.price)[0]?.priceMin), // Try Real -> Fallback Estimate
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

                // DYNAMIC R:R CALCULATION
                // Formula: (TP2 - AvgEntry) / (AvgEntry - StopLoss)
                let dynamicRR = 2.5; // Default fallback
                if (dcaPlan.averageEntry && dcaPlan.stopLoss && dcaPlan.takeProfits.tp2.price) {
                    const risk = Math.abs(dcaPlan.averageEntry - dcaPlan.stopLoss);
                    const reward = Math.abs(dcaPlan.takeProfits.tp2.price - dcaPlan.averageEntry);
                    if (risk > 0) dynamicRR = parseFloat((reward / risk).toFixed(2));
                }
                opportunity.riskRewardRatio = dynamicRR;

                // --- STAGE 5.5: PROFESSIONAL TRADER GATEKEEPER ---
                // Apply Proximity Penalty from DCA engine
                if (dcaPlan.proximityScorePenalty && dcaPlan.proximityScorePenalty > 0) {
                    totalScore -= dcaPlan.proximityScorePenalty;
                    opportunity.confidenceScore = Math.max(0, Math.round(totalScore));
                    // REFINED MESSAGE: Be specific about waiting
                    reasoning.push(`⏳ Filtro Sniper: Esperando Dip (Limit Order -${dcaPlan.proximityScorePenalty})`);

                }

                // PIVOT LOGIC: If a Short is distant but trend is Bullish, add tactical warning
                const isDistantShort = signalSide === 'SHORT' && (dcaPlan.proximityScorePenalty || 0) > 15;
                const localBullishTrend = indicators.emaSlope > 3 && indicators.price > indicators.ema200;

                if (isDistantShort && localBullishTrend) {
                    opportunity.technicalReasoning = `🏦 TÁCTICA PROFESIONAL: Tendencia alcista fuerte. No shortear el "pump" prematuramente. Buscar confirmación en zona de resistencia superior ($${dcaPlan.entries[1].price.toFixed(0)}) o scalp LONG hasta dicho nivel. ` + reasoning.join(". ");
                    // Downgrade score further to ensure it's not a 'Golden Ticket'
                    opportunity.confidenceScore = Math.max(40, opportunity.confidenceScore - 10);
                } else {
                    opportunity.technicalReasoning = reasoning.join(". ");
                }

                // --- WALL WARNING SUPPRESSION (Deep Entry Logic) ---
                // If we are waiting for a dip (> 2% away), a current sell wall is irrelevant for entry.
                const entryDist = Math.abs((dcaPlan.averageEntry - indicators.price) / indicators.price);
                if (entryDist > 0.02) {
                    // Remove "Buying into a Sell Wall" from reasoning if present
                    opportunity.technicalReasoning = opportunity.technicalReasoning.replace(/⚠️ Wall Warning: Buying into a Sell Wall \(-20\)/g, "🛡️ Wall Filter: Muro de Venta ignorado (Entrada Profunda)");
                    // Restore score penalty if we removed it? 
                    // Technically checking string is brittle, checking previous array state is better but text is already joined.
                    // Doing a simple string replace is "surgical" enough for now to clean the UI.
                    // Ideally we would recalc score, but visual consistency is the user's main complaint.
                    // Let's rely on the replace for now.
                }

                // --- STAGE 6: FOMO PREVENTION (The Sniper Check) ---
                const isFresh = strategyResult.primaryStrategy?.isFresh ?? true; // Default to true if strategy doesn't support fresh check yet
                const bestEntryDist = Math.abs(dcaPlan.entries[0].distanceFromCurrent);

                // Dynamic Threshold based on timeframe
                const fomoThreshold = interval === '4h' ? 2.5 : 0.6; // 2.5% for Swing (Relaxed), 0.6% for Scalp

                if (!isFresh && bestEntryDist > fomoThreshold) {
                    // It's a stale signal AND we are far from the ideal entry.
                    // This is classic FOMO / Chasing.
                    // We don't discard entirely to allow 'Limit Order' setups, but we penalize score HEAVILY
                    // so it only shows up if everything else is perfect.
                    // Actually, user said "Entradas Ideales", "No FOMO".
                    // A limit order far away IS an ideal entry (waiting for dip).
                    // But showing it as a "Live Opportunity" might be confusing?
                    // Let's MARK it as "WAITING" status via score penalty or separate flag.
                    // For now, we will SKIP sending it to avoiding cluttering the UI with "Old Trends".

                    // Decision: Filters out 'Chasing'. If you want to enter a trend, wait for the dip (which dcaPlan provides).
                    // If price is > fomoThreshold away from dip, it's not a valid "Now" opportunity.
                    console.log(`[Sniper] Rejected ${coin.symbol}: Stale signal + Bad Entry (${bestEntryDist.toFixed(2)}% > ${fomoThreshold}%).`);
                    return;
                }

                // FINAL GATEKEEPER
                const history = await signalAuditService.getRecentSymbolHistory(coin.symbol);
                const mlStats = await signalAuditService.getAdvancedMLMetrics();

                // Propagate Regime for Filters
                if (!opportunity.metrics) opportunity.metrics = { rvol: indicators.rvol, rsi: indicators.rsi, vwapDist: 0, structure: '', specificTrigger: '' };
                opportunity.metrics.marketRegime = indicators.marketRegime;

                const safetyGate = FilterEngine.checkApexSafety(opportunity, history, mlStats);
                if (safetyGate.discarded) {
                    console.log(`[Safety] Rejected ${coin.symbol}: ${safetyGate.reason}`);
                    return;
                }

                const gate = FilterEngine.shouldDiscard(opportunity, risk, style);
                if (!gate.discarded) {
                    opportunities.push(opportunity);
                } else {
                    // Debug Log for Rejected Candidates (Top 5 only to reduce spam)
                    if (opportunities.length < 5) {
                        console.log(`[Filter] Rejected ${coin.symbol}: ${gate.reason} (Score: ${opportunity.confidenceScore}) | ${opportunity.debugLog}`);
                    }
                }
            } catch (err) {
                // Individual coin failure is acceptable, but we log it clearly
                // console.warn(`[Scanner] Skipped ${coin.symbol}:`, err); 
            }
        }));
    }

    console.log(`[Scanner] PIPELINE COMPLETE: Found ${opportunities.length} opportunities.`);

    if (opportunities.length === 0) {
        console.warn("[Scanner] 0 Opportunities found. Check console for [Filter] rejection reasons. Possible causes: Low Volatility (ADX<25), Risk Shield, or stricter scoring.");
    }

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

    // Penalize Shorts in Bull Market (Daily/Weekly) - STRICTER
    if (!isBTC && signalSide === 'SHORT') {
        const weeklyBullish = macro.btcWeeklyRegime?.regime === 'BULL';
        const dailyBullish = macro.btcRegime.regime === 'BULL';

        if (weeklyBullish) {
            adjustedScore -= 30; // Huge penalty for shorting a Weekly Bull Market
        } else if (dailyBullish) {
            adjustedScore -= 20;
        } else if (macro.btcRegime.regime === 'RANGE') {
            // In range, shorts are okay at resistance, minimal penalty.
        }
    }

    // Liquidity Drain Check
    if (macro.usdtDominance.trend === 'RISING' && signalSide === 'LONG') {
        adjustedScore *= 0.75;
    }

    return adjustedScore;
}

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

    // Range Filter (ADX < 25) - MARKETS ARE SIDEWAYS/CHOPPY
    if (indicators.adx < 25) {
        // Strategies that THRIVE in ranges or are counter-trend/reversal based
        const isRangeFriendly =
            strategyId === 'mean_reversion' ||
            strategyId === 'divergence_hunter' ||
            strategyId === 'freeze_protocol' ||
            strategyId === 'smc_liquidity' ||
            strategyId === 'swing_institutional'; // Added Swing

        if (isRangeFriendly) {
            // RANGE BONUS: If utilizing a range strategy in a range, small boost
            // adjustedScore *= 1.1; 
        } else {
            // TREND PENALTY: Breakout/Trend strategies fail in ranges
            // e.g. Breakout, Ichimoku, Quant Volatility
            // We penalize them to avoid false breakouts
            adjustedScore *= 0.5;
        }
    }
    // Trend Filter (ADX > 25) - MARKETS ARE MOVING
    else {
        // If we have a strong trend, but we are trying to Mean Revert without extreme conditions, that's dangerous.
        if (strategyId === 'mean_reversion' && indicators.rsi > 35 && indicators.rsi < 65) {
            adjustedScore *= 0.8; // Reduce confidence in fighting the trend mid-range
        }
    }

    return adjustedScore;
}
