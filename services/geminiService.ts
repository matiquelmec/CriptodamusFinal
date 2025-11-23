import { GoogleGenAI, ChatSession, GenerateContentResponse } from "@google/genai";
import { AIOpportunity, TradingStyle } from "../types";

// Initialize AI instance if API Key is available in environment
let ai: GoogleGenAI | null = process.env.API_KEY ? new GoogleGenAI({ apiKey: process.env.API_KEY }) : null;
let chatSession: ChatSession | null = null;
let currentInstruction: string = '';

export const initializeGemini = (key: string) => {
  ai = new GoogleGenAI({ apiKey: key });
};

export const resetSession = () => {
    chatSession = null;
};

export const hasActiveSession = () => {
    return !!ai;
};

export const streamMarketAnalysis = async function* (userMessage: string, marketContext: string, systemInstruction: string) {
    if (!ai) throw new Error("API Key not set");

    // If instruction changed or session is null, create new
    if (!chatSession || currentInstruction !== systemInstruction) {
        chatSession = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.7,
                tools: [{ googleSearch: {} }] // Enable Google Search for economic news verification
            },
        });
        currentInstruction = systemInstruction;
    }

    const prompt = `
CONTEXTO DE MERCADO ACTUAL (Datos Reales):
${marketContext}

PREGUNTA DEL USUARIO:
${userMessage}
    `.trim();

    const stream = await chatSession.sendMessageStream({ message: prompt });
    
    // We don't collect sources anymore to keep the UI clean

    for await (const chunk of stream) {
        const c = chunk as GenerateContentResponse;
        
        if (c.text) {
            yield c.text;
        }
    }
}

// Helper for delay/retry
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Nueva función optimizada para generar señales en LOTE (Batching) con RETRY LOGIC
export const generateBatchTradeSignals = async (
    candidates: { symbol: string, technicalData: string }[],
    style: TradingStyle,
    retryCount = 0
): Promise<AIOpportunity[]> => {
    if (!ai || candidates.length === 0) return [];

    let strategyPrompt = "";
    if (style === 'SCALP_AGRESSIVE') {
        strategyPrompt = `
        ESTRATEGIA: QUANT MOMENTUM SCALP (15m).
        - Busca EXPANSIÓN de volatilidad.
        - RVOL debe ser alto.
        - Entradas en rupturas o rebotes en EMA 20.
        - Ratios rápidos 1:1.5. Stop Loss ajustado.
        `;
    } else if (style === 'SWING_INSTITUTIONAL') {
        strategyPrompt = `
        ESTRATEGIA: SMC LIQUIDITY SWING (4h).
        - Identifica "Liquidity Sweeps" (toma de mínimos/máximos).
        - Busca Order Blocks y FVG.
        - IMPRESCINDIBLE: Define DCA (promediación).
        - Ratios amplios 1:3.
        `;
    } else if (style === 'ICHIMOKU_CLOUD') {
        strategyPrompt = `
        ESTRATEGIA: ICHIMOKU "ZEN DRAGON".
        - Prioridad: PRECIO vs Nube (Kumo).
        - Gatillo: Cruce Tenkan/Kijun (TK Cross).
        - TP: Proyecciones.
        `;
    } else {
        strategyPrompt = `
        ESTRATEGIA: VOLATILITY BREAKOUT.
        - Compresión antes de Explosión.
        - Entra a favor de EMAs.
        `;
    }

    // Construimos un contexto unificado
    const assetsContext = candidates.map(c => `
=== ACTIVO: ${c.symbol} ===
${c.technicalData}
    `).join('\n\n');

    const prompt = `
Eres un Algoritmo de Trading Institucional (SMC & Quant).
Analiza los siguientes ${candidates.length} activos SIMULTÁNEAMENTE.

${assetsContext}

${strategyPrompt}

TU TAREA:
Genera un ARRAY JSON con las señales válidas.
Analiza cada activo individualmente. 
Si un activo tiene una configuración técnica débil, RVOL bajo (<1) o no cumple la estrategia, NO lo incluyas o ponle "confidenceScore": 0.

FORMATO DE RESPUESTA (Array JSON):
[
  {
    "symbol": "BTC/USDT", 
    "side": "LONG" | "SHORT",
    "entryZone": { "min": number, "max": number },
    "dcaLevel": number (opcional, null si no aplica),
    "stopLoss": number,
    "takeProfits": { "tp1": number, "tp2": number, "tp3": number },
    "technicalReasoning": "Resumen técnico de 1 frase (ej: Liquidez tomada en 4h + Divergencia)",
    "confidenceScore": number (0-100)
  }
]

Responde SOLAMENTE con el JSON.
    `.trim();

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });

        const text = response.text;
        if (!text) return [];
        
        const data = JSON.parse(text);
        
        if (Array.isArray(data)) {
            // Map to internal types and add IDs
            return data.map((signal: any) => ({
                id: Date.now().toString() + Math.random().toString().slice(2),
                symbol: signal.symbol,
                timestamp: Date.now(),
                strategy: style,
                side: signal.side,
                confidenceScore: signal.confidenceScore || 50,
                entryZone: signal.entryZone,
                dcaLevel: signal.dcaLevel,
                stopLoss: signal.stopLoss,
                takeProfits: signal.takeProfits,
                technicalReasoning: signal.technicalReasoning || "Análisis técnico IA",
                invalidated: false
            })).filter((s: AIOpportunity) => s.confidenceScore > 0);
        }
        
        return [];

    } catch (error: any) {
        // Robust 429 Handling with Exponential Backoff
        if ((error.toString().includes('429') || error.status === 429) && retryCount < 3) {
            const waitTime = 2000 * Math.pow(2, retryCount); // 2s, 4s, 8s
            console.warn(`Rate limit hit (429). Retrying in ${waitTime}ms (Attempt ${retryCount + 1}/3)...`);
            await delay(waitTime);
            return generateBatchTradeSignals(candidates, style, retryCount + 1);
        }

        console.error("Error generating batch signals:", error);
        
        // If we exhausted retries or it's another error, throw it so UI knows
        if (retryCount >= 3) {
            throw new Error("API Quota Exceeded (429). Please wait a moment.");
        }
        
        return [];
    }
}