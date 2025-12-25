import { AIOpportunity, TradingStyle, TechnicalIndicators, MarketRisk } from "../types";
import { MacroContext } from './macroService';
import { analyzeIchimokuSignal } from './ichimokuStrategy'; // NEW: Expert Logic
import { generateDCAExecutionPlan } from './dcaReportGenerator'; // NEW: DCA System
import { detectBullishDivergence, calculateRSIArray } from './mathUtils'; // NEW: Divergence Detection
import { generateInvestmentThesis, generateExecutionPlanNarrative } from './narrativeService'; // Moved to top

// --- MOTOR AUTÓNOMO (OFFLINE) ---
// Este servicio reemplaza a la IA de Google.
// Ahora recibe DATOS DUROS (TechnicalIndicators) + MacroContext en lugar de intentar leer texto.

export const initializeGemini = (key: string) => {
    // No-op: No necesitamos inicializar nada externo.
    console.log("Sistema Autónomo Inicializado.");
};

export const resetSession = () => {
    // No-op
};

export const hasActiveSession = () => {
    return true; // Siempre activo en modo autónomo
};

export const streamMarketAnalysis = async function* (
    userMessage: string,
    marketContextString: string, // String educativo para display (legacy/backup)
    macroContext: MacroContext | null, // NEW: Objeto estructurado para lógica
    techData: TechnicalIndicators | null, // Strongly typed data
    strategyId: string, // Context aware logic
    riskProfile: MarketRisk // Market Risk integration
) {
    // Simular "pensamiento" para UX
    await new Promise(resolve => setTimeout(resolve, 800));

    // Normalización ROBUSTA: Simplemente a minúsculas, sin trucos de unicode complejos.
    const msg = userMessage.toLowerCase().trim();

    // 1. FAILSAFE: Si no hay datos técnicos (API Error)
    if (!techData) {
        yield `⚠️ **Error de Datos:** No pude recuperar las métricas precisas para este activo. Por favor, intenta de nuevo o revisa si el par es válido en Binance.`;
        return;
    }

    // 2. EXTRAER DATOS (YA NO SE PARSEA TEXTO, SE USAN OBJETOS)
    const {
        price, rsi, stochRsi, vwap, adx, atr, rvol, ema20, ema50, ema100, ema200,
        zScore, emaSlope, macd, bollinger, pivots, fibonacci, trendStatus,
        volumeProfile, orderBlocks, fairValueGaps, confluenceAnalysis,
        fractalAnalysis, harmonicPatterns, macdDivergence, isSqueeze, rsiExpert,
        chartPatterns // NEW: Smart Chart Patterns
    } = techData;

    // --- LÓGICA DE COMANDO: DETECCIÓN AMPLIA ---
    const isAnalysisRequest =
        msg.includes("analisis") ||
        msg.includes("análisis") ||
        msg.includes("generar") ||
        msg.includes("integral") ||
        msg.includes("estrategia") ||
        msg.includes("opinion") ||
        msg.includes("reporte") ||
        msg.includes("prediccion") ||
        msg.includes("ver") ||
        msg.includes("long") ||
        msg.includes("short") ||
        msg.includes("entrar");

    if (isAnalysisRequest) {
        let response = "";

        // --- PHASE 0: RISK CHECK ---
        const isHighRisk = riskProfile.level === 'HIGH';

        // --- PHASE 1: SCORING SYSTEM (MATRIX) ---
        let bullishScore = 0;
        let bearishScore = 0;

        // CRITICAL: Detect Range Market (ADX < 25)
        const isRangeMarket = adx < 25;
        const isHighVolatilityRange = isRangeMarket && bollinger.bandwidth > 8;

        // Trend Alignment (Structure) with SLOPE FILTER
        // Expert Rule: Only trust EMA200 if slope is significant (> 0.2 flat threshold example)
        if (price > ema200) {
            bullishScore += 2;
            if (emaSlope > 5) bullishScore += 1; // Strong Upward Slope match
        } else {
            bearishScore += 2;
            if (emaSlope < -5) bearishScore += 1; // Strong Downward Slope match
        }

        if (ema20 > ema50) bullishScore += 1; else bearishScore += 1;

        // NEW: VWAP Logic (Institutional Consensus)
        if (price > vwap) bullishScore += 1.5; else bearishScore += 1.5;

        // Momentum (RSI & MACD & StochRSI)
        if (macd.histogram > 0) bullishScore += 1.5; else bearishScore += 1.5;
        if (rsi > 50) bullishScore += 1; else bearishScore += 1;

        // StochRSI Cross Check
        if (stochRsi.k < 20 && stochRsi.k > stochRsi.d) bullishScore += 2; // Golden cross in oversold
        if (stochRsi.k > 80 && stochRsi.k < stochRsi.d) bearishScore += 2; // Death cross in overbought

        // Volatility Context (Bollinger)
        const inUpperZone = price > bollinger.middle;
        if (inUpperZone) bullishScore += 1; else bearishScore += 1;

        // NEW: Detect Market Extremes with Z-SCORE (Expert Veto)
        const isCapitulation = (rsi < 20 && rvol > 2) || (zScore && zScore < -2.0); // Panic selling or Statistical Extension
        const isEuphoria = (rsi > 80 && rvol > 2) || (zScore && zScore > 2.0); // FOMO buying or Statistical Extension

        // Z-Score Mean Reversion Boost
        if (zScore && zScore < -2.5) bullishScore += 4; // Extreme Oversold (Statistical) - Buy Value
        if (zScore && zScore > 2.5) bearishScore += 4; // Extreme Overbought (Statistical) - Sell Value

        if (isCapitulation) bullishScore += 3; // Contrarian signal
        if (isEuphoria) bearishScore += 3; // Contrarian signal

        // NEW: PINBALL STRATEGY DETECTION (Advisor Logic)
        let isPinballBuy = false;
        let isPinballSell = false;
        // Bullish Pinball: Price drops into zone between EMA50 and EMA200 in an Uptrend
        if (ema50 > ema200 && price < ema50 && price > ema200 && rsi < 45) {
            isPinballBuy = true;
            bullishScore += 3.5; // High Probability Swing
        }
        // Bearish Pinball: Price rallies into zone between EMA50 and EMA200 in a Downtrend
        if (ema50 < ema200 && price > ema50 && price < ema200 && rsi > 55) {
            isPinballSell = true;
            bearishScore += 3.5; // High Probability Swing
        }

        // NEW: LIQUIDATION CASCADE DETECTION (INSTITUCIONAL)
        const isLiquidationCascade = rvol > 3 && Math.abs(macd.histogram) > atr * 0.5;
        if (isLiquidationCascade) {
            if (rsi < 30) {
                bullishScore += 4; // Liquidaciones de longs = oportunidad de compra
            } else if (rsi > 70) {
                bearishScore += 4; // Liquidaciones de shorts = oportunidad de venta
            }
        }

        // NEW: Order Block Proximity Boost
        if (orderBlocks) {
            const { bullish, bearish } = orderBlocks;
            if (bullish && bullish.length > 0) {
                // HARDENING: Tolerance reduced to 0.5% (Sniper Mode)
                const nearOB = bullish.find(ob => ob && ob.price && Math.abs(price - ob.price) / price < 0.005);
                if (nearOB && nearOB.strength > 0.7) bullishScore += 2.5;
            }
            if (bearish && bearish.length > 0) {
                // HARDENING: Tolerance reduced to 0.5% (Sniper Mode)
                const nearOB = bearish.find(ob => ob && ob.price && Math.abs(price - ob.price) / price < 0.005);
                if (nearOB && nearOB.strength > 0.7) bearishScore += 2.5;
            }
        }

        // NEW: FAIR VALUE GAPS INTEGRATION (INSTITUCIONAL)
        if (fairValueGaps) {
            const { bullish, bearish } = fairValueGaps;
            if (bullish && bullish.length > 0) {
                // HARDENING: Tolerance reduced to 0.5% (Precision)
                const nearFVG = bullish.find(fvg =>
                    fvg && !fvg.filled && Math.abs(price - fvg.midpoint) / price < 0.005
                );
                if (nearFVG) {
                    bullishScore += 2; // FVG sin llenar = zona de imán
                }
            }
            if (bearish && bearish.length > 0) {
                // HARDENING: Tolerance reduced to 0.5% (Precision)
                const nearFVG = bearish.find(fvg =>
                    fvg && !fvg.filled && Math.abs(price - fvg.midpoint) / price < 0.005
                );
                if (nearFVG) {
                    bearishScore += 2;
                }
            }
        }

        // NEW: VOLUME PROFILE ANALYSIS (INSTITUCIONAL)
        if (volumeProfile) {
            const { poc, valueAreaHigh, valueAreaLow } = volumeProfile;
            const inValueArea = price >= valueAreaLow && price <= valueAreaHigh;

            if (!inValueArea) {
                if (price < valueAreaLow) {
                    bullishScore += 1.5; // Zona de descuento
                } else if (price > valueAreaHigh) {
                    bearishScore += 1.5; // Zona de premium
                }
            }
        }

        // NEW: HARMONIC PATTERNS (INSTITUCIONAL GEOMETRY)
        if (harmonicPatterns && harmonicPatterns.length > 0) {
            harmonicPatterns.forEach(pattern => {
                // Only consider patterns that are complete and recent (Logic implicit in detection)
                if (pattern.direction === 'BULLISH') {
                    bullishScore += 4; // High conviction pattern
                } else {
                    bearishScore += 4;
                }
            });
        }

        // NEW: MACD EXPERT LOGIC (Divergences & Squeeze)
        if (macdDivergence) {
            const isHidden = macdDivergence.type?.includes('HIDDEN');
            const isBullish = macdDivergence.type?.includes('BULLISH');

            // Expert Doc: Hidden Divergence is "Holy Grail" for continuation
            const boost = isHidden ? 5 : 3; // Massive boost for Hidden

            if (isBullish) bullishScore += boost;
            else bearishScore += boost;
        }

        // TTM Squeeze Logic
        if (isSqueeze) {
            // If squeezing, potential explosion. Bias towards break direction.
            // If price > ema20, likely expansion up.
            if (price > ema20) bullishScore += 2;
            else bearishScore += 2;
        }

        // --- PHASE 1.5: MACRO ADJUSTMENTS (NEW) ---
        // Aquí es donde el "Trader Experto" ajusta las probabilidades

        // SESSION ANALYSIS (TIME-BASED Legacy Removed - Uses TechData now)
        // Adjustments moved to reliance on techData.sessionAnalysis indirectly via bias check later if needed

        // --- NEW: SFP / LIQUIDITY SWEEP LOGIC (SWING FAILURE PATTERN) ---
        let isSFP = false;
        let sfpType = 'NONE';

        const distToR1 = Math.abs(price - pivots.r1) / price;
        const distToS1 = Math.abs(price - pivots.s1) / price;

        // Bearish SFP (Sweep Highs)
        if ((distToR1 < 0.005 || price > bollinger.upper) && rvol > 1.5) {
            if (stochRsi.k < stochRsi.d || rsi > 70) {
                bearishScore += 4;
                bullishScore *= 0.5;
                isSFP = true;
                sfpType = 'BEARISH_SWEEP';
            }
        }

        // Bullish SFP (Sweep Lows)
        if ((distToS1 < 0.005 || price < bollinger.lower) && rvol > 1.5) {
            if (stochRsi.k > stochRsi.d || rsi < 30) {
                bullishScore += 4;
                bearishScore *= 0.5;
                isSFP = true;
                sfpType = 'BULLISH_SWEEP';
            }
        }

        // CRITICAL: Range Market Kill Switch (SFP Aware)
        if (isHighVolatilityRange && !isSFP) {
            bullishScore *= 0.1;
            bearishScore *= 0.1;
        } else if (isRangeMarket && !isSFP && !isPinballBuy && !isPinballSell) { // Pinball respected in range
            bullishScore *= 0.5;
            bearishScore *= 0.5;
        }

        // Enhanced Risk Profile Integration
        if (riskProfile.level === 'HIGH') {
            bullishScore *= 0.5; // Más agresivo que antes (era 0.7 implícito)
            bearishScore *= 0.5;
        }

        if (macroContext) {
            const { btcRegime, btcDominance, usdtDominance } = macroContext;
            const isAlt = !techData.symbol.includes('BTC');

            // REGLA 1: Kill Switch (Volatilidad en Rango)
            if (btcRegime.volatilityStatus === 'HIGH' && btcRegime.regime === 'RANGE') {
                // Mercado peligroso, reducir confianza drásticamente
                bullishScore *= 0.3;
                bearishScore *= 0.3;
            }

            // REGLA 2: BTC Regime afecta alts (Correlación)
            if (isAlt) {
                if (btcRegime.regime === 'BEAR') {
                    bullishScore *= 0.5; // Penalizar LONGs en alts durante Bear de BTC
                } else if (btcRegime.regime === 'BULL' && btcDominance.trend === 'FALLING') {
                    bullishScore *= 1.2; // Alt Season boost
                }
            }

            // REGLA 3: USDT Dominance (Miedo/Fuga a Stablecoins)
            if (usdtDominance.trend === 'RISING') {
                bullishScore *= 0.6; // Mercado en pánico
                bearishScore *= 1.3; // Favorecer shorts
            }

            // NEW: EXPERT VOLUME ANALYSIS LOGIC (SMART MONEY)
            if (techData.volumeExpert) {
                const { derivatives, coinbasePremium, cvd, liquidity } = techData.volumeExpert;

                // 0. LIQUIDATION MAGNETS (GOD TIER)
                if (liquidity?.liquidationClusters && liquidity.liquidationClusters.length > 0) {
                    const closest = liquidity.liquidationClusters[0];
                    const dist = Math.abs((closest.priceMin - price) / price);
                    if (dist < 0.02) { // Within 2%
                        if (closest.type === 'SHORT_LIQ') {
                            bullishScore += 4; // Magnet Pull Up
                        } else if (closest.type === 'LONG_LIQ') {
                            bearishScore += 4; // Magnet Pull Down
                        }
                    }
                }

                // 0.5 ORDERBOOK WALLS (GOD TIER)
                if (liquidity?.orderBook) {
                    if (liquidity.orderBook.bidWall && liquidity.orderBook.bidWall.strength > 50) {
                        const dist = Math.abs((price - liquidity.orderBook.bidWall.price) / price);
                        if (dist < 0.03) bullishScore += 3; // Support Wall
                    }
                    if (liquidity.orderBook.askWall && liquidity.orderBook.askWall.strength > 50) {
                        const dist = Math.abs((liquidity.orderBook.askWall.price - price) / price);
                        if (dist < 0.03) bearishScore += 3; // Resistance Wall
                    }
                }

                // 1. Funding Rate Extremes (Contrarian)
                if (derivatives.fundingRate > 0.05) { // Extreme Greed
                    bearishScore += 3; // Short Squeeze likely
                } else if (derivatives.fundingRate < -0.05) { // Extreme Fear
                    bullishScore += 3; // Long Squeeze likely
                }

                // 2. Coinbase Premium (Institutional Conviction)
                if (coinbasePremium.signal === 'INSTITUTIONAL_BUY') {
                    bullishScore += 4; // High Trust Signal
                } else if (coinbasePremium.signal === 'INSTITUTIONAL_SELL') {
                    bearishScore += 4;
                }

                // 3. CVD Divergences (Microstructure Verification)
                if (cvd.divergence) {
                    // NEW: ABSORPTION LOGIC (World Class)
                    if (cvd.divergence === 'CVD_ABSORPTION_BUY') {
                        bullishScore += 4; // Whale Absorption (Passive Buys)
                    } else if (cvd.divergence === 'CVD_ABSORPTION_SELL') {
                        bearishScore += 4; // Whale Absorption (Passive Sells)
                    }
                }

                if (cvd.trend === 'BEARISH' && !cvd.divergence?.includes('ABSORPTION')) {
                    // Aggressors Selling -> Penalize Longs
                    bullishScore -= 1;
                } else if (cvd.trend === 'BULLISH' && !cvd.divergence?.includes('ABSORPTION')) {
                    // Aggressors Buying -> Penalize Shorts
                    bearishScore -= 1;
                }
            }

            // NEW: RSI TRENDLINE BREAKS (Leading Indicator)
            if (rsiExpert && rsiExpert.trendlineBreak && rsiExpert.trendlineBreak.detected) {
                if (rsiExpert.trendlineBreak.direction === 'BULLISH') {
                    bullishScore += 3; // Early Momentum Shift
                } else if (rsiExpert.trendlineBreak.direction === 'BEARISH') {
                    bearishScore += 3;
                }
            }

            // REGLA 4: BTC CRASH MODE (NUEVO - Dynamic Sensitivity)
            // Si BTC está en caída libre (Alta volatilidad + Bear), bloquear longs
            if (btcRegime.regime === 'BEAR' && btcRegime.volatilityStatus === 'HIGH' && isAlt) {
                bullishScore = 0; // Hard Block
                bearishScore *= 1.5; // Sniper Short Opportunity
                techData.technicalReasoning += "\nCRITICAL: BTC CRASH MODE ACTIVO. Longs bloqueados por seguridad sistémica.";
            }

            // REGLA 4: Sniper Shorts (Liquidez)
            if (isAlt && btcRegime.regime === 'BEAR' &&
                (btcDominance.trend === 'RISING' || usdtDominance.trend === 'RISING')) {
                bearishScore *= 1.5; // Boost shorts en alts
            }
        }

        let sentiment = "NEUTRO";
        let mainIcon = "⚪";

        // Recalculate sentiment after Tie-Breaker
        const finalIsBullish = bullishScore > bearishScore;
        const finalPrimarySide = finalIsBullish ? 'LONG' : 'SHORT';

        if (bullishScore > bearishScore + 2) { sentiment = "ALCISTA (BULLISH)"; mainIcon = "🟢"; }
        else if (bearishScore > bullishScore + 2) { sentiment = "BAJISTA (BEARISH)"; mainIcon = "🔴"; }

        // Confidence Calculation (0-10 Scale normalized)
        const winningScore = finalIsBullish ? bullishScore : bearishScore;
        let confidenceLevel = Math.min(Math.round(winningScore), 10);



        // Context for Narrative
        const narrativeContext = {
            symbol: techData.symbol,
            price: price,
            technicalIndicators: techData,
            marketRegime: { regime: 'UNKNOWN', confidence: 0 } as any,
            sentiment: sentiment.includes('ALCISTA') ? 'BULLISH' : sentiment.includes('BAJISTA') ? 'BEARISH' : 'NEUTRAL',
            confidenceScore: confidenceLevel
        };

        if (techData.marketRegime) {
            narrativeContext.marketRegime = techData.marketRegime;
        }

        // 1. GENERATE NARRATIVES (AI) - Parallel Execution
        const [investmentThesis, executionPhilosophy] = await Promise.all([
            generateInvestmentThesis(narrativeContext as any),
            generateExecutionPlanNarrative(narrativeContext as any, finalPrimarySide)
        ]);

        // Calculate God Mode LOCALLY for Summary (it was used in legacy code below, we need it here)
        let isGodMode = false;
        let weakTrendWarning = false;
        let cycleText = "N/A";
        let isAlignedCycle = true;

        let trend_1w = techData.fractalAnalysis?.trend_1w;

        // FRACTAL & GOD MODE CALCULATION (Restored)
        if (techData.fractalAnalysis) {
            const { trend_1h, trend_4h, trend_1d } = techData.fractalAnalysis;
            const isAligned1h = (sentiment.includes('ALCISTA') && trend_1h === 'BULLISH') || (sentiment.includes('BAJISTA') && trend_1h === 'BEARISH');
            let isAligned4h = true;
            if (trend_4h) isAligned4h = (sentiment.includes('ALCISTA') && trend_4h === 'BULLISH') || (sentiment.includes('BAJISTA') && trend_4h === 'BEARISH');
            let isAligned1d = true;
            if (trend_1d) isAligned1d = (sentiment.includes('ALCISTA') && trend_1d === 'BULLISH') || (sentiment.includes('BAJISTA') && trend_1d === 'BEARISH');

            // Cycle Logic
            if (trend_1w) {
                const rsi1w = techData.fractalAnalysis.rsi_1w || 50;
                const tempSentiment = bullishScore > bearishScore ? 'ALCISTA' : 'BAJISTA';
                isAlignedCycle = (tempSentiment === 'ALCISTA' && trend_1w === 'BULLISH') || (tempSentiment === 'BAJISTA' && trend_1w === 'BEARISH');

                if (trend_1w === 'BEARISH' && rsi1w < 35) { weakTrendWarning = true; isAlignedCycle = false; }
                if (trend_1w === 'BULLISH' && rsi1w > 75) { weakTrendWarning = true; isAlignedCycle = false; }
            }

            isGodMode = isAligned1h && isAligned4h && isAligned1d && isAlignedCycle && !weakTrendWarning;
        }

        // TIE BREAKER: If Technical Draw + Weak Trend Warning -> Penalize Confidence heavily
        const scoreDiff = Math.abs(bullishScore - bearishScore);
        if (scoreDiff < 2 && techData.fractalAnalysis?.trend_1w && !weakTrendWarning) {
            if (techData.fractalAnalysis.trend_1w === 'BULLISH') {
                bullishScore += 3;
            } else {
                bearishScore += 3;
            }
        }

        // DOWNGRADE CONFIDENCE IF NOT ALIGNED (Institutional Rule)
        if (!isGodMode && confidenceLevel >= 8) {
            confidenceLevel = 7;
        }

        // 2. CONSTRUCT RESPONSE
        response += `> [!IMPORTANT]\n`;
        response += `> **SEÑAL INSTITUCIONAL: ${finalPrimarySide} (Confianza ${confidenceLevel}/10)**\n`;

        // Add Summary Alerts
        if (weakTrendWarning) {
            response += `> ⚠️ **ALERTA CRÍTICA:** Tendencia Semanal Agotada (RSI Oversold/Overbought). Rebote inminente. Riesgo extremo.\n`;
        } else if (isSFP) {
            response += `> ⚡ **ALERTA SFP:** ${sfpType === 'BEARISH_SWEEP' ? 'Barrido Bajista' : 'Barrido Alcista'} confirmado. Entrada de alta precisión.\n`;
        } else if (isGodMode) {
            response += `> 💎 **MODO DIOS:** Alineación total de timeframes (15m-1W). Probabilidad Institucional.\n`;
        } else if (techData.volumeExpert?.cvd?.divergence?.includes('ABSORPTION')) {
            response += `> 🐋 **ALERTA BALLENAS:** Absorción Institucional Detectada. El "Smart Money" está posicionado.\n`;
        }

        response += `> *${investmentThesis}*\n\n`; // Insert AI Thesis here

        // ... (Keep existing structured tables as they are deterministic and good) ...

        // HEADER
        response += `# Evaluación de Riesgo y Estrategia Táctica para ${techData.symbol}\n\n`;

        // I. DIAGNÓSTICO OPERACIONAL
        response += `## I. Diagnóstico Operacional: Conflicto Estructural (Macro vs. Micro)\n\n`;
        response += `| Métrica Clave | Lectura | Interpretación (Institutional Bias) |\n`;
        response += `|---|---|---|\n`;

        // NEW: Advanced Session Analysis
        if (techData.sessionAnalysis) {
            const { currentSession, activeNote, judasSwing, bias } = techData.sessionAnalysis;
            const sessionIcon = currentSession === 'ASIA' ? '🌏' : currentSession === 'LONDON' ? '🇪🇺' : currentSession === 'NEW_YORK' ? '🇺🇸' : '🌑';

            let biasIcon = bias === 'BULLISH' ? '🟢' : bias === 'BEARISH' ? '🔴' : '⚪';
            let judasNote = "";

            if (judasSwing === 'BULLISH_REVERSAL') {
                judasNote = " 🐢 **TURTLE SOUP LONG Detectado** (Falso quiebre bajista).";
                biasIcon = "🟢🔥";
            } else if (judasSwing === 'BEARISH_REVERSAL') {
                judasNote = " 🐢 **TURTLE SOUP SHORT Detectado** (Falso quiebre alcista).";
                biasIcon = "🔴🔥";
            }

            response += `| **Sesión de Mercado** | ${sessionIcon} **${currentSession}** ${biasIcon} | ${activeNote}${judasNote} |\n`;
        } else {
            // Fallback
            response += `| **Sesión de Mercado** | ⚠️ N/A | Datos insuficientes para análisis de ORB. |\n`;
        }

        // NEW: CRASH MODE FEEDBACK IN TABLE
        if (techData.technicalReasoning.includes('BTC CRASH MODE')) {
            response += `| **🚨 ALERTA SISTÉMICA** | 📉 **CRASH MODE** | **LONGS BLOQUEADOS.** BTC cayendo con violencia. |\n`;
        }

        const trendNote = isRangeMarket
            ? "⚠️ Mercado en RANGO. Evitar operar hasta breakout."
            : finalPrimarySide === 'LONG'
                ? "Impulso local alcista, buscando captura de liquidez."
                : "Debilidad estructural, buscando ventas en zonas premium.";

        response += `| **Diagnóstico Táctico (15m)** | ${mainIcon} ${sentiment} | ${trendNote} |\n`;
        response += `| **Score de Fuerza** | Bulls ${bullishScore.toFixed(1)} vs Bears ${bearishScore.toFixed(1)} | Confirma el bias direccional: **${finalPrimarySide}** |\n`;
        if (zScore !== undefined) {
            const zStatus = zScore > 2 ? 'SOBRECOMPRA (Extrema)' : zScore < -2 ? 'SOBREVENTA (Extrema)' : 'Normal (Mean Reversion)';
            response += `| **Z-Score (Desviación)** | ${zScore.toFixed(2)}σ | ${zStatus} - ${Math.abs(zScore) > 2 ? '⚠️ Posible Reversión' : 'Tendencia Sostenible'} |\n`;
        }
        if (emaSlope !== undefined) {
            const slopeStatus = Math.abs(emaSlope) < 1 ? 'PLANA (Rango)' : emaSlope > 0 ? 'ALCISTA' : 'BAJISTA';
            response += `| **Pendiente EMA200** | ${emaSlope.toFixed(2)}° | ${slopeStatus} |\n`;
        }

        if (macroContext) {
            const { btcRegime } = macroContext;
            const regimeIcon = btcRegime.regime === 'BULL' ? '🟢' : btcRegime.regime === 'BEAR' ? '🔴' : '🟡';
            response += `| **Régimen Macro (Diario)** | ${regimeIcon} ${btcRegime.regime} (${btcRegime.strength}% Fuerza) | El factor de riesgo predominante. |\n`;
        }

        // III. ESTRUCTURA TÁCTICA 
        response += `\n## III. Estructura Táctica y Refinamiento del Punto de Interés (POI)\n`;

        // NEW: FRACTAL ANALYSIS SECTION
        if (techData.fractalAnalysis) {
            const { trend_1h, price_1h, price_1w } = techData.fractalAnalysis;
            const { trend_4h, trend_1d } = techData.fractalAnalysis;

            // Use the locally calculated GodMode
            const localGodMode = isGodMode;

            // Recalculate aligned flags just for the table icons display if needed, OR simplify
            const isAligned1h = (sentiment.includes('ALCISTA') && trend_1h === 'BULLISH') || (sentiment.includes('BAJISTA') && trend_1h === 'BEARISH');
            const isAligned4h = (!trend_4h) || (sentiment.includes('ALCISTA') && trend_4h === 'BULLISH') || (sentiment.includes('BAJISTA') && trend_4h === 'BEARISH');

            const fractalIcon = localGodMode ? "🚀🚀" : (confidenceLevel >= 7) ? "💎" : "⚠️";
            let fractalStatus = "Alineación Total (INSTITUCIONAL)";

            if (weakTrendWarning) fractalStatus = "Alerta: Tendencia Semanal perdiendo fuerza.";
            else if (localGodMode) fractalStatus = "GOD MODE (Alineación 15m a 1W sin Agotamiento)";
            else fractalStatus = "Estructura Mixta (Operar con precaución)";

            response += `### 3.3. Validación Fractal (Validación de Ciclo)\n`;
            response += `| Estructura | Estado | Análisis |\n|---|---|---|\n`;
            response += `| **Tendencia Táctica (1H)** | ${trend_1h === 'BULLISH' ? '🟢 Alcista' : '🔴 Bajista'} | Precio ($${price_1h}) vs EMA200. |\n`;
            if (trend_1w) {
                const rsiWDisplay = techData.fractalAnalysis?.rsi_1w ? `RSI: ${techData.fractalAnalysis.rsi_1w.toFixed(1)}` : '';
                response += `| **Ciclo de Mercado (1W)** | ${trend_1w === 'BULLISH' ? '🐂 Bull' : '🐻 Bear'} | Precio $${price_1w} vs EMA50. ${rsiWDisplay} |\n`;
            }
            response += `| **Veredicto Final** | ${fractalIcon} ${fractalStatus} | ${localGodMode ? '🌊 **Tsunami Institucional:** Toda la liquidez empuja en la misma dirección.' : 'Operar con precaución.'} |\n\n`;
        }

        if (harmonicPatterns && harmonicPatterns.length > 0) {
            response += `### 3.4. Geometría de Mercado (Patrones Armónicos)\n`;
            response += `| Patrón | Dirección | Confianza | PRZ (Zona) |\n`;
            response += `|---|---|---|---|\n`;
            harmonicPatterns.forEach(p => {
                const icon = p.direction === 'BULLISH' ? '🟢' : '🔴';
                response += `| **${p.type}** | ${icon} ${p.direction} | ${p.confidence}% | $${p.prz.toFixed(4)} |\n`;
            });
            response += `> *Validación matemática de proporciones 0.618/0.786/0.886 exitosa.*\n\n`;
        }

        // NEW: MACD EXPERT DIAGNOSIS
        if (macdDivergence || isSqueeze) {
            response += `### 3.5. Diagnóstico MACD Experto (Momentum Avanzado)\n`;
            response += `| Métrica | Estado | Interpretación |\n`;
            response += `|---|---|---|\n`;

            if (isSqueeze) {
                response += `| **Volatilidad** | ⚡ **TTM SQUEEZE** | Compresión extrema. Explosión inminente. |\n`;
            }
            if (macdDivergence) {
                const icon = macdDivergence.type?.includes('BULLISH') ? '🟢' : '🔴';
                response += `| **Divergencia** | ${icon} **${macdDivergence.type}** | ${macdDivergence.description} |\n`;
            }
            response += `\n`;
        }

        // NEW: RSI EXPERT DIAGNOSIS (Cardwell/Brown)
        if (rsiExpert) {
            response += `### 3.6. Diagnóstico RSI Experto (Estructura de Mercado)\n`;
            response += `| Análisis | Estado | Detalle |\n`;
            response += `|---|---|---|\n`;

            // Range Analysis
            const rangeIcon = rsiExpert.range.includes('BULL') ? '🐂' : rsiExpert.range.includes('BEAR') ? '🐻' : '⚖️';
            response += `| **Régimen RSI** | ${rangeIcon} **${rsiExpert.range.replace('_', ' ')}** | Definido por reglas de rango expertas. |\n`;

            // NEW: Trendline Break Display
            if (rsiExpert.trendlineBreak && rsiExpert.trendlineBreak.detected) {
                const direction = rsiExpert.trendlineBreak.direction;
                response += `| **Ruptura Tendencial** | ${direction === 'BULLISH' ? '🟢' : '🔴'} **BREAKOUT** | El RSI ha roto su línea de tendencia geométrica. Señal adelantada. |\n`;
            }

            // Target Analysis
            if (rsiExpert.target) {
                const targetIcon = rsiExpert.targetType === 'POSITIVE' ? '🟢' : '🔴';
                response += `| **Proyección** | ${targetIcon} **$${rsiExpert.target.toLocaleString()}** | Reversión detectada. |\n`;
            }
            response += `\n`;
        }

        // NEW: EXPERT VOLUME ANALYSIS (Institutional Flow)
        if (techData.volumeExpert) {
            const { derivatives, cvd, coinbasePremium, liquidity } = techData.volumeExpert;

            response += `### 3.7. Análisis de Flujo Institucional (Smart Money)\n`;
            response += `| Métrica | Valor | Interpretación |\n`;
            response += `|---|---|---|\n`;

            // Coinbase Premium
            const premiumIcon = coinbasePremium.signal === 'INSTITUTIONAL_BUY' ? '🟢' : coinbasePremium.signal === 'INSTITUTIONAL_SELL' ? '🔴' : '⚖️';
            const premiumReason = coinbasePremium.signal === 'INSTITUTIONAL_BUY' ? 'Compras Institucionales (Coinbase > Binance)' : coinbasePremium.signal === 'INSTITUTIONAL_SELL' ? 'Ventas Institucionales (Coinbase < Binance)' : 'Sin arbitraje significativo';
            response += `| **Coinbase Premium** | ${premiumIcon} ${(coinbasePremium.gapPercent * 100).toFixed(4)}% | ${premiumReason} |\n`;

            // Funding Rate
            const fundingIcon = Math.abs(derivatives.fundingRate) > 0.05 ? '⚠️' : 'ℹ️';
            response += `| **Funding Rate** | ${fundingIcon} ${derivatives.fundingRate.toFixed(4)}% | Sentimiento de derivados: ${derivatives.fundingRate > 0.01 ? 'Bullish (Caro)' : derivatives.fundingRate < -0.01 ? 'Bearish (Descuento)' : 'Neutral'}. |\n`;

            // CVD
            const cvdIcon = cvd.trend === 'BULLISH' ? '🟢' : cvd.trend === 'BEARISH' ? '🔴' : '⚖️';
            const cvdDivText = cvd.divergence ? `⚠️ **${cvd.divergence.replace(/_/g, ' ')}**` : 'Tendencia Confirmada';

            response += `| **CVD Sintético** | ${cvdIcon} ${cvd.trend} | ${cvdDivText} |\n`;

            // Open Interest
            response += `| **Interés Abierto** | 💰 $${(derivatives.openInterestValue / 1000000).toFixed(2)}M | Capital total activo en futuros. |\n`;

            // Orderbook & Liquidity (God Tier)
            if (liquidity) {
                response += `\n| **Liquidez (God Tier)** | **Estado** | **Detalle** |\n`;
                response += `|---|---|---|\n`;

                if (liquidity.liquidationClusters && liquidity.liquidationClusters.length > 0) {
                    // Show top 2 clusters
                    liquidity.liquidationClusters.slice(0, 2).forEach(c => {
                        const typeIcon = c.type === 'SHORT_LIQ' ? '🧲🟢' : '🧲🔴';
                        const typeName = c.type === 'SHORT_LIQ' ? 'Imán Alcista (Short Liqs)' : 'Imán Bajista (Long Liqs)';
                        response += `| **${typeName}** | ${typeIcon} | Zona $${c.priceMin.toFixed(2)} - $${c.priceMax.toFixed(2)} (x${c.strength} leverage) |\n`;
                    });
                }

                if (liquidity.orderBook) {
                    if (liquidity.orderBook.bidWall) {
                        response += `| **Muro de Compra** | 🧱🟢 Soporte | $${liquidity.orderBook.bidWall.price.toFixed(2)} (Fuerza: ${liquidity.orderBook.bidWall.strength}) |\n`;
                    }
                    if (liquidity.orderBook.askWall) {
                        response += `| **Muro de Venta** | 🧱🔴 Resistencia | $${liquidity.orderBook.askWall.price.toFixed(2)} (Fuerza: ${liquidity.orderBook.askWall.strength}) |\n`;
                    }
                }
            }

            response += `\n`;
        }

        // NEW: SMART CHART PATTERNS (Classical Geometry)
        if (chartPatterns && chartPatterns.length > 0) {
            response += `### 3.8. Geometría Clásica Inteligente (Smart Patterns)\n`;
            response += `| Patrón | Señal | Confianza | Detalle |\n`;
            response += `|---|---|---|---|\n`;

            chartPatterns.forEach(p => {
                const icon = p.signal === 'BULLISH' ? '🟢' : '🔴';
                response += `| **${p.type}** | ${icon} ${p.signal} | ${(p.confidence * 100).toFixed(0)}% | ${p.description} |\n`;
            });
            response += `> *Patrones filtrados por volumen y fractales (Anti-Retail Trap).*\n\n`;
        }

        // IV. PLAN DE EJECUCIÓN DCA
        const scenarioA_Score = finalIsBullish ? bullishScore : bearishScore;
        const scenarioB_Score = finalIsBullish ? bearishScore : bullishScore;
        const scenarioA_Conf = Math.min(Math.round(scenarioA_Score), 10);
        const scenarioB_Conf = Math.min(Math.round(scenarioB_Score), 10);

        const scenarioATitle = `## IV.A Escenario Principal: ${finalPrimarySide === 'LONG' ? 'COMPRA (LONG)' : 'VENTA (SHORT)'} (Confianza: ${scenarioA_Conf}/10)`;

        response += generateDCAExecutionPlan(
            price, atr, fibonacci, confluenceAnalysis as any,
            techData.marketRegime, finalPrimarySide,
            scenarioATitle, rsiExpert, macroContext,
            executionPhilosophy, // Passed from AI
            techData.tier, // NEW: Tier logic
            techData.harmonicPatterns || [] // NEW: Structural Stops
        );

        // ESCENARIO B: ALTERNATIVO (HEDGING)
        const secondarySide = finalPrimarySide === 'LONG' ? 'SHORT' : 'LONG';
        const scenarioBTitle = `## IV.B Escenario Alternativo (Cobertura): ${secondarySide === 'LONG' ? 'COMPRA (LONG)' : 'VENTA (SHORT)'} (Confianza: ${scenarioB_Conf}/10)`;

        // Note: We don't generate AI philosophy for Scenario B to save tokens/time, or we could. 
        // For now, let it fallback to default text by passing undefined.
        response += generateDCAExecutionPlan(
            price, atr, fibonacci, confluenceAnalysis as any,
            techData.marketRegime, secondarySide,
            scenarioBTitle, rsiExpert, macroContext,
            undefined, // No philosophy for B
            techData.tier, // NEW: Tier logic
            techData.harmonicPatterns || [] // NEW: Structural Stops
        );

        yield response;
    }
    // ... Legacy conversational logic ...
    else if (msg.includes('riesgo') || msg.includes('stop') || msg.includes('sl')) {
        yield `### 🛡️ Clase de Gestión de Riesgo (ATR)\nEl ATR (Average True Range) mide cuánto se mueve el precio en promedio por vela. Úsalo para colocar tu Stop Loss fuera del "ruido" normal.\n\n**Datos actuales:**\n- ATR: $${atr.toFixed(4)}\n\n**Cálculo de Stop Loss (LONG vs SHORT):**\n- **LONG (Compra):** Precio Entrada - (1.5 x ATR)\n- **SHORT (Venta):** Precio Entrada + (1.5 x ATR)\n\n**Ejemplo Práctico:**\n- Long: $${(price - (atr * 1.5)).toFixed(4)}\n- Short: $${(price + (atr * 1.5)).toFixed(4)}\n\n*Regla de Oro: Si tu SL está muy lejos, reduce el tamaño de tu posición para mantener el riesgo en dólares constante.*`;
    }
    else {
        yield `**Sistema Autónomo:** Datos capturados para **${techData.symbol}**.\n\n`;
        yield `📊 **Resumen Rápido:**\n• Precio: $${price}\n• Tendencia: ${price > ema200 ? '✅ Alcista' : '🔻 Bajista'}\n\nℹ️ _Mensaje recibido: "${msg}". Escribe "Analisis" para ver el reporte experto._`;
    }
};

// Helper to format strategy name nicely
const formatStrategyName = (id: string) => {
    switch (id) {
        case 'smc_liquidity': return "SMC (Conceptos de Dinero Inteligente)";
        case 'quant_volatility': return "Quant & Momentum (Matemático)";
        case 'ichimoku_dragon': return "Ichimoku Cloud (Equilibrio)";
        case 'meme_hunter': return "Meme Hunter (Alto Riesgo)";
        default: return "Acción de Precio Estándar";
    }
}
