

import { AIOpportunity, TradingStyle, TechnicalIndicators } from "../types";

// --- MOTOR AUTÓNOMO (OFFLINE) ---
// Este servicio reemplaza a la IA de Google.
// Ahora recibe DATOS DUROS (TechnicalIndicators) en lugar de intentar leer texto.

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
    marketContext: string, // Kept for macro context string
    techData: TechnicalIndicators | null, // NEW: Strongly typed data
    strategyId: string // NEW: Context aware logic
) {
    // Simular "pensamiento" para UX
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const lowerMsg = userMessage.toLowerCase();

    // 1. FAILSAFE: Si no hay datos técnicos (API Error)
    if (!techData) {
        yield `⚠️ **Error de Datos:** No pude recuperar las métricas precisas para este activo. Por favor, intenta de nuevo o revisa si el par es válido en Binance.`;
        return;
    }

    // 2. EXTRAER DATOS (YA NO SE PARSEA TEXTO, SE USAN OBJETOS)
    const { price, rsi, adx, atr, rvol, ema20, ema50, ema100, ema200, macd, bollinger, pivots, trendStatus } = techData;

    // --- LÓGICA DE COMANDO: ANALISIS_INTEGRAL ---
    if (userMessage.includes("Analisis") || lowerMsg.includes('estrategia') || lowerMsg.includes('opinion')) {
        let response = "";

        // --- PHASE 1: SCORING SYSTEM (MATRIX) ---
        let bullishScore = 0;
        let bearishScore = 0;
        let reasons: string[] = [];

        // Trend Alignment (Structure)
        if (price > ema200) bullishScore += 2; else bearishScore += 2;
        if (ema20 > ema50) bullishScore += 1; else bearishScore += 1;

        // Momentum (RSI & MACD)
        if (macd.histogram > 0) bullishScore += 1.5; else bearishScore += 1.5;
        if (rsi > 50) bullishScore += 1; else bearishScore += 1;

        // Volatility Context (Bollinger)
        const inUpperZone = price > bollinger.middle;
        if (inUpperZone) bullishScore += 1; else bearishScore += 1;

        // Final Sentiment Calculation
        let sentiment = "NEUTRO";
        let mainIcon = "⚪";
        
        if (bullishScore > bearishScore + 2) { sentiment = "ALCISTA (BULLISH)"; mainIcon = "🟢"; }
        else if (bearishScore > bullishScore + 2) { sentiment = "BAJISTA (BEARISH)"; mainIcon = "🔴"; }

        // --- PHASE 2: GENERATE REPORT ---

        // HEADER
        response += `### ${mainIcon} Diagnóstico: ${sentiment}\n`;
        response += `**Score Matemático:** Bulls ${bullishScore.toFixed(1)} vs Bears ${bearishScore.toFixed(1)}\n`;
        response += `**Estrategia Activa:** ${formatStrategyName(strategyId)}\n\n`;

        // SECCIÓN 1: SALUD DE LA TENDENCIA (Contexto)
        response += `#### 1. Estructura & Tendencia\n`;
        
        // ADX Interpretation
        let trendDesc = "Rango/Ruido (Peligroso)";
        if (adx > 20) trendDesc = "Tendencia en Desarrollo";
        if (adx > 30) trendDesc = "Tendencia Fuerte";
        if (adx > 50) trendDesc = "Tendencia Extrema (Clímax)";
        
        const emaState = trendStatus.emaAlignment === 'BULLISH' ? "Alineación Perfecta (20>50>100>200)" : 
                        trendStatus.emaAlignment === 'BEARISH' ? "Alineación Bajista (20<50<100<200)" : "Caótica (Cruce de medias)";
        
        response += `- **Tendencia Macro (EMA 200):** ${price > ema200 ? '✅ Alcista' : '🔻 Bajista'}\n`;
        response += `- **Fuerza ADX (14):** ${adx.toFixed(1)} (${trendDesc})\n`;
        response += `- **Estructura EMA:** ${emaState}\n`;
        if (trendStatus.goldenCross) response += `- **⚠️ Golden Cross Detectado:** Señal alcista de largo plazo.\n`;
        if (trendStatus.deathCross) response += `- **⚠️ Death Cross Detectado:** Señal bajista de largo plazo.\n`;
        
        // Macro Context Check
        if (marketContext.includes("Dominancia Bitcoin") && parseFloat(marketContext.split(':')[1]) > 58) {
            response += `- **⚠️ Macro Warn:** Dominancia BTC alta. Altcoins pueden sufrir volatilidad extra.\n`;
        }
        response += `\n`;

        // SECCIÓN 2: MOMENTO & VOLATILIDAD (El "Timing")
        response += `#### 2. Momento & Volatilidad\n`;
        
        // RSI Analysis with Context
        let rsiText = "Neutral (Zona de Control)";
        if (rsi > 70) rsiText = "⚠️ Sobrecompra (Riesgo de corrección)";
        if (rsi > 80) rsiText = "🔥 Sobrecompra Extrema (FOMO)";
        if (rsi < 30) rsiText = "⚠️ Sobreventa (Posible rebote)";
        
        // MACD Analysis
        const macdStatus = macd.line > macd.signal ? "Cruce Alcista" : "Cruce Bajista";
        
        // Bollinger Analysis
        const bbWidth = bollinger.bandwidth.toFixed(2);
        let volText = "Volatilidad Normal";
        if (parseFloat(bbWidth) < 5) volText = "Compresión (Squeeze) - Movimiento explosivo inminente";
        if (parseFloat(bbWidth) > 30) volText = "Expansión (Volatilidad Alta)";

        response += `- **RSI (14):** ${rsi.toFixed(1)} - ${rsiText}\n`;
        response += `- **MACD:** ${macdStatus} (Histograma: ${macd.histogram.toFixed(4)})\n`;
        response += `- **Bandas Bollinger:** ${volText} (Ancho: ${bbWidth}%)\n`;
        response += `- **RVOL (Volumen):** ${rvol.toFixed(2)}x ${rvol > 1.5 ? '✅ Interés Institucional' : '❌ Sin volumen relevante'}\n\n`;

        // SECCIÓN 3: NIVELES CLAVE (Table)
        response += `#### 🎯 Niveles Clave (Soportes y Resistencias)\n`;
        response += generateLevelsTable(price, pivots, ema200);
        response += `\n`;

        // SECCIÓN 4: RECOMENDACIÓN ESTRATÉGICA (El "Alpha")
        response += `#### 🛡️ Setup Sugerido (Gestión de Riesgo)\n`;
        
        // Generate strategy based on logic + selected strategy context
        response += generateStrategicAdvice(techData, sentiment, strategyId);

        yield response;
    }
    // Lógica para preguntas puntuales
    else if (lowerMsg.includes('riesgo') || lowerMsg.includes('stop')) {
        yield `### 🛡️ Gestión de Riesgo (ATR)\nEl ATR actual es **$${atr.toFixed(4)}**.\n\n- **Scalping SL (Tight):** $${(price - (atr * 1.5)).toFixed(4)} (1.5x ATR)\n- **Swing SL (Wide):** $${(price - (atr * 2.5)).toFixed(4)} (2.5x ATR)\n\nRecuerda: Nunca arriesgues más del 2% de tu cuenta por operación.`;
    }
    else {
        // Fallback conversacional
        yield `**Sistema Autónomo:** Datos recibidos correctamente.\nPrecio: $${price} | RSI: ${rsi.toFixed(1)} | Estructura: ${price > ema200 ? 'Alcista' : 'Bajista'}.\n\nEscribe "Generar Análisis" para obtener la estrategia completa.`;
    }
}

