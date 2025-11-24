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
    
    // Normalización ROBUSTA: Simplemente a minúsculas, sin trucos de unicode complejos.
    const msg = userMessage.toLowerCase().trim();

    // 1. FAILSAFE: Si no hay datos técnicos (API Error)
    if (!techData) {
        yield `⚠️ **Error de Datos:** No pude recuperar las métricas precisas para este activo. Por favor, intenta de nuevo o revisa si el par es válido en Binance.`;
        return;
    }

    // 2. EXTRAER DATOS (YA NO SE PARSEA TEXTO, SE USAN OBJETOS)
    const { price, rsi, adx, atr, rvol, ema20, ema50, ema100, ema200, macd, bollinger, pivots, trendStatus } = techData;

    // Extraer Dominancia de Bitcoin del contexto de texto si es posible
    let btcDominance = 0;
    try {
        const domMatch = marketContext.match(/Dominancia Bitcoin: (\d+\.?\d*)/);
        if (domMatch) btcDominance = parseFloat(domMatch[1]);
    } catch(e) {}

    // --- LÓGICA DE COMANDO: DETECCIÓN AMPLIA ---
    // Buscamos coincidencia directa con las palabras clave del botón o variaciones comunes
    const isAnalysisRequest = 
        msg.includes("analisis") || 
        msg.includes("análisis") || // Chequeo explícito de tilde
        msg.includes("generar") ||  // Palabra clave del botón por defecto
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
        if (btcDominance > 58) {
            response += `- **⚠️ Macro Warn:** Dominancia BTC Alta (${btcDominance}%). Altcoins y Memes pueden perder liquidez rápidamente.\n`;
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
        response += generateStrategicAdvice(techData, sentiment, strategyId, btcDominance);

        yield response;
    }
    // Lógica para preguntas puntuales
    else if (msg.includes('riesgo') || msg.includes('stop') || msg.includes('sl')) {
        yield `### 🛡️ Gestión de Riesgo (ATR)\nEl ATR actual es **$${atr.toFixed(4)}**.\n\n- **Scalping SL (Tight):** $${(price - (atr * 1.5)).toFixed(4)} (1.5x ATR)\n- **Swing SL (Wide):** $${(price - (atr * 2.5)).toFixed(4)} (2.5x ATR)\n\nRecuerda: Nunca arriesgues más del 2% de tu cuenta por operación.`;
    }
    else {
        // Fallback conversacional (DEBUG: Indica qué entendió)
        yield `**Sistema Autónomo:** Datos capturados para **${techData.symbol}**.\n\n`;
        yield `📊 **Resumen Rápido:**\n`;
        yield `• Precio: $${price}\n`;
        yield `• Tendencia: ${price > ema200 ? '✅ Alcista' : '🔻 Bajista'}\n`;
        yield `• RSI: ${rsi.toFixed(1)}\n`;
        yield `\nℹ️ _Mensaje recibido: "${msg}". Intenta escribiendo simplemente "Analisis" para forzar el reporte completo._`;
    }
}

// Helper to format strategy name nicely
const formatStrategyName = (id: string) => {
    switch(id) {
        case 'smc_liquidity': return "SMC (Smart Money Concepts)";
        case 'quant_volatility': return "Quant & Momentum";
        case 'ichimoku_dragon': return "Ichimoku Cloud";
        case 'meme_hunter': return "Meme Hunter (Degen)";
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
        { name: "Pivote (Equilibrio)", price: pivots.p },
        { name: "EMA 200 (Tendencia)", price: ema200 },
        { name: "S1 (Soporte)", price: pivots.s1 },
        { name: "S2 (Fondo)", price: s2 }
    ];

    levels.sort((a, b) => b.price - a.price);

    let table = "| Nivel | Precio | Distancia |\n|---|---|---|\n";
    levels.forEach(l => {
        const dist = ((l.price - price) / price) * 100;
        const icon = l.price > price ? '🔴' : '🟢';
        const distStr = dist > 0 ? `+${dist.toFixed(2)}%` : `${dist.toFixed(2)}%`;
        const style = Math.abs(dist) < 0.5 ? "**" : ""; // Highlight nearby levels
        table += `| ${icon} ${l.name} | $${l.price.toFixed(l.price > 100 ? 2 : 4)} | ${style}${distStr}${style} |\n`;
    });
    return table;
}

