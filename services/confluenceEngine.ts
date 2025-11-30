import { TechnicalIndicators } from '../types';
import { VolumeProfile } from './volumeProfile';
import { OrderBlock } from './orderBlocks';
import { FairValueGap } from './fairValueGaps';
import { AutoFibsResult } from '../types-advanced';

export interface POI {
    price: number;
    score: number;
    factors: string[];
    type: 'SUPPORT' | 'RESISTANCE';
}

export interface ConfluenceAnalysis {
    supportPOIs: POI[];
    resistancePOIs: POI[];
    topSupports: POI[];  // Top 3 soportes para DCA
    topResistances: POI[]; // Top 3 resistencias para TPs
}

/**
 * Motor de Confluencia - Calcula y puntúa Points of Interest
 * Combina múltiples factores técnicos para encontrar zonas de alta probabilidad
 */
export function calculatePOIs(
    currentPrice: number,
    fibonacci: AutoFibsResult,
    pivots: TechnicalIndicators['pivots'],
    ema200: number,
    ema50: number,
    atr: number,
    volumeProfile: VolumeProfile,
    bullishOBs: OrderBlock[],
    bearishOBs: OrderBlock[],
    bullishFVGs: FairValueGap[],
    bearishFVGs: FairValueGap[]
): ConfluenceAnalysis {
    const supportPOIs: POI[] = [];
    const resistancePOIs: POI[] = [];

    // Umbral de proximidad (0.5 ATR)
    const proximityThreshold = atr * 0.5;

    // Función helper para verificar si un precio ya está en la lista
    const findExistingPOI = (list: POI[], price: number): POI | undefined => {
        return list.find(poi => Math.abs(poi.price - price) < proximityThreshold);
    };

    // Función helper para agregar o actualizar POI
    const addOrUpdatePOI = (
        list: POI[],
        price: number,
        score: number,
        factor: string,
        type: 'SUPPORT' | 'RESISTANCE'
    ) => {
        const existing = findExistingPOI(list, price);
        if (existing) {
            existing.score += score;
            existing.factors.push(factor);
            // Actualizar precio al promedio ponderado
            existing.price = (existing.price + price) / 2;
        } else {
            list.push({ price, score, factors: [factor], type });
        }
    };

    // 1. FIBONACCI LEVELS
    const fibLevels = [
        { price: fibonacci.level0_236, name: 'Fib 0.236', score: 1 },
        { price: fibonacci.level0_382, name: 'Fib 0.382', score: 2 },
        { price: fibonacci.level0_5, name: 'Fib 0.5', score: 2 },
        { price: fibonacci.level0_618, name: 'Golden Pocket (0.618)', score: 3 },
        { price: fibonacci.level0_786, name: 'Fib 0.786', score: 1 }
    ];

    fibLevels.forEach(fib => {
        if (fib.price < currentPrice) {
            addOrUpdatePOI(supportPOIs, fib.price, fib.score, fib.name, 'SUPPORT');
        } else {
            addOrUpdatePOI(resistancePOIs, fib.price, fib.score, fib.name, 'RESISTANCE');
        }
    });

    // 2. PIVOT POINTS
    const pivotLevels = [
        { price: pivots.s2, name: 'Pivot S2', score: 1, type: 'SUPPORT' as const },
        { price: pivots.s1, name: 'Pivot S1', score: 2, type: 'SUPPORT' as const },
        { price: pivots.p, name: 'Pivot Central', score: 2, type: currentPrice > pivots.p ? 'SUPPORT' as const : 'RESISTANCE' as const },
        { price: pivots.r1, name: 'Pivot R1', score: 2, type: 'RESISTANCE' as const },
        { price: pivots.r2, name: 'Pivot R2', score: 1, type: 'RESISTANCE' as const }
    ];

    pivotLevels.forEach(pivot => {
        if (pivot.type === 'SUPPORT' && pivot.price < currentPrice) {
            addOrUpdatePOI(supportPOIs, pivot.price, pivot.score, pivot.name, 'SUPPORT');
        } else if (pivot.type === 'RESISTANCE' && pivot.price > currentPrice) {
            addOrUpdatePOI(resistancePOIs, pivot.price, pivot.score, pivot.name, 'RESISTANCE');
        }
    });

    // 3. EMAs
    if (ema200 < currentPrice) {
        addOrUpdatePOI(supportPOIs, ema200, 2, 'EMA 200', 'SUPPORT');
    } else {
        addOrUpdatePOI(resistancePOIs, ema200, 2, 'EMA 200', 'RESISTANCE');
    }

    if (ema50 < currentPrice) {
        addOrUpdatePOI(supportPOIs, ema50, 1, 'EMA 50', 'SUPPORT');
    } else {
        addOrUpdatePOI(resistancePOIs, ema50, 1, 'EMA 50', 'RESISTANCE');
    }

    // 4. VOLUME PROFILE (PoC)
    if (volumeProfile.poc > 0) {
        const pocType = volumeProfile.poc < currentPrice ? 'SUPPORT' : 'RESISTANCE';
        const pocList = pocType === 'SUPPORT' ? supportPOIs : resistancePOIs;
        addOrUpdatePOI(pocList, volumeProfile.poc, 5, 'PoC (Volume Profile)', pocType);
    }

    // 5. ORDER BLOCKS
    bullishOBs.filter(ob => !ob.mitigated && ob.price < currentPrice).forEach(ob => {
        const obScore = Math.ceil(ob.strength / 2.5); // Convertir strength (0-10) a score (0-4)
        addOrUpdatePOI(supportPOIs, ob.price, obScore, `Bullish OB (${ob.strength.toFixed(1)})`, 'SUPPORT');
    });

    bearishOBs.filter(ob => !ob.mitigated && ob.price > currentPrice).forEach(ob => {
        const obScore = Math.ceil(ob.strength / 2.5);
        addOrUpdatePOI(resistancePOIs, ob.price, obScore, `Bearish OB (${ob.strength.toFixed(1)})`, 'RESISTANCE');
    });

    // 6. FAIR VALUE GAPS
    bullishFVGs.filter(fvg => !fvg.filled && fvg.midpoint < currentPrice).forEach(fvg => {
        addOrUpdatePOI(supportPOIs, fvg.midpoint, 3, 'Bullish FVG', 'SUPPORT');
    });

    bearishFVGs.filter(fvg => !fvg.filled && fvg.midpoint > currentPrice).forEach(fvg => {
        addOrUpdatePOI(resistancePOIs, fvg.midpoint, 3, 'Bearish FVG', 'RESISTANCE');
    });

    // Ordenar por score descendente
    supportPOIs.sort((a, b) => b.score - a.score);
    resistancePOIs.sort((a, b) => b.score - a.score);

    // Seleccionar top 3 de cada tipo
    const topSupports = supportPOIs.slice(0, 3);
    const topResistances = resistancePOIs.slice(0, 3);

    return {
        supportPOIs,
        resistancePOIs,
        topSupports,
        topResistances
    };
}

/**
 * Genera una descripción legible de los factores de confluencia
 */
export function formatPOIFactors(poi: POI): string {
    return poi.factors.join(' + ');
}

/**
 * Convierte el score en estrellas visuales
 */
export function scoreToStars(score: number): string {
    const stars = Math.min(Math.ceil(score / 2), 5); // Máximo 5 estrellas
    return '⭐'.repeat(stars);
}
