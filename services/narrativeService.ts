
import { GoogleGenerativeAI } from "@google/generative-ai";
import { TechnicalIndicators } from "../types";
import { MarketRegime } from "../types-advanced";

// Initialize Gemini API
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

// Define models with fallback priority - More extensive list to avoid 404s
const MODELS_TO_TRY = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-001",
    "gemini-1.5-flash-8b",
    "gemini-1.0-pro",
    "gemini-pro"
];

// Helper: Iterate through models until one works
async function generateWithFallback(prompt: string): Promise<string> {
    let lastError: any;

    for (const modelName of MODELS_TO_TRY) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error: any) {
            // Only log debug to keep console clean for user, unless it's the last one
            console.debug(`Model ${modelName} failed:`, error.message);
            lastError = error;
            // Continue to next model
        }
    }

    // If all fail, throw the last error (or handle graceful fallback in caller)
    console.warn("All Gemini models failed. Check API Key or Region.");
    throw lastError;
}

/**
 * NARRATIVE SERVICE
 * The "Creative Brain" that translates the "Logical Brain's" data into human text.
 * Strict Rule: DO NOT invent numbers. Use provided data.
 */

export interface NarrativeContext {
    symbol: string;
    price: number;
    technicalIndicators: TechnicalIndicators;
    marketRegime: MarketRegime;
    sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
    confidenceScore: number;
}

export const generateInvestmentThesis = async (context: NarrativeContext): Promise<string> => {
    if (!API_KEY) {
        console.warn("⚠️ No API Key found for Gemini. Using fallback narrative.");
        return generateFallbackNarrative(context);
    }

    try {
        const prompt = `
        Act as an Elite Hedge Fund Manager explaining a trade setup to a high-net-worth client.
        
        CONTEXT:
        - Asset: ${context.symbol}
        - Current Price: $${context.price}
        - Market Regime: ${context.marketRegime.regime} (Confidence: ${context.marketRegime.confidence}%)
        - Technical Bias: ${context.sentiment} (Score: ${context.confidenceScore}/10)
        
        KEY METRICS (DO NOT INVENT NUMBERS, USE THESE):
        - RSI: ${context.technicalIndicators.rsi.toFixed(2)}
        - EMA200 Structure: Price is ${context.price > context.technicalIndicators.ema200 ? "ABOVE" : "BELOW"} EMA200
        - ADX (Trend Strength): ${context.technicalIndicators.adx.toFixed(2)}
        - ADX (Trend Strength): ${context.technicalIndicators.adx.toFixed(2)}
        - Volatility (ATR): $${context.technicalIndicators.atr.toFixed(4)}
        ${context.technicalIndicators.volumeExpert ? `
        EXPERT VOLUME METRICS (INSTITUTIONAL):
        - Open Interest: ${(context.technicalIndicators.volumeExpert.derivatives.openInterestValue / 1000000).toFixed(1)}M USD
        - Funding Rate: ${context.technicalIndicators.volumeExpert.derivatives.fundingRate.toFixed(4)}% (${context.technicalIndicators.volumeExpert.derivatives.fundingRate > 0.01 ? 'HIGH/GREED' : 'NORMAL'})
        - CVD (Delta): ${context.technicalIndicators.volumeExpert.cvd.trend} (${context.technicalIndicators.volumeExpert.cvd.current.toFixed(0)})
        - Coinbase Premium: ${context.technicalIndicators.volumeExpert.coinbasePremium.signal} (Gap: ${context.technicalIndicators.volumeExpert.coinbasePremium.gapPercent.toFixed(3)}%)
        ` : ''}
        
        TASK:
        Write a SHORT "Investment Thesis" (max 3 sentences).
        - Sentence 1: The "Why" based on Market Regime (e.g. "We are buying the dip in a Bull Market").
        - Sentence 2: The Technical Trigger (e.g. "Price reclaimed the Daily EMA200 with RSI divergence").
        - Sentence 3: The Risk/Warning (e.g. "However, Bitcoin dominance suggests caution").
        
        TONE: Professional, confident, institutional. No "To the moon" slang.
        LANGUAGE: Spanish (Español Neutro).
        `;

        const responseText = await generateWithFallback(prompt);
        return responseText;
    } catch (error) {
        console.error("Gemini API Error:", error);
        return generateFallbackNarrative(context);
    }
};

