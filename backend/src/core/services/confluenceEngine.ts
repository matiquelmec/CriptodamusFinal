import { TechnicalIndicators } from '../types';
import { VolumeProfile } from './volumeProfile';
import { OrderBlock } from './orderBlocks';
import { FairValueGap } from './fairValueGaps';
import { AutoFibsResult, HarmonicPattern, OrderBookAnalysis, LiquidationCluster } from '../types/types-advanced';
import { ChartPattern } from './chartPatterns';

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
    bearishFVGs: FairValueGap[],
    harmonicPatterns: HarmonicPattern[] = [],
    orderBook?: OrderBookAnalysis,
    liquidationClusters: LiquidationCluster[] = [],
    chartPatterns: ChartPattern[] = [] // NEW: Awake structural patterns
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
        { price: fibonacci.level0_65, name: 'Golden Pocket Low (0.65)', score: 3 }, // Institutional
        { price: fibonacci.level0_786, name: 'Fib 0.786', score: 2 },
        { price: fibonacci.level0_886, name: 'Shark/Deep (0.886)', score: 3 } // Stop Hunt zone
    ];

    fibLevels.forEach(fib => {
        if (fib.price < currentPrice) {
            addOrUpdatePOI(supportPOIs, fib.price, fib.score, fib.name, 'SUPPORT');
        } else {
            addOrUpdatePOI(resistancePOIs, fib.price, fib.score, fib.name, 'RESISTANCE');
        }
    });

    // 2. PIVOT POINTS
    const pivotLevels = pivots ? [
        { price: pivots.s2, name: 'Pivot S2', score: 1, type: 'SUPPORT' as const },
        { price: pivots.s1, name: 'Pivot S1', score: 2, type: 'SUPPORT' as const },
        { price: pivots.p, name: 'Pivot Central', score: 2, type: currentPrice > pivots.p ? 'SUPPORT' as const : 'RESISTANCE' as const },
        { price: pivots.r1, name: 'Pivot R1', score: 2, type: 'RESISTANCE' as const },
        { price: pivots.r2, name: 'Pivot R2', score: 1, type: 'RESISTANCE' as const }
    ] : [];

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

    // 7. HARMONIC PATTERNS (Tier S - Structural)
    harmonicPatterns.forEach(pattern => {
        if (pattern.direction === 'BULLISH') {
            // PRZ (Potential Reversal Zone) is Support
            // HIGH SCORE: 4 (Almost max, harmonics are geometric laws)
            addOrUpdatePOI(supportPOIs, pattern.prz, 4, `Bullish ${pattern.type} PRZ`, 'SUPPORT');
        } else {
            // PRZ is Resistance
            addOrUpdatePOI(resistancePOIs, pattern.prz, 4, `Bearish ${pattern.type} PRZ`, 'RESISTANCE');
        }
    });

    // 8. ORDER BOOK WALLS (Tier S - Institutional Liquidity)
    if (orderBook) {
        if (orderBook.bidWall && orderBook.bidWall.strength >= 50) {
            // HEAVY WEIGHT: 6 pts (Order book is current REAL commitment)
            addOrUpdatePOI(supportPOIs, orderBook.bidWall.price, 6, `🧱 Buy Wall (Strength: ${orderBook.bidWall.strength})`, 'SUPPORT');
        }
        if (orderBook.askWall && orderBook.askWall.strength >= 50) {
            addOrUpdatePOI(resistancePOIs, orderBook.askWall.price, 6, `🧱 Sell Wall (Strength: ${orderBook.askWall.strength})`, 'RESISTANCE');
        }
    }

    // 9. LIQUIDATION CLUSTERS (The Magnets)
    liquidationClusters.forEach(cluster => {
        const midPrice = (cluster.priceMin + cluster.priceMax) / 2;
        const label = cluster.type === 'SHORT_LIQ' ? '🧲 Short Liq Cluster' : '🧲 Long Liq Cluster';
        const poiType = cluster.type === 'SHORT_LIQ' ? 'RESISTANCE' : 'SUPPORT';
        const targetList = poiType === 'SUPPORT' ? supportPOIs : resistancePOIs;

        // Weight: 3-4 based on strength
        const clusterScore = cluster.strength >= 50 ? 4 : 3;
        addOrUpdatePOI(targetList, midPrice, clusterScore, label, poiType);
    });

    // 10. CHART PATTERNS (Structural Framework)
    chartPatterns.forEach(pattern => {
        const targetList = pattern.signal === 'BULLISH' ? supportPOIs : resistancePOIs;
        const poiType = pattern.signal === 'BULLISH' ? 'SUPPORT' : 'RESISTANCE';

        let score = 3;
        if (pattern.type === 'HEAD_SHOULDERS' || pattern.type === 'INV_HEAD_SHOULDERS') score = 5;
        if (pattern.type.includes('WEDGE')) score = 4;

        // Use priceTarget or invalidationLevel as the POI anchor depending on pattern context
        // For H&S/Inverse, the PRZ is often the neckline or the head itself.
        // Let's use the price point associated with the pattern (often the recent fractal)
        // If we don't have a specific anchor price in pattern, we'll skip POI mapping 
        // but we WILL use it for global confluence scoring in AdvancedAnalyzer.
        // Actually, we can use invalidationLevel (the "Head" or "Wedge Tip") as a strong POI.
        if (pattern.invalidationLevel) {
            addOrUpdatePOI(targetList, pattern.invalidationLevel, score, `💠 ${pattern.type} Pivot`, poiType);
        }
    });

    // SYNERGY BONUS: Fib + Order Block + Wall
    // If a POI contains technical + liquidity factors, it's a God Mode level.
    const applySynergy = (list: POI[]) => {
        list.forEach(poi => {
            const hasFib = poi.factors.some(f => f.includes('Fib') || f.includes('Golden'));
            const hasOB = poi.factors.some(f => f.includes('OB'));
            const hasWall = poi.factors.some(f => f.includes('Wall') || f.includes('Liq Cluster'));

            if (hasFib && hasOB && hasWall) {
                poi.score = Math.ceil(poi.score * 2.0); // 100% Boost (Iron Level)
                poi.factors.push('🔱 GOD MODE CONFLUENCE');
            } else if (hasFib && hasOB) {
                poi.score = Math.ceil(poi.score * 1.5); // 50% Boost
                poi.factors.push('🔥 INSTITUTIONAL CONFLUENCE');
            }
        });
    };

    applySynergy(supportPOIs);
    applySynergy(resistancePOIs);

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
