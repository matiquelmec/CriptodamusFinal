import { ConfluenceAnalysis, POI } from './confluenceEngine';
import { MarketRegime } from '../types-advanced';

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
 * Determina el tamaño de posición óptimo para cada entrada DCA según el régimen
 */
function getRegimeAwarePositionSizing(regime?: MarketRegime): [number, number, number] {
    if (!regime) return [40, 30, 30]; // Default (Balanceado)

    switch (regime.regime) {
        case 'TRENDING':
            // Agresivo: Entrar más fuerte al inicio para no perder el movimiento
            return [50, 30, 20];
        case 'RANGING':
            // Balanceado: Distribución estándar
            return [40, 30, 30];
        case 'VOLATILE':
            // Conservador: Reservar capital para entradas más profundas
            return [30, 30, 40];
        case 'EXTREME':
            // Muy Conservador: Esperar confirmación, entrada inicial pequeña
            return [25, 35, 40];
        default:
            return [40, 30, 30];
    }
}

/**
 * Determina el tamaño de salida óptimo para cada TP según el régimen
 */
function getRegimeAwareTPs(regime?: MarketRegime): [number, number, number] {
    if (!regime) return [40, 30, 30]; // Default

    switch (regime.regime) {
        case 'TRENDING':
            // Dejar correr: Salida inicial pequeña, Moonbag grande
            return [30, 30, 40];
        case 'RANGING':
            // Estándar: Asegurar ganancias en bordes del rango
            return [40, 30, 30];
        case 'VOLATILE':
            // Asegurar: Salida inicial grande para reducir riesgo rápido
            return [50, 30, 20];
        case 'EXTREME':
            // Scalp rápido: Asegurar la mayoría en el rebote inicial
            return [60, 25, 15];
        default:
            return [40, 30, 30];
    }
}

/**
 * Calcula un plan DCA institucional basado en POIs de confluencia
 * Filosofía: Entradas escalonadas en zonas de alta probabilidad
 * Position Sizing: Adaptativo según régimen de mercado
 */
