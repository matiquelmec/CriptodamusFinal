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
        const momentumPrice = closestValidSupport?.price || signalPrice;

        // 1. Remove it if it was already selected (to avoid dupe)
        selectedPOIs = selectedPOIs.filter(p => Math.abs(p.price - momentumPrice) / momentumPrice > 0.001);

        // 2. Inject at Top
        selectedPOIs.unshift({
            price: momentumPrice,
            score: closestValidSupport?.score || 5,
            factors: closestValidSupport ? [...closestValidSupport.factors, "🚀 Momentum Entry"] : ["🚀 Force Market Entry"],
            type: side === 'LONG' ? 'SUPPORT' : 'RESISTANCE'
        });

        // 3. Trim to 3
        selectedPOIs = selectedPOIs.slice(0, 3);
    }

    // 3.5 ADAPTIVE MOMENTUM ENTRY (Professional Logic)
    // If the best structural entry is too far (e.g. > 3% away) and Market is Trending/Volatile,
    // we risk missing the trade. We create a "Dynamic Entry" closer to price.
    // SHORT: Entry at Current + 1.5 ATR (Dynamic Supply)
    // LONG: Entry at Current - 1.5 ATR (Dynamic Demand)

    // Calculate gap to the best structural entry we found so far
    if (selectedPOIs.length > 0) {
        const bestEntryPrice = selectedPOIs[0].price;
        const gapPercent = Math.abs((bestEntryPrice - signalPrice) / signalPrice);

        // Threshold: 3% gap is huge for a scanner signal
        const GAP_THRESHOLD = 0.03;
        const isMomentumRegime = marketRegime?.regime === 'TRENDING' || marketRegime?.regime === 'VOLATILE';

        if (gapPercent > GAP_THRESHOLD && isMomentumRegime) {
            const dynamicFactor = 1.2; // 1.2 ATR pullback
            const dynamicPrice = side === 'LONG'
                ? signalPrice - (atr * dynamicFactor)
                : signalPrice + (atr * dynamicFactor);

            // Ensure it's actually closer than the structural one
            const dynamicGap = Math.abs((dynamicPrice - signalPrice) / signalPrice);
            if (dynamicGap < gapPercent) {
                // Inject Dynamic Entry at the top
                selectedPOIs.unshift({
                    price: dynamicPrice,
                    score: 4, // Decent score for trend following
                    factors: ["⚡ Dynamic Momentum (ATR)"],
                    type: side === 'LONG' ? 'SUPPORT' : 'RESISTANCE'
                });
                // Keep max 3
                selectedPOIs = selectedPOIs.slice(0, 3);
            }
        }
    }

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

    // --- 7. SMART STRUCTURAL STOP LOSS (The "Pau" Method) ---
    // Philosophy: Stop where the thesis is invalid, usually the next major structure below entry.
    // If trade relies on 50% Fib, invalidation is losing the 61.8% or 65% pocket.

    // 7.1 Identify Invalidation Level
    let invalidationPrice: number | null = null;
    const currentEntry = entries[0].price; // Use first entry as anchor for risk check

    if (fibonacciLevels) {
        // LONG: Invalidation is below the Golden Pocket (e.g., 0.65 or 0.786)
        // SHORT: Invalidation is above the Golden Pocket
        if (side === 'LONG') {
            invalidationPrice = fibonacciLevels.level0_786; // Conservative Structure
            // If entry is shallow (38%), maybe 61.8 is better? 
            // Pau Strategy: "Debe estar debajo del 61.8%". Let's stick to 0.65 or 0.786 as hard invalidation.
            if (invalidationPrice > currentEntry) invalidationPrice = null; // Sanity check
        } else {
            invalidationPrice = fibonacciLevels.level0_786;
            if (invalidationPrice < currentEntry) invalidationPrice = null;
        }
    }

    // 7.2 Calculate Baseline Volatility Stop (1.5x ATR - Professional Standard)
    // We use 1.5x as the "Standard Breathing Room" per Pau's strategy
    const { TradingConfig } = require('../config/tradingConfig'); // Lazy load to allow generic usage
    const baseMult = TradingConfig?.pauStrategy?.risk?.sl_atr_multiplier || 1.5;

    // Dynamic Tier Adjustments (Slight tweaks, not huge jumps)
    let atrMultiplier = baseMult;
    if (tier === 'S' || tier === 'A') atrMultiplier = baseMult * 1.0; // Standard for liquid pairs
    else atrMultiplier = baseMult * 1.2; // Slightly wider for risky alts

    const volStopPrice = side === 'LONG'
        ? averageEntry - (atr * atrMultiplier)
        : averageEntry + (atr * atrMultiplier);

    // 7.3 Select The Smartest Stop
    let finalStopLoss = volStopPrice;

    if (invalidationPrice) {
        // Check distance to structure
        const structDist = Math.abs((invalidationPrice - averageEntry) / averageEntry) * 100;

        // Rules from Plan:
        // 1. If Structure is too close (< 0.5%), it's noise. Use Volatility Stop.
        // 2. If Structure is too far (> 2.5%), it's ruinous. Cap at Max Risk (or 2x ATR).
        // 3. Otherwise, use Structure + Buffer.

        const MIN_DIST = 0.5;
        const MAX_DIST_CAP = TradingConfig?.risk?.safety?.max_sl_distance_percent || 2.5;

        if (structDist >= MIN_DIST && structDist <= MAX_DIST_CAP) {
            // Valid Structure! Add small buffer to avoid wick-outs.
            const buffer = atr * 0.2;
            finalStopLoss = side === 'LONG'
                ? invalidationPrice - buffer
                : invalidationPrice + buffer;
        } else if (structDist > MAX_DIST_CAP) {
            // Structure is too far. Use Volatility Cap (Max Distance allowed)
            const capDist = averageEntry * (MAX_DIST_CAP / 100);
            finalStopLoss = side === 'LONG'
                ? averageEntry - capDist
                : averageEntry + capDist;
        }
        // Else (too close): Stick to volStopPrice (1.5x ATR)
    }

    // 7.4 Final Safety Checks (Sanity Floors)
    // Absolute minimum distance: 0.8% (unless Scalp)
    const slDistPercent = Math.abs((finalStopLoss - averageEntry) / averageEntry) * 100;
    const ABS_MIN_SL = 0.8;

    if (slDistPercent < ABS_MIN_SL) {
        finalStopLoss = side === 'LONG'
            ? averageEntry * (1 - (ABS_MIN_SL / 100))
            : averageEntry * (1 + (ABS_MIN_SL / 100));
    }

    // 8. Calcular riesgo total
    const riskPerShare = Math.abs(averageEntry - finalStopLoss) / averageEntry;
    const totalRisk = riskPerShare * 100;

    // 9. Take Profits (SMART RISK:REWARD ENFORCEMENT)
    const targetPOIs = side === 'LONG'
        ? confluenceAnalysis.topResistances
        : confluenceAnalysis.topSupports;

    let smartTargets: { price: number, score: number, label: string }[] = [];

    // Filter Targets: MUST be > Min Reward Distance
    // Professional Rule: Reward >= Risk (Ideally). Check against TP1.
    // Minimum acceptable TP1: Risk * 0.8 OR Config Min (0.8%)
    const minTpDist = Math.max(riskPerShare * 0.8, (TradingConfig?.risk?.safety?.min_tp_distance_percent || 0.8) / 100);

    const validTargets = targetPOIs.filter(p => {
        const dist = Math.abs((p.price - averageEntry) / averageEntry);
        return dist >= minTpDist;
    });

    if (validTargets.length > 0) {
        // Use best available valid targets
        validTargets.forEach(p => smartTargets.push({ price: p.price, score: p.score, label: 'Structure' }));
    } else {
        // No structural targets found with good R:R. 
        // Force Artificial Targets based on R:R
        const r1 = side === 'LONG' ? averageEntry * (1 + minTpDist) : averageEntry * (1 - minTpDist);
        smartTargets.push({ price: r1, score: 2, label: 'Min R:R Target' });
    }

    // Inject Predictive Targets (Only if valid distance)
    if (predictiveTargets) {
        if (predictiveTargets.rsiReversal) smartTargets.push({ price: predictiveTargets.rsiReversal, score: 20, label: '🎯 RSI Target' });
        if (predictiveTargets.liquidationCluster) smartTargets.push({ price: predictiveTargets.liquidationCluster, score: 18, label: '🧲 Liquidity' });
        if (predictiveTargets.orderBookWall) smartTargets.push({ price: predictiveTargets.orderBookWall, score: 15, label: '🧱 Wall' });
    }

    // Deduplicate and Sort
    // ... (Existing logic adapted) ...
    let uniqueTargets: { price: number, score: number, label: string }[] = [];
    smartTargets.sort((a, b) => a.price - b.price);

    for (const t of smartTargets) {
        // Filter again for strict Valid Distance vs Entry (Predictive ones might be close)
        const dist = Math.abs((t.price - averageEntry) / averageEntry);
        if (dist < minTpDist) continue;

        const existing = uniqueTargets.find(u => Math.abs((u.price - t.price) / t.price) < 0.01);
        if (existing) {
            if (t.score > existing.score) existing.score = t.score;
            if (!existing.label.includes(t.label)) existing.label += ` + ${t.label}`;
        } else {
            uniqueTargets.push(t);
        }
    }

    // Final Sort for TPs
    uniqueTargets.sort((a, b) => Math.abs(a.price - averageEntry) - Math.abs(b.price - averageEntry));

    // Fill TPs
    let tpsArray: number[] = [];
    if (uniqueTargets.length >= 3) {
        tpsArray = [uniqueTargets[0].price, uniqueTargets[1].price, uniqueTargets[2].price];
    } else {
        tpsArray = uniqueTargets.map(u => u.price);
        // Fill absolute needed
        const needed = 3 - tpsArray.length;
        const startDist = tpsArray.length > 0 ? Math.abs(tpsArray[tpsArray.length - 1] - averageEntry) : (atr * 2);
        const dir = side === 'LONG' ? 1 : -1;

        for (let i = 0; i < needed; i++) {
            // Incremental steps from last TP
            const step = atr * 2;
            const prevPrice = tpsArray.length > 0 ? tpsArray[tpsArray.length - 1] : averageEntry;
            tpsArray.push(prevPrice + (step * dir));
        }
    }

    // Sort Final TPs
    const tps = tpsArray.sort((a, b) => side === 'LONG' ? a - b : b - a);

    // Calculate Sizes
    const tpSizes = getRegimeAwareTPs(marketRegime);

    return {
        entries,
        averageEntry,
        totalRisk,
        stopLoss: finalStopLoss,
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
