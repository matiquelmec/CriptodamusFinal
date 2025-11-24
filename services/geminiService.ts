
import { AIOpportunity, TradingStyle, TechnicalIndicators, MarketRisk } from "../types";

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
    strategyId: string, // NEW: Context aware logic
    riskProfile: MarketRisk // NEW: Market Risk integration
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

    // Extraer Dominancia de Bitcoin del contexto de texto si es posible
    let btcDominance = 0;
    try {
        const domMatch = marketContext.match(/Dominancia Bitcoin: (\d+\.?\d*)/);
        if (domMatch) btcDominance = parseFloat(domMatch[1]);
    } catch(e) {}

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
        
        if (trendStatus.goldenCross) response += `- **⚠️ Golden Cross Detectado:** La media rápida cruzó la lenta hacia arriba (Señal muy alcista).\n`;
        
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
        response += `  > *Dato: Un RVOL de ${rvol.toFixed(2)}x significa que hay ${(rvol*100-100).toFixed(0)}% más volumen de lo normal para esta hora.*\n\n`;

        // SECCIÓN 3: NIVELES CLAVE (Table)
        response += `#### 🎯 Niveles Clave (Mapa de Liquidez)\n`;
        response += generateLevelsTable(price, pivots, ema200, fibonacci);
        response += `\n> *Estrategia: Busca reacciones (rebotes o rechazos) en estos niveles exactos, no operes en medio de la nada.*\n\n`;

        // SECCIÓN 4: RECOMENDACIÓN ESTRATÉGICA (El "Alpha")
        response += `#### 🛡️ Plan de Trading Educativo\n`;
        
        // Generate strategy based on logic + selected strategy context
        response += generateStrategicAdvice(techData, sentiment, strategyId, btcDominance, isHighRisk);

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
    switch(id) {
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
    btcDom: number,
    highRisk: boolean
): string => {
    const { price, atr, bollinger, rsi, stochRsi, vwap, ema50, ema200, fibonacci } = data; 
    const isBullish = sentiment.includes("ALCISTA");

    let advice = "";

    // FAILSAFE: Si hay riesgo extremo
    if (highRisk && strategyId !== 'meme_hunter') {
        advice += `⚠️ **MODO PROTECCIÓN:** La volatilidad actual es demasiado alta. \n`;
        advice += `**Recomendación Educativa:** Los traders profesionales NO operan durante el caos. Espera a que el precio forme un rango estable (acumulación) antes de entrar.\n\n`;
    }

    // ESTRATEGIA: SMC LIQUIDITY
    if (strategyId === 'smc_liquidity') {
        const goldenPocket = fibonacci.level0_618;
        
        advice += `**🧠 Lógica SMC:** Buscamos comprar donde los retail (traders novatos) ponen sus Stop Loss, es decir, en zonas de liquidez profunda.\n\n`;

        if (isBullish) {
            advice += `**📈 Setup Long:** Paciencia. Espera un retroceso al **Golden Pocket** ($${goldenPocket.toFixed(4)}).\n`;
            advice += `- **¿Por qué aquí?:** Es el retroceso del 61.8% de Fibonacci. Los algoritmos bancarios suelen tener órdenes "Limit" esperando aquí.\n`;
            advice += `- **Stop Loss ($${(goldenPocket - atr).toFixed(4)}):** Lo colocamos bajo el nivel 0.786 para darle "aire" al precio y evitar un barrido de mecha.\n`;
            advice += `- **TP ($${(price + atr*3).toFixed(4)}):** Apuntamos a los máximos anteriores donde hay liquidez de vendedores atrapados.`;
        } else {
            advice += `**📉 Setup Short:** Buscar entrada si el precio barre un máximo anterior y pierde el VWAP ($${vwap.toFixed(4)}).\n`;
            advice += `- **Confirmación:** Espera que una vela de 15m cierre por debajo del VWAP para confirmar que los vendedores tienen el control.`;
        }
    }
    // ESTRATEGIA: MEME HUNTER
    else if (strategyId === 'meme_hunter') {
        advice += `**🧠 Lógica Degen:** Aquí ignoramos los fundamentales. Buscamos Volumen (Gasolina) y Momentum (Velocidad).\n\n`;
        
        if (data.rvol > 2.0 && isBullish && price > vwap) {
            advice += `**🚀 MOMENTUM LONG:** El volumen es explosivo (x${data.rvol.toFixed(1)}). Las ballenas están entrando.\n`;
            advice += `- **Entrada:** Mercado (Ya). El precio está rompiendo con fuerza.\n`;
            advice += `- **Gestión:** Sube el Stop Loss a "Breakeven" (precio de entrada) en cuanto suba un 3%.\n`;
        } else if (rsi < 30 || stochRsi.k < 10) {
            advice += `**🧲 REBOTE TÉCNICO:** El activo está sobrevendido (StochRSI ${stochRsi.k.toFixed(0)}).\n`;
            advice += `- **Estrategia:** Compra el miedo. Busca un rebote rápido hacia la EMA 20 ($${data.ema20.toFixed(4)}).\n`;
            advice += `- **Advertencia:** Esto es "atrapar un cuchillo". Usa stop loss ajustado.`;
        } else {
            advice += `⚠️ **NO TOCAR:** No hay volumen suficiente (RVOL bajo) ni extremos de RSI. Es zona de "tierra de nadie".`;
        }
    }
    // DEFAULT: QUANT/GENERAL
    else {
        if (parseFloat(bollinger.bandwidth.toFixed(2)) < 5) {
             advice += `🔥 **SQUEEZE PLAY:** Las Bandas de Bollinger están extremadamente cerradas. \n`;
             advice += `**Interpretación:** El mercado está acumulando energía. No adivines la dirección. Pon una orden de compra (Buy Stop) encima de la banda superior y una venta (Sell Stop) bajo la inferior. Sigue la ruptura.`;
        } else if (isBullish) {
            advice += `**🌊 Trend Following:** La tendencia es tu amiga.\n`;
            advice += `- **Entrada:** Busca comprar cerca del VWAP ($${vwap.toFixed(4)}). Si el precio rebota ahí, es confirmación de fuerza.\n`;
            advice += `- **Stop Loss:** Bajo la EMA 50 ($${ema50.toFixed(4)}). Si la pierde, la tendencia a corto plazo se invalida.`;
        } else {
             advice += `**📉 Trend Following:** La estructura es bajista.\n`;
             advice += `- **Estrategia:** Vende (Short) cada vez que el precio suba a tocar el VWAP ($${vwap.toFixed(4)}) y sea rechazado.`;
        }
    }

    return advice;
}
