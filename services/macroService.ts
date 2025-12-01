
import { calculateEMA, calculateATR } from './mathUtils';

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
    btcRegime: BTCRegimeAnalysis;
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
const fetchWithTimeout = async (url: string, timeout = 4000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

// ============================================================================
// CORE ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analiza el régimen de mercado de BTC usando EMAs en timeframe diario
 * @returns Análisis completo del régimen con razonamiento
 */
async function analyzeBTCRegime(): Promise<BTCRegimeAnalysis> {
    try {
        // Obtener velas diarias de BTC (últimos 200 días para EMA200)
        const res = await fetchWithTimeout(
            'https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=200',
            5000
        );

        if (!res.ok) throw new Error(`Binance API returned ${res.status}`);

        const candles = await res.json();
        const closes = candles.map((c: any[]) => parseFloat(c[4]));

        const ema50 = calculateEMA(closes, 50);
        const ema200 = calculateEMA(closes, 200);
        const currentPrice = closes[closes.length - 1];

        // Calcular Volatilidad (ATR 14)
        const highs = candles.map((c: any[]) => parseFloat(c[2]));
        const lows = candles.map((c: any[]) => parseFloat(c[3]));
        const atr = calculateATR(highs, lows, closes, 14);
        const atrPercent = (atr / currentPrice) * 100;

        let volatilityStatus: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL';
        if (atrPercent > 4.5) volatilityStatus = 'HIGH'; // >4.5% movimiento diario promedio es alto
        else if (atrPercent < 1.5) volatilityStatus = 'LOW';

        // Lógica de régimen
        let regime: 'BULL' | 'BEAR' | 'RANGE' = 'RANGE';
        let strength = 50;
        let reasoning = '';

        const priceAboveEMA50 = currentPrice > ema50;
        const priceAboveEMA200 = currentPrice > ema200;
        const goldenCross = ema50 > ema200;
        const deathCross = ema50 < ema200;

        // Determinar régimen con lógica robusta y educativa
        if (goldenCross && priceAboveEMA50 && priceAboveEMA200) {
            regime = 'BULL';
            strength = 85;
            reasoning = '🟢 Alcista (Diario): Precio sobre EMAs 50 y 200. "Golden Cross" activo (La media de 50 días cruzó arriba de la de 200), indicando que el momentum de corto plazo supera al histórico.';
        } else if (deathCross && !priceAboveEMA50 && !priceAboveEMA200) {
            regime = 'BEAR';
            strength = 85;
            reasoning = '🔴 Bajista (Diario): Precio bajo EMAs 50 y 200. "Death Cross" activo (La media de 50 días cruzó abajo de la de 200), señalando debilidad estructural a largo plazo.';
        } else if (priceAboveEMA200 && !goldenCross) {
            regime = 'BULL';
            strength = 65;
            reasoning = '🟡 Alcista Débil (Diario): Precio sobre la EMA de 200 días (Soporte Mayor), pero sin Golden Cross. El mercado es resiliente pero le falta momentum explosivo.';
        } else if (!priceAboveEMA200 && !deathCross) {
            regime = 'BEAR';
            strength = 65;
            reasoning = '🟠 Bajista Débil (Diario): Precio bajo la EMA de 200 días (Resistencia Mayor), pero sin Death Cross. Peligro de caída mayor si no recupera pronto.';
        } else {
            regime = 'RANGE';
            strength = 50;
            reasoning = '⚪ Rango / Indecisión (Diario): El precio está atrapado entre las EMAs 50 y 200. El mercado busca dirección; operar con cautela (esperar ruptura).';
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
        console.warn('[MacroService] BTC Regime analysis failed:', error);
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

/**
 * Obtiene datos globales de CoinGecko (Dominancia BTC, USDT, etc.)
 * Fuente más confiable que CoinCap
 */
async function fetchCoinGeckoGlobal(): Promise<any> {
    const res = await fetchWithTimeout(
        'https://api.coingecko.com/api/v3/global',
        4000
    );
    if (!res.ok) throw new Error(`CoinGecko API returned ${res.status}`);
    return res.json();
}

/**
 * Obtiene BTC Dominance y calcula tendencia
 * @returns Datos de dominancia con tendencia calculada
 */
async function getBTCDominance(): Promise<BTCDominanceData> {
    try {
        // INTENTO 1: CoinGecko (Más robusto)
        const json = await fetchCoinGeckoGlobal();
        const current = json.data.market_cap_percentage.btc;

        // Validar rango
        if (!current || current < 0 || current > 100) {
            throw new Error(`Invalid BTC dominance value: ${current}`);
        }

        // Calcular tendencia basada en umbrales históricos
        let trend: 'RISING' | 'FALLING' | 'STABLE' = 'STABLE';

        if (current > 55) {
            trend = 'RISING'; // Capital concentrándose en BTC
        } else if (current < 45) {
            trend = 'FALLING'; // Capital fluyendo a altcoins (alt season)
        }

        return {
            current,
            trend,
            changePercent: 0
        };

    } catch (error) {
        console.warn('[MacroService] BTC Dominance fetch failed (CoinGecko):', error);

        // Fallback explícito para no engañar al usuario
        return {
            current: 50.0,
            trend: 'STABLE',
            changePercent: 0
        };
    }
}

/**
 * Obtiene USDT Dominance (Correlación Inversa)
 * @returns Datos de dominancia USDT
 */
async function getUSDTDominance(): Promise<USDTDominanceData> {
    try {
        // INTENTO 1: CoinGecko (Ya tiene este dato calculado)
        const json = await fetchCoinGeckoGlobal();
        const current = json.data.market_cap_percentage.usdt;

        if (!current) throw new Error('USDT dominance not found in CoinGecko response');

        // Tendencia simple: > 5% es alto (miedo), < 3% es bajo (codicia)
        let trend: 'RISING' | 'FALLING' | 'STABLE' = 'STABLE';

        if (current > 6.5) trend = 'RISING';
        else if (current < 4.0) trend = 'FALLING';

        return { current, trend };

    } catch (error) {
        console.warn('[MacroService] USDT Dominance fetch failed:', error);
        return { current: 5.0, trend: 'STABLE' };
    }
}

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

    // Fetch paralelo de ambos datos para optimizar latencia
    const [btcRegime, btcDominance, usdtDominance] = await Promise.all([
        analyzeBTCRegime(),
        getBTCDominance(),
        getUSDTDominance()
    ]);

    const context: MacroContext = {
        btcRegime,
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
    const regimeInfo = `RÉGIMEN BTC (Diario): ${macro.btcRegime.regime} (${macro.btcRegime.strength}% Fuerza). ${macro.btcRegime.reasoning}`;

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
