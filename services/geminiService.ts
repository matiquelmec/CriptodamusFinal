import { GoogleGenerativeAI } from "@google/generative-ai";
import { TechnicalIndicators, MarketRisk } from "../types";
import { MacroContext } from './macroService';

// --- CONFIGURATION ---
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// --- SESSION MANAGEMENT ---
let chatSession: any = null;
let lastSymbol: string = "";

export const startChatSession = async () => {
    if (!chatSession) {
        chatSession = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: "Actúa como un trader institucional experto con 20 años de experiencia. Tu nombre es 'Criptodamus AI'. Tu objetivo es proteger el capital del usuario y buscar operaciones de alta probabilidad. Sé directo, usa emojis para estructurar, y prioriza la gestión de riesgo. No des consejos financieros legales, solo análisis educativo." }],
                },
                {
                    role: "model",
                    parts: [{ text: "Entendido. Soy Criptodamus AI. Analizaré el mercado con precisión institucional, enfocándome en la estructura de mercado, liquidez y gestión de riesgo. Mis respuestas serán tácticas y educativas." }],
                },
            ],
        });
    }
    return chatSession;
};

export const hasActiveSession = () => !!chatSession;

// --- MAIN ANALYSIS STREAM ---
export async function* streamMarketAnalysis(
    msg: string,
    techData: TechnicalIndicators,
    riskProfile: MarketRisk,
    strategyId: string,
    macroContext: MacroContext | null
) {
    if (!API_KEY) {
        yield "⚠️ **Error:** Falta la API Key de Gemini. Configúrala en .env";
        return;
    }

    // 1. Detect Intent
    const isAnalysisRequest = msg.toLowerCase().includes('analisis') || msg.toLowerCase().includes('opinion') || lastSymbol !== techData.symbol;
    lastSymbol = techData.symbol;

    if (isAnalysisRequest) {
        yield `🔍 **Iniciando Escaneo Institucional para ${techData.symbol}...**\n\n`;

        // --- PHASE 1: MATH ENGINE (The "Brain") ---
        // We calculate the score internally before asking AI, to guide the prompt.

        const { price, rsi, stochRsi, macd, adx, ema50, ema200, bollinger, vwap, pivots, fibonacci, rvol } = techData;

        let bullishScore = 0;
        let bearishScore = 0;

        // Trend Check
        if (price > ema200) bullishScore += 3; else bearishScore += 3;
        if (price > ema50) bullishScore += 2; else bearishScore += 2;

        // Momentum
        if (rsi > 50) bullishScore += 1; else bearishScore += 1;
        if (macd.histogram > 0) bullishScore += 2; else bearishScore += 2;

        // VWAP (Institutional Value)
        if (price > vwap) bullishScore += 2; else bearishScore += 2;

        // Risk Filter
        const isHighRisk = riskProfile.level === 'HIGH' || riskProfile.level === 'EXTREME';
        if (isHighRisk) {
            bearishScore += 3; // Bias towards caution
        }

        // PHASE 1.5: MACRO ADJUSTMENTS (NEW)
        if (macroContext) {
            const { btcRegime, btcDominance, usdtDominance } = macroContext;
            const isAlt = !techData.symbol.includes('BTC');

            // REGLA 1: Kill Switch (Rango + Volatilidad Alta)
            if (btcRegime.volatilityStatus === 'HIGH' && btcRegime.regime === 'RANGE') {
                bearishScore += 5; // Penalización masiva a cualquier setup
                bullishScore = 0;
            }

            // REGLA 2: BTC Regime para Alts
            if (isAlt) {
                if (btcRegime.regime === 'BEAR') {
                    bullishScore -= 5; // No long alts en Bear Market
                    bearishScore += 3;
                } else if (btcRegime.regime === 'BULL' && btcDominance.trend === 'FALLING') {
                    bullishScore += 4; // Alt Season Boost
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

        let response = "";

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
        let trendDesc = "Mercado Lateral (Rango)";
        let trendEdu = "El precio no tiene dirección clara. Peligroso para estrategias de tendencia.";
        if (adx > 20) { trendDesc = "Tendencia en Desarrollo"; trendEdu = "La tendencia empieza a ganar tracción."; }
        if (adx > 30) { trendDesc = "Tendencia Fuerte"; trendEdu = "El movimiento es sólido y direccional."; }
        if (adx > 50) { trendDesc = "Tendencia Extrema (Clímax)"; trendEdu = "Posible agotamiento por exceso de euforia/pánico."; }

        response += `- **Tendencia Macro (EMA 200):** ${price > ema200 ? '✅ Alcista' : '🔻 Bajista'} ($${ema200.toFixed(2)})\n`;
        response += `  > *Nota: Estar por encima de la EMA 200 indica que, a largo plazo, los compradores dominan.*\n`;

        response += `- **VWAP (Institucional):** $${vwap.toFixed(4)} ${price > vwap ? '✅ Precio sobre valor justo' : '❌ Precio bajo descuento'}\n`;
        response += `  > *Nota: Las instituciones suelen comprar cerca del VWAP. Estar lejos indica sobre-extensión.*\n`;

        response += `- **Fuerza ADX (14):** ${adx.toFixed(1)} (${trendDesc})\n`;

        // Golden Cross Check (Simple approximation)
        const goldenCross = ema50 > ema200 && ema50 < ema200 * 1.01; // Just crossed
        if (goldenCross) response += `- **⚠️ Golden Cross Detectado:** La media rápida cruzó la lenta hacia arriba (Señal muy alcista).\n`;

        response += `\n`;

        // SECCIÓN 2: MOMENTO & VOLATILIDAD (El "Timing")
        response += `#### 2. Momento & Volatilidad (El Gatillo)\n`;

        // RSI Analysis with Context
        let rsiText = "Neutral (50)";
        let rsiEdu = "Equilibrio entre compradores y vendedores.";
        if (rsi > 60 && rsi < 70) { rsiText = "Bullish Control"; rsiEdu = "Fuerza compradora saludable."; }
        if (rsi > 70) { rsiText = "⚠️ Sobrecompra"; rsiEdu = "El precio ha subido muy rápido. Riesgo de corrección a corto plazo."; }
        if (rsi < 30) { rsiText = "⚠️ Sobreventa"; rsiEdu = "El precio ha caído demasiado rápido. Posible rebote técnico."; }

        // Bollinger Analysis
        const bbWidth = bollinger.bandwidth.toFixed(2);
        let volText = "Normal";
        if (parseFloat(bbWidth) < 5) volText = "🔥 SQUEEZE (Compresión Extrema)";

        response += `- **RSI (14):** ${rsi.toFixed(1)} - ${rsiText}\n`;
        response += `- **StochRSI:** ${stochRsi.k.toFixed(0)}/100 ${stochRsi.k > 80 ? '(Techo)' : stochRsi.k < 20 ? '(Suelo)' : ''}\n`;
        response += `  > *Tip: El StochRSI es más rápido que el RSI. Úsalo para afinar tu entrada exacta.*\n`;

        response += `- **Bandas Bollinger:** ${volText} (Ancho: ${bbWidth}%)\n`;
        if (parseFloat(bbWidth) < 5) {
            response += `  > *Ojo: Una compresión (Squeeze) siempre precede a un movimiento explosivo. Prepara órdenes a ambos lados.*\n`;
        }

        response += `- **RVOL (Volumen):** ${rvol.toFixed(2)}x ${rvol > 1.5 ? '✅ Volumen Institucional' : '❌ Volumen Retail'}\n`;
        response += `  > *Dato: Un RVOL de ${rvol.toFixed(2)}x significa que hay ${(rvol * 100 - 100).toFixed(0)}% más volumen de lo normal para esta hora.*\n\n`;

        // SECCIÓN 3: NIVELES CLAVE (Table)
        response += `#### 🎯 Niveles Clave (Mapa de Liquidez)\n`;
        response += generateLevelsTable(price, pivots, ema200, fibonacci);
        response += `\n> *Estrategia: Busca reacciones (rebotes o rechazos) en estos niveles exactos, no operes en medio de la nada.*\n\n`;

        // SECCIÓN 4: RECOMENDACIÓN ESTRATÉGICA (El "Alpha")
        response += `#### 🛡️ Plan de Trading Educativo\n`;

        // Generate strategy based on logic + selected strategy context + macro
        response += generateStrategicAdvice(techData, sentiment, strategyId, macroContext, isHighRisk);

        yield response;
    }
    // Lógica para preguntas puntuales
    else if (msg.includes('riesgo') || msg.includes('stop') || msg.includes('sl')) {
        yield `### 🛡️ Clase de Gestión de Riesgo (ATR)\nEl ATR (Average True Range) mide cuánto se mueve el precio en promedio por vela. Úsalo para colocar tu Stop Loss fuera del "ruido" normal.\n\n**Datos actuales:**\n- ATR: $${techData.atr.toFixed(4)}\n\n**Cálculo de Stop Loss:**\n- **Scalping:** Precio - (1.5 x ATR) = $${(techData.price - (techData.atr * 1.5)).toFixed(4)}\n- **Swing:** Precio - (2.5 x ATR) = $${(techData.price - (techData.atr * 2.5)).toFixed(4)}\n\n*Regla de Oro: Si tu SL está muy lejos, reduce el tamaño de tu posición para mantener el riesgo en dólares constante.*`;
    }
    else {
        // Fallback conversacional (DEBUG: Indica qué entendió)
        yield `**Sistema Autónomo:** Datos capturados para **${techData.symbol}**.\n\n`;
        yield `📊 **Resumen Rápido:**\n`;
        yield `• Precio: $${techData.price}\n`;
        yield `• Tendencia: ${techData.price > techData.ema200 ? '✅ Alcista' : '🔻 Bajista'}\n`;
        yield `• RSI: ${techData.rsi.toFixed(1)}\n`;
        if (riskProfile.level !== 'LOW') {
            yield `• ⚠️ **Riesgo Macro:** ${riskProfile.level}\n`;
        }
        yield `\nℹ️ _Mensaje recibido: "${msg}". Escribe "Analisis" para ver el reporte educativo completo._`;
    }
}

// --- HELPER FUNCTIONS ---

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
            if (l.name.includes("S1") || l.name.includes("S2")) status += " (Soporte Roto ⚠️)";
        } else {
            status = `Soporte (${dist.toFixed(2)}%)`;
            icon = "🟢";
            if (l.name.includes("R1") || l.name.includes("R2")) status += " (Resistencia Rota ✅)";
        }

        const nameDisplay = l.name.includes("Golden") ? `✨ **${l.name}**` : l.name;
        table += `| ${icon} ${nameDisplay} | $${l.price.toFixed(l.price > 100 ? 2 : 4)} | ${status} |\n`;
    });
    return table;
}

