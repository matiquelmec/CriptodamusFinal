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
import { DataIntegrityGuard } from './pipeline/DataIntegrityGuard'; // NEW: Integrity Sentinel

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
import { getExpertVolumeAnalysis, enrichWithDepthAndLiqs } from '../volumeExpertService'; // Volume Expert Service
import { VolumeExpertAnalysis } from '../../types/types-advanced'; // NEW: Correct Type Import
import { CEXConnector } from '../api/CEXConnector'; // NEW: Professional Source
import { EconomicService } from '../economicService'; // NEW: Nuclear Shield
import { systemAlerts } from '../../../services/systemAlertService';

export const scanMarketOpportunities = async (style: TradingStyle): Promise<AIOpportunity[]> => {
    // 0. INITIALIZATION
    console.log(`[Scanner] PIPELINE START: ${style} mode...`);

    // 1. DATA INGESTION

    // 0.5 NUCLEAR SHIELD (Tournament Defense)
    let shield = { isActive: false, isImminent: false, reason: 'OK' };
    let globalWarning: string | null = null; // NEW: Global Warning for all signals

    if (TradingConfig.TOURNAMENT_MODE) {
        try {
            const { EconomicService } = await import('../economicService');
            shield = await EconomicService.checkNuclearStatus();
            if (shield.isActive) {
                if (shield.isImminent) {
                    console.warn(`[Scanner] ☢️ SNIPER SHIELD ACTIVE (IMMINENT EVENT): ${shield.reason}`);
                    // throw new Error(`SNIPER_SHIELD_PAUSE: ${shield.reason}`); // DISABLED: Inform Only
                    globalWarning = `⚠️ **ALERTA NUCLEAR:** Evento Inminente -> ${shield.reason}`;
                } else {
                    console.warn(`[Scanner] ☢️ NUCLEAR DAY DETECTED: ${shield.reason}`);
                    globalWarning = `⚠️ **PRECAUCIÓN:** ${shield.reason}`;
                    // console.log(`[Scanner] Institutional Sniper mode: Operational until 60m before event.`);
                }
            }
        } catch (e: any) {
            console.warn("[Scanner] Shield check failed (Fail Open):", e);
            shield = { isActive: false, isImminent: false, reason: 'Calendar offline (fail-open mode)' };
        }
    }

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
    let globalData: any = { dxyIndex: 0, goldPrice: 0, btcDominance: 0, isDataValid: false };
    try {
        globalData = await fetchGlobalMarketData();
    } catch (e) {
        console.warn("[Scanner] Global Market Data missing", e);
    }

    // NEW (Institutional 100%): Strategy Performance weights (Meta-Scoring)
    const { strategyPerformanceService } = await import('../../../services/strategyPerformanceService');
    const stratWeightsMap: Record<string, number> = {};
    const allWeights = strategyPerformanceService.getAllWeights();
    Object.keys(allWeights).forEach(k => { stratWeightsMap[k] = allWeights[k].weight; });

    // NEW: MARKET INTELLIGENCE INTEGRATION (The "Skill" Connection)
    // We check the correlation matrix state BEFORE processing individual coins.
    const { correlationAnalyzer } = await import('../risk/CorrelationAnalyzer');
    let intelligenceState = { state: 'normal', highCorrRatio: 0 };
    try {
        // Find BTC data for context
        const btcTicker = market.find(m => m.symbol === 'BTC/USDT' || m.id === 'BTCUSDT');
        const btcData = btcTicker ? { price: btcTicker.price, change24h: btcTicker.percentage } : undefined;

        // Analyze Market Structure (passing empty ops just to get state)
        const intelligence = await correlationAnalyzer.analyze([], btcData);
        intelligenceState = {
            state: intelligence.state,
            highCorrRatio: intelligence.metrics ? (intelligence.metrics.highCorrPairs / intelligence.metrics.totalPairs) : 0
        };
        console.log(`[Scanner] 🧠 Market Intelligence: ${intelligence.state.toUpperCase()} (Corr: ${(intelligenceState.highCorrRatio * 100).toFixed(1)}%)`);
    } catch (e) {
        console.warn("[Scanner] Failed to consult Market Intelligence:", e);
    }

    // --- STAGE 0.9: HOLISTIC INTEGRITY GUARD (Fail-Fast Logic) ---
    const integrityReport = await DataIntegrityGuard.getSystemIntegrityReport({
        isPreFlight: true,
        globalData,
        newsSentiment: globalSentiment,
        economicShield: shield
    });

    if (integrityReport.status === 'HALTED') {
        const msg = `Integrity HALTED: ${integrityReport.missingCritical.join(', ')}`;
        console.error(`[Scanner] 🚨 ${msg}`);

        // CRITICAL: ABORT ON INTEGRITY FAILURE
        // "Bad data is worse than no data."

        const { systemAlerts } = await import('../../../services/systemAlertService');
        await systemAlerts.logCritical(
            `Data Integrity Shield Triggered (BLOCKING): ${integrityReport.missingCritical.join(', ')}`,
            { score: integrityReport.score, staleSources: integrityReport.staleSources }
        );

        throw new Error(`DATA_INTEGRITY_SHIELD_TRIGGERED: ${msg}`);
    }


    if (integrityReport.status === 'DEGRADED' || integrityReport.status === 'DOUBTFUL') {
        const warningMsg = `Integrity ${integrityReport.status}: Score ${integrityReport.score.toFixed(2)}. Stale: ${integrityReport.staleSources.join(', ')}`;
        console.warn(`[Scanner] ⚠️ ${warningMsg}`);

        // Log degradation alert to database
        const { systemAlerts } = await import('../../../services/systemAlertService');
        await systemAlerts.logAlert({
            severity: integrityReport.status === 'DEGRADED' ? 'HIGH' : 'MEDIUM',
            category: 'DATA_INTEGRITY',
            message: warningMsg,
            metadata: {
                score: integrityReport.score,
                staleSources: integrityReport.staleSources,
                missingCritical: integrityReport.missingCritical
            }
        });
    }

    let topCandidates = style === 'MEME_SCALP' ? market : market.slice(0, 60);
    const opportunities: AIOpportunity[] = [];

    // 3. CHUNKED PROCESSING (Robustness Fix)
    const signalHistory: Record<string, any[]> = {}; // Placeholder if not fetched
    console.log(`[Diagnostic] Starting Chunk Processing for ${market.length} assets...`);

    // Force Include Gold Asset for Pau Strategy even if low volume
    const goldSym = TradingConfig.pauStrategy.asset.replace('/', '').toUpperCase(); // 'PAXGUSDT'
    const goldTicker = market.find(m => m.id === goldSym || m.symbol.replace('/', '') === goldSym);

    // Inject Gold if found and not present in topCandidates
    if (goldTicker && !topCandidates.find(c => c.id === goldTicker.id)) {
        // console.log(`[Scanner] 🏆 Injecting ${goldTicker.symbol} for World Champ Strategy (Backend)`);
        topCandidates.push(goldTicker);
    }

    // --- TOURNAMENT MODE OVERRIDE ---
    if (TradingConfig.TOURNAMENT_MODE) {
        console.log(`[Scanner] 🏆 TOURNAMENT MODE ACTIVE: Monitoring Elite 9 Only`);
        const eliteSymbols = TradingConfig.assets.tournament_list; // e.g. ['BTCUSDT', ...]

        // Filter market to only include Elite 9. Matching by ID (BTCUSDT) or Symbol (BTC/USDT)
        topCandidates = market.filter(m => {
            const cleanId = m.id.toUpperCase().replace('/', '');
            const cleanSym = m.symbol.toUpperCase().replace('/', '');
            return eliteSymbols.includes(cleanId) || eliteSymbols.includes(cleanSym);
        });

        console.log(`[Scanner] Elite Candidates: ${topCandidates.map(c => c.symbol).join(', ')}`);
    }

    // Process in small batches to prevent API rate limiting / Geo-blocking timeouts
    const BATCH_SIZE = 5;
    for (let i = 0; i < topCandidates.length; i += BATCH_SIZE) {
        const batch = topCandidates.slice(i, i + BATCH_SIZE);
        // console.log(`[Scanner] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(topCandidates.length / BATCH_SIZE)}`);

        await Promise.all(batch.map(async (coin: any) => {
            try {
                let interval = style === 'SWING_INSTITUTIONAL' || style === 'ICHIMOKU_CLOUD' ? '4h' : '15m';

                // TOURNAMENT MODE FORCE: 15m for entry
                if (TradingConfig.TOURNAMENT_MODE) interval = '15m';

                const candles = await fetchCandles(coin.id, interval);

                // PROFESSIONAL MTF: Fetch Context (4h & 1d) for ALL strategies
                let contextCandles: any[] = [];
                let dailyCandles: any[] = [];
                try {
                    // Parallel fetch for speed (SmartCache will handle redundancy)
                    const [res4h, res1d] = await Promise.all([
                        fetchCandles(coin.id, '4h'),
                        fetchCandles(coin.id, '1d')
                    ]);
                    contextCandles = res4h;
                    dailyCandles = res1d;
                } catch (e) {
                    console.warn(`[Scanner] Professional MTF fetch failed for ${coin.symbol}`);
                }

                if (candles.length < 200) return;

                // --- STAGE 1: INDICATORS & ATOMIC INTEGRITY ---
                const indicators = IndicatorCalculator.compute(coin.symbol, candles);
                indicators.symbol = coin.symbol;

                // 1.1 Atomic Integrity Check (The "Blind" Switch)
                if (indicators.invalidated) {
                    // systemAlerts.logVeto(coin.symbol, `PIPELINE_INVALIDATED: ${indicators.technicalReasoning}`);
                    // return; // DISABLED: Inform Only
                    const warn = `⚠️ PROCESANDO CON DATOS PARCIALES: ${indicators.technicalReasoning}`;
                    indicators.technicalReasoning = warn; // Override or append cause it's critical
                    if (!globalWarning) globalWarning = warn; // Elevate to global if first error
                }

                // 1. Freshness Sentinel (Ensure data is LIVE)
                const lastCandle = candles[candles.length - 1];
                const now = Date.now();
                const msSinceLastCandle = now - lastCandle.timestamp;
                const maxStaleMs = 45 * 60 * 1000; // 45m (3 candles)

                if (msSinceLastCandle > maxStaleMs) {
                    /* systemAlerts.logAlert({ ... }); return; */ // DISABLED: Inform Only
                    indicators.technicalReasoning += ` | ⚠️ DATOS ANTIGUOS (${(msSinceLastCandle / 60000).toFixed(0)}m)`;
                }

                // 2. Source Integrity
                const isRealBinance = coin.id.toUpperCase().endsWith('USDT');
                if (!isRealBinance) {
                    // console.warn(`[Sentinel] ${coin.symbol} using unreliable fallback. Rejecting signal.`);
                    // return; // DISABLED: Inform Only
                    indicators.technicalReasoning += ` | ⚠️ Fuente Alternativa (No-Binance)`;
                }

                // --- STAGE 2.2: EXPERT VOLUME & LIQUIDITY (God Tier) ---
                let volumeAnalysis: VolumeExpertAnalysis | undefined;
                try {
                    // FIX 1.3: Parallel API calls for performance (+30% faster)
                    const [realCVD, realOI, baseVolumeAnalysis] = await Promise.all([
                        CEXConnector.getRealCVD(coin.symbol),
                        CEXConnector.getOpenInterest(coin.symbol),
                        getExpertVolumeAnalysis(coin.symbol)
                    ]);

                    if (realCVD.integrity < 1.0 || realOI.integrity < 1.0) {
                        // console.warn(`[Sentinel] ${coin.symbol}: Authenticated flow failed. Signal discarded to prevent phantom data.`);
                        // return; // HARD ABORT: No real data, no signal. -> DISABLED: Inform Only
                        indicators.technicalReasoning += ` | ⚠️ Flujo Institucional Limitado (API)`;
                    }

                    // Use fetched data
                    volumeAnalysis = baseVolumeAnalysis;
                    if (volumeAnalysis) {
                        // Override with authenticated high-fidelity data
                        volumeAnalysis.cvd.current = realCVD.delta;
                        volumeAnalysis.derivatives.openInterestValue = realOI.value;

                        const highs = candles.map(c => c.high);
                        const lows = candles.map(c => c.low);
                        volumeAnalysis = await enrichWithDepthAndLiqs(coin.symbol, volumeAnalysis, highs, lows, indicators.price);
                    }
                } catch (e) {
                    console.error(`[Sentinel] Critical data failure for ${coin.symbol}`, e);
                    indicators.technicalReasoning += ` | ❌ Error Análisis de Volumen`;
                    // return; // DISABLED
                }

                // --- STAGE 2.5: ADVANCED ANALYSIS (Institutional) ---
                const advancedData = await AdvancedAnalyzer.compute(
                    coin.symbol,
                    candles,
                    indicators.atr,
                    indicators.price,
                    indicators.fibonacci,
                    (indicators as any).pivots,
                    (indicators as any).ema200,
                    (indicators as any).ema50,
                    [], // Harmonics fallback
                    volumeAnalysis?.liquidity?.orderBook,
                    (volumeAnalysis?.liquidity?.liquidationClusters || []) as any[]
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

                const strategyResult = StrategyRunner.run(indicators, risk, highs, lows, prices, volumes, contextCandles);

                // Skip if no valid signal found
                if (strategyResult.primaryStrategy && strategyResult.primaryStrategy.signal === 'NEUTRAL') {
                    return;
                }

                const signalSide: 'LONG' | 'SHORT' = (strategyResult.primaryStrategy?.signal === 'SHORT') ? 'SHORT' : 'LONG';

                // NEW: Per-Coin Sentiment Analysis (Institutional Context)
                let coinSentiment = undefined;
                try {
                    // We only fetch sentiment for coins that at least have a strategy signal
                    coinSentiment = await fetchCryptoSentiment(coin.id.replace('USDT', ''));
                } catch (e) {
                    console.warn(`[Scanner] Sentiment fetch failed for ${coin.symbol}`);
                }

                const baseScoreResult = StrategyScorer.score(coin.symbol, indicators, signalSide, coinSentiment, stratWeightsMap);

                // Initial Score (Capped to baseline level before boosts)
                let rawScore = (baseScoreResult.score + (strategyResult.primaryStrategy?.score || 0) + strategyResult.scoreBoost) / 1.5;
                if (isNaN(rawScore)) rawScore = 0;
                let totalScore = Math.min(100, rawScore);
                let reasoning = [...baseScoreResult.reasoning, ...strategyResult.details];

                // INJECT GLOBAL WARNING (If Exists)
                if (globalWarning) {
                    reasoning.unshift(globalWarning); // Put it at the TOP
                }

                // --- PHASE 0: MARKET SESSION & TIME AWARENESS ---
                const sessionState = MarketSession.analyzeSession();
                const sessionLabel = sessionState.activeSessions.join(' + ') || 'QUIET_HOURS';

                // Log once per scan cycle
                // console.log(`⏰ Session: ${sessionLabel} ${sessionState.isKillZone ? `(⚠️ KILL ZONE: ${sessionState.killZoneReason})` : ''}`);

                // Apply Macro Filters (Context Awareness)
                // ✅ SYMMETRIC & ENHANCED: Applied Macro context (BTC, USDT.D, Global)
                if (macroContext) {
                    totalScore = applyMacroFilters(totalScore, coin.symbol, signalSide, macroContext, indicators, globalData);
                }

                // NEW: News Sentiment Integration moved to StrategyScorer for granular logic
                // But we still apply some global sentiment context here if needed
                // ✅ SYMMETRIC: Global Sentiment Boost
                if (globalSentiment.score > 0.5 && signalSide === 'LONG') {
                    totalScore += 10; // Boost to 10 for professional alignment
                    reasoning.push("🗞️ Market Mood: Global Bullish Bias (+10)");
                } else if (globalSentiment.score < -0.5 && signalSide === 'SHORT') {
                    totalScore += 10;
                    reasoning.push("🗞️ Market Mood: Global Bearish Bias (+10)");
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

                // ✅ SYMMETRIC: Validation by Quality (Score), not by Direction
                const needsArchitectCheck = (totalScore > 70 || strategyResult.primaryStrategy?.id === 'FREEZE_STRATEGY' || isProfessionalReversal);

                if (needsArchitectCheck) {
                    if (interval === '15m') {
                        const compassResult = await verifyMacroTrend(coin.id, signalSide);
                        macroCompass = compassResult;

                        if (!compassResult.aligned) {
                            // Professional Veto: If counter-trend, we only allow it if score is exceptional (High Conviction)
                            const isHighConviction = totalScore > 85;

                            if (isHighConviction) {
                                console.log(`[Smart MTF] PENALTY ${coin.symbol}: Counter-trend ${signalSide} has high conviction. Proceeding.`);
                                totalScore -= 15; // Caution Penalty even if High Conviction
                                reasoning.push(`⚠️ Counter-Trend: Macro trend mismatch (-15)`);
                            } else {
                                console.log(`[Smart MTF] WARNING ${coin.symbol}: ${signalSide} signal against 4H Trend alignment.`);
                                totalScore -= 40; // SEVERE Penalty
                                reasoning.push(`⛔ Contra-Tendencia MACRO peligrosa (-40)`);
                                // return; // DISABLED: Allow user to see it but with terrible score
                            }
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
                    // CIRCUIT BREAKER CHECK
                    const { MLCircuitBreaker } = await import('./ml/MLCircuitBreaker');
                    const circuitStatus = await MLCircuitBreaker.checkStatus();

                    // Only run ML for strong candidates to save CPU, or run for all if capable
                    // Running for all > 50 score
                    if (circuitStatus.isOpen) {
                        reasoning.push(`🧠 IA Silenced: ${circuitStatus.reason}`);
                    } else if (totalScore > 50) {
                        mlResult = await predictNextMove(coin.symbol, candles);
                        if (mlResult) {
                            // PERSISTENCE: Log to model_predictions table (Robust Audit)
                            const regime = indicators.marketRegime?.regime || 'UNKNOWN';
                            savePrediction(coin.symbol, mlResult.probabilityUp, mlResult.signal, regime);

                            // PREDICTION BOOST/PENALTY
                            // ML Safety Check - Symmetric rejection for both directions
                            const dailyBullish = macroContext?.btcRegime.regime === 'BULL' || (macroContext?.btcRegime.currentPrice || 0) > (macroContext?.btcRegime.ema200 || 0);
                            const dailyBearish = macroContext?.btcRegime.regime === 'BEAR' || (macroContext?.btcRegime.currentPrice || 0) < (macroContext?.btcRegime.ema200 || 0);

                            // ✅ SYMMETRIC: Reject ML if it contradicts Daily structure
                            if (mlResult.signal === 'BEARISH' && dailyBullish && signalSide === 'SHORT') {
                                // ML says Short, Daily says Bull -> Ignore ML (Noise)
                                reasoning.push(`🧠 IA Ignored: Bearish prediction clashes with Daily Bull Trend`);
                            } else if (mlResult.signal === 'BULLISH' && dailyBearish && signalSide === 'LONG') {
                                // ML says Long, Daily says Bear -> Ignore ML (Noise)
                                reasoning.push(`🧠 IA Ignored: Bullish prediction clashes with Daily Bear Trend`);
                            } else {
                                // Fix Type Mismatch: Map ML(BULLISH/BEARISH) to Strategy(LONG/SHORT)
                                const mlSide = mlResult.signal === 'BULLISH' ? 'LONG' : (mlResult.signal === 'BEARISH' ? 'SHORT' : 'NEUTRAL');

                                // Normal Logic
                                if (mlSide === signalSide) {
                                    const boost = Math.round(mlResult.confidence * 30); // 0-30 points (Scaled for 75k candle brain)
                                    totalScore += boost;
                                    reasoning.push(`🧠 IA Confluence: ${(mlResult.probabilityUp * 100).toFixed(2)}% probability`);
                                } else if (mlResult.signal !== 'NEUTRAL' && mlSide !== signalSide) {
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
                    // 1. Coinbase Premium Signal (God Tier)
                    if (ve.coinbasePremium.signal === 'INSTITUTIONAL_BUY' && signalSide === 'LONG') {
                        totalScore += TradingConfig.scoring.advisor.coinbase_premium;
                        reasoning.push(`🏦 Premium: Buying Detected (+${ve.coinbasePremium.gapPercent.toFixed(3)}%)`);
                        if (ve.coinbasePremium.gapPercent > 0.2) {
                            totalScore += 10;
                            reasoning.push(`🏦 CB Premium EXTREMO (+10)`);
                        }
                    } else if (ve.coinbasePremium.signal === 'INSTITUTIONAL_SELL' && signalSide === 'SHORT') {
                        totalScore += TradingConfig.scoring.advisor.coinbase_premium;
                        reasoning.push(`🏦 Premium: Selling Detected (${ve.coinbasePremium.gapPercent.toFixed(3)}%)`);
                        if (ve.coinbasePremium.gapPercent < -0.2) {
                            totalScore += 10;
                            reasoning.push(`🏦 CB Discount EXTREMO (+10)`);
                        }
                    }

                    // 2. CVD Trend Confirmation
                    // COHERENCE FIX: Only apply trend if NO divergence detected
                    // (divergence is stronger signal and already includes trend analysis)
                    const hasCVDDivergence = (indicators as any).cvdDivergence &&
                        (indicators as any).cvdDivergence !== 'NONE';

                    if (!hasCVDDivergence && ve.cvd.trend === 'BULLISH' && signalSide === 'LONG') {
                        totalScore += 10;
                        reasoning.push("🌊 CVD: Aggressive Buying Flow");
                    } else if (!hasCVDDivergence && ve.cvd.trend === 'BEARISH' && signalSide === 'SHORT') {
                        totalScore += 10;
                        reasoning.push("🌊 CVD: Aggressive Selling Flow");
                    }

                    // 3. Liquidity Walls & Imbalance
                    const orderBook = ve.liquidity.orderBook;

                    // --- INSTITUTIONAL ORDERBOOK ANALYSIS ---
                    if (orderBook && orderBook.advanced) {
                        const adv = orderBook.advanced;

                        // IMPROVEMENT 1: Fake Wall Detection (Anti-Manipulation)
                        if (adv.fakeWallRisk === 'HIGH') {
                            totalScore -= 30;
                            reasoning.push("🚨 FAKE WALL DETECTED: High manipulation risk");
                        } else if (adv.fakeWallRisk === 'MEDIUM') {
                            totalScore -= 10;
                            reasoning.push("⚠️ Wall Stability Questionable");
                        } else if (adv.wallStability === 'STABLE') {
                            totalScore += 10;
                            reasoning.push("✅ Wall Stability Verified");
                        }

                        // IMPROVEMENT 2: Absorption Analysis (Tape Reading)
                        if (adv.wasAbsorbed && adv.absorptionScore > 80) {
                            const boost = signalSide === 'LONG' ? 25 : 20;
                            totalScore += boost;
                            reasoning.push(`💎 WALL ABSORBED & HELD: Inst. support (${adv.absorptionScore}/100) (+${boost})`);
                        } else if (adv.wasAbsorbed && adv.absorptionScore > 60) {
                            totalScore += 15;
                            reasoning.push(`💎 Wall Holding: Score ${adv.absorptionScore}/100 (+15)`);
                        }

                        // IMPROVEMENT 3: Deep Imbalance Analysis (Smart Money)
                        const depthIm = adv.depthImbalance;
                        if (depthIm) {
                            // Bullish Deep Pressure
                            if (depthIm.deep > 2.5 && signalSide === 'LONG') {
                                totalScore += 30;
                                reasoning.push(`🌊 DEEP BID PRESSURE: ${depthIm.deep.toFixed(1)}x institutional accumulation (+30)`);
                            } else if (depthIm.deep < 0.4 && signalSide === 'SHORT') {
                                totalScore += 30;
                                reasoning.push(`🌊 DEEP ASK PRESSURE: ${(1 / depthIm.deep).toFixed(1)}x distribution (+30)`);
                            }

                            // Divergence Detection (Trap Warning)
                            if (depthIm.divergence) {
                                totalScore -= 15;
                                reasoning.push("🪤 LIQUIDITY TRAP: Surface/Deep divergence detected");
                            }

                            // Surface-only pressure (weaker than deep)
                            if (depthIm.surface > 3 && depthIm.deep < 1 && signalSide === 'LONG') {
                                totalScore -= 10;
                                reasoning.push("🪤 SHALLOW LIQUIDITY: Retail" + " trap suspected");
                            }
                        }

                        // IMPROVEMENT 4: Spread Volatility (Panic/Confidence Indicator)
                        const spread = adv.spreadAnalysis;
                        if (spread) {
                            if (spread.isPanic && signalSide === 'LONG') {
                                totalScore += 20;
                                reasoning.push(`🔥 PANIC SPREAD: ${spread.currentSpread.toFixed(3)}% - Capitulation entry (+20)`);
                            } else if (spread.isTight) {
                                totalScore += 10;
                                reasoning.push(`✅ TIGHT SPREAD: ${spread.currentSpread.toFixed(3)}% - High liquidity`);
                            } else if (spread.isWidening && signalSide === 'SHORT') {
                                totalScore += 10;
                                reasoning.push("📊 Widening Spread: Fear building");
                            }
                        }

                        // IMPROVEMENT 5: Iceberg Detection (Hidden Liquidity)
                        if (adv.icebergZones && adv.icebergZones.length > 0) {
                            const nearest = adv.icebergZones[0];
                            const distancePct = Math.abs(nearest.price - indicators.price) / indicators.price;

                            if (distancePct < 0.01) { // Within 1%
                                totalScore += 25;
                                reasoning.push(`🧊 ICEBERG DETECTED at $${nearest.price.toFixed(2)}: Hidden institutional wall (+25)`);
                            } else if (distancePct < 0.02) {
                                totalScore += 15;
                                reasoning.push(`🧊 Iceberg nearby: ${nearest.bounceCount} bounces`);
                            }
                        }

                        // Overall Confidence Boost
                        if (adv.confidence > 70) {
                            totalScore += 5;
                            reasoning.push(`🎯 OrderBook Confidence: ${adv.confidence}/100`);
                        }

                    } else if (orderBook) {
                        // FALLBACK: Basic OrderBook Analysis (for when advanced isn't available)
                        if (signalSide === 'LONG' && orderBook.bidWall && orderBook.bidWall.strength > 70) {
                            totalScore += 15;
                            reasoning.push(`🧱 Muro Confirmado: Soporte real en $${orderBook.bidWall.price.toFixed(2)} (+15)`);
                        } else if (signalSide === 'SHORT' && orderBook.askWall && orderBook.askWall.strength > 70) {
                            totalScore += 15;
                            reasoning.push(`🧱 Muro Confirmado: Resistencia real en $${orderBook.askWall.price.toFixed(2)} (+15)`);
                        }
                        if (orderBook.buyingPressure !== undefined) {
                            if (orderBook.buyingPressure > 3.0 && signalSide === 'LONG') {
                                totalScore += 15;
                                reasoning.push(`⚖️ Book Pressure: ${orderBook.buyingPressure.toFixed(1)}x Bid Advantage (+15)`);
                            } else if (orderBook.buyingPressure < 0.33 && signalSide === 'SHORT') {
                                totalScore += 15;
                                reasoning.push(`⚖️ Book Pressure: ${(1 / orderBook.buyingPressure).toFixed(1)}x Ask Advantage (+15)`);
                            }
                        }
                    }

                    // 4. Funding Extremes (Reversal/Fuel)
                    const funding = ve.derivatives?.fundingRate;
                    if (funding !== undefined) {
                        if (funding > 0.001 && signalSide === 'SHORT') {
                            totalScore += 15;
                            reasoning.push(`💸 Funding Extreme: Longs Overcrowded (+15)`);
                        } else if (funding < -0.0005 && signalSide === 'LONG') {
                            totalScore += 15;
                            reasoning.push(`💸 Funding Extreme: Shorts Overcrowded (+15)`);
                        }
                    }

                    // 5. Liquidation Magnet Strategy
                    const liqs = ve.liquidity.liquidationClusters;
                    if (liqs && liqs.length > 0) {
                        const nearest = liqs[0];
                        const avgPrice = (nearest.priceMin + nearest.priceMax) / 2;
                        const dist = Math.abs(indicators.price - avgPrice) / indicators.price;
                        if (dist < 0.015) {
                            const volFormatted = (nearest.totalVolume && !isNaN(nearest.totalVolume))
                                ? (nearest.totalVolume / 1e6).toFixed(1)
                                : '???';

                            if (nearest.type === 'LONG_LIQ' && signalSide === 'SHORT') {
                                totalScore += 20;
                                reasoning.push(`🎯 Liq Magnet: Hunting $${volFormatted}M Long Exits (+20)`);
                            } else if (nearest.type === 'SHORT_LIQ' && signalSide === 'LONG') {
                                totalScore += 20;
                                reasoning.push(`🎯 Liq Magnet: Hunting $${volFormatted}M Short Squeezes (+20)`);
                            }
                        }
                    }
                }

                // 6. Volume Profile POC (Magnet)
                const vp = indicators.volumeProfile;
                if (vp && vp.poc) {
                    const distPOC = Math.abs(indicators.price - vp.poc) / vp.poc;
                    if (distPOC < 0.005) {
                        if (signalSide === 'LONG' && indicators.price < vp.poc) {
                            totalScore += 10;
                            reasoning.push(`📊 Volume POC Support: Price below magnet (+10)`);
                        } else if (signalSide === 'SHORT' && indicators.price > vp.poc) {
                            totalScore += 10;
                            reasoning.push(`📊 Volume POC Resistance: Price above magnet (+10)`);
                        }
                    }
                }

                // --- STAGE 4.7: ORDER FLOW VERIFICATION (Truth Layer) ---
                if ((indicators as any).cvdDivergence && (indicators as any).cvdDivergence !== 'NONE') {
                    const cvdBoost = TradingConfig.scoring.weights.cvd_divergence_boost;
                    const divType = (indicators as any).cvdDivergence;

                    if (divType === 'BULLISH' && signalSide === 'LONG') {
                        totalScore += cvdBoost; // Massive Boost: Buying into the dip (Absorption)
                        reasoning.push("🌊 CVD Divergence: Institutional Absorption Detected");
                    } else if (divType === 'BEARISH' && signalSide === 'SHORT') {
                        totalScore += cvdBoost; // Massive Boost: Selling into the pump (Exhaustion)
                        reasoning.push("🌊 CVD Divergence: Institutional Exhaustion Detected");
                    } else if (
                        (divType === 'BULLISH' && signalSide === 'SHORT') ||
                        (divType === 'BEARISH' && signalSide === 'LONG')
                    ) {
                        totalScore -= 15; // Penalty: Fighting the hidden flow
                        reasoning.push("⚠️ CVD Warning: Order Flow Contradicts Signal");
                    }
                }

                // --- STAGE 4.8: PROFESSIONAL MTF TRIPLE CONFLUENCE (The "God" Layer) ---
                if (contextCandles.length > 200 && dailyCandles.length > 200) {
                    const closes4h = contextCandles.map(c => c.close);
                    const closes1d = dailyCandles.map(c => c.close);

                    const ema200_4h = calculateEMA(closes4h, 200);
                    const ema200_1d = calculateEMA(closes1d, 200);
                    const last4h = closes4h[closes4h.length - 1];
                    const last1d = closes1d[closes1d.length - 1];
                    const ema200_15m = indicators.ema200;

                    const alignedBullish = last1d > ema200_1d && last4h > ema200_4h && indicators.price > ema200_15m;
                    const alignedBearish = last1d < ema200_1d && last4h < ema200_4h && indicators.price < ema200_15m;

                    if (alignedBullish && signalSide === 'LONG') {
                        totalScore += 25;
                        reasoning.push(`🕐 MTF Confluence: D1 + H4 + M15 Aligned BULLISH (+25)`);
                    } else if (alignedBearish && signalSide === 'SHORT') {
                        totalScore += 25;
                        reasoning.push(`🕐 MTF Confluence: D1 + H4 + M15 Aligned BEARISH (+25)`);
                    }
                }

                // --- STAGE 4.9: GLOBAL SENTIMENT OVERLAY (The "News" Filter) ---
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

                    // --- STAGE 4.9b: NARRATIVE DIVERGENCE (Phase 12 Elite) ---
                    // "The Lie Detector": News says X, Price + Volume says Y.
                    const { checkNarrativeDivergence } = await import('./NarrativeEngine');
                    const narrative = checkNarrativeDivergence(globalSentiment, indicators);

                    if (narrative.score !== 0) {
                        // Apply Modifier (Positive for Absorption, Negative for Distribution)
                        // If Absorption (+25) and we are LONG -> Boost
                        // If Distribution (-25) and we are LONG -> Penalty

                        if (signalSide === 'LONG') {
                            totalScore += narrative.score;
                        } else {
                            // Short logic: If Distribution (-25 implied Bearish), Short should be boosted?
                            // wait, narrative.score is directional "goodness for BULLS".
                            // Absorption (+25) is Bullish. Distribution (-25) is Bearish.
                            // So Short Score = totalScore - narrative.score (if narrative is -25, we add 25 to short)
                            totalScore -= narrative.score;
                        }

                        if (narrative.reason) reasoning.push(narrative.reason);
                    }
                }

                // --- STAGE 4.10: ADVANCED RISK SIZING (Kelly & Volatility) ---
                // WinRate approximated from totalScore (e.g. 70 score -> 70% win rate for Kelly)
                // MOVED TO LATER STAGE to avoid duplication
                // const winRate = totalScore / 100;
                // const kellySize = calculateKellySize(winRate, 2.5); // Using 2.5 as target RR
                // const rawLeverage = getVolatilityAdjustedLeverage(indicators.atr, indicators.price, kellySize);
                // const recommendedLeverage = parseFloat(rawLeverage.toFixed(1)); // Fix: Round to 1 decimal

                // Session Kill Zone Penalty
                if (sessionState.isKillZone) {
                    totalScore -= 20; // Reduce confidence significantly
                    reasoning.push(`⚠️ Reduced Confidence: ${sessionState.killZoneReason} (-20)`);
                }

                // --- STAGE 4.12: MARKET INTELLIGENCE CHECK (Skill Override) ---
                if (intelligenceState.state === 'systemic_risk') {
                    // "If everything moves together, edge is zero."
                    // TOURNAMENT MODE ADJUSTMENT:
                    // In Tournament Mode (Elite 9), high correlation is expected. We reduce penalty to avoid false negatives.
                    const penalty = TradingConfig.TOURNAMENT_MODE ? 5 : 15;
                    totalScore -= penalty;
                    reasoning.push(`🧠 Intelligence: RIESGO SISTÉMICO (${(intelligenceState.highCorrRatio * 100).toFixed(0)}% Corr) (-${penalty})`);

                    // Force Higher Threshold in Systemic Risk
                    // If score was 65, now it's 60 (Tournament) -> Passes!
                    // If score was 70, now it's 55 (Global) -> Filtered out.
                } else if (intelligenceState.state === 'rotation_active') {
                    // Rotation context could be added here if we identified specific rotation assets
                    // For now, we just acknowledge the active environment
                    reasoning.push(`🧠 Intelligence: Rotación de Capital Activa`);
                }

                // --- STAGE 4.11: DORMANT ENGINES ACTIVATION ---
                // Consolidating redundant engines here if needed
                let liquidationTarget = null;

                // B. RSI REVERSAL TARGET
                let rsiTarget = null;
                const pivots = (indicators as any).pivots;
                if (signalSide === 'LONG' && pivots) rsiTarget = pivots.r2;
                if (signalSide === 'SHORT' && pivots) rsiTarget = pivots.s2;

                // C. ORDER BOOK WALL
                let wallTarget = null;
                const veSafe = indicators.volumeExpert;

                if (veSafe && veSafe.liquidity && veSafe.liquidity.orderBook) {
                    if (signalSide === 'LONG' && veSafe.liquidity.orderBook.askWall) wallTarget = veSafe.liquidity.orderBook.askWall.price;
                    if (signalSide === 'SHORT' && veSafe.liquidity.orderBook.bidWall) wallTarget = veSafe.liquidity.orderBook.bidWall.price;
                }

                // --- STAGE 5: BUILD OPPORTUNITY (If Threshold Met) ---
                const minScore = (TradingConfig.scoring as any).min_score_to_list || 75;

                if (totalScore >= minScore) {
                    const finalScore = Math.min(100, Math.round(totalScore));

                    let finalTier: 'S' | 'A' | 'B' | 'C' = 'C';
                    if (finalScore >= 90) finalTier = 'S';
                    else if (finalScore >= 75) finalTier = 'A';
                    else if (finalScore >= 60) finalTier = 'B';

                    // 1. DCA PLAN GENERATION
                    const dcaPlan = calculateDCAPlan(
                        indicators.price,
                        (indicators.confluenceAnalysis as any) || { topSupports: [], topResistances: [] },
                        indicators.atr,
                        signalSide,
                        indicators.marketRegime,
                        (indicators as any).fibLevels,
                        finalTier,
                        {
                            rsiReversal: (typeof rsiTarget === 'number' && rsiTarget > 0) ? rsiTarget : undefined,
                            liquidationCluster: liquidationTarget || undefined,
                            orderBookWall: wallTarget || undefined
                        }
                    );

                    // Apply Proximity Penalty (Wait for Dip) logic
                    if (dcaPlan.proximityScorePenalty) {
                        totalScore -= dcaPlan.proximityScorePenalty;
                        reasoning.push(`⏳ Sniper: Waiting for dip -${dcaPlan.proximityScorePenalty}`);
                    }

                    // --- FINAL SCORE NORMALIZATION & REALISM ---
                    totalScore = Math.min(100, Math.max(0, totalScore));

                    // RE-CALC TIER AFTER PENALTY for Metadata
                    let postPenaltyTier: 'S' | 'A' | 'B' | 'C' = 'C';
                    if (totalScore >= 90) postPenaltyTier = 'S';
                    else if (totalScore >= 75) postPenaltyTier = 'A';
                    else if (totalScore >= 60) postPenaltyTier = 'B';

                    // DYNAMIC R:R CALCULATION
                    let dynamicRR = 2.5;
                    if (dcaPlan.averageEntry && dcaPlan.stopLoss && dcaPlan.takeProfits.tp2.price) {
                        const risk = Math.abs(dcaPlan.averageEntry - dcaPlan.stopLoss);
                        const reward = Math.abs(dcaPlan.takeProfits.tp2.price - dcaPlan.averageEntry);
                        if (risk > 0) dynamicRR = parseFloat((reward / risk).toFixed(2));
                    }

                    // --- STAGE 5.1: PORTFOLIO HEATMAP (Pearson Matrix Check) ---
                    const activeTrades = signalAuditService.getActiveSignals().map((s: any) => s.symbol);
                    const priceSeries = candles.map(c => c.close);
                    const correlationRisk = await calculatePortfolioCorrelation(
                        coin.symbol,
                        activeTrades,
                        style === 'MEME_SCALP',
                        priceSeries
                    );

                    // If correlation is too high, we block or penalize
                    if (correlationRisk.recommendation === 'BLOCK') {
                        // console.log(`[Scanner] 🛡️ Blocking ${coin.symbol}: Portfolio Correlation too high (${correlationRisk.score.toFixed(2)})`);
                        // return; // Drop this opportunity -> DISABLED
                        // totalScore -= 50; // REMOVED: No Penalty
                        reasoning.push(`⛔ ALTO RIESGO PORTAFOLIO: Correlación Excesiva`);
                    } else if (correlationRisk.recommendation === 'REDUCE') {
                        totalScore -= 15; // Penalty for high similarity
                        reasoning.push(`🛡️ Portfolio Heatmap: High correlation with open trades (${correlationRisk.score.toFixed(2)})`);
                    }
                }

                // Apply asset-specific RVOL scoring bonus/penalty
                // This replaces the hard filter approach with a more flexible scoring system
                if (indicators.rvol !== undefined && indicators.rvol > 0) {
                    const { AssetClassifier } = await import('./pipeline/AssetClassifier');

                    // Calc volatility proxy (using BTC ATR status or DXY if available)
                    // If BTC volatility is HIGH, we assume market is volatile
                    const isVolatile = macroContext?.btcRegime.volatilityStatus === 'HIGH';
                    const volMetric = isVolatile ? 0.06 : 0.03;

                    const rvolAdjustment = AssetClassifier.getRVOLScoreAdjustment(
                        coin.symbol,
                        indicators.rvol,
                        macroContext?.btcRegime.regime as any, // Cast to match AssetClassifier type
                        volMetric
                    );
                    const rvolStatusMsg = AssetClassifier.getRVOLStatusMessage(coin.symbol, indicators.rvol);

                    totalScore += rvolAdjustment;

                    // Only log if significant adjustment
                    if (Math.abs(rvolAdjustment) >= 5) {
                        reasoning.push(`📊 ${rvolStatusMsg}`);
                    }
                }

                // FIX 1.2: Cap score BEFORE using it for ANY downstream calculations
                // This ensures tier calc, confidence scoring, etc. never see score >100
                totalScore = Math.max(0, Math.min(100, totalScore));

                // === CALCULATE TIER & RISK METRICS ===
                // === CALCULATE TIER & RISK METRICS ===
                // Use fundamentalTier calculated at start of pipeline
                const postPenaltyTier = fundamentalTier;

                // Calculate isMeme for Risk Engine
                const isMeme = (TradingConfig.assets.tiers.c_tier_patterns as unknown as string[]).some(p => coin.symbol.includes(p)) ||
                    (TradingConfig.assets.meme_list as unknown as string[]).includes(coin.symbol);

                const correlationRisk = await calculatePortfolioCorrelation(coin.symbol, [], isMeme); // Fixed Args
                const dynamicRR = strategyResult.primaryStrategy?.id === 'SCALPING_M15' ? 1.5 : 2.5;

                // === MARKET REGIME CONSTRUCTION (Bridge Macro -> Advanced Types) ===
                if (macroContext && !indicators.marketRegime) {
                    const volStatus = macroContext.btcRegime.volatilityStatus;
                    const macroRegime = macroContext.btcRegime.regime;

                    let derivRegime: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'EXTREME' = 'RANGING';

                    if (volStatus === 'HIGH') derivRegime = 'VOLATILE';
                    else if (macroRegime === 'BULL' || macroRegime === 'BEAR') derivRegime = 'TRENDING';
                    else if (macroRegime === 'RANGE') derivRegime = 'RANGING';

                    indicators.marketRegime = {
                        regime: derivRegime,
                        confidence: 75,
                        metrics: {
                            adx: indicators.adx,
                            atr: indicators.atr,
                            atrPercent: (indicators.atr / indicators.price) * 100,
                            bbBandwidth: indicators.bollinger ? ((indicators.bollinger.upper - indicators.bollinger.lower) / indicators.bollinger.middle) : 0,
                            emaAlignment: indicators.trendStatus.emaAlignment === 'CHAOTIC' ? 'NEUTRAL' : indicators.trendStatus.emaAlignment,
                            rsi: indicators.rsi,
                            rvol: indicators.rvol,
                            zScore: indicators.zScore,
                            emaSlope: indicators.emaSlope
                        },
                        recommendedStrategies: [],
                        reasoning: `Macro Derived: ${macroRegime} (${volStatus})`
                    };
                }

                // === CALCULATE DCA PLAN ===
                // Use updated dcaCalculator with tier-based logic
                const dcaPlan = calculateDCAPlan(
                    indicators.price,
                    (indicators.confluenceAnalysis as any) || { topSupports: [], topResistances: [] }, // Ensure valid ConfluenceAnalysis object
                    indicators.atr,
                    signalSide,
                    indicators.marketRegime, // Arg 5: Market Regime
                    indicators.fibonacci,    // Arg 6: Fibs
                    postPenaltyTier          // Arg 7: Tier
                );

                // === CALCULATE POSITION SIZING ===
                const kellySize = calculateKellySize(0.65, dynamicRR); // 65% winrate assumption
                const recommendedLeverage = getVolatilityAdjustedLeverage(indicators.atr, indicators.price);

                // === FASE 2: COHERENCE VALIDATION & AUTO-FIX ===
                const { CoherenceValidator } = await import('./pipeline/CoherenceValidator');
                const coherenceCheck = CoherenceValidator.validate(
                    {
                        side: signalSide,
                        strategy: strategyResult.primaryStrategy?.id,
                        globalSentiment: globalSentiment
                    },
                    indicators,
                    indicators.volumeExpert, // Use from indicators instead of 've' (different scope)
                    totalScore,
                    reasoning
                );

                // Log contradictions for debugging
                if (!coherenceCheck.isCoherent) {
                    console.warn(`[Coherence] ${coin.symbol}: ${coherenceCheck.contradictions.length} issues found`);
                    coherenceCheck.contradictions.forEach(c => {
                        console.warn(`  - [${c.severity}] ${c.type}: ${c.description} → ${c.action}`);
                    });
                }

                // Apply fixes
                totalScore = coherenceCheck.fixedScore;
                reasoning = coherenceCheck.fixedReasoning;

                // DISCARD signal if CRITICAL contradiction detected
                if (coherenceCheck.shouldDiscard) {
                    console.log(`[Coherence] ❌ DISCARDING ${coin.symbol}: Critical contradiction detected`);
                    return; // Skip this signal entirely
                }

                const opportunity: AIOpportunity = {
                    id: coin.id,
                    symbol: coin.symbol,
                    timestamp: Date.now(),
                    timeframe: interval,
                    session: sessionLabel,
                    riskRewardRatio: dynamicRR,
                    strategy: strategyResult.primaryStrategy?.id || baseScoreResult.strategies[0] || 'hybrid_algo',
                    side: signalSide,
                    confidenceScore: Math.round(Math.min(100, totalScore)),
                    debugLog: `Base: ${baseScoreResult.score} + Strat: ${strategyResult.primaryStrategy?.score || 0} + Boost: ${strategyResult.scoreBoost}.`,
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
                    stopLoss: dcaPlan.stopLoss,
                    takeProfits: {
                        tp1: dcaPlan.takeProfits.tp1.price,
                        tp2: dcaPlan.takeProfits.tp2.price,
                        tp3: dcaPlan.takeProfits.tp3.price
                    },
                    technicalReasoning: reasoning.join(". "),
                    reasoning: reasoning, // NEW: Pass array for Telegram Service
                    dcaPlan: dcaPlan,
                    metrics: {
                        adx: indicators.adx || 0,
                        volume24h: coin.rawVolume || 0,
                        rvol: indicators.rvol || 0,
                        rsi: indicators.rsi || 50,
                        vwapDist: indicators.vwap ? ((indicators.price - indicators.vwap) / indicators.vwap) * 100 : 0,
                        structure: indicators.trendStatus.emaAlignment,
                        specificTrigger: strategyResult.primaryStrategy?.reason || "Technical Setup",
                        zScore: indicators.zScore || 0,
                        emaSlope: indicators.emaSlope || 0,
                        isSqueeze: !!(indicators as any).isSqueeze,
                        volumeExpert: veSafe,
                        macdDivergence: (indicators as any).macdDivergence?.type || undefined,
                        rsiDivergence: (indicators as any).rsiDivergence?.type || undefined,
                        chartPatterns: ((indicators as any).chartPatterns && (indicators as any).chartPatterns.length > 0) ? (indicators as any).chartPatterns : undefined,
                        harmonics: ((indicators as any).harmonics && (indicators as any).harmonics.length > 0) ? (indicators as any).harmonics : undefined,

                        // God Mode Metrics
                        cvdDivergence: ((indicators as any).cvdDivergence && (indicators as any).cvdDivergence !== 'NONE') ? {
                            type: (indicators as any).cvdDivergence,
                            strength: 0.8
                        } : undefined,

                        // Macro Context
                        macroContext: macroContext ? {
                            btcRegime: macroContext.btcRegime.regime,
                            dxyIndex: parseFloat(globalData.dxyIndex.toFixed(2)),
                            goldPrice: parseFloat(globalData.goldPrice.toFixed(0)),
                            btcDominance: parseFloat(macroContext.btcDominance.current.toFixed(2))
                        } : undefined
                    },
                    invalidated: false,
                    tier: postPenaltyTier,
                    kellySize,
                    recommendedLeverage,
                    correlationRisk
                };

                // --- STAGE 6: FOMO PREVENTION (The Sniper Check) ---
                const isFresh = strategyResult.primaryStrategy?.isFresh ?? true;
                const bestEntryDist = Math.abs(dcaPlan.entries[0].distanceFromCurrent);
                const fomoThreshold = interval === '4h' ? 2.5 : 0.6;

                if (!isFresh && bestEntryDist > fomoThreshold) {
                    console.log(`[Sniper] Rejected ${coin.symbol}: Stale signal + Bad Entry (${bestEntryDist.toFixed(2)}% > ${fomoThreshold}%).`);
                    return; // Continue to next coin
                }

                // --- FINAL OUTPUT ---
                // 4. FILTER ENGINE (The Gatekeeper)
                const filterResult = FilterEngine.shouldDiscard(opportunity, risk, style, macroContext);
                if (filterResult.discarded) {
                    // NEW: "Inform, Don't Block" Policy
                    // Per User Request: DO NOT PENALIZE SCORE. Just Warn.
                    // If we penalize, it might drop below visibility threshold.
                    const isSoftBlock =
                        filterResult.reason?.includes('Risk Shield') ||
                        filterResult.reason?.includes('Liquidity') ||
                        filterResult.reason?.includes('Volume') ||
                        filterResult.reason?.includes('RSI') ||
                        filterResult.reason?.includes('Trend');

                    if (isSoftBlock && filterResult.reason) {
                        console.warn(`[Filter] FORCE PASS ${coin.symbol}: ${filterResult.reason}`);
                        // totalScore -= 20; // REMOVED: No Penalty
                        reasoning.push(`⚠️ FILTRO DE RIESGO: ${filterResult.reason}`);
                    } else {
                        // Hard Block (Score too low, Blacklisted, Wrong Algo)
                        return;
                    }
                }

                // 4. APEX GUARD (Whipsaw Protection)
                const apexCheck = FilterEngine.checkApexSafety(opportunity, signalHistory[coin.symbol] || [], null);
                if (apexCheck.discarded) {
                    console.warn(`[Apex] FORCE PASS ${coin.symbol}: ${apexCheck.reason}`);
                    // totalScore -= 30; // REMOVED: No Penalty
                    reasoning.push(`⚠️ PROTECCIÓN APEX: ${apexCheck.reason}`);
                }
                opportunities.push(opportunity);
                console.log(`[Scanner] [${coin.symbol}] ✅ ACCEPTED with Match Score ${opportunity.confidenceScore}`);
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

    // --- FINAL GATEKEEPER (SAFETY NET) ---
    // Ensure absolutely NO non-tournament assets leak out due to any logic bypass above
    if (TradingConfig.TOURNAMENT_MODE) {
        const eliteSymbols = TradingConfig.assets.tournament_list;
        const beforeCount = opportunities.length;
        const filteredOps = opportunities.filter(o => {
            const cleanId = o.symbol.replace('/', '') + 'USDT';
            const cleanSym = o.symbol.replace('/', '');
            // Check formatted list (BTCUSDT) - cast as string[] to avoid strict union mismatch
            const eliteList = eliteSymbols as readonly string[];
            const isElite = eliteList.includes(cleanSym) || eliteList.some(e => e.includes(cleanSym));
            return isElite;
        });

        if (filteredOps.length !== beforeCount) {
            console.warn(`[Scanner] 🛡️ GATEKEEPER CAUGHT ${beforeCount - filteredOps.length} UNAUTHORIZED SIGNALS! (Logic Leak or Cache Issue)`);
        }
        return filteredOps.sort((a, b) => b.confidenceScore - a.confidenceScore);
    }

    // --- 4.11 UPDATE ACTIVE CONTEXT (Slow Lane) ---
    // Every 15m scan, we also check our soldiers in the field for new threats (Walls)
    if (TradingConfig.TOURNAMENT_MODE) {
        // Run completely async to not block the main scanner return
        updateActiveSignalsContext().catch(e => console.error(`[Scanner] Context Update Failed: ${e.message}`));
    }

    return opportunities.sort((a, b) => b.confidenceScore - a.confidenceScore);
};

// --- HELPER: MACRO CONTEXT (Legacy Logic Preserved) ---
// ✅ SYMMETRIC & PROFESSIONAL MACRO FILTERS
function applyMacroFilters(
    baseScore: number,
    symbol: string,
    signalSide: 'LONG' | 'SHORT',
    macro: MacroContext,
    indicators: TechnicalIndicators,
    globalData?: any
): number {
    let adjustedScore = baseScore;
    const isBTC = symbol.includes('BTC');

    // 1. BTC REGIME PENALTY (Symmetric)
    // Exception: If signal is a Reversal (Oversold/Overbought), bypass penalty to catch bottoms/tops
    const isReversalLONG = signalSide === 'LONG' && indicators.rsi < 30;
    const isReversalSHORT = signalSide === 'SHORT' && indicators.rsi > 70;

    if (!isBTC && signalSide === 'LONG' && !isReversalLONG) {
        if (macro.btcRegime.regime === 'BEAR') adjustedScore *= 0.7; // -30%
        else if (macro.btcRegime.regime === 'RANGE') adjustedScore *= 0.9;
    }

    if (!isBTC && signalSide === 'SHORT' && !isReversalSHORT) {
        if (macro.btcRegime.regime === 'BULL' || macro.btcWeeklyRegime?.regime === 'BULL') {
            adjustedScore *= 0.7; // -30% (Symmetric to BULL filter)
        } else if (macro.btcRegime.regime === 'RANGE') {
            adjustedScore *= 0.9;
        }
    }

    // 2. USDT DOMINANCE (Rotation Logic)
    if (macro.usdtDominance.trend === 'RISING' && signalSide === 'LONG') {
        adjustedScore *= 0.75; // -25% Drain
    } else if (macro.usdtDominance.trend === 'FALLING' && signalSide === 'LONG') {
        adjustedScore += 10; // ✅ BOOST: Capital rotating INTO alts
    } else if (macro.usdtDominance.trend === 'RISING' && signalSide === 'SHORT') {
        adjustedScore += 10; // ✅ BOOST: Capital fleeing TO stables
    }

    // 3. GLOBAL MACRO (DXY / Gold) - Risk-ON/OFF
    if (globalData && globalData.isDataValid) {
        const dxyStr = globalData.dxyIndex || 0;
        const goldStr = globalData.goldPrice || 0;

        // DXY Rising (Bearish for Risk Assets)
        if (dxyStr > 103 && signalSide === 'LONG') adjustedScore -= 10;
        if (dxyStr > 103 && signalSide === 'SHORT') adjustedScore += 10;

        // DXY Falling (Bullish for Risk Assets)
        if (dxyStr < 101 && signalSide === 'LONG') adjustedScore += 10;

        // Gold (Safe Haven) Correlation
        if (goldStr > 2700 && signalSide === 'LONG') adjustedScore += 5; // Risk-off hedge
    }

    return isNaN(adjustedScore) ? baseScore : Math.round(adjustedScore);
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

// --- HELPER: ACTIVE CONTEXT UPDATE (The "Slow Lane") ---
async function updateActiveSignalsContext() {
    try {
        const activeSignals = signalAuditService.getActiveSignals();
        if (activeSignals.length === 0) return;

        console.log(`[Scanner] 🕵️ Deep Audit on ${activeSignals.length} active positions...`);

        for (const signal of activeSignals) {
            try {
                // only check if we are in profit (don't adjust losing trades TPs yet)
                if (signal.pnl_percent && signal.pnl_percent > 0.5) {
                    let volAnalysis = await getExpertVolumeAnalysis(signal.symbol);

                    // Fetch candles for enrichment with Timeout
                    const fetchWithTimeout = (promise: Promise<any>, ms: number) => {
                        return Promise.race([
                            promise,
                            new Promise((_, reject) => setTimeout(() => reject(new Error("Fetch Timeout")), ms))
                        ]);
                    };

                    let rawCandles;
                    try {
                        rawCandles = await fetchWithTimeout(fetchCandles(signal.symbol, '15m'), 5000) as any[];
                    } catch (e) {
                        console.warn(`[Diagnostic] ⚠️ Timeout fetching candles for ${signal.symbol}`);
                        return;
                    }

                    if (!rawCandles || rawCandles.length < 50) {
                        console.warn(`[Diagnostic] ⚠️ Not enough candles for ${signal.symbol}`);
                        return;
                    }

                    console.log(`[Diagnostic] Processing ${signal.symbol}: Candles ${rawCandles.length}`);

                    const candles = rawCandles.map(c => ({ ...c, time: c.timestamp / 1000 })); // Fix timestamp format
                    const highs = candles.map((c: any) => c.high);
                    const lows = candles.map((c: any) => c.low);
                    const currentPrice = candles[candles.length - 1].close;

                    // ENRICH (Fetch Order Book)
                    // Note: enrichWithDepthAndLiqs handles pure math + Order Book fetch if available
                    volAnalysis = await enrichWithDepthAndLiqs(signal.symbol, volAnalysis, highs, lows, currentPrice);

                    // CHECK FOR OPPOSING WALLS (Front-run logic)
                    if (signal.side === 'LONG' && volAnalysis.liquidity.orderBook?.askWall) {
                        const wall = volAnalysis.liquidity.orderBook.askWall;
                        // If wall is huge (>50 strength) and below our TP, we must respect it.
                        if (wall.strength > 50) {
                            await signalAuditService.updateSignalContext(signal.symbol, {
                                new_tp: wall.price * 0.999, // Front-run 0.1%
                                reason: `Sell Wall Detected @ $${wall.price}`
                            });
                        }
                    } else if (signal.side === 'SHORT' && volAnalysis.liquidity.orderBook?.bidWall) {
                        const wall = volAnalysis.liquidity.orderBook.bidWall;
                        if (wall.strength > 50) {
                            await signalAuditService.updateSignalContext(signal.symbol, {
                                new_tp: wall.price * 1.001, // Front-run 0.1%
                                reason: `Buy Wall Detected @ $${wall.price}`
                            });
                        }
                    }
                }
            } catch (innerError) { /* ignore single signal error */ }
        }
    } catch (e) {
        console.warn("[Scanner] Context Audit Error:", e);
    }
}
