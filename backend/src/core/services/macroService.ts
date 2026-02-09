
import { calculateEMA, calculateATR } from './mathUtils';
import { SmartFetch } from './SmartFetch';
import { fetchGlobalMarketData } from '../../services/globalMarketService';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface BTCRegimeAnalysis {
    regime: 'BULL' | 'BEAR' | 'RANGE';
    strength: number; // 0-100
    ema50: number;
    ema200: number;
    currentPrice: number;
    reasoning: string;
    volatilityStatus: 'LOW' | 'NORMAL' | 'HIGH';
    atr: number;
}

export interface USDTDominanceData {
    current: number;
    trend: 'RISING' | 'FALLING' | 'STABLE';
}

export interface BTCDominanceData {
    current: number; // Porcentaje (ej: 54.2)
    trend: 'RISING' | 'FALLING' | 'STABLE';
    changePercent: number; // Cambio en últimas 24h
}

export interface MacroContext {
    btcRegime: BTCRegimeAnalysis; // Daily
    btcWeeklyRegime: BTCRegimeAnalysis; // Weekly (NEW)
    btcDominance: BTCDominanceData;
    usdtDominance: USDTDominanceData;
    timestamp: number;
    isStale: boolean; // true si data > 5 minutos
}

interface CachedMacroData {
    data: MacroContext;
    fetchedAt: number;
}

// ============================================================================
// CACHE & CONSTANTS
// ============================================================================

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
let macroCache: CachedMacroData | null = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Fetch with timeout (reutilizando patrón existente del proyecto)
 */
// fetchWithTimeout removed as we now use SmartFetch

// ============================================================================
// CORE ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analiza el régimen de mercado de BTC usando EMAs en el timeframe solicitado
 * @param interval Timeframe a analizar ('1d', '1w'). Default: '1d'
 * @returns Análisis completo del régimen con razonamiento
 */