const generatePositionSizingPlan = (price: number, atr: number, isBullish: boolean) => {
    // Lógica de Layering (Escalonamiento) basada en ATR

    const e1 = price;
    const e2 = isBullish ? price - (atr * 0.5) : price + (atr * 0.5);
    const e3 = isBullish ? price - (atr * 1.0) : price + (atr * 1.0);

    const avgEntry = (e1 * 0.3) + (e2 * 0.4) + (e3 * 0.3);

    // Targets basados en el precio promedio estimado
    const tp1 = isBullish ? avgEntry + (atr * 1.5) : avgEntry - (atr * 1.5);
    const tp2 = isBullish ? avgEntry + (atr * 3.0) : avgEntry - (atr * 3.0);
    const tp3 = isBullish ? avgEntry + (atr * 5.0) : avgEntry - (atr * 5.0);

    const sl = isBullish ? avgEntry - (atr * 1.5) : avgEntry + (atr * 1.5);

    let plan = `#### 🧱 Gestión de Posición Avanzada (Layering)\n`;
    plan += `> *Técnica Profesional: No entres con todo. Divide tu capital para mejorar tu precio promedio y reducir estrés.*\n\n`;

    plan += `**🔵 Zonas de Entrada (Compras Escalonadas):**\n`;
    plan += `1. **30% (Inicial):** $${e1.toFixed(4)} (Precio Actual)\n`;
    plan += `2. **40% (Optimización):** $${e2.toFixed(4)} (Orden Limit)\n`;
    plan += `3. **30% (Defensa):** $${e3.toFixed(4)} (Orden Limit)\n`;
    plan += `*🎯 Precio Promedio Estimado: $${avgEntry.toFixed(4)}*\n\n`;

    plan += `**🔴 Zonas de Salida (Toma de Ganancias):**\n`;
    plan += `1. **TP 1 (50%):** $${tp1.toFixed(4)} (Asegurar Ganancia + Mover SL a Breakeven)\n`;
    plan += `2. **TP 2 (30%):** $${tp2.toFixed(4)} (Objetivo Principal)\n`;
    plan += `3. **TP 3 (20%):** $${tp3.toFixed(4)} (Moonbag - Dejar correr)\n\n`;

    plan += `**🛡️ Stop Loss Final:** $${sl.toFixed(4)} (Si el precio cruza esto, la tesis se invalida).`;

    return plan;
}

