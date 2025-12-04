
import { AIOpportunity, TradingStyle, TechnicalIndicators, MarketRisk } from "../types";
import { MacroContext } from './macroService';
import { analyzeIchimokuSignal } from './ichimokuStrategy'; // NEW: Expert Logic
import { generateDCAExecutionPlan } from './dcaReportGenerator'; // NEW: DCA System

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
    const { price, rsi, stochRsi, vwap, adx, atr, rvol, ema20, ema50, ema100, ema200, macd, bollinger, pivots, fibonacci, trendStatus, volumeProfile, orderBlocks, fairValueGaps, confluenceAnalysis } = techData;

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

        // --- PHASE 1.5: MACRO ADJUSTMENTS (NEW) ---
        // Aquí es donde el "Trader Experto" ajusta las probabilidades

        // CRITICAL: Range Market Kill Switch
        if (isHighVolatilityRange) {
            // Mercado en rango con alta volatilidad = trampa mortal
            bullishScore *= 0.1;
            bearishScore *= 0.1;
        } else if (isRangeMarket) {
            // Mercado lateral normal = reducir confianza
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

        let sentiment = "NEUTRO";
        let mainIcon = "⚪";

        if (bullishScore > bearishScore + 2) { sentiment = "ALCISTA (BULLISH)"; mainIcon = "🟢"; }
        else if (bearishScore > bullishScore + 2) { sentiment = "BAJISTA (BEARISH)"; mainIcon = "🔴"; }

        // --- PHASE 2: GENERATE REPORT (INSTITUTIONAL FORMAT) ---

        // HEADER
        response += `# Evaluación de Riesgo y Estrategia Táctica para ${techData.symbol}\n\n`;

        // I. DIAGNÓSTICO OPERACIONAL
        response += `## I. Diagnóstico Operacional: Conflicto Estructural (Macro vs. Micro)\n\n`;
        response += `| Métrica Clave | Lectura | Interpretación (Institutional Bias) |\n`;
        response += `|---|---|---|\n`;
        const trendNote = isRangeMarket
            ? "⚠️ Mercado en RANGO (ADX < 25). Evitar operar hasta breakout confirmado."
            : "Impulso local, ideal para la captura de un rally de alivio.";
        response += `| **Diagnóstico Táctico (15m)** | ${mainIcon} ${sentiment} | ${trendNote} |\n`;
        response += `| **Score de Fuerza** | Bulls ${bullishScore.toFixed(1)} vs Bears ${bearishScore.toFixed(1)} | Confirma el control momentáneo de la demanda. |\n`;

        if (macroContext) {
            const { btcRegime } = macroContext;
            const regimeIcon = btcRegime.regime === 'BULL' ? '🟢' : btcRegime.regime === 'BEAR' ? '🔴' : '🟡';
            response += `| **Régimen Macro (Diario)** | ${regimeIcon} ${btcRegime.regime} (${btcRegime.strength}% Fuerza) | El factor de riesgo predominante; todo long es un trade contra la "gravedad" macro. |\n`;
        }

        response += `| **Estrategia Primaria** | ${formatStrategyName(strategyId)} | Enfoque en la mitigación de órdenes institucionales no ejecutadas (POI). |\n\n`;

        // II. CONTEXTO MACROECONÓMICO
        if (macroContext) {
            const { btcRegime, btcDominance, usdtDominance } = macroContext;
            response += `## II. Contexto Macroeconómico: La Gravedad Estructural\n`;
            response += `El contexto macroeconómico exige una gestión de riesgo inflexible. La tendencia de largo plazo se encuentra bajo presión crítica.\n\n`;

            response += `### 2.1. La Amenaza del Régimen ${btcRegime.regime}\n`;
            response += `La estructura técnica diaria muestra un régimen **${btcRegime.regime}**. ${btcRegime.reasoning}\n`;
            response += `**Implicación:** El objetivo de este trade no es la continuación alcista perpetua, sino la captura eficiente de un rally de alivio antes de que la presión estructural reanude.\n\n`;

            response += `### 2.2. Correlación de Liquidez Global\n`;
            response += `Bitcoin actúa como un "barómetro" de liquidez global.\n`;
            response += `- **USDT.D (Miedo):** ${usdtDominance.current.toFixed(1)}% (${usdtDominance.trend}). Si sube, indica fuga a refugio (Risk-Off).\n`;
            response += `- **BTC.D (Dominancia):** ${btcDominance.current.toFixed(1)}% (${btcDominance.trend}).\n\n`;
        }

        // III. ESTRUCTURA TÁCTICA
        response += `## III. Estructura Táctica y Refinamiento del Punto de Interés (POI)\n`;

        // Divergence Logic
        let divergenceText = "Alineación Confirmada";
        if (macroContext && macroContext.btcRegime.regime === 'BEAR' && price > ema200) {
            divergenceText = "⚠️ Divergencia Crítica (Posible Dead Cat Bounce)";
        }
        response += `El análisis del marco temporal de 15 minutos revela: **${divergenceText}**.\n\n`;

        response += `### 3.1. Validación del Riesgo\n`;
        response += `- **ADX (Fuerza de Tendencia):** ${adx.toFixed(1)} ${adx < 25 ? '(⚠️ RANGO - No operar)' : adx > 40 ? '(🔥 Tendencia Fuerte)' : '(✅ Tendencia Moderada)'}\n`;
        response += `- **Volumen Relativo (RVOL):** ${rvol.toFixed(2)}x ${rvol < 1 ? '(❌ Poco Interés)' : '(✅ Interés Real)'}. Un rally con bajo volumen es sospechoso.\n`;

        // Market Extremes Warning
        if (isCapitulation) {
            response += `- **🚨 CAPITULACIÓN DETECTADA:** RSI < 20 + Volumen extremo. Posible rebote técnico inminente.\n`;
        }
        if (isEuphoria) {
            response += `- **🚨 EUFORIA DETECTADA:** RSI > 80 + Volumen extremo. Alto riesgo de corrección.\n`;
        }

        const bbWidth = bollinger.bandwidth.toFixed(2);
        const squeezeStatus = parseFloat(bbWidth) < 5 ? "🔥 SQUEEZE (Compresión)" : "⚡ Expansión";
        response += `- **Volatilidad:** Bandas Bollinger en **${squeezeStatus}**. Esta fase precede invariablemente a un movimiento violento.\n\n`;

        // SMC Logic Table
        // SMC Logic Table
        response += `### 3.2. Lógica SMC: Confluencia del POI de Alta Probabilidad\n`;
        response += `La filosofía SMC dicta que la entrada óptima se encuentra en una zona de descuento profundo.\n\n`;

        if (confluenceAnalysis && confluenceAnalysis.topSupports.length > 0) {
            response += `| Nivel Clave (POI) | Precio Objetivo | Confluencia Institucional |\n`;
            response += `|---|---|---|\n`;
            confluenceAnalysis.topSupports.forEach(poi => {
                response += `| **${poi.factors[0]}** | $${poi.price.toFixed(4)} | ${poi.factors.join(' + ')} |\n`;
            });
            response += `\n`;
        } else {
            const goldenPocket = fibonacci.level0_618;
            response += `| Nivel Clave (POI) | Precio Objetivo | Confluencia Institucional |\n`;
            response += `|---|---|---|\n`;
            response += `| **Golden Pocket (Fib 0.618)** | $${goldenPocket.toFixed(4)} | Zona de descuento ideal para la reentrada. |\n`;
            response += `| **EMA 200 Local** | $${ema200.toFixed(4)} | Soporte dinámico clave que refuerza la rigidez del POI. |\n`;
            response += `| **Point of Control (PoC)** | $\\approx$ $${pivots.p.toFixed(4)} | Nivel de equilibrio de volumen (Pivote Central). |\n\n`;
        }

        // NEW: FRACTAL ANALYSIS SECTION (1H & 4H Validation)
        // NEW: FRACTAL ANALYSIS SECTION (1H, 4H & 1D Validation)
        if (techData.fractalAnalysis) {
            const { trend_1h, ema200_1h, price_1h, trend_4h, ema200_4h, price_4h, trend_1d, ema200_1d, price_1d } = techData.fractalAnalysis;

            const isAligned1h = (sentiment.includes('ALCISTA') && trend_1h === 'BULLISH') ||
                (sentiment.includes('BAJISTA') && trend_1h === 'BEARISH');

            let isAligned4h = true;
            let trend4hText = "N/A";
            if (trend_4h) {
                isAligned4h = (sentiment.includes('ALCISTA') && trend_4h === 'BULLISH') ||
                    (sentiment.includes('BAJISTA') && trend_4h === 'BEARISH');
                trend4hText = trend_4h === 'BULLISH' ? '🟢 Alcista' : '🔴 Bajista';
            }

            let isAligned1d = true;
            let trend1dText = "N/A";
            if (trend_1d) {
                isAligned1d = (sentiment.includes('ALCISTA') && trend_1d === 'BULLISH') ||
                    (sentiment.includes('BAJISTA') && trend_1d === 'BEARISH');
                trend1dText = trend_1d === 'BULLISH' ? '🟢 Alcista' : '🔴 Bajista';
            }

            const isFullyAligned = isAligned1h && isAligned4h && isAligned1d;
            const fractalIcon = isFullyAligned ? "💎💎" : (isAligned1h && isAligned4h) ? "✅✅" : isAligned1h ? "✅⚠️" : "⛔";

            let fractalStatus = "Alineación Total (GOD MODE)";
            if (!isAligned1h) fractalStatus = "Conflicto Táctico (1H) - Alto Riesgo";
            else if (!isAligned4h) fractalStatus = "Conflicto Estructural (4H) - Scalp Corto Plazo";
            else if (!isAligned1d) fractalStatus = "Conflicto Macro (1D) - Swing Peligroso";

            response += `### 3.3. Validación Fractal (1H + 4H + 1D) - La Visión del Dragón\n`;
            response += `Validación multi-timeframe completa: Táctico (1H), Estructural (4H) y Macro (1D).\n\n`;
            response += `| Estructura | Estado | Análisis |\n`;
            response += `|---|---|---|\n`;
            response += `| **Tendencia Táctica (1H)** | ${trend_1h === 'BULLISH' ? '🟢 Alcista' : '🔴 Bajista'} | Precio ($${price_1h}) vs EMA200 ($${ema200_1h.toFixed(4)}). |\n`;

            if (trend_4h && ema200_4h && price_4h) {
                response += `| **Tendencia Suprema (4H)** | ${trend4hText} | Precio ($${price_4h}) vs EMA200 ($${ema200_4h.toFixed(4)}). |\n`;
            }
            if (trend_1d && ema200_1d && price_1d) {
                response += `| **Tendencia Macro (1D)** | ${trend1dText} | Precio ($${price_1d}) vs EMA200 ($${ema200_1d.toFixed(4)}). |\n`;
            }

            response += `| **Veredicto Fractal** | ${fractalIcon} ${fractalStatus} | ${isFullyAligned ? '� **INSTITUTIONAL TSUNAMI:** Alineación perfecta en todas las temporalidades. Máxima convicción.' : '⚠️ Precaución: Fractura en la estructura temporal.'} |\n\n`;
        }

        // IV. PLAN DE EJECUCIÓN DCA (Generado por módulo)
        response += generateDCAExecutionPlan(price, atr, fibonacci, confluenceAnalysis as any, techData.marketRegime);

        yield response;
    }
    // Lógica para preguntas puntuales
    else if (msg.includes('riesgo') || msg.includes('stop') || msg.includes('sl')) {
        yield `### 🛡️ Clase de Gestión de Riesgo (ATR)\nEl ATR (Average True Range) mide cuánto se mueve el precio en promedio por vela. Úsalo para colocar tu Stop Loss fuera del "ruido" normal.\n\n**Datos actuales:**\n- ATR: $${atr.toFixed(4)}\n\n**Cálculo de Stop Loss:**\n- **Scalping:** Precio - (1.5 x ATR) = $${(price - (atr * 1.5)).toFixed(4)}\n- **Swing:** Precio - (2.5 x ATR) = $${(price - (atr * 2.5)).toFixed(4)}\n\n*Regla de Oro: Si tu SL está muy lejos, reduce el tamaño de tu posición para mantener el riesgo en dólares constante.*`;
    }
    else {
        // Fallback conversacional (DEBUG: Indica qué entendió)
        yield `**Sistema Autónomo:** Datos capturados para **${techData.symbol}**.\n\n`;
        yield `📊 **Resumen Rápido:**\n`;
        yield `• Precio: $${price}\n`;
        yield `• Tendencia: ${price > ema200 ? '✅ Alcista' : '🔻 Bajista'}\n`;
        yield `• RSI: ${rsi.toFixed(1)}\n`;
        if (riskProfile.level !== 'LOW') {
            yield `• ⚠️ **Riesgo Macro:** ${riskProfile.level}\n`;
        }
        yield `\nℹ️ _Mensaje recibido: "${msg}". Escribe "Analisis" para ver el reporte educativo completo._`;
    }
}


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
