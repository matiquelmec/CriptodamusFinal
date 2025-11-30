
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

        // Determinar régimen con lógica robusta
        if (goldenCross && priceAboveEMA50 && priceAboveEMA200) {
            regime = 'BULL';
            strength = 85;
            reasoning = 'Golden Cross + Precio sobre EMAs (Tendencia alcista confirmada)';
        } else if (deathCross && !priceAboveEMA50 && !priceAboveEMA200) {
            regime = 'BEAR';
            strength = 85;
            reasoning = 'Death Cross + Precio bajo EMAs (Tendencia bajista confirmada)';
        } else if (priceAboveEMA200 && !goldenCross) {
            regime = 'BULL';
            strength = 65;
            reasoning = 'Precio sobre EMA200 pero sin Golden Cross (Alcista débil)';
        } else if (!priceAboveEMA200 && !deathCross) {
            regime = 'BEAR';
            strength = 65;
            reasoning = 'Precio bajo EMA200 pero sin Death Cross (Bajista débil)';
        } else {
            regime = 'RANGE';
            strength = 50;
            reasoning = 'Precio entre EMAs (Sin tendencia clara)';
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
 * Obtiene BTC Dominance y calcula tendencia
 * @returns Datos de dominancia con tendencia calculada
 */
async function getBTCDominance(): Promise<BTCDominanceData> {
    try {
        const res = await fetchWithTimeout(
            'https://api.coincap.io/v2/global',
            3000
        );

        if (!res.ok) throw new Error(`CoinCap API returned ${res.status}`);

        const json = await res.json();
        const current = parseFloat(json.data.bitcoinDominancePercentage);

        // Validar rango (debe estar entre 0-100)
        if (isNaN(current) || current < 0 || current > 100) {
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
            changePercent: 0 // TODO: Calcular con histórico si es necesario
        };

    } catch (error) {
        console.warn('[MacroService] BTC Dominance fetch failed:', error);
        // Fallback: Dominancia neutral
        return {
            current: 50,
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
        // Necesitamos Market Cap Global y Market Cap de USDT
        const [globalRes, usdtRes] = await Promise.all([
            fetchWithTimeout('https://api.coincap.io/v2/global', 3000),
            fetchWithTimeout('https://api.coincap.io/v2/assets/tether', 3000)
        ]);

        if (!globalRes.ok || !usdtRes.ok) throw new Error('API Error fetching USDT data');

        const globalJson = await globalRes.json();
        const usdtJson = await usdtRes.json();

        // CoinCap devuelve market caps en USD (pero a veces como string grande)
        // globalJson.data.totalMarketCapUsd es un número grande
        const totalMarketCap = parseFloat(globalJson.data.totalMarketCapUsd);
        const usdtMarketCap = parseFloat(usdtJson.data.marketCapUsd);

        if (!totalMarketCap || !usdtMarketCap) throw new Error('Invalid market cap data');

        const current = (usdtMarketCap / totalMarketCap) * 100;

        // Tendencia simple: > 5% es alto (miedo), < 3% es bajo (codicia)
        // Para tendencia real necesitaríamos histórico, por ahora usamos umbrales
        // USDT.D suele estar entre 3% (Bull run) y 8% (Bear market profundo)
        let trend: 'RISING' | 'FALLING' | 'STABLE' = 'STABLE';

        // Simplificación: Si es alto, asumimos presión alcista (miedo)
        if (current > 6.5) trend = 'RISING';
        else if (current < 4.0) trend = 'FALLING';

        return { current, trend };

    } catch (error) {
        console.warn('[MacroService] USDT Dominance fetch failed:', error);
        return { current: 5.0, trend: 'STABLE' }; // Valor medio seguro
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
