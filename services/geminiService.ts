import { AIOpportunity, TradingStyle } from "../types";

// --- MOTOR AUTÓNOMO (OFFLINE) ---
// Este servicio reemplaza a la IA de Google.
// Analiza el contexto técnico proporcionado por cryptoService y responde 
// basándose en lógica determinista y plantillas de análisis profesional.

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

export const streamMarketAnalysis = async function* (userMessage: string, marketContext: string, systemInstruction: string) {
    // Simular "pensamiento" para UX
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const lowerMsg = userMessage.toLowerCase();
    
    // 1. Extraer datos del contexto (Parseo Robustecido)
    const getVal = (marker: string) => {
        // Busca el valor numérico después del marcador
        const regex = new RegExp(`${marker}[^\\d\\-]*([\\d\\.\\-\\$]+)`, 'i');
        const match = marketContext.match(regex);
        return match ? match[1] : "N/A";
    };

    // Extracción de datos clave
    const priceStr = getVal("Precio Actual");
    const rsiStr = getVal("RSI \\(14, Wilder\\)");
    const adxStr = getVal("ADX \\(Fuerza Tendencia\\)");
    const atrStr = getVal("ATR \\(Volatilidad\\)");
    const rvolStr = getVal("RVOL \\(Fuerza Relativa\\)");
    const pivotP = getVal("P=");
    const pivotR1 = getVal("R1=");
    const pivotS1 = getVal("S1=");
    const fearGreedVal = getVal("Valor"); // Fear and Greed value
    
    // Extract generic lines
    const crossMatch = marketContext.match(/Estado Cruce Macro: (.*)/);
    const crossStatus = crossMatch ? crossMatch[1] : "Neutro";
    
    const distMatch = marketContext.match(/Distancia EMA20: ([\-\d\.]+)%/);
    const distEma20 = distMatch ? parseFloat(distMatch[1]) : 0;

    // Conversión a números para lógica
    const price = parseFloat(priceStr.replace('$',''));
    const rsi = parseFloat(rsiStr);
    const adx = parseFloat(adxStr);
    const rvol = parseFloat(rvolStr);
    const fearGreed = parseFloat(fearGreedVal);
    const pR1 = parseFloat(pivotR1);
    const pS1 = parseFloat(pivotS1);

    // Lógica de Comando: ANALISIS_INTEGRAL (O frase natural pre-llenada)
    if (userMessage === "ANALISIS_INTEGRAL" || lowerMsg.includes('generar análisis') || lowerMsg.includes('reporte') || lowerMsg.includes('analisis')) {
        let response = "";

        // --- LÓGICA DE FASES DE MERCADO ---
        let marketPhase = "Indecisión";
        if (crossStatus.includes("GOLDEN")) {
            if (rsi > 50 && adx > 25) marketPhase = "Tendencia Alcista Saludable 🐂";
            else if (rsi < 40) marketPhase = "Acumulación en Tendencia Alcista (Buy the Dip) 📉➡📈";
            else marketPhase = "Consolidación Alcista";
        } else {
             if (rsi < 50 && adx > 25) marketPhase = "Tendencia Bajista Fuerte 🐻";
             else if (rsi > 60) marketPhase = "Distribución (Venta en Rebotes) 📈➡📉";
             else marketPhase = "Consolidación Bajista";
        }

        // --- DISTANCIA A NIVELES ---
        const distToS1 = Math.abs((price - pS1) / price * 100).toFixed(2);
        const distToR1 = Math.abs((price - pR1) / price * 100).toFixed(2);
        
        let levelContext = "";
        if (parseFloat(distToS1) < 0.5) levelContext = "🟢 **ZONA CRÍTICA:** Precio testeando SOPORTE S1.";
        else if (parseFloat(distToR1) < 0.5) levelContext = "🔴 **ZONA CRÍTICA:** Precio testeando RESISTENCIA R1.";
        else if (price > pS1 && price < pR1) levelContext = "⚪ **Tierra de Nadie:** Precio en medio del rango operativo.";

        // BLOQUE 1: DIAGNÓSTICO INSTITUCIONAL
        response += `### 🏛️ Diagnóstico Institucional\n`;
        response += `- **Fase de Mercado:** ${marketPhase}\n`;
        response += `- **Sesgo Macro:** ${crossStatus.includes('GOLDEN') ? 'LONG (Alcista)' : 'SHORT (Bajista)'}\n`;
        response += `- **Interés Volumétrico:** ${rvol > 1.5 ? '🔥 ALTO (Manos Fuertes Presentes)' : '💤 BAJO (Retail Only)'}\n\n`;

        // BLOQUE 2: RADIOGRAFÍA TÉCNICA
        response += `### 🔬 Radiografía Técnica\n`;
        let adxStatus = adx > 25 ? "Tendencia Definida" : "Rango / Ruido";
        let rsiStatus = rsi > 70 ? "Sobrecompra (Peligro)" : rsi < 30 ? "Sobreventa (Oportunidad)" : "Neutral";
        
        response += `- **Fuerza (ADX):** ${adx.toFixed(1)} - ${adxStatus}.\n`;
        response += `- **Momentum (RSI):** ${rsi.toFixed(1)} - ${rsiStatus}.\n`;
        response += `- **Elasticidad:** El precio está a un **${distEma20}%** de su media (EMA20). ${Math.abs(distEma20) > 3 ? '⚠️ Sobreenstendido (Posible reversión a la media).' : '✅ Saludable.'}\n\n`;
        
        // BLOQUE 3: NIVELES & ESTRUCTURA
        response += `### 🧱 Mapa de Liquidez\n`;
        response += `${levelContext}\n`;
        response += `🔴 **Techo (R1):** ${pivotR1} (${distToR1}% distancia)\n`;
        response += `🔵 **Pivote Central:** ${pivotP}\n`;
        response += `🟢 **Suelo (S1):** ${pivotS1} (${distToS1}% distancia)\n\n`;

        // BLOQUE 4: PLAN DE BATALLA (STRATEGIC ACTION)
        response += `### ⚔️ Plan de Batalla Criptodamus\n`;
        
        // Estrategia de Confluencia
        if (marketPhase.includes("Tendencia Alcista")) {
             response += `**Estrategia: FOLLOW THE TREND (Seguimiento)**\n`;
             response += `El mercado es fuerte. No busques techos.\n`;
             response += `1. **Entrada Óptima:** Esperar retroceso a EMA 20 o soporte ${pivotS1}.\n`;
             response += `2. **Confirmación:** Vela envolvente alcista en H1.\n`;
             response += `3. **Objetivo:** Romper ${pivotR1} buscando liquidez superior.\n`;
        } 
        else if (marketPhase.includes("Tendencia Bajista")) {
             response += `**Estrategia: SELL THE RALLY (Venta en Rebote)**\n`;
             response += `La gravedad domina. Busca ventas en subidas débiles.\n`;
             response += `1. **Entrada Óptima:** Rechazo en la EMA 20 o resistencia ${pivotR1}.\n`;
             response += `2. **Confirmación:** Mecha superior larga (Rechazo) en 15m/1H.\n`;
             response += `3. **Objetivo:** Visitar ${pivotS1} y nuevos mínimos.\n`;
        }
        else if (marketPhase.includes("Acumulación")) {
             response += `**Estrategia: BUY THE DIP (Compra de Suelo)**\n`;
             response += `Macro alcista en zona baja. Riesgo/Beneficio alto.\n`;
             response += `1. **Entrada Agresiva:** Limit Order en ${pivotS1}.\n`;
             response += `2. **Stop Loss:** Estricto por debajo de ${pivotS1} (margen ${atrStr}).\n`;
        }
        else {
            // Rango
            response += `**Estrategia: RANGO (PING-PONG)**\n`;
            response += `Sin dirección clara. Compra abajo, vende arriba.\n`;
            response += `1. **Long:** Rebote en ${pivotS1}.\n`;
            response += `2. **Short:** Rechazo en ${pivotR1}.\n`;
            response += `3. **Advertencia:** Si ADX sube de 25, CANCELAR estrategia de rango (Ruptura inminente).`;
        }

        yield response;
    }
    // Lógica para preguntas puntuales (Riesgo, Niveles, etc.)
    else if (lowerMsg.includes('riesgo') || lowerMsg.includes('stop')) {
        yield `### 🛡️ Gestión de Riesgo\nBasado en ATR (${atrStr}):\n- **Long SL:** $${(price - parseFloat(atrStr.replace('$',''))*1.5).toFixed(4)}\n- **Short SL:** $${(price + parseFloat(atrStr.replace('$',''))*1.5).toFixed(4)}`;
    }
    else {
        // Fallback conversacional
        yield `**Sistema Autónomo:** He recibido tu mensaje. Para ver el análisis completo de nuevo, cambia de moneda o presiona "Generar Análisis Integral".\n\nDatos actuales: RSI ${rsiStr}, ADX ${adxStr}.`;
    }
}

// Función dummy para compatibilidad
export const generateBatchTradeSignals = async () => { return []; }