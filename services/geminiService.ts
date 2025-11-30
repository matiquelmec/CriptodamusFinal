
import { AIOpportunity, TradingStyle, TechnicalIndicators, MarketRisk } from "../types";
import { MacroContext } from './macroService';
import { analyzeIchimokuSignal } from './ichimokuStrategy'; // NEW: Expert Logic

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
    const { price, rsi, stochRsi, vwap, adx, atr, rvol, ema20, ema50, ema100, ema200, macd, bollinger, pivots, fibonacci, trendStatus } = techData;

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

        // --- PHASE 1.5: MACRO ADJUSTMENTS (NEW) ---
        // Aquí es donde el "Trader Experto" ajusta las probabilidades
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

        // Final Sentiment Calculation
        let sentiment = "NEUTRO";
        let mainIcon = "⚪";

        if (bullishScore > bearishScore + 2) { sentiment = "ALCISTA (BULLISH)"; mainIcon = "🟢"; }
        else if (bearishScore > bullishScore + 2) { sentiment = "BAJISTA (BEARISH)"; mainIcon = "🔴"; }

        // --- PHASE 2: GENERATE REPORT (EDUCATIONAL MODE) ---

        // HEADER
        response += `### ${mainIcon} Diagnóstico: ${sentiment}\n`;
        if (isHighRisk) {
            response += `🔥 **ALERTA DE MERCADO:** ${riskProfile.note}\n> *Contexto Educativo: En momentos de alta volatilidad macro, el análisis técnico pierde fiabilidad. Protege tu capital reduciendo el apalancamiento.*\n\n`;
        }
        response += `**Score de Fuerza:** Bulls ${bullishScore.toFixed(1)} vs Bears ${bearishScore.toFixed(1)}\n`;
        response += `**Estrategia Activa:** ${formatStrategyName(strategyId)}\n\n`;

        // SECCIÓN 0: CONTEXTO MACROECONÓMICO (NEW)
        if (macroContext) {
            response += `#### 🌍 Contexto Macroeconómico (El Panorama General)\n`;

            const { btcRegime, btcDominance, usdtDominance } = macroContext;

            // BTC Regime
            const regimeIcon = btcRegime.regime === 'BULL' ? '🟢' : btcRegime.regime === 'BEAR' ? '🔴' : '🟡';
            response += `- **Régimen de BTC:** ${regimeIcon} ${btcRegime.regime} (${btcRegime.strength}% Fuerza)\n`;
            response += `  > ${btcRegime.reasoning}\n`;

            // Volatilidad
            const volIcon = btcRegime.volatilityStatus === 'HIGH' ? '🔥' : btcRegime.volatilityStatus === 'LOW' ? '❄️' : '⚡';
            response += `- **Volatilidad:** ${volIcon} ${btcRegime.volatilityStatus} (ATR: ${btcRegime.atr.toFixed(0)})\n`;

            if (btcRegime.volatilityStatus === 'HIGH' && btcRegime.regime === 'RANGE') {
                response += `  > ⚠️ **KILL SWITCH ACTIVO:** Mercado en rango con alta volatilidad. Condición peligrosa para operar.\n`;
            }

            // Flujo de Capital
            response += `- **Flujo de Capital:**\n`;
            response += `  • BTC.D: ${btcDominance.current.toFixed(1)}% (${btcDominance.trend})\n`;
            response += `  • USDT.D: ${usdtDominance.current.toFixed(1)}% (${usdtDominance.trend})\n`;

            // Condiciones Especiales
            const isAlt = !techData.symbol.includes('BTC');
            if (isAlt) {
                if (btcRegime.regime === 'BEAR' && (btcDominance.trend === 'RISING' || usdtDominance.trend === 'RISING')) {
                    response += `  > 🔥 **SNIPER SHORT ACTIVA:** Mercado bajista + drenaje de liquidez. Los shorts en altcoins tienen alta probabilidad.\n`;
                } else if (btcRegime.regime === 'BULL' && btcDominance.trend === 'FALLING') {
                    response += `  > 🚀 **ALT SEASON DETECTADA:** BTC alcista pero perdiendo dominancia. Capital rotando a altcoins.\n`;
                }
            }

            response += `\n`;
        }

        // SECCIÓN 1: SALUD DE LA TENDENCIA (Contexto)
        response += `#### 1. Estructura & Tendencia (El Contexto)\n`;

        // ADX Interpretation

        // Generate strategy based on logic + selected strategy context + macro
        response += generateStrategicAdvice(techData, sentiment, strategyId, macroContext, isHighRisk);

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