const generateStrategicAdvice = (
    data: TechnicalIndicators,
    sentiment: string,
    strategyId: string,
    macroContext: MacroContext | null,
    highRisk: boolean
): string => {
    const { price, atr, bollinger, rsi, stochRsi, vwap, ema50, ema200, fibonacci } = data;
    const isBullish = sentiment.includes("ALCISTA");

    let advice = "";

    // --- MACRO VALIDATIONS ---
    if (macroContext) {
        const { btcRegime, btcDominance, usdtDominance } = macroContext;
        const isAlt = !data.symbol.includes('BTC');

        if (btcRegime.volatilityStatus === 'HIGH' && btcRegime.regime === 'RANGE') {
            advice += `🚫 **KILL SWITCH MACRO:** El mercado está en rango con volatilidad extrema.\n`;
            advice += `**Acción Recomendada:** NO OPERAR. Espera a que la volatilidad se normalice o que BTC defina una dirección clara.\n\n`;
            return advice;
        }

        if (isAlt && isBullish && btcRegime.regime === 'BEAR') {
            advice += `⚠️ **ADVERTENCIA MACRO:** Estás considerando un LONG en una altcoin, pero BTC está en régimen BAJISTA.\n`;
            advice += `**Contexto Educativo:** Cuando BTC cae, las altcoins suelen caer más fuerte (correlación positiva). Reduce tu confianza o espera a que BTC se estabilice.\n\n`;
        }

        if (usdtDominance.trend === 'RISING' && isBullish) {
            advice += `⚠️ **SEÑAL DE MIEDO:** USDT Dominance está subiendo (${usdtDominance.current.toFixed(1)}%).\n`;
            advice += `**Interpretación:** Los inversores están huyendo a stablecoins. Mercado en modo pánico. Los LONGs son muy arriesgados.\n\n`;
        }
    }

    if (highRisk && strategyId !== 'meme_hunter') {
        advice += `⚠️ **MODO PROTECCIÓN:** La volatilidad actual es demasiado alta. \n`;
        advice += `**Recomendación Educativa:** Los traders profesionales NO operan durante el caos. Espera a que el precio forme un rango estable (acumulación) antes de entrar.\n\n`;
    }

    // ESTRATEGIA: SMC LIQUIDITY
    if (strategyId === 'smc_liquidity') {
        const goldenPocket = fibonacci.level0_618;

        advice += `**🧠 Lógica SMC (Smart Money Concepts):**\n`;
        advice += `Las instituciones no compran "al mercado". Dejan órdenes limitadas en zonas de descuento profundo para obtener el mejor precio posible.\n\n`;

        if (isBullish) {
            advice += `**📈 PLAN DE BATALLA LONG:**\n`;
            advice += `1. **Zona de Espera:** Paciencia. Deja que el precio caiga al **Golden Pocket** ($${goldenPocket.toFixed(4)}).\n`;
            advice += `2. **El Gatillo:** No entres ciegamente. Espera una vela de rechazo (mecha larga abajo) en esa zona.\n`;
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
        } else if (rsi < 30 || stochRsi.k < 10) {
            advice += `**🧲 REBOTE TÉCNICO (Scalping):**\n`;
            advice += `El activo está sobrevendido (StochRSI ${stochRsi.k.toFixed(0)}). Es como una liga estirada al máximo.\n\n`;
            advice += `**Estrategia:** Compra el miedo.\n`;
            advice += `- **Meta:** Rebote rápido hacia la EMA 20 ($${data.ema20.toFixed(4)}).\n`;
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
        } else {
            advice += `**📉 Trend Following (Bajista):**\n`;
            advice += `La estructura de mercado es de máximos y mínimos decrecientes.\n\n`;
            advice += `**Estrategia:**\n`;
            advice += `- Vende (Short) cada vez que el precio suba a tocar el VWAP ($${vwap.toFixed(4)}) y sea rechazado.\n`;
            advice += `- No compres los rebotes, son "trampas de toros".`;
        }
    }

    // --- INJECT POSITION SIZING PLAN ---
    advice += `\n\n` + generatePositionSizingPlan(price, atr, isBullish);

    return advice;
}
