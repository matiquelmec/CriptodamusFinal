import { Candle } from '../types/types-advanced';

export interface VolumeProfile {
    poc: number;           // Point of Control (precio con mayor volumen)
    valueAreaHigh: number; // 70% del volumen (límite superior)
    valueAreaLow: number;  // 70% del volumen (límite inferior)
    totalVolume: number;
    lowVolumeNodes?: number[]; // NEW: Valles de volumen (zonas de rechazo)
}

export interface VolumeBin {
    priceLevel: number;
    volume: number;
}

/**
 * Calcula el Volume Profile de las velas proporcionadas
 * El PoC (Point of Control) es el nivel de precio donde se negoció más volumen
 */
export function calculateVolumeProfile(candles: Candle[], atr: number): VolumeProfile {
    if (!candles || candles.length === 0) {
        return { poc: 0, valueAreaHigh: 0, valueAreaLow: 0, totalVolume: 0 };
    }

    // Determinar rango de precios
    const prices = candles.flatMap(c => [c.high, c.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Crear bins (agrupaciones) de precio
    // Usamos ATR/2 como tamaño de bin para tener resolución adecuada
    const binSize = atr / 2;
    const numBins = Math.ceil((maxPrice - minPrice) / binSize);

    // Inicializar bins
    const bins: VolumeBin[] = [];
    for (let i = 0; i < numBins; i++) {
        bins.push({
            priceLevel: minPrice + (i * binSize) + (binSize / 2), // Centro del bin
            volume: 0
        });
    }

    // Distribuir volumen en bins
    let totalVolume = 0;
    candles.forEach(candle => {
        const candleVolume = candle.volume;
        totalVolume += candleVolume;

        // Distribuir el volumen de la vela proporcionalmente en los bins que cubre
        const candleRange = candle.high - candle.low;
        if (candleRange === 0) {
            // Vela doji, todo el volumen va a un bin
            const binIndex = Math.floor((candle.close - minPrice) / binSize);
            if (binIndex >= 0 && binIndex < bins.length) {
                bins[binIndex].volume += candleVolume;
            }
        } else {
            // Distribuir proporcionalmente
            for (let i = 0; i < bins.length; i++) {
                const binLow = minPrice + (i * binSize);
                const binHigh = binLow + binSize;

                // Calcular overlap entre vela y bin
                const overlapLow = Math.max(candle.low, binLow);
                const overlapHigh = Math.min(candle.high, binHigh);

                if (overlapHigh > overlapLow) {
                    const overlapRatio = (overlapHigh - overlapLow) / candleRange;
                    bins[i].volume += candleVolume * overlapRatio;
                }
            }
        }
    });

    // Encontrar PoC (bin con mayor volumen)
    const pocBin = bins.reduce((max, bin) => bin.volume > max.volume ? bin : max, bins[0]);
    const poc = pocBin.priceLevel;

    // Calcular Value Area (70% del volumen)
    // Ordenar bins por volumen descendente
    const sortedBins = [...bins].sort((a, b) => b.volume - a.volume);

    let accumulatedVolume = 0;
    const targetVolume = totalVolume * 0.7;
    const valueAreaBins: VolumeBin[] = [];

    for (const bin of sortedBins) {
        valueAreaBins.push(bin);
        accumulatedVolume += bin.volume;
        if (accumulatedVolume >= targetVolume) break;
    }

    // Encontrar límites del Value Area
    const valueAreaPrices = valueAreaBins.map(b => b.priceLevel);
    const valueAreaHigh = Math.max(...valueAreaPrices);
    const valueAreaLow = Math.min(...valueAreaPrices);

    // 6. Detect Low Volume Nodes (LVNs)
    // Un LVN es un valle local en bins con volumen sig. menor a sus vecinos
    const lowVolumeNodes: number[] = [];
    if (bins.length > 2) {
        for (let i = 1; i < bins.length - 1; i++) {
            const currentVol = bins[i].volume;
            const prevVol = bins[i - 1].volume;
            const nextVol = bins[i + 1].volume;

            // Condición menos estricta: Valle local y significativamente menor al promedio de volumen
            const avgVol = totalVolume / bins.length;
            if (currentVol < prevVol && currentVol < nextVol && currentVol < avgVol * 0.5) {
                lowVolumeNodes.push(bins[i].priceLevel);
            }
        }
    }

    return {
        poc,
        valueAreaHigh,
        valueAreaLow,
        totalVolume,
        lowVolumeNodes
    };
}

/**
 * Verifica si un precio está dentro del Value Area
 */
export function isInValueArea(price: number, profile: VolumeProfile): boolean {
    return price >= profile.valueAreaLow && price <= profile.valueAreaHigh;
}

/**
 * Calcula la distancia relativa al PoC (en %)
 */
export function distanceToPoC(price: number, profile: VolumeProfile): number {
    if (profile.poc === 0) return 0;
    return ((price - profile.poc) / profile.poc) * 100;
}
