
import { AIOpportunity, TradingStyle, TechnicalIndicators, MarketRisk } from "../types";
import { MacroContext } from './macroService';
import { analyzeIchimokuSignal } from './ichimokuStrategy'; // NEW: Expert Logic
import { generateDCAExecutionPlan } from './dcaReportGenerator'; // NEW: DCA System
import { detectBullishDivergence, calculateRSIArray, getMarketSession } from './mathUtils'; // NEW: Divergence Detection

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
    const { price, rsi, stochRsi, vwap, adx, atr, rvol, ema20, ema50, ema100, ema200, macd, bollinger, pivots, fibonacci, trendStatus, volumeProfile, orderBlocks, fairValueGaps, confluenceAnalysis, fractalAnalysis } = techData;

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

        // Trend Alignment (Structure)
        if (price > ema200) bullishScore += 2; else bearishScore += 2;
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

        // NEW: Detect Market Extremes
        const isCapitulation = rsi < 20 && rvol > 2; // Panic selling
        const isEuphoria = rsi > 80 && rvol > 2; // FOMO buying

        if (isCapitulation) bullishScore += 3; // Contrarian signal
        if (isEuphoria) bearishScore += 3; // Contrarian signal

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
        // --- PHASE 1.5: MACRO ADJUSTMENTS (NEW) ---
        // Aquí es donde el "Trader Experto" ajusta las probabilidades

        // SESSION ANALYSIS (TIME-BASED)
        const activeSession = getMarketSession();

        // Session-based Scoring Adjustments
        if (activeSession.session === 'ASIA') {
            if (isRangeMarket) { bullishScore += 0.5; bearishScore += 0.5; }
            else if (rvol < 2.5) { bullishScore *= 0.8; bearishScore *= 0.8; }
        } else if (activeSession.session === 'LONDON') {
            if (!isRangeMarket) { bullishScore *= 1.1; bearishScore *= 1.1; }
        } else if (activeSession.session === 'NEW_YORK') {
            // NY introduces volatility + reversals
        }

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
        } else if (isRangeMarket && !isSFP) {
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

            // REGLA 4: Sniper Shorts (Liquidez)
            if (isAlt && btcRegime.regime === 'BEAR' &&
                (btcDominance.trend === 'RISING' || usdtDominance.trend === 'RISING')) {
                bearishScore *= 1.5; // Boost shorts en alts
            }
        }
        // --- NEW: FRACTAL & WEAKNESS PRE-CALCULATION (Lifted for Executive Summary) ---
        let weakTrendWarning = false;
        let trend_1w = techData.fractalAnalysis?.trend_1w;
        let cycleText = "N/A";
        let isAlignedCycle = true;

        if (techData.fractalAnalysis && trend_1w) {
            const rsi1w = techData.fractalAnalysis.rsi_1w || 50;
            const tempSentiment = bullishScore > bearishScore ? 'ALCISTA' : 'BAJISTA';

            isAlignedCycle = (tempSentiment === 'ALCISTA' && trend_1w === 'BULLISH') ||
                (tempSentiment === 'BAJISTA' && trend_1w === 'BEARISH');

            cycleText = trend_1w === 'BULLISH' ? '🐂 Bull Cycles' : '🐻 Bear Winter';

            if (trend_1w === 'BEARISH' && rsi1w < 35) {
                cycleText += " (Agotado/Oversold)";
                weakTrendWarning = true;
                isAlignedCycle = false;
            }
            if (trend_1w === 'BULLISH' && rsi1w > 75) {
                cycleText += " (Euphoria/Overbought)";
                weakTrendWarning = true;
                isAlignedCycle = false;
            }
        }

        let sentiment = "NEUTRO";
        let mainIcon = "⚪";

        // TIE BREAKER: If Technical Draw + Weak Trend Warning -> Penalize Confidence heavily
        const scoreDiff = Math.abs(bullishScore - bearishScore);
        if (scoreDiff < 2 && techData.fractalAnalysis?.trend_1w && !weakTrendWarning) {
            if (techData.fractalAnalysis.trend_1w === 'BULLISH') {
                bullishScore += 3;
            } else {
                bearishScore += 3;
            }
        }

        // Recalculate sentiment after Tie-Breaker
        const finalIsBullish = bullishScore > bearishScore;
        const finalPrimarySide = finalIsBullish ? 'LONG' : 'SHORT';

        if (bullishScore > bearishScore + 2) { sentiment = "ALCISTA (BULLISH)"; mainIcon = "🟢"; }
        else if (bearishScore > bullishScore + 2) { sentiment = "BAJISTA (BEARISH)"; mainIcon = "🔴"; }

        // Confidence Calculation (0-10 Scale normalized)
        const winningScore = finalIsBullish ? bullishScore : bearishScore;
        let confidenceLevel = Math.min(Math.round(winningScore), 10);

        // --- PHASE 2: GENERATE REPORT (INSTITUTIONAL FORMAT) ---

        // 0. FLASH EXECUTIVE SUMMARY (NEW)
        // Calculate God Mode for Summary
        let isGodMode = false;
        if (techData.fractalAnalysis) {
            const { trend_1h, trend_4h, trend_1d } = techData.fractalAnalysis;
            const isAligned1h = (sentiment.includes('ALCISTA') && trend_1h === 'BULLISH') || (sentiment.includes('BAJISTA') && trend_1h === 'BEARISH');
            let isAligned4h = true;
            if (trend_4h) isAligned4h = (sentiment.includes('ALCISTA') && trend_4h === 'BULLISH') || (sentiment.includes('BAJISTA') && trend_4h === 'BEARISH');
            let isAligned1d = true;
            if (trend_1d) isAligned1d = (sentiment.includes('ALCISTA') && trend_1d === 'BULLISH') || (sentiment.includes('BAJISTA') && trend_1d === 'BEARISH');
            isGodMode = isAligned1h && isAligned4h && isAligned1d && isAlignedCycle && !weakTrendWarning;
        }

        // DOWNGRADE CONFIDENCE IF NOT ALIGNED
        if (!isGodMode && confidenceLevel >= 8) {
            confidenceLevel = 7;
        }

        response += `> [!IMPORTANT]\n`;
        response += `> **SEÑAL INSTITUCIONAL: ${finalPrimarySide} (Confianza ${confidenceLevel}/10)**\n`;

        if (weakTrendWarning) {
            response += `> ⚠️ **ALERTA CRÍTICA:** Tendencia Semanal Agotada (RSI Oversold/Overbought). Rebote inminente. Riesgo extremo.\n`;
        } else if (isSFP) {
            response += `> ⚡ **ALERTA SFP:** ${sfpType === 'BEARISH_SWEEP' ? 'Barrido Bajista' : 'Barrido Alcista'} confirmado. Entrada de alta precisión.\n`;
        } else if (isGodMode) {
            response += `> 💎 **MODO DIOS:** Alineación total de timeframes (15m-1W). Probabilidad Institucional.\n`;
        } else if (confidenceLevel >= 7) {
            response += `> 🔥 **ALTA CONVICCIÓN:** Estructura técnica sólida (sin alineación total).\n`;
        } else if (confidenceLevel <= 5) {
            response += `> 🟡 **CORRECCIÓN/RANGO:** Conflicto Técnico. Reducir tamaño de posición.\n`;
        }
        response += `\n`;

        // HEADER
        response += `# Evaluación de Riesgo y Estrategia Táctica para ${techData.symbol}\n\n`;

        // I. DIAGNÓSTICO OPERACIONAL
        response += `## I. Diagnóstico Operacional: Conflicto Estructural (Macro vs. Micro)\n\n`;
        response += `| Métrica Clave | Lectura | Interpretación (Institutional Bias) |\n`;
        response += `|---|---|---|\n`;
        const sessionIcon = activeSession.session === 'ASIA' ? '🌏' : activeSession.session === 'LONDON' ? '🇪🇺' : '🇺🇸';
        response += `| **Sesión de Mercado** | ${sessionIcon} **${activeSession.session}** | ${activeSession.note} |\n`;

        const trendNote = isRangeMarket
            ? "⚠️ Mercado en RANGO. Evitar operar hasta breakout."
            : finalPrimarySide === 'LONG'
                ? "Impulso local alcista, buscando captura de liquidez."
                : "Debilidad estructural, buscando ventas en zonas premium.";

        response += `| **Diagnóstico Táctico (15m)** | ${mainIcon} ${sentiment} | ${trendNote} |\n`;
        response += `| **Score de Fuerza** | Bulls ${bullishScore.toFixed(1)} vs Bears ${bearishScore.toFixed(1)} | Confirma el bias direccional: **${finalPrimarySide}** |\n`;

        if (macroContext) {
            const { btcRegime } = macroContext;
            const regimeIcon = btcRegime.regime === 'BULL' ? '🟢' : btcRegime.regime === 'BEAR' ? '🔴' : '🟡';
            response += `| **Régimen Macro (Diario)** | ${regimeIcon} ${btcRegime.regime} (${btcRegime.strength}% Fuerza) | El factor de riesgo predominante. |\n`;
        }

        // III. ESTRUCTURA TÁCTICA 
        response += `\n## III. Estructura Táctica y Refinamiento del Punto de Interés (POI)\n`;

        // NEW: FRACTAL ANALYSIS SECTION
        if (techData.fractalAnalysis) {
            const { trend_1h, price_1h, trend_4h, trend_1d, price_4h, price_1d, price_1w } = techData.fractalAnalysis;

            const isAligned1h = (sentiment.includes('ALCISTA') && trend_1h === 'BULLISH') || (sentiment.includes('BAJISTA') && trend_1h === 'BEARISH');
            let isAligned4h = true;
            if (trend_4h) isAligned4h = (sentiment.includes('ALCISTA') && trend_4h === 'BULLISH') || (sentiment.includes('BAJISTA') && trend_4h === 'BEARISH');
            let isAligned1d = true;
            if (trend_1d) isAligned1d = (sentiment.includes('ALCISTA') && trend_1d === 'BULLISH') || (sentiment.includes('BAJISTA') && trend_1d === 'BEARISH');

            // Re-affirm Cycle Alignment with FINAL sentiment
            // Re-affirm Cycle Alignment with FINAL sentiment
            if (trend_1w) {
                isAlignedCycle = (sentiment.includes('ALCISTA') && trend_1w === 'BULLISH') ||
                    (sentiment.includes('BAJISTA') && trend_1w === 'BEARISH');
                if (weakTrendWarning) isAlignedCycle = false;
            }

            const isFullyAligned = isAligned1h && isAligned4h && isAligned1d;

            // Recalculate God Mode locally to guarantee consistency
            const localGodMode = isFullyAligned && isAlignedCycle && !weakTrendWarning;

            const fractalIcon = localGodMode ? "🚀🚀" : isFullyAligned ? "💎" : (isAligned1h && isAligned4h) ? "✅" : "⚠️";
            let fractalStatus = "Alineación Total (INSTITUCIONAL)";

            if (weakTrendWarning) fractalStatus = "Alerta: Tendencia Semanal perdiendo fuerza.";
            else if (!isAlignedCycle && trend_1w) fractalStatus = "Contra-Ciclo Semanal (Riesgo Alto)";
            else if (!isAligned1d) fractalStatus = "Conflicto Diario - Swing Peligroso";
            else if (!isAligned1h) fractalStatus = "Divergencia Táctica (1H) - Ruido Local";

            if (localGodMode) fractalStatus = "GOD MODE (Alineación 15m a 1W sin Agotamiento)";

            response += `### 3.3. Validación Fractal (Validación de Ciclo)\n`;
            response += `| Estructura | Estado | Análisis |\n|---|---|---|\n`;
            response += `| **Tendencia Táctica (1H)** | ${trend_1h === 'BULLISH' ? '🟢 Alcista' : '🔴 Bajista'} | Precio ($${price_1h}) vs EMA200. |\n`;
            if (trend_1w) {
                const rsiWDisplay = techData.fractalAnalysis?.rsi_1w ? `RSI: ${techData.fractalAnalysis.rsi_1w.toFixed(1)}` : '';
                response += `| **Ciclo de Mercado (1W)** | ${cycleText} | Precio $${price_1w} vs EMA50. ${rsiWDisplay} |\n`;
            }
            response += `| **Veredicto Final** | ${fractalIcon} ${fractalStatus} | ${localGodMode ? '🌊 **Tsunami Institucional:** Toda la liquidez empuja en la misma dirección.' : 'Operar con precaución.'} |\n\n`;
        }

        // IV. PLAN DE EJECUCIÓN DCA
        const scenarioATitle = `## IV.A Escenario Principal: ${finalPrimarySide === 'LONG' ? 'COMPRA (LONG)' : 'VENTA (SHORT)'} (Confianza: ${finalIsBullish ? bullishScore.toFixed(0) : bearishScore.toFixed(0)})`;
        response += generateDCAExecutionPlan(price, atr, fibonacci, confluenceAnalysis as any, techData.marketRegime, finalPrimarySide, scenarioATitle);

        // ESCENARIO B: ALTERNATIVO (HEDGING)
        const secondarySide = finalPrimarySide === 'LONG' ? 'SHORT' : 'LONG';
        const scenarioBTitle = `## IV.B Escenario Alternativo (Cobertura): ${secondarySide === 'LONG' ? 'COMPRA (LONG)' : 'VENTA (SHORT)'} (Confianza: ${finalIsBullish ? bearishScore.toFixed(0) : bullishScore.toFixed(0)})`;
        response += generateDCAExecutionPlan(price, atr, fibonacci, confluenceAnalysis as any, techData.marketRegime, secondarySide, scenarioBTitle);

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
