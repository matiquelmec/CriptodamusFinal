import { AIOpportunity, TradingStyle, TechnicalIndicators, MarketRisk } from '../../types';
import { analyzeIchimoku } from '../strategies/IchimokuAdapter';
import { analyzeMemeSignal } from '../strategies/MemeStrategy';
import { analyzeSwingSignal } from '../strategies/SwingStrategy';
import { analyzeBreakoutSignal } from '../strategies/BreakoutStrategy';
import { analyzeScalpSignal } from '../strategies/ScalpStrategy';
import { analyzePinballSignal } from '../strategies/PinballStrategy';
import { analyzeRSIExpert } from '../rsiExpert';
import { getMacroContext, type MacroContext } from '../macroService';
import {
    calculateIchimokuLines, calculateIchimokuCloud,
    calculateBollingerStats, calculateSMA, calculateEMA, calculateMACD,
    calculateEMAArray, calculateStdDev, calculateRSI, calculateStochRSI,
    calculateRSIArray, calculateCumulativeVWAP, calculateAutoFibs, calculateFractals,
    calculateATR, calculateADX, calculatePivotPoints,
    calculateZScore, calculateSlope
} from '../mathUtils';
import { calculateVolumeProfile } from '../volumeProfile';
import { detectOrderBlocks } from '../orderBlocks';
import { detectHarmonicPatterns } from '../harmonicPatterns';
import { detectChartPatterns } from '../chartPatterns';
import { detectFVG } from '../fairValueGaps';
import { calculatePOIs } from '../confluenceEngine';
import { getCurrentSessionSimple } from '../sessionExpert';
import { detectMarketRegime } from '../marketRegimeDetector';
import { detectGenericDivergence } from '../divergenceDetector';
import { selectStrategies } from '../strategySelector';
import { calculateDCAPlan } from '../dcaCalculator';
import { getExpertVolumeAnalysis, enrichWithDepthAndLiqs } from '../volumeExpertService';
import {
    fetchCryptoData,
    fetchCandles,
    checkBinanceHealth,
    MEME_SYMBOLS
} from '../api/binanceApi';
import {
    getMarketRisk,
    calculateFundamentalTier
} from './riskEngine';

// --- MATH HELPERS (Local) ---

function getStrategyId(style: TradingStyle): string {
    switch (style) {
        case 'SCALP_AGRESSIVE': return 'quant_volatility';
        case 'SWING_INSTITUTIONAL': return 'smc_liquidity';
        case 'ICHIMOKU_CLOUD': return 'ichimoku_dragon';
        case 'MEME_SCALP': return 'meme_hunter';
        case 'BREAKOUT_MOMENTUM': return 'breakout_momentum';
        default: return (style as string).toLowerCase();
    }
}

function applyMacroFilters(
    baseScore: number,
    symbol: string,
    signalSide: 'LONG' | 'SHORT',
    macro: MacroContext
): number {
    let adjustedScore = baseScore;
    const isBTC = symbol === 'BTC/USDT' || symbol === 'BTCUSDT';

    if (macro.btcRegime.volatilityStatus === 'HIGH' && macro.btcRegime.regime === 'RANGE') {
        // console.log(`[MacroFilter] Alta volatilidad en rango para ${symbol}: Reduciendo confianza`);
        adjustedScore *= 0.7;
    }

    if (!isBTC && signalSide === 'LONG') {
        if (macro.btcRegime.regime === 'BEAR') {
            adjustedScore *= 0.7;
        } else if (macro.btcRegime.regime === 'RANGE') {
            adjustedScore *= 0.9;
        }
    }

    if (!isBTC) {
        const { trend, current } = macro.btcDominance;
        if (trend === 'RISING' || current > 55) {
            adjustedScore *= 0.85;
        } else if (trend === 'FALLING' && current < 50) {
            adjustedScore *= 1.15;
        }
    }

    if (macro.usdtDominance.trend === 'RISING') {
        if (signalSide === 'LONG') {
            adjustedScore *= 0.75;
        } else {
            adjustedScore *= 1.2;
        }
    }

    if (!isBTC && signalSide === 'SHORT') {
        const isBearishContext = macro.btcRegime.regime === 'BEAR';
        const liquidityDraining = macro.btcDominance.trend === 'RISING' || macro.usdtDominance.trend === 'RISING';

        if (isBearishContext && liquidityDraining) {
            adjustedScore *= 1.5;
        }
    }

    if (isBTC && signalSide === 'LONG') {
        if (macro.btcRegime.regime === 'BEAR') adjustedScore *= 0.7;
        else if (macro.btcRegime.regime === 'BULL') adjustedScore *= 1.1;
    }

    return Math.min(adjustedScore, 100);
}