const generateStrategicAdvice = (
    data: TechnicalIndicators, 
    sentiment: string, 
    strategyId: string, 
    btcDom: number
): string => {
    const { price, atr, bollinger, rsi, trendStatus, ema20, ema50, ema100, ema200 } = data; // ema100 added
    const isBullish = sentiment.includes("ALCISTA");
    const isBearish = sentiment.includes("BAJISTA");

    let advice = "";

    // ESTRATEGIA: SMC LIQUIDITY
    if (strategyId === 'smc_liquidity') {
        if (isBullish) {
            advice = `**Setup Long (SMC):** Buscar entrada en Retroceso al Order Block (EMA 50 en $${ema50.toFixed(4)}). \n`;
            advice += `- **Stop Loss:** $${(ema50 - atr).toFixed(4)} (Bajo el mínimo anterior).\n`;
            advice += `- **Take Profit:** Liquidez en Máximos ($${(price + atr*3).toFixed(4)}).`;
        } else {
            advice = `**Setup Short (SMC):** Buscar entrada tras barrido de liquidez y rechazo en $${(price + atr).toFixed(4)}. \n`;
            advice += `- **Stop Loss:** $${(price + atr*1.5).toFixed(4)}. \n`;
            advice += `- **Target:** EMA 200 ($${ema200.toFixed(4)}).`;
        }
    }
    // ESTRATEGIA: MEME HUNTER
    else if (strategyId === 'meme_hunter') {
        if (data.rvol > 2.0 && isBullish) {
            advice = `**🚀 DEGEN LONG:** Volumen masivo detectado. Entrar en ruptura de mercado.\n`;
            advice += `- **SL Estricto:** -4% ($${(price * 0.96).toFixed(4)}).\n`;
            advice += `- **Salida:** En cuanto el RSI toque 80 o el volumen baje. ¡No te cases con la bolsa!`;
        } else if (rsi < 30) {
            advice = `**🧲 OVERSOLD BOUNCE:** RSI en suelo (${rsi.toFixed(0)}). Scalp rápido por rebote.\n`;
            advice += `- **Entrada:** Zona actual.\n`;
            advice += `- **TP:** Banda Media ($${bollinger.middle.toFixed(4)}).`;
        } else {
            advice = `⚠️ **NO TRADE ZONE:** Volumen bajo para una Meme Coin. El riesgo de "Bleed" (Sangrado lento) es alto. Esperar RVOL > 2.0.`;
        }
    }
    // ESTRATEGIA: ICHIMOKU
    else if (strategyId === 'ichimoku_dragon') {
        advice = `**Análisis Zen:** ${isBullish ? 'El precio busca soporte en Tenkan/Kijun.' : 'Resistencia fuerte en Kijun-sen.'}\n`;
        advice += `Operar a favor de la Nube. Si el precio está dentro de la Nube, esperar ruptura clara.`;
    }
    // DEFAULT: QUANT/GENERAL
    else {
        if (parseFloat(bollinger.bandwidth.toFixed(2)) < 5) {
             advice = `🔥 **ALERTA DE SQUEEZE:** Las bandas están comprimidas. Esperar ruptura de $${bollinger.upper.toFixed(4)} (Long) o $${bollinger.lower.toFixed(4)} (Short) con volumen.`;
        } else if (isBullish) {
            advice = `**Trend Following:** Comprar en retrocesos a la EMA 20 ($${ema20.toFixed(4)}).\n`;
            advice += `- **SL:** Cierre de vela 1h bajo EMA 50 ($${ema50.toFixed(4)}).`;
        } else {
             advice = `**Trend Following:** Vender en rebotes a la EMA 20 ($${ema20.toFixed(4)}).\n`;
             advice += `- **SL:** Cierre de vela 1h sobre EMA 50 ($${ema50.toFixed(4)}).`;
        }
    }

    return advice;
}