// Helper to format strategy name nicely
const formatStrategyName = (id: string) => {
    switch(id) {
        case 'smc_liquidity': return "SMC (Smart Money Concepts)";
        case 'quant_volatility': return "Quant & Momentum";
        case 'ichimoku_dragon': return "Ichimoku Cloud";
        default: return "Estandard (Price Action)";
    }
}

const generateLevelsTable = (price: number, pivots: any, ema200: number) => {
    // Generate a markdown table
    const r2 = (pivots.p - pivots.s1) + pivots.r1;
    const s2 = pivots.p - (pivots.r1 - pivots.s1);

    const levels = [
        { name: "R2 (Resistencia)", price: r2 },
        { name: "R1 (Objetivo Corto)", price: pivots.r1 },
        { name: "P (Pivote Central)", price: pivots.p },
        { name: "S1 (Soporte)", price: pivots.s1 },
        { name: "S2 (Fondo)", price: s2 },
        { name: "EMA 200 (Dinámico)", price: ema200 },
    ].sort((a,b) => b.price - a.price); // Sort descending

    let table = `| Nivel | Precio | Distancia |\n|---|---|---|\n`;
    
    levels.forEach(l => {
        const dist = ((l.price - price) / price) * 100;
        const icon = l.price > price ? "🔴" : "🟢";
        const distStr = dist > 0 ? `+${dist.toFixed(2)}%` : `${dist.toFixed(2)}%`;
        const style = Math.abs(dist) < 0.5 ? "**" : ""; // Highlight close levels
        
        table += `| ${icon} ${l.name} | ${style}$${l.price.toFixed(4)}${style} | ${distStr} |\n`;
    });

    return table;
}