const generateLevelsTable = (price: number, pivots: any, ema200: number, fibs: any) => {
    // Generate a markdown table merging Pivots AND Fibonacci
    // We prioritize the GOLDEN POCKET (0.618)

    const levels = [
        { name: "R2 (Resistencia)", price: pivots.r1 + (pivots.p - pivots.s1), type: 'R' },
        { name: "Fib 0.618 (Golden Pocket)", price: fibs.level0_618, type: 'FIB' },
        { name: "Pivote Central", price: pivots.p, type: 'P' },
        { name: "EMA 200 (Tendencia)", price: ema200, type: 'EMA' },
        { name: "S1 (Soporte)", price: pivots.s1, type: 'S' },
        { name: "Fib 0.786 (Zona de Descuento)", price: fibs.level0_786, type: 'FIB' }
    ];

    levels.sort((a, b) => b.price - a.price);

    let table = "| Nivel | Precio | Estado Actual |\n|---|---|---|\n";
    levels.forEach(l => {
        const dist = ((l.price - price) / price) * 100;
        const isAbove = l.price > price;

        let status = "";
        let icon = "⚪";

        if (isAbove) {
            status = `Resistencia (+${dist.toFixed(2)}%)`;
            icon = "🔴";
            // Educational logic: If a Support level is ABOVE price, it flipped to resistance
            if (l.name.includes("S1") || l.name.includes("S2")) status += " (Soporte Roto ⚠️)";
        } else {
            status = `Soporte (${dist.toFixed(2)}%)`;
            icon = "🟢";
            // Educational logic: If a Resistance level is BELOW price, it flipped to support
            if (l.name.includes("R1") || l.name.includes("R2")) status += " (Resistencia Rota ✅)";
        }

        // Highlight Golden Pocket special
        const nameDisplay = l.name.includes("Golden") ? `✨ **${l.name}**` : l.name;

        table += `| ${icon} ${nameDisplay} | $${l.price.toFixed(l.price > 100 ? 2 : 4)} | ${status} |\n`;
    });
    return table;
}