export const generateExecutionPlanNarrative = async (context: NarrativeContext, side: 'LONG' | 'SHORT'): Promise<string> => {
    if (!API_KEY) return generateFallbackExecutionNarrative(side);

    try {
        const prompt = `
        Act as a Senior Quant Trader defining an execution strategy.
        
        CONTEXT:
        - Side: ${side}
        - Symbol: ${context.symbol}
        - Volatility (ATR): $${context.technicalIndicators.atr}
        
        TASK:
        Explain the execution philosophy for this specific trade in 1-2 sentences.
        Focus on how we are entering (DCA? Breakout? Sniper?) based on the volatility.
        
        LANGUAGE: Spanish.
        `;

        return await generateWithFallback(prompt);
    } catch (error) {
        return generateFallbackExecutionNarrative(side);
    }
}

// --- FALLBACKS (Old Logic for safety) ---
function generateFallbackNarrative(ctx: NarrativeContext): string {
    const isBullish = ctx.sentiment === "BULLISH";
    if (ctx.marketRegime.regime === "TRENDING") {
        return isBullish
            ? "El activo muestra una fuerte tendencia alcista. Estamos buscando continuidad del momentum."
            : "La estructura de mercado es claramente bajista. Buscamos ventas en los rebotes.";
    }
    return "El mercado se encuentra en una fase de consolidación. Operaremos los extremos del rango con precaución.";
}

function generateFallbackExecutionNarrative(side: string): string {
    return side === 'LONG'
        ? "Utilizaremos una entrada escalonada (DCA) para mejorar nuestro precio promedio ante la volatilidad."
        : "Buscaremos vender en zonas de resistencia clave para minimizar el riesgo de atrapamiento.";
}
import { TechnicalIndicators } from "../types";
import { MarketRegime } from "../types-advanced";

// Initialize Gemini API
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

// Define models with fallback priority
const modelPrimary = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const modelFallback = genAI.getGenerativeModel({ model: "gemini-pro" });

// Helper: Try primary, then fallback
async function generateWithFallback(prompt: string): Promise<string> {
    try {
        const result = await modelPrimary.generateContent(prompt);
        return result.response.text();
    } catch (error: any) {
        console.warn("Primary model failed, retrying with fallback...", error.message);
        try {
            const result = await modelFallback.generateContent(prompt);
            return result.response.text();
        } catch (fallbackError) {
            throw error; // If both fail, throw original error
        }
    }
}

/**
 * NARRATIVE SERVICE
 * The "Creative Brain" that translates the "Logical Brain's" data into human text.
 * Strict Rule: DO NOT invent numbers. Use provided data.
 */

export interface NarrativeContext {
    symbol: string;
    price: number;
    technicalIndicators: TechnicalIndicators;
    marketRegime: MarketRegime;
    sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
    confidenceScore: number;
}

