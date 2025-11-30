import { ConfluenceAnalysis, POI } from './confluenceEngine';

export interface DCAEntry {
    level: number; // 1, 2, 3
    price: number;
    positionSize: number; // % del total (40, 30, 30)
    confluenceScore: number;
    factors: string[];
    distanceFromCurrent: number; // % de descuento
}

export interface DCAPlan {
    entries: DCAEntry[];
    averageEntry: number; // Precio promedio ponderado (WAP)
    totalRisk: number; // % de cuenta en riesgo
    stopLoss: number; // SL ajustado al WAP
    takeProfits: {
        tp1: { price: number; exitSize: number }; // 40%
        tp2: { price: number; exitSize: number }; // 30%
        tp3: { price: number; exitSize: number }; // 30%
    };
}

/**
 * Calcula un plan DCA institucional basado en POIs de confluencia
 * Filosofía: Entradas escalonadas en zonas de alta probabilidad
 * Position Sizing: 40% / 30% / 30% (piramidal decreciente)
 */
export function calculateDCAPlan(
    currentPrice: number,
    confluenceAnalysis: ConfluenceAnalysis,
    atr: number,
    side: 'LONG' | 'SHORT',
    fibonacciLevels?: {
        level0_618: number;
        level0_786: number;
        level0_5: number;
    }
): DCAPlan {
    // 1. Seleccionar POIs según el lado del trade
    const relevantPOIs = side === 'LONG'
        ? confluenceAnalysis.topSupports
        : confluenceAnalysis.topResistances;

    // 2. Fallback a Fibonacci si no hay suficientes POIs
    let selectedPOIs: POI[] = [];

    if (relevantPOIs.length >= 3) {
        selectedPOIs = relevantPOIs.slice(0, 3);
    } else if (relevantPOIs.length >= 1 && fibonacciLevels) {
        // Usar POIs disponibles + Fibonacci como backup
        selectedPOIs = [...relevantPOIs];

        // Agregar niveles Fibonacci faltantes
        if (selectedPOIs.length < 3 && side === 'LONG') {
            if (selectedPOIs.length === 1) {
                selectedPOIs.push({
                    price: fibonacciLevels.level0_786,
                    score: 3,
                    factors: ['Fib 0.786'],
                    type: 'SUPPORT'
                });
            }
            if (selectedPOIs.length === 2) {
                selectedPOIs.push({
                    price: fibonacciLevels.level0_5,
                    score: 2,
                    factors: ['Fib 0.5'],
                    type: 'SUPPORT'
                });
            }
        }
    } else if (fibonacciLevels) {
        // Fallback completo a Fibonacci
        selectedPOIs = [
            {
                price: fibonacciLevels.level0_618,
                score: 5,
                factors: ['Golden Pocket (0.618)'],
                type: side === 'LONG' ? 'SUPPORT' : 'RESISTANCE'
            },
            {
                price: fibonacciLevels.level0_786,
                score: 3,
                factors: ['Fib 0.786'],
                type: side === 'LONG' ? 'SUPPORT' : 'RESISTANCE'
            },
            {
                price: fibonacciLevels.level0_5,
                score: 2,
                factors: ['Fib 0.5'],
                type: side === 'LONG' ? 'SUPPORT' : 'RESISTANCE'
            }
        ];
    } else {
        // Último recurso: usar ATR para crear niveles
        const atrMultipliers = [1.5, 2.5, 3.5];
        selectedPOIs = atrMultipliers.map((mult, idx) => ({
            price: side === 'LONG'
                ? currentPrice - (atr * mult)
                : currentPrice + (atr * mult),
            score: 5 - idx,
            factors: [`ATR ${mult}x`],
            type: side === 'LONG' ? 'SUPPORT' : 'RESISTANCE'
        }));
    }

    // 3. Ordenar POIs (de menor a mayor para LONG, de mayor a menor para SHORT)
    selectedPOIs.sort((a, b) => side === 'LONG' ? b.price - a.price : a.price - b.price);

    // 4. Position sizing institucional (40%, 30%, 30%)
    const positionSizes = [40, 30, 30];

    // 5. Crear entradas DCA
    const entries: DCAEntry[] = selectedPOIs.map((poi, index) => ({
        level: index + 1,
        price: poi.price,
        positionSize: positionSizes[index],
        confluenceScore: poi.score,
        factors: poi.factors,
        distanceFromCurrent: side === 'LONG'
            ? ((currentPrice - poi.price) / currentPrice) * 100
            : ((poi.price - currentPrice) / currentPrice) * 100
    }));

    // 6. Calcular precio promedio ponderado (WAP - Weighted Average Price)
    const totalWeight = entries.reduce((sum, e) => sum + e.positionSize, 0);
    const averageEntry = entries.reduce((sum, e) =>
        sum + (e.price * e.positionSize / totalWeight), 0
    );

    // 7. Stop Loss: 1.5 ATR más allá del Entry 3 (más profundo)
    const deepestEntry = entries[entries.length - 1].price;
    const stopLoss = side === 'LONG'
        ? deepestEntry - (atr * 1.5)
        : deepestEntry + (atr * 1.5);

    // 8. Calcular riesgo total (% de cuenta)
    const riskPerShare = Math.abs(averageEntry - stopLoss) / averageEntry;
    const totalRisk = riskPerShare * 100; // Asumiendo 100% de capital asignado

    // 9. Take Profits basados en resistencias/soportes de confluencia
    const targetPOIs = side === 'LONG'
        ? confluenceAnalysis.topResistances
        : confluenceAnalysis.topSupports;

    let tp1Price: number, tp2Price: number, tp3Price: number;

    if (targetPOIs.length >= 3) {
        tp1Price = targetPOIs[0].price;
        tp2Price = targetPOIs[1].price;
        tp3Price = targetPOIs[2].price;
    } else if (targetPOIs.length >= 1) {
        tp1Price = targetPOIs[0].price;
        tp2Price = targetPOIs[1]?.price || (side === 'LONG'
            ? averageEntry + (atr * 4)
            : averageEntry - (atr * 4));
        tp3Price = targetPOIs[2]?.price || (side === 'LONG'
            ? averageEntry + (atr * 8)
            : averageEntry - (atr * 8));
    } else {
        // Fallback a ATR
        tp1Price = side === 'LONG'
            ? averageEntry + (atr * 2)
            : averageEntry - (atr * 2);
        tp2Price = side === 'LONG'
            ? averageEntry + (atr * 4)
            : averageEntry - (atr * 4);
        tp3Price = side === 'LONG'
            ? averageEntry + (atr * 8)
            : averageEntry - (atr * 8);
    }

    return {
        entries,
        averageEntry,
        totalRisk,
        stopLoss,
        takeProfits: {
            tp1: { price: tp1Price, exitSize: 40 },
            tp2: { price: tp2Price, exitSize: 30 },
            tp3: { price: tp3Price, exitSize: 30 }
        }
    };
}

/**
 * Formatea el score de confluencia en estrellas visuales
 */
export function formatConfluenceStars(score: number): string {
    const stars = Math.min(Math.ceil(score / 2), 5);
    return '⭐'.repeat(stars);
}
