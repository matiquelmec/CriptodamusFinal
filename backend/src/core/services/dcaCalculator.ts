import { ConfluenceAnalysis, POI } from './confluenceEngine';
import { MarketRegime } from '../types/types-advanced';
import { FundamentalTier } from '../types'; // NEW Import

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
    proximityScorePenalty?: number; // NEW
}

// NEW: Predictive Targets for Smart Exits
export interface PredictiveTargets {
    rsiReversal?: number; // Cardwell Objective
    orderBookWall?: number; // Major Wall Price
    liquidationCluster?: number; // Liquidity Magnet
    projectedHigh?: number; // Pattern Measured Move
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
    },
    tier: FundamentalTier = 'B', // NEW: Fundamental Tier (Default to average)
    predictiveTargets?: PredictiveTargets // NEW: Smart Exit Data
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
    // CORRECTION: For LONG, we want HIGH P (Closest below price) to LOW P. Descending.
    // For SHORT, we want LOW P (Closest above price) to HIGH P. Ascending.
    selectedPOIs.sort((a, b) => side === 'LONG' ? b.price - a.price : a.price - b.price);

    // --- MOMENTUM ENTRY LOGIC (Bull Run Adaptation) ---
    // Problem: In strong trends, high score POIs are too deep (e.g. 90k when price is 97k).
    // Solution: Force inclusion of the closest valid support (Breakout Level) if we are TRENDING.
    const proximityLimit = 0.04; // Look for support within 4% of price

    // Find the closest support that is NOT already in selectedPOIs
    // relevantPOIs is already filtered by side (Supports below price for LONG)
    const closestValidSupport = relevantPOIs.find(p => {
        const dist = Math.abs((signalPrice - p.price) / signalPrice);
        // Must be close and acceptable score (>=2)
        // We REMOVED the !alreadySelected check to allow "Upgrading" an existing POI to Momentum status
        return dist < proximityLimit && p.score >= 2;
    });

    const isMomentumRegime = marketRegime?.regime === 'TRENDING' || marketRegime?.regime === 'VOLATILE';
    const isHighQualitySetup = closestValidSupport && closestValidSupport.score >= 4;

    if ((isMomentumRegime || isHighQualitySetup) && tier !== 'C') {
        if (closestValidSupport) {
            // Found a "Breakout Support"
            // Strategy: Promoted to Entry 1 with Momentum Tag.

            // 1. Remove it if it was already selected (to avoid dupe and ensure it moves to top)
            selectedPOIs = selectedPOIs.filter(p => p.price !== closestValidSupport.price);

            // 2. Inject at Top
            selectedPOIs.unshift({
                ...closestValidSupport,
                factors: [...closestValidSupport.factors, "🚀 Momentum Entry"]
            });

            // 3. Trim to 3
            selectedPOIs = selectedPOIs.slice(0, 3);
        }
    }

    // 3.5 FORCE MARKET ENTRY - REMOVED FOR "NO FOMO" UPDATE
    // We now respect the technical levels even if distant.
    // If the price is far from the first POI, it becomes a "Limit Order" setup automatically.

    // const firstPOIDist = Math.abs((selectedPOIs[0].price - signalPrice) / signalPrice);
    // if (firstPOIDist > 0.005) { ... }

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
    // EXCEPTION: If this is a Momentum Entry, we respect the level (Breakout/Wall) and rely on tighter management or high probability.
    const hasMomentumEntry = entries.some(e => e.factors.some(f => f.includes("Momentum")));

    if (initialRR < 1.5 && !hasMomentumEntry) {
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

    // 6.5 PROFESSIONAL PROXIMITY PENALTY (Sniper Filter)
    const entryGap = Math.abs(averageEntry - signalPrice) / signalPrice;
    const atrGap = atr > 0 ? (Math.abs(averageEntry - signalPrice) / atr) : 0;

    let proximityScorePenalty = 0;

    // Penalize if > 3% or > 2.5x ATR
    if (entryGap > 0.03 || atrGap > 2.5) {
        proximityScorePenalty = Math.min(30, Math.round(entryGap * 100 * 2)); // Up to 30 points penalty
        entries.forEach(e => e.factors.push(`⚠️ Proximity Alert: ${(entryGap * 100).toFixed(1)}% Gap`));
    }

    // 7. Stop Loss Final
    // DYNAMIC ATR MULTIPLIER BASED ON TIER (Elite Hedge Fund Calibration)
    // S: Wide (3.5x), A: Strong (3.0x), B: Institutional (2.5x), C: Scalp (2.0x)
    let atrMultiplier = 2.5; // Default (Tier B)
    if (tier === 'S') atrMultiplier = 3.5;
    else if (tier === 'A') atrMultiplier = 3.0;
    else if (tier === 'B') atrMultiplier = 2.5;
    else if (tier === 'C') atrMultiplier = 2.0;

    const finalDeepest = entries[entries.length - 1].price;
    const stopLoss = side === 'LONG'
        ? finalDeepest - (atr * atrMultiplier)
        : finalDeepest + (atr * atrMultiplier);

    // 8. Calcular riesgo total
    const riskPerShare = Math.abs(averageEntry - stopLoss) / averageEntry;
    const totalRisk = riskPerShare * 100;

    // 9. Take Profits (SMART PREDICTIVE LOGIC)
    const targetPOIs = side === 'LONG'
        ? confluenceAnalysis.topResistances
        : confluenceAnalysis.topSupports;

    // STRICT FILTER: Only accept TPs that are PROFITABLE
    const profitablePOIs = targetPOIs.filter(p => {
        if (side === 'LONG') return p.price > averageEntry * 1.001;
        return p.price < averageEntry * 0.999;
    });

    // INTELLIGENT MERGE: Combine Static POIs with Predictive Targets
    let smartTargets: { price: number, score: number, label: string }[] = [];

    // A. Add Structural POIs (Base Layer)
    profitablePOIs.forEach(p => smartTargets.push({ price: p.price, score: p.score, label: 'Structure' }));

    // B. Add Predictive Targets (God Tier Layer)
    if (predictiveTargets) {
        // 1. RSI Target (High Accuracy)
        if (predictiveTargets.rsiReversal) {
            const isProfitable = side === 'LONG' ? predictiveTargets.rsiReversal > averageEntry * 1.005 : predictiveTargets.rsiReversal < averageEntry * 0.995;
            if (isProfitable) smartTargets.push({ price: predictiveTargets.rsiReversal, score: 20, label: '🎯 RSI Target' });
        }
        // 2. Liquidity Magnet (High Probability)
        if (predictiveTargets.liquidationCluster) {
            const isProfitable = side === 'LONG' ? predictiveTargets.liquidationCluster > averageEntry * 1.005 : predictiveTargets.liquidationCluster < averageEntry * 0.995;
            if (isProfitable) smartTargets.push({ price: predictiveTargets.liquidationCluster, score: 18, label: '🧲 Liquidity' });
        }
        // 3. Sell Wall (Smart Exit)
        if (predictiveTargets.orderBookWall) {
            // Front-run wall by 0.2% to ensure fill before the rejection
            const safePrice = side === 'LONG' ? predictiveTargets.orderBookWall * 0.998 : predictiveTargets.orderBookWall * 1.002;
            const isProfitable = side === 'LONG' ? safePrice > averageEntry * 1.005 : safePrice < averageEntry * 0.995;
            if (isProfitable) smartTargets.push({ price: safePrice, score: 15, label: '🧱 Wall Front-Run' });
        }
    }

    // C. Deduplicate & Sort
    const NOTE_THRESHOLD = 0.01; // 1% distance considered "same level"
    let uniqueTargets: { price: number, score: number, label: string }[] = [];

    // Sort by price for deduplication logic
    smartTargets.sort((a, b) => a.price - b.price);

    for (const t of smartTargets) {
        const existing = uniqueTargets.find(u => Math.abs((u.price - t.price) / t.price) < NOTE_THRESHOLD);
        if (existing) {
            // Merge: Keep higher score, combine labels
            if (t.score > existing.score) existing.score = t.score;
            if (!existing.label.includes(t.label)) existing.label += ` + ${t.label}`;
            // If the new one is more precise (Predictive), usually we prefer its price? 
            // Let's bias towards the Predictive price if score is high
            if (t.score >= 15) existing.price = t.price;
        } else {
            uniqueTargets.push(t);
        }
    }

    // Sort for TPs: Closest to entry is TP1
    uniqueTargets.sort((a, b) => Math.abs(a.price - averageEntry) - Math.abs(b.price - averageEntry));

    // Fallback if empty (shouldn't happen often with confluence)
    let tpsArray: number[] = [];

    if (uniqueTargets.length >= 3) {
        tpsArray = [uniqueTargets[0].price, uniqueTargets[1].price, uniqueTargets[2].price];
    } else {
        // Fill from unique
        tpsArray = uniqueTargets.map(u => u.price);

        // Fill remaining with Multipliers (ATR)
        const needed = 3 - tpsArray.length;
        const dir = side === 'LONG' ? 1 : -1;
        // Start multipliers higher than existing TPs if possible? 
        // Simple fallback logic:
        for (let i = 0; i < needed; i++) {
            const baseMult = 2 + (i + tpsArray.length) * 2;

            tpsArray.push(averageEntry + (atr * baseMult * dir));
        }
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

    const tps = tpsArray.sort((a, b) => side === 'LONG' ? a - b : b - a);

    // Validate TPs are profitable relative to ENTRY 1 (Crucial for "Force Market" setups)
    // Even if profitable vs WAP, they must be profitable vs the first execution to avoid losses on partial fills.
    const entry1Price = entries[0].price;

    if (side === 'LONG') {
        // TP1 must be > Entry 1
        if (tps[0] <= entry1Price) {
            tps[0] = entry1Price + (atr * 1.5); // Force profitable TP1
        }
        // Ensure TP alignment (TP1 < TP2 < TP3)
        if (tps[1] <= tps[0]) tps[1] = tps[0] + (atr * 2);
        if (tps[2] <= tps[1]) tps[2] = tps[1] + (atr * 2);

    } else { // SHORT
        // TP1 must be < Entry 1
        if (tps[0] >= entry1Price) {
            tps[0] = entry1Price - (atr * 1.5); // Force profitable TP1
        }
        // Ensure TP alignment (TP1 > TP2 > TP3)
        if (tps[1] >= tps[0]) tps[1] = tps[0] - (atr * 2);
        if (tps[2] >= tps[1]) tps[2] = tps[1] - (atr * 2);
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
        },
        proximityScorePenalty // NEW: Bubbled up for StrategyScorer/Scanner
    };
}

/**
 * Formatea el score de confluencia en estrellas visuales
 */
export function formatConfluenceStars(score: number): string {
    const stars = Math.min(Math.ceil(score / 2), 5);
    return '⭐'.repeat(stars);
}