// --- CORE BRAIN: Generates the actual advice based on numbers ---
const generateStrategicAdvice = (data: TechnicalIndicators, sentiment: string, strategyId: string): string => {
    const { price, rsi, ema20, ema50, ema100, ema200, pivots, bollinger, atr } = data;
    const isBullish = sentiment.includes("ALCISTA");
    let advice = "";

    // Helper for decimals
    const dec = price > 1000 ? 2 : 4;

    // LOGIC BRANCH: SMC (Liquidity Hunter)
    if (strategyId === 'smc_liquidity') {
        if (isBullish) {
            advice += `**🟢 OPORTUNIDAD SMC LONG:**\n`;
            advice += `El precio muestra estructura alcista. Buscamos entrar en la corrección.\n\n`;
            advice += `> **Zona de Entrada (POI):** $${ema50.toFixed(dec)} - $${pivots.p.toFixed(dec)}\n`;
            advice += `> **Confirmación:** Esperar mecha de rechazo en esta zona en 15m.\n`;
            advice += `> **Invalidación (SL):** Cierre debajo de EMA 100 ($${data.ema100.toFixed(dec)}).\n`;
            advice += `> **Target (TP):** R1 ($${pivots.r1.toFixed(dec)}) o máximo anterior.`;
        } else {
            advice += `**🔴 OPORTUNIDAD SMC SHORT:**\n`;
            advice += `Ruptura de estructura confirmada (ChoCH).\n\n`;
            advice += `> **Zona de Entrada (Breaker):** $${pivots.p.toFixed(dec)} - $${pivots.r1.toFixed(dec)}\n`;
            advice += `> **Invalidación (SL):** Por encima del último alto ($${(price + atr*2).toFixed(dec)}).\n`;
            advice += `> **Target (TP):** Liquidez en S1 ($${pivots.s1.toFixed(dec)}).`;
        }
    } 
    // LOGIC BRANCH: SCALP / QUANT (Volatility)
    else if (strategyId === 'quant_volatility') {
        if (data.bollinger.bandwidth < 5) {
            advice += `**⚠️ ALERTA DE SQUEEZE (COMPRESIÓN):**\n`;
            advice += `La volatilidad ha muerto. **NO OPERAR RANGO.**\n`;
            advice += `Coloca órdenes de ruptura (Stop Orders):\n`;
            advice += `1. **Buy Stop:** $${bollinger.upper.toFixed(dec)} (Ruptura Alcista)\n`;
            advice += `2. **Sell Stop:** $${bollinger.lower.toFixed(dec)} (Ruptura Bajista)\n`;
        } else if (isBullish) {
            advice += `**🚀 MOMENTUM SCALP LONG:**\n`;
            advice += `Precio sobre EMA 20. El momentum es tu amigo.\n`;
            advice += `> **Trailing Stop:** EMA 20 ($${ema20.toFixed(dec)}).\n`;
            advice += `> **Take Profit:** Banda Superior ($${bollinger.upper.toFixed(dec)}).\n`;
        } else {
            advice += `**🐻 MOMENTUM SCALP SHORT:**\n`;
            advice += `Precio bajo EMA 20. Busca cortos rápidos.\n`;
            advice += `> **Stop Loss:** EMA 50 ($${ema50.toFixed(dec)}).\n`;
            advice += `> **Take Profit:** Banda Inferior ($${bollinger.lower.toFixed(dec)}).`;
        }
    }
    // LOGIC BRANCH: ICHIMOKU (Trend)
    else if (strategyId === 'ichimoku_dragon') {
        // Simple proxy for Kumo if precise cloud data isn't fully calculated here (using EMA proxies)
        if (isBullish && price > ema100) {
            advice += `**🐉 ESTRATEGIA DRAGON (TREND):**\n`;
            advice += `El activo está en tendencia saludable sobre el equilibrio.\n\n`;
            advice += `> **Zona de Recompra (Kijun):** $${ema50.toFixed(dec)}\n`;
            advice += `> **Objetivo:** Expansión de Fibonacci ($${(price + atr*3).toFixed(dec)}).`;
        } else {
            advice += `**☁️ BAJO LA NUBE (RESISTENCIA):**\n`;
            advice += `La tendencia es bajista o neutra. Operar largos es arriesgado.\n`;
            advice += `> **Resistencia Clave:** EMA 100 ($${ema100.toFixed(dec)}). Solo comprar si rompe y apoya.`;
        }
    }
    // DEFAULT LOGIC
    else {
        if (isBullish) {
             if (rsi > 70) {
                 advice += `**⚠️ ESCENARIO DE FOMO:**\n`;
                 advice += `Tendencia fuerte pero RSI en sobrecompra. No perseguir el precio.\n`;
                 advice += `**Acción:** Esperar pullback a $${ema20.toFixed(dec)} para entrar.`;
             } else {
                 advice += `**✅ CONTINUACIÓN ALCISTA:**\n`;
                 advice += `Soportes respetados. Estructura de máximos crecientes.\n`;
                 advice += `> **Entrada:** Precio de mercado.\n`;
                 advice += `> **SL:** $${(price - atr*1.5).toFixed(dec)}\n`;
                 advice += `> **TP:** $${pivots.r1.toFixed(dec)}`;
             }
        } else {
             if (rsi < 30) {
                 advice += `**⚠️ RIESGO DE REBOTE (SUELO):**\n`;
                 advice += `Sobreventa extrema. Riesgo de "Short Squeeze".\n`;
                 advice += `**Acción:** No vender en pánico. Esperar rebote a $${ema20.toFixed(dec)} para evaluar cortos.`;
             } else {
                 advice += `**🔻 ESTRATEGIA DE VENTA:**\n`;
                 advice += `Debilidad estructural. Los rebotes son oportunidades de venta.\n`;
                 advice += `> **Venta Limit:** $${ema20.toFixed(dec)} (Si el precio sube ahí).`;
             }
        }
    }

    return advice;
}


// Función dummy para compatibilidad
export const generateBatchTradeSignals = async () => { return []; }