// --- MAIN LOGIC (Refactored from cryptoService.ts) ---

export const scanMarketOpportunities = async (style: TradingStyle): Promise<AIOpportunity[]> => {
    // 0. LOG START
    console.log(`[Scanner] STARTING SCAN: ${style} mode...`);

    // 1. Get market data based on selected style
    // REMOVED BLOCKING HEALTH CHECK: Let fetchCryptoData handle fallbacks internally.
    const mode = style === 'MEME_SCALP' ? 'memes' : 'volume';
    let market: any[] = [];
    try {
        market = await fetchCryptoData(mode);
        console.log(`[Scanner] Market Data Parsed: ${market.length} tickers.`);
    } catch (e) {
        console.error("[Scanner] MARKET DATA CRITICAL ERROR:", e);
        throw new Error("EXCHANGE_OFFLINE"); // Signal to UI
    }

    // 2. CHECK MARKET RISK (News Filter)
    const risk = await getMarketRisk();
    const isHighRisk = risk.level === 'HIGH';

    // 3. GET MACRO CONTEXT
    let macroContext: MacroContext | null = null;
    try {
        macroContext = await getMacroContext();
        console.log(`[Scanner] Macro Context: BTC ${macroContext.btcRegime.regime} (${macroContext.btcRegime.strength}%), BTC.D ${macroContext.btcDominance.current.toFixed(1)}% (${macroContext.btcDominance.trend})`);
    } catch (error) {
        console.warn('[Scanner] Macro context unavailable, proceeding without macro filters:', error);
    }
    if (!market || market.length === 0) throw new Error("No market data available");

    const topCandidates = style === 'MEME_SCALP' ? market : market.slice(0, 60);
    console.log(`[Scanner] Analyzing Top ${topCandidates.length} candidates...`);

    const validMathCandidates: AIOpportunity[] = [];

    await Promise.all(topCandidates.map(async (coin) => {
        try {
            const interval = style === 'SWING_INSTITUTIONAL' || style === 'ICHIMOKU_CLOUD' ? '4h' : '15m';

            const candles = await fetchCandles(coin.id, interval);
            if (candles.length < 200) return;

            const prices = candles.map(c => c.close);
            const volumes = candles.map(c => c.volume);
            const highs = candles.map(c => c.high);
            const lows = candles.map(c => c.low);

            let score = 0;
            let detectionNote = "";
            let signalSide: 'LONG' | 'SHORT' = 'LONG';

            let specificTrigger = "";
            let structureNote = "";

            const checkIndex = prices.length - 2;

            const vwap = calculateCumulativeVWAP(highs, lows, prices, volumes);
            const stochRsi = calculateStochRSI(prices, 14);
            const rsi = calculateRSI(prices.slice(0, checkIndex + 1), 14);
            const rsiArray = calculateRSIArray(prices.slice(0, checkIndex + 1), 14);

            const { fractalHighs, fractalLows } = calculateFractals(highs.slice(0, checkIndex + 1), lows.slice(0, checkIndex + 1));
            const fibs = calculateAutoFibs(highs, lows, calculateEMA(prices, 200));

            const harmonicPatterns = detectHarmonicPatterns(prices.slice(0, checkIndex + 1), highs.slice(0, checkIndex + 1), lows.slice(0, checkIndex + 1), fractalHighs, fractalLows);
            const ema200 = calculateEMA(prices.slice(0, checkIndex + 1), 200);
            const currentPrice = prices[checkIndex];
            const avgVol = calculateSMA(volumes, 20);
            const rvol = avgVol > 0 ? (volumes[checkIndex] / avgVol) : 0;

            const tier = calculateFundamentalTier(coin.id, style === 'MEME_SCALP');

            if (rvol < 0.3) {
                return;
            }

            const trendDist = ((currentPrice - ema200) / ema200) * 100;
            structureNote = trendDist > 0 ? `Tendencia Alcista (+${trendDist.toFixed(1)}% sobre EMA200)` : `Tendencia Bajista (${trendDist.toFixed(1)}% bajo EMA200)`;

            const ema20 = calculateEMA(prices.slice(0, checkIndex + 1), 20);
            const ema50 = calculateEMA(prices.slice(0, checkIndex + 1), 50);
            const ema100 = calculateEMA(prices.slice(0, checkIndex + 1), 100);
            const macd = calculateMACD(prices.slice(0, checkIndex + 1));
            const bb = calculateBollingerStats(prices.slice(0, checkIndex + 1), 20, 2);
            const pivots = calculatePivotPoints(highs.slice(0, checkIndex + 1), lows.slice(0, checkIndex + 1), prices.slice(0, checkIndex + 1));
            const adx = calculateADX(highs.slice(0, checkIndex + 1), lows.slice(0, checkIndex + 1), prices.slice(0, checkIndex + 1), 14);
            const atr = calculateATR(highs.slice(0, checkIndex + 1), lows.slice(0, checkIndex + 1), prices.slice(0, checkIndex + 1), 14);

            // --- EXPERT MODULES (SAFE WRAPPED) ---
            let volumeProfile, bullishOB, bearishOB, bullishFVG, bearishFVG;
            try {
                volumeProfile = calculateVolumeProfile(candles.slice(0, checkIndex + 1), atr);
                const obs = detectOrderBlocks(candles.slice(0, checkIndex + 1), atr, currentPrice);
                bullishOB = obs.bullishOB; bearishOB = obs.bearishOB;
                const fvgs = detectFVG(candles.slice(0, checkIndex + 1), atr, currentPrice);
                bullishFVG = fvgs.bullishFVG; bearishFVG = fvgs.bearishFVG;
            } catch (err) {
                volumeProfile = { poc: 0, valueAreaHigh: 0, valueAreaLow: 0, totalVolume: 0 };
                bullishOB = []; bearishOB = []; bullishFVG = []; bearishFVG = [];
            }

            const zScore = calculateZScore(prices.slice(0, checkIndex + 1), ema200);
            const emaSlope = calculateSlope(calculateEMAArray(prices.slice(0, checkIndex + 1), 200), 10);

            const macdDivergence = detectGenericDivergence(candles, macd.histogramValues, 'MACD_HIST');
            const rsiDivergence = detectGenericDivergence(candles, rsiArray, 'RSI');
            const isSqueeze = bb.bandwidth < 10 && Math.abs(macd.histogram) < (currentPrice * 0.0005);

            let volumeExpert = undefined;
            let cvdDivergence = undefined; // NEW: CVD Divergence
            try {
                if (rvol > 0.3) {
                    volumeExpert = await getExpertVolumeAnalysis(coin.symbol).catch(() => undefined);

                    // --- NEW: DETECT CVD DIVERGENCE (Micro-structure) ---
                    if (volumeExpert && volumeExpert.cvd && volumeExpert.cvd.cvdSeries && volumeExpert.cvd.priceSeries) {
                        // Construct a mock "candles" array for the detector because it expects {high, low} etc.
                        // But our detector mainly needs arrays? 
                        // Check detectGenericDivergence signature: (candles: any[], oscillatorValues: number[], sourceName...)
                        // It uses candles[i].high / candles[i].low.
                        // Our priceSeries from volumeExpert are just averages.
                        // Let's create mock candles where high=low=price. It works for the logic (high > high check).
                        const mockCandles = volumeExpert.cvd.priceSeries.map(p => ({ high: p, low: p, close: p }));
                        const cvdValues = volumeExpert.cvd.cvdSeries;

                        cvdDivergence = detectGenericDivergence(mockCandles, cvdValues, 'CVD', 5); // Lookback 5 buckets

                        if (cvdDivergence) {
                            volumeExpert.cvd.divergence = cvdDivergence.type;
                        }
                    }
                }
            } catch (e) { }

            const rsiExpertResults = analyzeRSIExpert(prices.slice(0, checkIndex + 1), rsiArray.slice(0, checkIndex + 1));

            const confluenceAnalysis = calculatePOIs(
                currentPrice, fibs, pivots, ema200, ema50, atr,
                volumeProfile, bullishOB, bearishOB, bullishFVG, bearishFVG
            );

            const resistances = confluenceAnalysis.topResistances.map(r => r.price);

            const techIndicators: TechnicalIndicators = {
                symbol: coin.symbol,
                price: currentPrice,
                rsi, stochRsi, adx, atr, rvol, vwap,
                ema20, ema50, ema100, ema200,
                zScore, emaSlope, macdDivergence, isSqueeze,
                rsiExpert: {
                    range: rsiExpertResults.range.type,
                    target: rsiExpertResults.reversalTarget?.active ? rsiExpertResults.reversalTarget.targetPrice : null,
                    targetType: rsiExpertResults.reversalTarget?.type || null
                },
                macd: { line: macd.macdLine, signal: macd.signalLine, histogram: macd.histogram },
                bollinger: { upper: bb.upper, lower: bb.lower, middle: bb.sma, bandwidth: bb.bandwidth },
                pivots, fibonacci: fibs, harmonicPatterns: harmonicPatterns, volumeExpert,
                technicalReasoning: "", invalidated: false,
                trendStatus: {
                    emaAlignment: (ema20 > ema50 && ema50 > ema100) ? 'BULLISH' : (ema20 < ema50 && ema50 < ema100) ? 'BEARISH' : 'CHAOTIC',
                    goldenCross: ema50 > ema200, deathCross: ema50 < ema200
                }
            };

            const marketRegime = detectMarketRegime(techIndicators);
            const selection = selectStrategies(marketRegime);

            let totalScore = 0;
            let totalWeight = 0;
            let primaryStrategy = selection.activeStrategies[0]?.id;
            let strategyDetails: string[] = [];

            for (const strategy of selection.activeStrategies) {
                const strategyId = strategy.id;
                const weight = strategy.weight;
                if (weight === 0) continue;

                let result = null;
                let strategyName = "";

                if (strategyId === 'ichimoku_dragon') {
                    result = analyzeIchimoku(highs, lows, prices);
                    strategyName = "Ichimoku Cloud";
                } else if (strategyId === 'breakout_momentum') {
                    result = analyzeBreakoutSignal(
                        prices.slice(0, checkIndex + 1), highs.slice(0, checkIndex + 1), lows.slice(0, checkIndex + 1),
                        rvol, resistances
                    );
                    strategyName = "Breakout Momentum";
                } else if (strategyId === 'smc_liquidity') {
                    result = analyzeSwingSignal(
                        prices.slice(0, checkIndex + 1), highs.slice(0, checkIndex + 1), lows.slice(0, checkIndex + 1),
                        fibs, volumes.slice(0, checkIndex + 1), { bullishOB, bearishOB }
                    );
                    strategyName = "SMC Liquidity";
                } else if (strategyId === 'quant_volatility') {
                    const slope200 = calculateSlope(calculateEMAArray(prices.slice(0, checkIndex + 1), 200), 10);
                    const pinballResult = analyzePinballSignal(
                        prices.slice(0, checkIndex + 1), lows.slice(0, checkIndex + 1), highs.slice(0, checkIndex + 1),
                        ema50, ema200, slope200, adx
                    );

                    if (pinballResult) {
                        result = pinballResult;
                        strategyName = "Institutional Pinball";
                    } else {
                        result = analyzeScalpSignal(prices.slice(0, checkIndex + 1), vwap, rsi);
                        strategyName = "Quant Volatility";
                    }
                } else if (strategyId === 'meme_hunter') {
                    result = analyzeMemeSignal(prices.slice(0, checkIndex + 1), vwap, rvol, rsi, stochRsi);
                    strategyName = "Meme Hunter";
                }

                if (result) {
                    totalScore += result.score * weight;
                    totalWeight += weight;

                    if (result.score > 50) {
                        strategyDetails.push(`${strategyName}: ${result.detectionNote}`);
                    }

                    if (strategyId === primaryStrategy || !specificTrigger) {
                        signalSide = result.signalSide;
                        specificTrigger = result.specificTrigger;
                        detectionNote = result.detectionNote;
                    }
                }
            }

            score = totalWeight > 0 ? totalScore : 0;

            if (strategyDetails.length > 0) {
                detectionNote = strategyDetails.join(" | ");
            }

            // --- INSTITUTIONAL SCORING BOOSTS (VOLUME) ---
            if (volumeExpert) {
                // 1. Coinbase Premium
                if (volumeExpert.coinbasePremium.signal === 'INSTITUTIONAL_BUY' && signalSide === 'LONG') {
                    totalScore += 15;
                    detectionNote += " | 🏦 Inst. Buying (Premium +)";
                } else if (volumeExpert.coinbasePremium.signal === 'INSTITUTIONAL_SELL' && signalSide === 'SHORT') {
                    totalScore += 15;
                    detectionNote += " | 🏦 Inst. Selling (Premium -)";
                }

                // 2. CVD Divergence (Absorption)
                if (cvdDivergence) {
                    const isBullAbs = cvdDivergence.type === 'CVD_ABSORPTION_BUY';
                    const isBearAbs = cvdDivergence.type === 'CVD_ABSORPTION_SELL';

                    if (signalSide === 'LONG' && isBullAbs) {
                        totalScore += 20; // High Conviction
                        detectionNote += " | 🐋 Whale Absorption (Bull)";
                    } else if (signalSide === 'SHORT' && isBearAbs) {
                        totalScore += 20;
                        detectionNote += " | 🐋 Whale Absorption (Bear)";
                    }
                }

                // 3. Open Interest (Trend Confirmation)
                // If Long + OI Up = Strong Trend
                if (volumeExpert.derivatives.openInterest > 0) {
                    // Can't check trend of OI easily without history, but can check magnitude/value
                    // Placeholder for now
                }
            }

            if (isSqueeze) {
                totalScore += 10;
                detectionNote += " | ⚡ TTM Squeeze (Explosión)";
            }

            if (rsiExpertResults.reversalTarget?.active) {
                const targetIsBullish = rsiExpertResults.reversalTarget.type === 'POSITIVE';
                const targetIsBearish = rsiExpertResults.reversalTarget.type === 'NEGATIVE';
                if ((signalSide === 'LONG' && targetIsBullish) || (signalSide === 'SHORT' && targetIsBearish)) {
                    totalScore += 15;
                    detectionNote += ` | 🎯 Cardwell Target ($${rsiExpertResults.reversalTarget.targetPrice.toLocaleString()})`;
                }
            }

            if (rsiExpertResults.range.type.includes('SUPER')) {
                const isBullRange = rsiExpertResults.range.type.includes('BULL');
                const isBearRange = rsiExpertResults.range.type.includes('BEAR');
                if ((signalSide === 'LONG' && isBullRange) || (signalSide === 'SHORT' && isBearRange)) {
                    totalScore += 10;
                    detectionNote += " | 🚀 Super Range Momentum";
                }
            }

            if (macdDivergence) {
                const divIsBullish = macdDivergence.type.includes('BULLISH');
                const divIsBearish = macdDivergence.type.includes('BEARISH');
                if ((signalSide === 'LONG' && divIsBullish) || (signalSide === 'SHORT' && divIsBearish)) {
                    totalScore += 10;
                    detectionNote += ` | ⚠️ Div ${macdDivergence.type}`;
                } else {
                    totalScore -= 10;
                    detectionNote += ` | ⛔ Div Opuesta (${macdDivergence.type})`;
                }
            }

            if (totalScore > 99) totalScore = 99;
            score = totalWeight > 0 ? totalScore : 0;

            const threshold = isHighRisk ? 70 : 50;

            let finalScore = score;
            if (macroContext) {
                finalScore = applyMacroFilters(score, coin.symbol, signalSide, macroContext);
            }

            const PREMIUM_THRESHOLD = 60;
            const GOD_MODE_THRESHOLD = 90;
            const minimumThreshold = isHighRisk ? 80 : PREMIUM_THRESHOLD;

            if (finalScore < minimumThreshold && finalScore > 40) {
                // console.log(`[Scanner Audit] 📉 ${coin.symbol} rechazado por Score (${Math.round(finalScore)}/${minimumThreshold}). Razón: ${detectionNote}`);
            }

            if (finalScore >= minimumThreshold) {
                const signalPrice = prices[checkIndex];
                const livePrice = prices[prices.length - 1];

                const priceMove = ((livePrice - signalPrice) / signalPrice) * 100;
                const maxPriceMove = 5.0;

                if (Math.abs(priceMove) > maxPriceMove) {
                    // console.log(`[Scanner Audit] ⚠️ ${coin.symbol} señal obsoleta (Movimiento: ${priceMove.toFixed(2)}%)`);
                    return;
                }

                try {
                    // --- GOD TIER ENRICHMENT (SNIPER MODE) ---
                    // Only run for candidates that passed the threshold to save API calls
                    if (volumeExpert && finalScore >= 60) {
                        try {
                            volumeExpert = await enrichWithDepthAndLiqs(coin.symbol, volumeExpert, highs, lows, currentPrice);

                            // CONFLUENCE LOGIC: Smart Money Intent
                            const liqs = volumeExpert.liquidity.liquidationClusters || [];
                            const book = volumeExpert.liquidity.orderBook;

                            // 1. LIQUIDATION MAGNETS
                            if (liqs.length > 0) {
                                const closestPool = liqs[0]; // Already sorted by proximity
                                const distToLiq = Math.abs((closestPool.priceMin - currentPrice) / currentPrice) * 100;

                                if (distToLiq < 2.0) { // Within 2%
                                    if (signalSide === 'LONG' && closestPool.type === 'SHORT_LIQ') {
                                        detectionNote += " | 🧲 Magnet: Short Liqs";
                                        finalScore += 5;
                                    } else if (signalSide === 'SHORT' && closestPool.type === 'LONG_LIQ') {
                                        detectionNote += " | 🧲 Magnet: Long Liqs";
                                        finalScore += 5;
                                    }
                                }
                            }

                            // 2. ORDERBOOK WALLS (Resistance/Support)
                            if (book) {
                                if (signalSide === 'LONG') {
                                    if (book.bidWall && book.bidWall.strength > 0) {
                                        const distToWall = ((currentPrice - book.bidWall.price) / currentPrice) * 100;
                                        if (distToWall < 3 && distToWall > 0) { // Wall below us confirmed
                                            detectionNote += " | 🧱 Buy Wall Support";
                                            finalScore += 10;
                                        }
                                    }
                                } else if (signalSide === 'SHORT') {
                                    if (book.askWall && book.askWall.strength > 0) {
                                        const distToWall = ((book.askWall.price - currentPrice) / currentPrice) * 100;
                                        if (distToWall < 3 && distToWall > 0) { // Wall above us confirmed
                                            detectionNote += " | 🧱 Sell Wall Resistance";
                                            finalScore += 10;
                                        }
                                    }
                                }
                            }

                        } catch (enrichErr) {
                            // Fail silently, don't discard the opportunity just because depth failed
                            // console.warn("Enrichment failed", enrichErr);
                        }
                    }

                    const candles1h = await fetchCandles(coin.id, '1h');
                    if (candles1h.length >= 200) {
                        const prices1h = candles1h.map(c => c.close);
                        const ema200_1h = calculateEMA(prices1h, 200);
                        const currentPrice1h = prices1h[prices1h.length - 1];

                        let fractalPenalty = 0;
                        let fractalNote = "";
                        const distanceFrom1hEMA = Math.abs((currentPrice1h - ema200_1h) / ema200_1h) * 100;

                        if (signalSide === 'LONG') {
                            if (currentPrice1h < ema200_1h) {
                                if (distanceFrom1hEMA > 5) {
                                    fractalPenalty = 100;
                                    fractalNote = `⛔ Estructura 1H Muy Bajista (${distanceFrom1hEMA.toFixed(1)}% bajo EMA200)`;
                                } else {
                                    fractalNote = "⚠️ Cerca de EMA200 1H (Precaución)";
                                }
                            } else {
                                fractalNote = "✅ Confirmado por Estructura 1H";
                            }
                        } else {
                            if (currentPrice1h > ema200_1h) {
                                if (distanceFrom1hEMA > 5) {
                                    fractalPenalty = 100;
                                    fractalNote = `⛔ Estructura 1H Muy Alcista (${distanceFrom1hEMA.toFixed(1)}% sobre EMA200)`;
                                } else {
                                    fractalNote = "⚠️ Cerca de EMA200 1H (Precaución)";
                                }
                            } else {
                                fractalNote = "✅ Confirmado por Estructura 1H";
                            }
                        }

                        if (fractalPenalty > 0) {
                            // console.log(`[Scanner Audit] ❌ ${coin.symbol} rechazado por Fractal (${fractalNote})`);
                            return;
                        }
                        detectionNote += ` | ${fractalNote}`;

                        try {
                            const candles4h = await fetchCandles(coin.id, '4h');
                            if (candles4h.length >= 200) {
                                const prices4h = candles4h.map(c => c.close);
                                const ema200_4h = calculateEMA(prices4h, 200);
                                const currentPrice4h = prices4h[prices4h.length - 1];
                                const distanceFrom4hEMA = Math.abs((currentPrice4h - ema200_4h) / ema200_4h) * 100;

                                if (signalSide === 'LONG' && currentPrice4h < ema200_4h && distanceFrom4hEMA > 3) {
                                    finalScore *= 0.85;
                                    detectionNote += " | ⚠️ Estructura 4H bajista";
                                } else if (signalSide === 'SHORT' && currentPrice4h > ema200_4h && distanceFrom4hEMA > 3) {
                                    finalScore *= 0.85;
                                    detectionNote += " | ⚠️ Estructura 4H alcista";
                                } else if ((signalSide === 'LONG' && currentPrice4h > ema200_4h) || (signalSide === 'SHORT' && currentPrice4h < ema200_4h)) {
                                    detectionNote += " | ✅ Confirmado 4H";
                                }
                            }
                        } catch (err4h) { }

                        if (techIndicators.fractalAnalysis?.trend_1d) {
                            const trend1d = techIndicators.fractalAnalysis.trend_1d;
                            const isPinball = strategyDetails.some(s => s.includes("Institutional Pinball"));

                            if (signalSide === 'LONG' && trend1d === 'BEARISH') {
                                if (!macdDivergence && !isPinball) {
                                    finalScore *= 0.5;
                                    detectionNote += " | ⛔ Contra-Tendencia Diaria (Elder Rule)";
                                } else {
                                    detectionNote += " | ⚠️ Contra-Tendencia (Validado por Pinball/Div)";
                                }
                            } else if (signalSide === 'SHORT' && trend1d === 'BULLISH') {
                                if (!macdDivergence && !isPinball) {
                                    finalScore *= 0.5;
                                    detectionNote += " | ⛔ Contra-Tendencia Diaria (Elder Rule)";
                                } else {
                                    detectionNote += " | ⚠️ Contra-Tendencia (Validado por Pinball/Div)";
                                }
                            } else {
                                finalScore += 5;
                                detectionNote += " | 🌊 Marea a favor (Elder Aligned)";
                            }
                        }
                    }
                } catch (err) { }

                const dcaPlan = calculateDCAPlan(
                    signalPrice,
                    { supportPOIs: [], resistancePOIs: [], topSupports: [], topResistances: [] },
                    atr, signalSide, marketRegime, fibs, tier
                );

                let finalPrimarySide = signalSide;
                let currentFinalScore = finalScore;
                let filterNote = "";

                const btcCrashMode = macroContext?.btcRegime.regime === 'BEAR' && macroContext?.btcRegime.volatilityStatus === 'HIGH';
                const btcRegime = macroContext?.btcRegime.regime || 'RANGE';
                const strategyId = getStrategyId(style);

                if (btcCrashMode && finalPrimarySide === 'LONG') {
                    if (strategyId !== 'quant_volatility') {
                        currentFinalScore = 0;
                        filterNote = " (Blocked by BTC Crash)";
                    }
                } else if (btcRegime === 'BEAR' && finalPrimarySide === 'LONG') {
                    if (currentFinalScore < 85) {
                        currentFinalScore *= 0.5;
                        filterNote = " (Penalized: Trend Mismatch)";
                    } else {
                        filterNote = " (Decoupled Runner)";
                    }
                } else if (btcRegime === 'BULL' && finalPrimarySide === 'SHORT') {
                    if (currentFinalScore < 85) {
                        currentFinalScore *= 0.5;
                        filterNote = " (Penalized: Trend Mismatch)";
                    }
                }

                const chartPatterns = detectChartPatterns(highs, lows, prices, volumes);
                const MIN_SCORE = 60;

                if (currentFinalScore < MIN_SCORE) return;

                finalScore = currentFinalScore;
                detectionNote += filterNote;

                const decimals = signalPrice > 1000 ? 2 : signalPrice > 1 ? 4 : 6;
                const format = (n: number) => parseFloat(n.toFixed(decimals));
                const finalNote = isHighRisk ? `[⚠️ RIESGO ALTO] ${detectionNote}` : detectionNote;
                const vwapDist = ((signalPrice - vwap) / vwap) * 100;
                const signalTier = finalScore >= GOD_MODE_THRESHOLD ? '🔥 GOD MODE' : '⭐ PREMIUM';
                const session = getCurrentSessionSimple();
                const rrRatio = dcaPlan.entries.length > 0 && dcaPlan.stopLoss > 0
                    ? Math.abs((dcaPlan.takeProfits.tp3.price - dcaPlan.entries[0].price) / (dcaPlan.entries[0].price - dcaPlan.stopLoss))
                    : 0;

                const mathOpp: AIOpportunity = {
                    timeframe: interval, session: session.session, tier: tier,
                    riskRewardRatio: parseFloat(rrRatio.toFixed(2)),
                    id: Date.now().toString() + Math.random(),
                    symbol: coin.symbol, timestamp: Date.now(), signalTimestamp: candles[checkIndex].timestamp,
                    strategy: `${signalTier} (${marketRegime.regime})`,
                    side: signalSide, confidenceScore: Math.round(finalScore),
                    entryZone: {
                        min: format(dcaPlan.entries[2]?.price || signalPrice),
                        max: format(dcaPlan.entries[0]?.price || signalPrice),
                        aggressive: format(dcaPlan.entries[0]?.price || signalPrice),
                        signalPrice: format(signalPrice)
                    },
                    stopLoss: format(dcaPlan.stopLoss),
                    takeProfits: {
                        tp1: format(dcaPlan.takeProfits.tp1.price),
                        tp2: format(dcaPlan.takeProfits.tp2.price),
                        tp3: format(dcaPlan.takeProfits.tp3.price)
                    },
                    technicalReasoning: finalNote,
                    metrics: {
                        rvol: format(rvol), rsi: format(rsi), vwapDist: format(vwapDist),
                        structure: structureNote, specificTrigger: specificTrigger,
                        zScore: techIndicators.zScore, emaSlope: techIndicators.emaSlope,
                        rsiExpert: {
                            range: techIndicators.rsiExpert?.range || 'NEUTRAL',
                            target: techIndicators.rsiExpert?.target || null
                        },
                        isSqueeze: isSqueeze,
                        macdDivergence: macdDivergence?.description,
                        rsiDivergence: rsiDivergence?.description,
                        volumeExpert: volumeExpert // Updated in Place with divergence
                    },
                    chartPatterns: chartPatterns, dcaPlan: dcaPlan,
                    harmonicPatterns: harmonicPatterns, invalidated: false
                };

                validMathCandidates.push(mathOpp);
            }

        } catch (e) { return null; }
    }));

    const result = validMathCandidates.sort((a, b) => b.confidenceScore - a.confidenceScore).slice(0, 10);
    console.log(`[Scanner] SCAN COMPLETE. Found ${result.length} opportunities.`);
    return result;
};