async function analyzeBTCRegime(interval: string = '1d'): Promise<BTCRegimeAnalysis> {
    try {
        const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=200`;
        console.log(`[Macro Debug] Fetching: ${url}`);

        const candles = await SmartFetch.get<any[]>(url);

        const lastCandle = candles[candles.length - 1];
        const lastTime = new Date(lastCandle[0]).toISOString();
        const closes = candles.map((c: any[]) => parseFloat(c[4]));
        const currentPrice = closes[closes.length - 1];

        console.log(`[Macro Debug] Last Candle Time: ${lastTime} | Price: ${currentPrice}`);

        const ema50 = calculateEMA(closes, 50);
        const ema200 = calculateEMA(closes, 200);

        // Calcular Volatilidad (ATR 14)
        const highs = candles.map((c: any[]) => parseFloat(c[2]));
        const lows = candles.map((c: any[]) => parseFloat(c[3]));
        const atr = calculateATR(highs, lows, closes, 14);
        const atrPercent = (atr / currentPrice) * 100;

        let volatilityStatus: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL';
        if (atrPercent > 4.5) volatilityStatus = 'HIGH'; // >4.5% movimiento promedio es alto
        else if (atrPercent < 1.5) volatilityStatus = 'LOW';

        // Lógica de régimen
        let regime: 'BULL' | 'BEAR' | 'RANGE' = 'RANGE';
        let strength = 50;
        let reasoning = '';

        const priceAboveEMA50 = currentPrice > ema50;
        const priceAboveEMA200 = currentPrice > ema200;
        const goldenCross = ema50 > ema200;
        const deathCross = ema50 < ema200;

        const tfLabel = interval === '1d' ? 'Diario' : 'Semanal';

        // Determinar régimen con lógica robusta y educativa
        if (goldenCross && priceAboveEMA50 && priceAboveEMA200) {
            regime = 'BULL';
            strength = 85;
            reasoning = `🟢 Alcista (${tfLabel}): Precio sobre EMAs 50 y 200. Golden Cross activo, momentum fuerte.`;
        } else if (deathCross && !priceAboveEMA50 && !priceAboveEMA200) {
            regime = 'BEAR';
            strength = 85;
            reasoning = `🔴 Bajista (${tfLabel}): Precio bajo EMAs 50 y 200. Death Cross activo, debilidad estructural.`;
        } else if (priceAboveEMA200 && !goldenCross) {
            regime = 'BULL';
            strength = 65;
            reasoning = `🟡 Alcista Débil (${tfLabel}): Precio sobre EMA 200 (Soporte Mayor), pero sin Golden Cross. Resiliente.`;
        } else if (!priceAboveEMA200 && !deathCross) {
            regime = 'BEAR';
            strength = 65;
            reasoning = `🟠 Bajista Débil (${tfLabel}): Precio bajo EMA 200 (Resistencia Mayor), sin Death Cross. Peligro.`;
        } else {
            regime = 'RANGE';
            strength = 50;
            reasoning = `⚪ Rango / Indecisión (${tfLabel}): Precio entre EMAs. Esperar ruptura.`;
        }

        return {
            regime,
            strength,
            ema50,
            ema200,
            currentPrice,
            reasoning,
            volatilityStatus,
            atr
        };

    } catch (error) {
        console.warn(`[MacroService] BTC Regime (${interval}) analysis failed:`, error);
        // Fallback: Régimen neutral para no afectar el sistema
        return {
            regime: 'RANGE',
            strength: 50,
            ema50: 0,
            ema200: 0,
            currentPrice: 0,
            reasoning: 'Datos no disponibles (Fallback a neutral)',
            volatilityStatus: 'NORMAL',
            atr: 0
        };
    }
}

// Fallback functions removed as we now use globalMarketService

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Función principal: Obtiene contexto macro completo con caché inteligente
 * @returns Contexto macroeconómico completo (BTC régimen + dominancia)
 */
export async function getMacroContext(): Promise<MacroContext> {
    const now = Date.now();

    // Verificar caché (5 minutos de validez)
    if (macroCache && (now - macroCache.fetchedAt) < CACHE_DURATION) {
        return {
            ...macroCache.data,
            isStale: false
        };
    }

    // Fetch paralelo de régimen y datos globales
    const [btcRegime, btcWeeklyRegime, globalData] = await Promise.all([
        analyzeBTCRegime('1d'),
        analyzeBTCRegime('1w'),
        fetchGlobalMarketData()
    ]);

    // Construct Dominance Objects from Global Data
    const btcDominance: BTCDominanceData = {
        current: globalData.btcDominance,
        trend: 'STABLE', // Could infer trend if we had history, keeping simple for now
        changePercent: 0
    };

    const usdtDominance: USDTDominanceData = {
        current: globalData.usdtDominance,
        trend: 'STABLE'
    };

    const context: MacroContext = {
        btcRegime,
        btcWeeklyRegime,
        btcDominance,
        usdtDominance,
        timestamp: now,
        isStale: false
    };

    // Actualizar caché
    macroCache = {
        data: context,
        fetchedAt: now
    };

    return context;
}

/**
 * Formatea el contexto macro en string educativo para el AI Advisor
 * @param macro - Contexto macro completo
 * @returns String formateado con información educativa y análisis de condiciones especiales
 */
export function formatMacroForAI(macro: MacroContext): string {
    const regimeInfo = `RÉGIMEN BTC (Semanal): ${macro.btcWeeklyRegime.regime} | (Diario): ${macro.btcRegime.regime} (${macro.btcRegime.strength}% Fuerza). ${macro.btcRegime.reasoning}`;

    let volatilityNote = `VOLATILIDAD: ${macro.btcRegime.volatilityStatus} (ATR: ${macro.btcRegime.atr.toFixed(0)})`;
    if (macro.btcRegime.volatilityStatus === 'HIGH' && macro.btcRegime.regime === 'RANGE') {
        volatilityNote += " [⚠️ KILL SWITCH ACTIVO: Mercado en rango peligroso, no operar]";
    }

    const capitalFlow = `FLUJO DE CAPITAL: BTC.D ${macro.btcDominance.trend} (${macro.btcDominance.current.toFixed(1)}%) | USDT.D ${macro.usdtDominance.trend} (${macro.usdtDominance.current.toFixed(1)}%)`;

    let specialConditions = "";
    if (macro.btcRegime.regime === 'BEAR' && (macro.btcDominance.trend === 'RISING' || macro.usdtDominance.trend === 'RISING')) {
        specialConditions = "\n🔥 CONDICIÓN SNIPER SHORT ACTIVA: Mercado bajista + Drenaje de liquidez. Los shorts en Altcoins tienen alta probabilidad.";
    } else if (macro.btcRegime.regime === 'BULL' && macro.btcDominance.trend === 'FALLING') {
        specialConditions = "\n🚀 ALT SEASON DETECTADA: Mercado alcista + BTC perdiendo dominancia. Buscar entradas agresivas en Alts.";
    }

    return `CONTEXTO MACROECONÓMICO INTEGRAL:\n${regimeInfo}\n${volatilityNote}\n${capitalFlow}${specialConditions}`;
}


/**
 * Función helper: Obtiene solo régimen de BTC (más ligero si solo necesitas esto)
 * @returns Análisis de régimen de BTC
 */
export async function getBTCRegimeQuick(): Promise<BTCRegimeAnalysis> {
    try {
        const context = await getMacroContext();
        return context.btcRegime;
    } catch (error) {
        console.error('[MacroService] Error getting BTC regime:', error);
        return {
            regime: 'RANGE',
            strength: 50,
            ema50: 0,
            ema200: 0,
            currentPrice: 0,
            reasoning: 'Error obteniendo datos',
            volatilityStatus: 'NORMAL',
            atr: 0
        };
    }
}

/**
 * Limpia el caché (útil para testing o forzar refresh)
 */
export function clearMacroCache(): void {
    macroCache = null;
}