const generateStrategicAdvice = (
    data: TechnicalIndicators,
    sentiment: string,
    strategyId: string,
    macroContext: MacroContext | null, // NEW: Macro context for validation
    highRisk: boolean
): string => {
    const { price, atr, bollinger, rsi, stochRsi, vwap, ema50, ema200, fibonacci, ichimokuData } = data;
    const isBullish = sentiment.includes("ALCISTA");

    let advice = "";

    // --- MACRO VALIDATIONS (NEW) ---
    if (macroContext) {
        const { btcRegime, btcDominance, usdtDominance } = macroContext;
        const isAlt = !data.symbol.includes('BTC');

        // Validación Kill Switch
        if (btcRegime.volatilityStatus === 'HIGH' && btcRegime.regime === 'RANGE') {
            advice += `🚫 **KILL SWITCH MACRO:** El mercado está en rango con volatilidad extrema.\n`;
            advice += `**Acción Recomendada:** NO OPERAR. Espera a que la volatilidad se normalice o que BTC defina una dirección clara.\n\n`;
            return advice; // Early return
        }

        // Validación Bear Market para Alts
        if (isAlt && isBullish && btcRegime.regime === 'BEAR') {
            advice += `⚠️ **ADVERTENCIA MACRO:** Estás considerando un LONG en una altcoin, pero BTC está en régimen BAJISTA.\n`;
            advice += `**Contexto Educativo:** Cuando BTC cae, las altcoins suelen caer más fuerte (correlación positiva). Reduce tu confianza o espera a que BTC se estabilice.\n\n`;
        }

        // Validación USDT Dominance Rising
        if (usdtDominance.trend === 'RISING' && isBullish) {
            advice += `⚠️ **SEÑAL DE MIEDO:** USDT Dominance está subiendo (${usdtDominance.current.toFixed(1)}%).\n`;
            advice += `**Interpretación:** Los inversores están huyendo a stablecoins. Mercado en modo pánico. Los LONGs son muy arriesgados.\n\n`;
        }
    }

    // FAILSAFE: Si hay riesgo extremo
    if (highRisk && strategyId !== 'meme_hunter') {
        advice += `⚠️ **MODO PROTECCIÓN:** La volatilidad actual es demasiado alta. \n`;
        advice += `**Recomendación Educativa:** Los traders profesionales NO operan durante el caos. Espera a que el precio forme un rango estable (acumulación) antes de entrar.\n\n`;
    }

    // --- ESTRATEGIA: ICHIMOKU CLOUD (REAL EXPERT MODE) ---
    if (strategyId === 'ichimoku_dragon' && ichimokuData) {
        const ichimokuSignal = analyzeIchimokuSignal(ichimokuData);
        const { tenkan, kijun, senkouA, senkouB, chikou } = ichimokuData;
        const cloudTop = Math.max(senkouA, senkouB);
        const cloudBottom = Math.min(senkouA, senkouB);

        advice += `**🐉 Estrategia Ichimoku Kinko Hyo (Equilibrio):**\n`;
        advice += `El sistema Ichimoku busca ver el equilibrio del mercado "de un vistazo".\n\n`;

        advice += `**📊 Estado de la Nube (Kumo):**\n`;
        if (ichimokuSignal.metrics.cloudStatus === 'ABOVE') {
            advice += `✅ **Tendencia Alcista Fuerte:** El precio está sobre la nube. La nube actúa como soporte dinámico en $${cloudTop.toFixed(4)}.\n`;
        } else if (ichimokuSignal.metrics.cloudStatus === 'BELOW') {
            advice += `🔻 **Tendencia Bajista Fuerte:** El precio está bajo la nube. La nube actúa como resistencia en $${cloudBottom.toFixed(4)}.\n`;
        } else {
            advice += `⚠️ **Zona de Turbulencia:** El precio está DENTRO de la nube. El mercado no tiene tendencia clara. **NO OPERAR TENDENCIA.**\n`;
        }

        advice += `\n**⚔️ Cruce Tenkan-Kijun (El Gatillo):**\n`;
        if (ichimokuSignal.metrics.tkCross === 'BULLISH') {
            advice += `🟢 **Cruce Dorado (TK Cross):** La línea rápida (Tenkan) cruzó arriba de la lenta (Kijun). Señal de compra.\n`;
        } else if (ichimokuSignal.metrics.tkCross === 'BEARISH') {
            advice += `🔴 **Cruce de la Muerte (TK Cross):** La línea rápida cruzó abajo. Señal de venta.\n`;
        } else {
            advice += `⚪ **Neutro:** Las líneas están paralelas sin cruce reciente.\n`;
        }

        advice += `\n**👻 Chikou Span (El Fantasma del Pasado):**\n`;
        if (ichimokuSignal.metrics.chikouStatus === 'VALID') {
            advice += `✅ **Confirmado:** El Chikou está libre de obstáculos. El camino está despejado.\n`;
        } else {
            advice += `❌ **Bloqueado:** El Chikou choca con el precio o la nube de hace 26 periodos. La tendencia no tiene fuerza real aún.\n`;
        }

        advice += `\n**📋 Veredicto Ichimoku:**\n`;
        advice += `> **${ichimokuSignal.reason}**\n\n`;

        if (ichimokuSignal.side !== 'NEUTRAL') {
            advice += `**🛡️ Niveles Operativos:**\n`;
            advice += `- **Stop Loss (Kijun):** $${kijun.toFixed(4)}\n`;
            advice += `- **Soporte Nube:** $${cloudTop.toFixed(4)}\n`;
        }
    }
    // ESTRATEGIA: SMC LIQUIDITY
    else if (strategyId === 'smc_liquidity') {
        const goldenPocket = fibonacci.level0_618;

        advice += `**🧠 Lógica SMC (Smart Money Concepts):**\n`;
        advice += `Las instituciones no compran "al mercado". Dejan órdenes limitadas en zonas de descuento profundo para obtener el mejor precio posible.\n\n`;

        if (isBullish) {
            advice += `**📈 PLAN DE BATALLA LONG:**\n`;
            advice += `1. **Zona de Espera:** Paciencia. Deja que el precio caiga al **Golden Pocket** ($${goldenPocket.toFixed(4)}).\n`;
            advice += `2. **El Gatillo:** No entres ciegamente. Espera una vela de rechazo (mecha larga abajo) en esa zona.\n`;
            advice += `3. **Gestión de Riesgo:**\n`;
            advice += `   - **Stop Loss:** $${(goldenPocket - atr).toFixed(4)} (Bajo el nivel 0.786).\n`;
            advice += `   - **Take Profit:** $${(price + atr * 3).toFixed(4)} (Máximos anteriores).\n`;
            advice += `   - **Tamaño:** Si tu cuenta es de $1000, arriesga máx $10 (1%).\n`;
        } else {
            advice += `**📉 PLAN DE BATALLA SHORT:**\n`;
            advice += `1. **Zona de Caza:** Busca que el precio suba a tomar liquidez (barrer stops) por encima de un máximo anterior.\n`;
            advice += `2. **Confirmación:** Espera que el precio pierda el VWAP ($${vwap.toFixed(4)}) con fuerza.\n`;
            advice += `3. **Ejecución:** Entra en el re-testeo del VWAP por debajo.`;
        }
    }
    // ESTRATEGIA: MEME HUNTER
    else if (strategyId === 'meme_hunter') {
        advice += `**🧠 Lógica Degen (Alto Riesgo):**\n`;
        advice += `Aquí ignoramos los fundamentales. Buscamos Volumen (Gasolina) y Momentum (Velocidad). Si no hay volumen, no hay fiesta.\n\n`;

        if (data.rvol > 2.0 && isBullish && price > vwap) {
            advice += `**🚀 MOMENTUM LONG DETECTADO:**\n`;
            advice += `El volumen es explosivo (x${data.rvol.toFixed(1)}). Las ballenas están entrando agresivamente.\n\n`;
            advice += `**📋 Checklist de Entrada:**\n`;
            advice += `1. [x] Precio sobre VWAP ($${vwap.toFixed(4)}).\n`;
            advice += `2. [x] Volumen relativo > 2.0.\n`;
            advice += `3. [ ] **Acción:** Entra a mercado YA.\n\n`;
            advice += `**🛡️ Gestión de Salida:**\n`;
            advice += `- Sube el Stop Loss a "Breakeven" (precio de entrada) en cuanto suba un 3%.\n`;
            advice += `- Toma ganancias parciales (50%) rápido. Estas monedas caen tan rápido como suben.`;
        } else if (rsi < 30 || stochRsi.k < 10) {
            advice += `**🧲 REBOTE TÉCNICO (Scalping):**\n`;
            advice += `El activo está sobrevendido (StochRSI ${stochRsi.k.toFixed(0)}). Es como una liga estirada al máximo.\n\n`;
            advice += `**Estrategia:** Compra el miedo.\n`;
            advice += `- **Meta:** Rebote rápido hacia la EMA 20 ($${data.ema20.toFixed(4)}).\n`;
            advice += `- **Stop Loss:** Muy ajustado. Si sigue cayendo, sal inmediatamente.`;
        } else {
            advice += `⚠️ **NO TOCAR:**\n`;
            advice += `No hay volumen suficiente (RVOL bajo) ni extremos de RSI. Es zona de "tierra de nadie". Espera a que entre volumen.`;
        }
    }
    // DEFAULT: QUANT/GENERAL
    else {
        if (parseFloat(bollinger.bandwidth.toFixed(2)) < 5) {
            advice += `🔥 **SQUEEZE PLAY (Compresión):**\n`;
            advice += `Las Bandas de Bollinger están extremadamente cerradas. El mercado está acumulando energía para un movimiento explosivo.\n\n`;
            advice += `**Estrategia de Ruptura:**\n`;
            advice += `1. No adivines la dirección.\n`;
            advice += `2. Pon una orden **Buy Stop** encima de la banda superior.\n`;
            advice += `3. Pon una orden **Sell Stop** bajo la banda inferior.\n`;
            advice += `4. La que se active primero te meterá en la tendencia. Cancela la otra.`;
        } else if (isBullish) {
            advice += `**🌊 Trend Following (Seguimiento de Tendencia):**\n`;
            advice += `La tendencia es tu amiga hasta que se doble. No luches contra la corriente.\n\n`;
            advice += `**📋 Checklist de Compra:**\n`;
            advice += `1. **Tendencia:** El precio está sobre la EMA 200 (Alcista).\n`;
            advice += `2. **Zona de Valor:** Espera un retroceso al VWAP ($${vwap.toFixed(4)}).\n`;
            advice += `3. **Gatillo:** Busca un patrón de vela alcista (Martillo o Envolvente) sobre el VWAP.\n\n`;
            advice += `**🛡️ Gestión de Riesgo:**\n`;
            advice += `- **Stop Loss:** Bajo la EMA 50 ($${ema50.toFixed(4)}). Si la pierde, la tendencia a corto plazo se debilita.`;
        } else {
            advice += `**📉 Trend Following (Bajista):**\n`;
            advice += `La estructura de mercado es de máximos y mínimos decrecientes.\n\n`;
            advice += `**Estrategia:**\n`;
            advice += `- Vende (Short) cada vez que el precio suba a tocar el VWAP ($${vwap.toFixed(4)}) y sea rechazado.\n`;
            advice += `- No compres los rebotes, son "trampas de toros".`;
        }
    }

    return advice;
}
