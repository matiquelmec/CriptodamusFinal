
import { calculateBollingerStats } from '../mathUtils';

export interface BreakoutSignal {
    score: number;
    signalSide: 'LONG' | 'SHORT';
    detectionNote: string;
    specificTrigger: string;
}

export const analyzeBreakoutSignal = (
    prices: number[],
    highs: number[],
    lows: number[],
    rvol: number,
    resistances?: number[] // NEW: Resistencias conocidas para validación
): BreakoutSignal | null => {
    const checkIndex = prices.length - 1;
    const currentPrice = prices[checkIndex];

    // Ensure enough data for 20 periods
    if (checkIndex < 20) return null;

    // DONCHIAN CHANNEL LOGIC (20 Periods)
    // We look at the PAST 20 candles (excluding current) to define the channel
    const pastHighs = highs.slice(checkIndex - 20, checkIndex);
    const pastLows = lows.slice(checkIndex - 20, checkIndex);
    const maxHigh20 = Math.max(...pastHighs);
    const minLow20 = Math.min(...pastLows);

    // Volatility Expansion Check
    const { bandwidth } = calculateBollingerStats(prices);
    // Previous bandwidth (approximate by removing last candle)
    const prevBandwidth = calculateBollingerStats(prices.slice(0, checkIndex)).bandwidth;
    const isExpanding = bandwidth > prevBandwidth;

    // 1. BULLISH BREAKOUT
    if (currentPrice > maxHigh20 && rvol > 1.5 && isExpanding) {
        // NEW: VALIDACIÓN DE CIERRE FUERTE (Institucional)
        // Un breakout real debe cerrar fuerte (>70% del rango de la vela)
        const currentHigh = highs[checkIndex];
        const currentLow = lows[checkIndex];
        const candleRange = currentHigh - currentLow;

        if (candleRange > 0) {
            const closeStrength = (currentPrice - currentLow) / candleRange;

            // Si cerró débil (<70%), es posible bull trap
            if (closeStrength < 0.7) {
                return null; // Descartar breakout no confirmado
            }
        }

        let score = 75 + Math.min((rvol * 5), 20);

        // NEW: PENALIZACIÓN POR RESISTENCIAS CERCANAS
        // Si hay resistencia <2% arriba, el breakout puede fallar
        if (resistances && resistances.length > 0) {
            const nearResistance = resistances.some(r =>
                r > currentPrice && ((r - currentPrice) / currentPrice) < 0.02
            );
            if (nearResistance) {
                score -= 20; // Penalización significativa
            }
        }

        return {
            score,
            signalSide: 'LONG',
            detectionNote: `Donchian Breakout: Ruptura de Máximo de 20 periodos con Expansión. La expansión de bandas confirma que el movimiento tiene fuerza real y no es ruido.`,
            specificTrigger: `Price > ${maxHigh20.toFixed(4)} (20p High) + RVOL ${rvol.toFixed(1)}x`
        };
    }
    // 2. BEARISH BREAKDOWN
    else if (currentPrice < minLow20 && rvol > 1.5 && isExpanding) {
        // NEW: VALIDACIÓN DE CIERRE FUERTE PARA SHORT
        // Debe cerrar en el 30% inferior de la vela (presión vendedora)
        const currentHigh = highs[checkIndex];
        const currentLow = lows[checkIndex];
        const candleRange = currentHigh - currentLow;

        if (candleRange > 0) {
            const closeStrength = (currentPrice - currentLow) / candleRange;

            // Para SHORT, queremos cierre débil (<30%)
            if (closeStrength > 0.3) {
                return null; // Breakdown no confirmado
            }
        }

        let score = 75 + Math.min((rvol * 5), 20);

        // NEW: PENALIZACIÓN POR SOPORTES CERCANOS (para SHORTs)
        if (resistances && resistances.length > 0) {
            // Para SHORT, "resistances" actúan como soportes
            const nearSupport = resistances.some(r =>
                r < currentPrice && ((currentPrice - r) / currentPrice) < 0.02
            );
            if (nearSupport) {
                score -= 20;
            }
        }

        return {
            score,
            signalSide: 'SHORT',
            detectionNote: `Donchian Breakdown: Ruptura de Mínimo de 20 periodos con Expansión. La volatilidad creciente valida la continuación bajista y la debilidad del soporte.`,
            specificTrigger: `Price < ${minLow20.toFixed(4)} (20p Low) + RVOL ${rvol.toFixed(1)}x`
        };
    }

    return null;
};
