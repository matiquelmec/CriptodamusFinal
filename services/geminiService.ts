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
        const trendStrength = adx > 25 ? "Fuerte" : "Débil/Rango";
        const emaState = trendStatus.emaAlignment === 'BULLISH' ? "Alineación Perfecta (20>50>100>200)" : 
                        trendStatus.emaAlignment === 'BEARISH' ? "Alineación Bajista (20<50<100<200)" : "Caótica (Cruce de medias)";
        
        response += `- **Tendencia Macro (EMA 200):** ${price > ema200 ? '✅ Alcista' : '🔻 Bajista'}\n`;
        response += `- **Fuerza (ADX):** ${adx.toFixed(1)} (${trendStrength})\n`;
        response += `- **Estructura EMA:** ${emaState}\n`;
        if (trendStatus.goldenCross) response += `- **⚠️ Golden Cross Detectado:** Señal alcista de largo plazo.\n`;
        if (trendStatus.deathCross) response += `- **⚠️ Death Cross Detectado:** Señal bajista de largo plazo.\n`;
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

        // SECCIÓN 3: RECOMENDACIÓN ESTRATÉGICA (El "Alpha")
        response += `#### 3. Plan de Acción Sugerido\n`;
        
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

// --- CORE BRAIN: Generates the actual advice based on numbers ---
const generateStrategicAdvice = (data: TechnicalIndicators, sentiment: string, strategyId: string): string => {
    const { price, rsi, ema20, ema50, ema100, ema200, pivots, bollinger } = data;
    const isBullish = sentiment.includes("ALCISTA");
    let advice = "";

    // LOGIC BRANCH: SMC (Liquidity Hunter)
    if (strategyId === 'smc_liquidity') {
        if (isBullish) {
            advice += `**🟢 SETUP SMC LONG:**\n`;
            advice += `Busca un retroceso al Order Block cercano a **$${ema50.toFixed(4)}** o al Pivote **$${pivots.p.toFixed(4)}**.\n`;
            advice += `1. **Entrada:** Esperar barrido de liquidez en $${pivots.s1.toFixed(4)} y recuperación.\n`;
            advice += `2. **SL:** Bajo el mínimo reciente o EMA 100 ($${data.ema100.toFixed(4)}).\n`;
        } else {
            advice += `**🔴 SETUP SMC SHORT:**\n`;
            advice += `El precio rompió estructura. Busca ventas en el retest de **$${ema20.toFixed(4)}**.\n`;
            advice += `1. **Entrada:** Zona de oferta entre $${pivots.p.toFixed(4)} y $${pivots.r1.toFixed(4)}.\n`;
            advice += `2. **TP:** Liquidez en mínimos iguales (Equal Lows) o S1 ($${pivots.s1.toFixed(4)}).\n`;
        }
    } 
    // LOGIC BRANCH: SCALP / QUANT (Volatility)
    else if (strategyId === 'quant_volatility') {
        if (data.bollinger.bandwidth < 5) {
            advice += `**⚠️ ALERTA DE SQUEEZE (COMPRESIÓN):**\n`;
            advice += `El mercado está acumulando energía. **NO OPERAR RANGO.**\n`;
            advice += `Pon Buy Stop en $${bollinger.upper.toFixed(4)} y Sell Stop en $${bollinger.lower.toFixed(4)}.\n`;
        } else if (isBullish) {
            advice += `**🚀 MOMENTUM SCALP:**\n`;
            advice += `Mientras el precio respete la EMA 20 ($${ema20.toFixed(4)}), mantén longs.\n`;
            advice += `**TP Rápido:** Banda Superior Bollinger ($${bollinger.upper.toFixed(4)}).\n`;
        } else {
            advice += `**🐻 MOMENTUM SHORT:**\n`;
            advice += `El precio perdió la EMA 20. Short hasta la Banda Inferior ($${bollinger.lower.toFixed(4)}).\n`;
        }
    }
    // LOGIC BRANCH: ICHIMOKU (Trend)
    else if (strategyId === 'ichimoku_dragon') {
        // Simple proxy for Kumo if precise cloud data isn't fully calculated here (using EMA proxies)
        if (isBullish && price > ema100) {
            advice += `**🐉 DRAGON RUN:**\n`;
            advice += `Tendencia saludable. El precio está sobre el equilibrio.\n`;
            advice += `**Zona de Recompra:** Si el precio toca la EMA 50 ($${ema50.toFixed(4)}) (Kijun Proxy).\n`;
        } else {
            advice += `**☁️ BAJO LA NUBE:**\n`;
            advice += `Resistencia fuerte en medias móviles. Evitar compras hasta recuperar $${ema100.toFixed(4)}.\n`;
        }
    }
    // DEFAULT LOGIC
    else {
        if (isBullish) {
             if (rsi > 70) {
                 advice += `**⚠️ PRECAUCIÓN (FOMO):** Tendencia alcista pero sobreextendida.\n`;
                 advice += `Esperar retroceso a $${ema20.toFixed(4)} antes de entrar.`;
             } else {
                 advice += `**✅ CONTINUACIÓN DE TENDENCIA:**\n`;
                 advice += `Soportes clave en $${pivots.p.toFixed(4)} y EMA 50.\nObjetivo: $${pivots.r1.toFixed(4)}.`;
             }
        } else {
             if (rsi < 30) {
                 advice += `**⚠️ POSIBLE SUELO (REBOTE):**\n`;
                 advice += `Sobreventa extrema. Riesgo de Short Squeeze. No vender aquí.`;
             } else {
                 advice += `**🔻 VENTA EN REBOTES:**\n`;
                 advice += `Usar cualquier subida a $${ema20.toFixed(4)} como oportunidad de venta/cierre de longs.`;
             }
        }
    }

    return advice;
}


// Función dummy para compatibilidad
export const generateBatchTradeSignals = async () => { return []; }