export function calculateDCAPlan(
    signalPrice: number, // Renamed for clarity (it's the reference price for entries)
    confluenceAnalysis: ConfluenceAnalysis,
    atr: number,
    side: 'LONG' | 'SHORT',
    marketRegime?: MarketRegime, // NEW: Contexto de mercado
    fibonacciLevels?: {
        level0_618: number;
        level0_65: number;   // NEW
        level0_786: number;
        level0_886: number;  // NEW
        level0_5: number;
    }
): DCAPlan {
    // 1. Seleccionar POIs según el lado del trade
    let relevantPOIs = side === 'LONG'
        ? confluenceAnalysis.topSupports
        : confluenceAnalysis.topResistances;

    // FILTER: Solo aceptar POIs que estén "a favor" del trade (o muy cerca)
    // LONG: POI <= signalPrice (con 0.1% tolerancia)
    // SHORT: POI >= signalPrice (con 0.1% tolerancia)
    relevantPOIs = relevantPOIs.filter(poi => {
        if (side === 'LONG') return poi.price <= signalPrice * 1.001;
        return poi.price >= signalPrice * 0.999;
    });

    // 2. Fallback a Fibonacci si no hay suficientes POIs
    let selectedPOIs: POI[] = [];

    // Helper para validar niveles Fibonacci
    const isValidLevel = (price: number) => {
        if (side === 'LONG') return price <= signalPrice * 1.001;
        return price >= signalPrice * 0.999;
    };

    if (relevantPOIs.length >= 3) {
        selectedPOIs = relevantPOIs.slice(0, 3);
    } else if (relevantPOIs.length >= 1 && fibonacciLevels) {
        // Usar POIs disponibles + Fibonacci como backup
        selectedPOIs = [...relevantPOIs];

        // Agregar niveles Fibonacci faltantes (SOLO SI SON VÁLIDOS)
        if (selectedPOIs.length < 3) {
            const fibLevels = [
                { p: fibonacciLevels.level0_618, label: 'Golden Pocket (0.618)', score: 5 },
                { p: fibonacciLevels.level0_65, label: 'Golden Pocket Low (0.65)', score: 5 }, // Strong
                { p: fibonacciLevels.level0_5, label: 'Fib 0.5', score: 2 },
                { p: fibonacciLevels.level0_786, label: 'Fib 0.786', score: 3 },
                { p: fibonacciLevels.level0_886, label: 'Deep 0.886', score: 4 }
            ];

            for (const fib of fibLevels) {
                if (selectedPOIs.length >= 3) break;
                // Evitar duplicados cercanos
                const isDuplicate = selectedPOIs.some(p => Math.abs(p.price - fib.p) / fib.p < 0.005);

                if (!isDuplicate && isValidLevel(fib.p)) {
                    selectedPOIs.push({
                        price: fib.p,
                        score: fib.score,
                        factors: [fib.label],
                        type: side === 'LONG' ? 'SUPPORT' : 'RESISTANCE'
                    });
                }
            }
        }
    } else if (fibonacciLevels) {
        // Fallback completo a Fibonacci (Validado)
        const potentialFibs = [
            { p: fibonacciLevels.level0_618, label: 'Golden Pocket (0.618)', score: 5 },
            { p: fibonacciLevels.level0_65, label: 'Golden Pocket Low (0.65)', score: 5 },
            { p: fibonacciLevels.level0_5, label: 'Fib 0.5', score: 2 },
            { p: fibonacciLevels.level0_786, label: 'Fib 0.786', score: 3 },
            { p: fibonacciLevels.level0_886, label: 'Deep 0.886', score: 4 }
        ];

        selectedPOIs = potentialFibs
            .filter(f => isValidLevel(f.p))
            .map(f => ({
                price: f.p,
                score: f.score,
                factors: [f.label],
                type: (side === 'LONG' ? 'SUPPORT' : 'RESISTANCE') as 'SUPPORT' | 'RESISTANCE'
            }))
            .slice(0, 3);
    }

    // Si aún faltan niveles (porque Fibs estaban mal), usar ATR
    if (selectedPOIs.length < 3) {
        const needed = 3 - selectedPOIs.length;
        const atrMultipliers = [1.5, 2.5, 3.5]; // Default distances

        for (let i = 0; i < needed; i++) {
            const mult = atrMultipliers[i];
            const price = side === 'LONG'
                ? signalPrice - (atr * mult)
                : signalPrice + (atr * mult);

            selectedPOIs.push({
                price: price,
                score: 2,
                factors: [`ATR ${mult}x (Fallback)`],
                type: (side === 'LONG' ? 'SUPPORT' : 'RESISTANCE') as 'SUPPORT' | 'RESISTANCE'
            });
        }
    }

    // 3. Ordenar POIs (de menor a mayor para LONG, de mayor a menor para SHORT)
    selectedPOIs.sort((a, b) => side === 'LONG' ? b.price - a.price : a.price - b.price);

    // 4. Position sizing institucional
    const positionSizes = getRegimeAwarePositionSizing(marketRegime);

    // 5. Crear entradas DCA (Initial Draft)
    let entries: DCAEntry[] = selectedPOIs.map((poi, index) => ({
        level: index + 1,
        price: poi.price,
        positionSize: positionSizes[index],
        confluenceScore: poi.score,
        factors: poi.factors,
        distanceFromCurrent: side === 'LONG'
            ? ((signalPrice - poi.price) / signalPrice) * 100
            : ((poi.price - signalPrice) / signalPrice) * 100
    }));

    // --- EXPERT OPTIMIZATION: R:R CHECK & ADJUSTMENT ---
    // Calculate hypothetical WAP and Risk to check R:R BEFORE finalizing
    const tempWAP = entries.reduce((sum, e) => sum + (e.price * e.positionSize / 100), 0);
    const deepestPrice = entries[entries.length - 1].price;
    const tempSL = side === 'LONG' ? deepestPrice - (atr * 1.5) : deepestPrice + (atr * 1.5);

    // Estimate TP2 (Impulse) for R:R check
    const estTP2 = side === 'LONG' ? tempWAP + (atr * 4) : tempWAP - (atr * 4);
    const estRisk = Math.abs(tempWAP - tempSL);
    const estReward = Math.abs(tempWAP - estTP2);
    const initialRR = estReward / estRisk;

    // IF R:R IS POOR (< 1.5), AGGRESSIVELY SHIFT ENTRIES DEEPER
    if (initialRR < 1.5) {
        // Shift Factor: Demand 2% better price on all entries
        const shiftMult = side === 'LONG' ? 0.98 : 1.02;
        entries = entries.map(e => ({
            ...e,
            price: e.price * shiftMult,
            factors: [...e.factors, "⚡ R:R Opt."]
        }));
    }

    // 6. Recalculate Final WAP
    const totalWeight = entries.reduce((sum, e) => sum + e.positionSize, 0);
    const averageEntry = entries.reduce((sum, e) =>
        sum + (e.price * e.positionSize / totalWeight), 0
    );

    // 7. Stop Loss Final
    const finalDeepest = entries[entries.length - 1].price;
    const stopLoss = side === 'LONG'
        ? finalDeepest - (atr * 1.5)
        : finalDeepest + (atr * 1.5);

    // 8. Calcular riesgo total
    const riskPerShare = Math.abs(averageEntry - stopLoss) / averageEntry;
    const totalRisk = riskPerShare * 100;

    // 9. Take Profits
    const targetPOIs = side === 'LONG'
        ? confluenceAnalysis.topResistances
        : confluenceAnalysis.topSupports;

    targetPOIs.sort((a, b) => Math.abs(a.price - averageEntry) - Math.abs(b.price - averageEntry));

    let tp1Price: number, tp2Price: number, tp3Price: number;

    if (targetPOIs.length >= 3) {
        tp1Price = targetPOIs[0].price;
        tp2Price = targetPOIs[1].price;
        tp3Price = targetPOIs[2].price;
    } else {
        // Fallback ATR
        const dir = side === 'LONG' ? 1 : -1;
        tp1Price = averageEntry + (atr * 2 * dir);
        tp2Price = averageEntry + (atr * 4 * dir);
        tp3Price = averageEntry + (atr * 8 * dir);
    }

    // --- EXPERT OPTIMIZATION: RSI TARGET INJECTION ---
    // If we have an expert RSI target that aligns with trade direction, use it as TP3 (Moonbag)
    /* 
       Note: Passing rsiExpert param would require signature update. 
       For now, we will handle this in dcaReportGenerator by passing the value down or overriding.
       Actually, let's stick to core calculation here. 
       If I want to use RSI target, I should pass it in 'fibonacciLevels' or a new 'expertTargets' param.
       Since I am editing this file, I will add the param to the function signature in a separate edit 
       or just assume standard TPs and let the report generator override/note it.
       
       Better approach: Keep this function pure math based on POIs.
       Real "Pro" move: The report generator will check RSI target and SWAP TP3 if valid.
    */

    const tps = [tp1Price, tp2Price, tp3Price].sort((a, b) => side === 'LONG' ? a - b : b - a);

    // Validate TPs are profitable (TP > Entry for Long)
    // If TP1 is invalid (below entry for long), shift it up.
    if ((side === 'LONG' && tps[0] <= averageEntry) || (side === 'SHORT' && tps[0] >= averageEntry)) {
        const dir = side === 'LONG' ? 1 : -1;
        tps[0] = averageEntry + (atr * 1.5 * dir);
        tps[1] = averageEntry + (atr * 3.5 * dir);
        tps[2] = averageEntry + (atr * 7 * dir);
    }


    const tpSizes = getRegimeAwareTPs(marketRegime);

    return {
        entries,
        averageEntry,
        totalRisk,
        stopLoss,
        takeProfits: {
            tp1: { price: tps[0], exitSize: tpSizes[0] },
            tp2: { price: tps[1], exitSize: tpSizes[1] },
            tp3: { price: tps[2], exitSize: tpSizes[2] }
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
