import { Candle } from '../types/types-advanced';

export interface OrderBlock {
    price: number;      // Precio del Order Block (centro del rango)
    high: number;       // Límite superior
    low: number;        // Límite inferior
    strength: number;   // Fuerza (0-10)
    type: 'BULLISH' | 'BEARISH';
    timestamp: number;
    mitigated: boolean; // Si el precio ya volvió a esta zona
}

/**
 * Detecta Order Blocks en las velas proporcionadas
 * Un Order Block es una vela con alto volumen seguida de un desplazamiento fuerte
 */
export function detectOrderBlocks(candles: Candle[], atr: number, currentPrice: number): {
    bullishOB: OrderBlock[];
    bearishOB: OrderBlock[];
} {
    if (!candles || candles.length < 10 || atr === 0) {
        return { bullishOB: [], bearishOB: [] };
    }

    const bullishOB: OrderBlock[] = [];
    const bearishOB: OrderBlock[] = [];

    // Calcular volumen promedio
    const avgVolume = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;

    // Buscar Order Blocks (últimas 50 velas para no sobrecargar)
    const lookback = Math.min(50, candles.length - 3);

    for (let i = candles.length - lookback; i < candles.length - 2; i++) {
        const currentCandle = candles[i];
        const nextCandle = candles[i + 1];
        const next2Candle = candles[i + 2];

        // Calcular desplazamiento (displacement)
        const displacement = Math.abs(next2Candle.close - currentCandle.close);
        const isStrongMove = displacement > atr * 1.5;

        // Verificar si la vela tiene volumen significativo
        const hasHighVolume = currentCandle.volume > avgVolume * 1.2;

        if (!isStrongMove || !hasHighVolume) continue;

        // BULLISH ORDER BLOCK
        // Condición: Vela bajista/neutral seguida de movimiento alcista fuerte
        if (next2Candle.close > currentCandle.close + atr) {
            const isBearishCandle = currentCandle.close <= currentCandle.open;

            if (isBearishCandle) {
                const obLow = Math.min(currentCandle.open, currentCandle.close);
                const obHigh = Math.max(currentCandle.open, currentCandle.close);
                const obPrice = (obLow + obHigh) / 2;

                // Verificar si ya fue mitigado (precio volvió a la zona)
                const mitigated = currentPrice < obHigh;

                // Calcular strength basado en volumen y desplazamiento
                const volumeStrength = Math.min((currentCandle.volume / avgVolume) * 3, 5);
                const displacementStrength = Math.min((displacement / atr) * 2, 5);
                const strength = Math.min(volumeStrength + displacementStrength, 10);

                bullishOB.push({
                    price: obPrice,
                    high: obHigh,
                    low: obLow,
                    strength,
                    type: 'BULLISH',
                    timestamp: currentCandle.timestamp,
                    mitigated
                });
            }
        }

        // BEARISH ORDER BLOCK
        // Condición: Vela alcista/neutral seguida de movimiento bajista fuerte
        if (next2Candle.close < currentCandle.close - atr) {
            const isBullishCandle = currentCandle.close >= currentCandle.open;

            if (isBullishCandle) {
                const obLow = Math.min(currentCandle.open, currentCandle.close);
                const obHigh = Math.max(currentCandle.open, currentCandle.close);
                const obPrice = (obLow + obHigh) / 2;

                // Verificar si ya fue mitigado
                const mitigated = currentPrice > obLow;

                // Calcular strength
                const volumeStrength = Math.min((currentCandle.volume / avgVolume) * 3, 5);
                const displacementStrength = Math.min((displacement / atr) * 2, 5);
                const strength = Math.min(volumeStrength + displacementStrength, 10);

                bearishOB.push({
                    price: obPrice,
                    high: obHigh,
                    low: obLow,
                    strength,
                    type: 'BEARISH',
                    timestamp: currentCandle.timestamp,
                    mitigated
                });
            }
        }
    }

    // Ordenar por strength descendente y tomar solo los 5 más fuertes
    bullishOB.sort((a, b) => b.strength - a.strength);
    bearishOB.sort((a, b) => b.strength - a.strength);

    return {
        bullishOB: bullishOB.slice(0, 5),
        bearishOB: bearishOB.slice(0, 5)
    };
}

/**
 * Encuentra el Order Block más cercano a un precio dado
 */
export function findNearestOB(
    price: number,
    orderBlocks: OrderBlock[],
    maxDistance: number
): OrderBlock | null {
    const validOBs = orderBlocks.filter(ob =>
        !ob.mitigated && Math.abs(ob.price - price) <= maxDistance
    );

    if (validOBs.length === 0) return null;

    return validOBs.reduce((nearest, ob) => {
        const distToCurrent = Math.abs(price - ob.price);
        const distToNearest = Math.abs(price - nearest.price);
        return distToCurrent < distToNearest ? ob : nearest;
    });
}

/**
 * Verifica si un precio está dentro de un Order Block
 */
export function isPriceInOB(price: number, ob: OrderBlock): boolean {
    return price >= ob.low && price <= ob.high;
}
