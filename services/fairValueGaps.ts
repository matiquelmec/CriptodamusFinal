import { Candle } from '../types-advanced';

export interface FairValueGap {
    top: number;
    bottom: number;
    midpoint: number;
    type: 'BULLISH' | 'BEARISH';
    timestamp: number;
    filled: boolean;  // Si el gap ya fue rellenado
    size: number;     // Tamaño del gap en precio
}

/**
 * Detecta Fair Value Gaps (FVG) en las velas proporcionadas
 * Un FVG es un gap/ineficiencia entre velas consecutivas que el precio tiende a rellenar
 */
export function detectFVG(candles: Candle[], atr: number, currentPrice: number): {
    bullishFVG: FairValueGap[];
    bearishFVG: FairValueGap[];
} {
    if (!candles || candles.length < 3 || atr === 0) {
        return { bullishFVG: [], bearishFVG: [] };
    }

    const bullishFVG: FairValueGap[] = [];
    const bearishFVG: FairValueGap[] = [];

    // Umbral mínimo para considerar un gap válido (30% del ATR)
    const minGapSize = atr * 0.3;

    // Buscar FVGs (últimas 30 velas)
    const lookback = Math.min(30, candles.length - 2);

    for (let i = candles.length - lookback; i < candles.length - 2; i++) {
        const candle1 = candles[i];     // Vela anterior
        const candle2 = candles[i + 1]; // Vela del medio (la que crea el gap)
        const candle3 = candles[i + 2]; // Vela siguiente

        // BULLISH FVG
        // Ocurre cuando hay un gap entre el high de candle1 y el low de candle3
        // durante un movimiento alcista
        const bullishGapBottom = candle1.high;
        const bullishGapTop = candle3.low;
        const bullishGapSize = bullishGapTop - bullishGapBottom;

        if (bullishGapSize > minGapSize && candle2.close > candle2.open) {
            const midpoint = (bullishGapTop + bullishGapBottom) / 2;

            // Verificar si el gap ya fue rellenado (precio volvió a la zona)
            const filled = currentPrice <= bullishGapTop;

            bullishFVG.push({
                top: bullishGapTop,
                bottom: bullishGapBottom,
                midpoint,
                type: 'BULLISH',
                timestamp: candle2.timestamp,
                filled,
                size: bullishGapSize
            });
        }

        // BEARISH FVG
        // Ocurre cuando hay un gap entre el low de candle1 y el high de candle3
        // durante un movimiento bajista
        const bearishGapTop = candle1.low;
        const bearishGapBottom = candle3.high;
        const bearishGapSize = bearishGapTop - bearishGapBottom;

        if (bearishGapSize > minGapSize && candle2.close < candle2.open) {
            const midpoint = (bearishGapTop + bearishGapBottom) / 2;

            // Verificar si el gap ya fue rellenado
            const filled = currentPrice >= bearishGapBottom;

            bearishFVG.push({
                top: bearishGapTop,
                bottom: bearishGapBottom,
                midpoint,
                type: 'BEARISH',
                timestamp: candle2.timestamp,
                filled,
                size: bearishGapSize
            });
        }
    }

    // Ordenar por tamaño descendente (gaps más grandes son más significativos)
    bullishFVG.sort((a, b) => b.size - a.size);
    bearishFVG.sort((a, b) => b.size - a.size);

    // Tomar solo los 5 más grandes
    return {
        bullishFVG: bullishFVG.slice(0, 5),
        bearishFVG: bearishFVG.slice(0, 5)
    };
}

/**
 * Encuentra el FVG más cercano a un precio dado
 */
export function findNearestFVG(
    price: number,
    fvgs: FairValueGap[],
    maxDistance: number
): FairValueGap | null {
    const validFVGs = fvgs.filter(fvg =>
        !fvg.filled && Math.abs(fvg.midpoint - price) <= maxDistance
    );

    if (validFVGs.length === 0) return null;

    return validFVGs.reduce((nearest, fvg) => {
        const distToCurrent = Math.abs(price - fvg.midpoint);
        const distToNearest = Math.abs(price - nearest.midpoint);
        return distToCurrent < distToNearest ? fvg : nearest;
    });
}

/**
 * Verifica si un precio está dentro de un FVG
 */
export function isPriceInFVG(price: number, fvg: FairValueGap): boolean {
    return price >= fvg.bottom && price <= fvg.top;
}

/**
 * Calcula el porcentaje de llenado de un FVG
 */
export function getFVGFillPercentage(currentPrice: number, fvg: FairValueGap): number {
    if (fvg.type === 'BULLISH') {
        if (currentPrice >= fvg.top) return 0; // No ha entrado
        if (currentPrice <= fvg.bottom) return 100; // Completamente lleno
        return ((fvg.top - currentPrice) / fvg.size) * 100;
    } else {
        if (currentPrice <= fvg.bottom) return 0; // No ha entrado
        if (currentPrice >= fvg.top) return 100; // Completamente lleno
        return ((currentPrice - fvg.bottom) / fvg.size) * 100;
    }
}