export const generateInvestmentThesis = async (context: NarrativeContext): Promise<string> => {
    if (!API_KEY) {
        console.warn("⚠️ No API Key found for Gemini. Using fallback narrative.");
        return generateFallbackNarrative(context);
    }

    try {
        const prompt = `
        Act as an Elite Hedge Fund Manager explaining a trade setup to a high-net-worth client.
        
        CONTEXT:
        - Asset: ${context.symbol}
        - Current Price: $${context.price}
        - Market Regime: ${context.marketRegime.regime} (Confidence: ${context.marketRegime.confidence}%)
        - Technical Bias: ${context.sentiment} (Score: ${context.confidenceScore}/10)
        
        KEY METRICS (DO NOT INVENT NUMBERS, USE THESE):
        - RSI: ${context.technicalIndicators.rsi.toFixed(2)}
        - EMA200 Structure: Price is ${context.price > context.technicalIndicators.ema200 ? "ABOVE" : "BELOW"} EMA200
        - ADX (Trend Strength): ${context.technicalIndicators.adx.toFixed(2)}
        - ADX (Trend Strength): ${context.technicalIndicators.adx.toFixed(2)}
        - Volatility (ATR): $${context.technicalIndicators.atr.toFixed(4)}
        ${context.technicalIndicators.volumeExpert ? `
        EXPERT VOLUME METRICS (INSTITUTIONAL):
        - Open Interest: ${(context.technicalIndicators.volumeExpert.derivatives.openInterestValue / 1000000).toFixed(1)}M USD
        - Funding Rate: ${context.technicalIndicators.volumeExpert.derivatives.fundingRate.toFixed(4)}% (${context.technicalIndicators.volumeExpert.derivatives.fundingRate > 0.01 ? 'HIGH/GREED' : 'NORMAL'})
        - CVD (Delta): ${context.technicalIndicators.volumeExpert.cvd.trend} (${context.technicalIndicators.volumeExpert.cvd.current.toFixed(0)})
        - Coinbase Premium: ${context.technicalIndicators.volumeExpert.coinbasePremium.signal} (Gap: ${context.technicalIndicators.volumeExpert.coinbasePremium.gapPercent.toFixed(3)}%)
        ` : ''}
        
        TASK:
        Write a SHORT "Investment Thesis" (max 3 sentences).
        - Sentence 1: The "Why" based on Market Regime (e.g. "We are buying the dip in a Bull Market").
        - Sentence 2: The Technical Trigger (e.g. "Price reclaimed the Daily EMA200 with RSI divergence").
        - Sentence 3: The Risk/Warning (e.g. "However, Bitcoin dominance suggests caution").
        
        TONE: Professional, confident, institutional. No "To the moon" slang.
        LANGUAGE: Spanish (Español Neutro).
        `;

        const responseText = await generateWithFallback(prompt);
        return responseText;
    } catch (error) {
        console.error("Gemini API Error:", error);
        return generateFallbackNarrative(context);
    }
};

export const generateExecutionPlanNarrative = async (context: NarrativeContext, side: 'LONG' | 'SHORT'): Promise<string> => {
    if (!API_KEY) return generateFallbackExecutionNarrative(side);

    try {
        const prompt = `
        Act as a Senior Quant Trader defining an execution strategy.
        
        CONTEXT:
        - Side: ${side}
        - Symbol: ${context.symbol}
        - Volatility (ATR): $${context.technicalIndicators.atr}
        
        TASK:
        Explain the execution philosophy for this specific trade in 1-2 sentences.
        Focus on how we are entering (DCA? Breakout? Sniper?) based on the volatility.
        
        LANGUAGE: Spanish.
        `;

        return await generateWithFallback(prompt);
    } catch (error) {
        return generateFallbackExecutionNarrative(side);
    }
}

// --- FALLBACKS (Old Logic for safety) ---
function generateFallbackNarrative(ctx: NarrativeContext): string {
    const isBullish = ctx.sentiment === "BULLISH";
    if (ctx.marketRegime.regime === "TRENDING") {
        return isBullish
            ? "El activo muestra una fuerte tendencia alcista. Estamos buscando continuidad del momentum."
            : "La estructura de mercado es claramente bajista. Buscamos ventas en los rebotes.";
    }
    return "El mercado se encuentra en una fase de consolidación. Operaremos los extremos del rango con precaución.";
}

function generateFallbackExecutionNarrative(side: string): string {
    return side === 'LONG'
        ? "Utilizaremos una entrada escalonada (DCA) para mejorar nuestro precio promedio ante la volatilidad."
        : "Buscaremos vender en zonas de resistencia clave para minimizar el riesgo de atrapamiento.";
}
