import { calculateDCAPlan, formatConfluenceStars } from './dcaCalculator';
import { TechnicalIndicators, FundamentalTier } from '../types';
import type { ConfluenceAnalysis } from './confluenceEngine';

/**
 * Genera la sección IV del reporte: Plan de Ejecución DCA
 * Enfoque modular para evitar complejidad en geminiService.ts
 */
export function generateDCAExecutionPlan(
    price: number,
    atr: number,
    fibonacci: TechnicalIndicators['fibonacci'],
    confluenceAnalysis: ConfluenceAnalysis | undefined,
    marketRegime: import('../types-advanced').MarketRegime | undefined,
    side: 'LONG' | 'SHORT' = 'LONG',
    customHeader?: string,
    rsiExpert?: { target: number | null; range: string; },
    macroContext?: import('../services/macroService').MacroContext,
    executionPhilosophy?: string, // NEW: AI Narrative Injection
    tier: FundamentalTier = 'B', // NEW: Fundamental Tier
    harmonicPatterns: import('./harmonicPatterns').HarmonicPattern[] = [], // NEW: For Structural Stops
    freezeSignal?: import('./strategies/FreezeStrategy').FreezeSignal, // NEW: Freeze Strategy Override
    volumeExpert?: import('./types-advanced').VolumeExpertAnalysis // NEW: Predictive Data Injection
): string {
    let response = '';

    // IV. PLAN DE EJECUCIÓN INSTITUCIONAL (DCA)
    const planType = side === 'LONG' ? 'Compra (Long)' : 'Venta (Short)';
    const headerTitle = customHeader || `## IV. Plan de Ejecución Institucional: Ladder DCA (${planType})`;
    response += `${headerTitle}\n\n`;

    // 4.1. Filosofía de Ejecución (AI Generated)
    response += `### 4.1. Filosofía de Ejecución\n\n`;

    // Fallback philosophy if AI fails or not provided
    const defaultPhilosophy = side === 'LONG'
        ? "El mercado rara vez ofrece el fondo exacto en la primera oportunidad. Este plan utiliza **3 zonas de confluencia decreciente** para construir una posición robusta."
        : "El mercado rara vez ofrece el tope exacto en la primera oportunidad. Este plan utiliza **3 zonas de resistencia creciente** para construir una posición short robusta.";

    response += `${executionPhilosophy || defaultPhilosophy}\n\n`;

    if (marketRegime) {
        response += `> **Ajuste Técnico:** Régimen ${marketRegime.regime}. Position Sizing y Take Profits adaptados.\n\n`;
    }

    // --- PREDICTIVE TARGETS EXTRACTION (ADVISOR BRAIN) ---
    const predictiveTargets: import('./dcaCalculator').PredictiveTargets = {
        rsiReversal: rsiExpert?.target ? rsiExpert.target : undefined,
        orderBookWall: undefined,
        liquidationCluster: undefined
    };

    if (volumeExpert) {
        // 1. OrderBook Walls (Front-run Logic)
        if (side === 'LONG' && volumeExpert.liquidity.orderBook?.askWall) {
            predictiveTargets.orderBookWall = volumeExpert.liquidity.orderBook.askWall.price;
        } else if (side === 'SHORT' && volumeExpert.liquidity.orderBook?.bidWall) {
            predictiveTargets.orderBookWall = volumeExpert.liquidity.orderBook.bidWall.price;
        }

        // 2. Liquidation Magnets
        const liqs = volumeExpert.liquidity.liquidationClusters || [];
        if (liqs.length > 0) {
            const targetType = side === 'LONG' ? 'SHORT_LIQ' : 'LONG_LIQ';
            const magnet = liqs.find(l => l.type === targetType);
            if (magnet) predictiveTargets.liquidationCluster = (magnet.priceMin + magnet.priceMax) / 2;
        }
    }

    const dcaPlan = confluenceAnalysis
        ? calculateDCAPlan(price, confluenceAnalysis, atr, side, marketRegime, {
            level0_618: fibonacci.level0_618,
            level0_65: fibonacci.level0_65,
            level0_786: fibonacci.level0_786,
            level0_886: fibonacci.level0_886,
            level0_5: fibonacci.level0_5
        }, tier, predictiveTargets) // ✅ WIRED TO BRAIN
        : null;

    // EXPERT TUNING: FREEZE STRATEGY OVERRIDE (PRIORITY #1)
    if (dcaPlan && freezeSignal && freezeSignal.active) {
        // Freeze dictates a precise entry and tight stop.
        // We override the Ladder to focus heavily on the Freeze Level.

        // Entry 1 & 2 -> Freeze Entry Price (Sniper)
        dcaPlan.entries[0].price = freezeSignal.entryPrice;
        dcaPlan.entries[0].level = 1;
        dcaPlan.entries[0].factors = ['❄️ FREEZE TRIGGER', ...freezeSignal.reason];
        dcaPlan.entries[0].positionSize = 50; // High conviction on first hit

        dcaPlan.entries[1].price = freezeSignal.entryPrice * (side === 'LONG' ? 0.995 : 1.005); // Tiny DCA
        dcaPlan.entries[1].level = 2;
        dcaPlan.entries[1].factors = ['❄️ FREEZE ZONE'];
        dcaPlan.entries[1].positionSize = 30;

        dcaPlan.entries[2].price = freezeSignal.entryPrice * (side === 'LONG' ? 0.99 : 1.01); // Standard safety
        dcaPlan.entries[2].positionSize = 20;

        // Recalculate Average
        dcaPlan.averageEntry = freezeSignal.entryPrice * 0.997; // Approx

        // Force Stop Loss
        dcaPlan.stopLoss = freezeSignal.stopLoss;

        // Force TP1 (1:1 Ratio usually)
        if (freezeSignal.takeProfit) {
            dcaPlan.takeProfits.tp2.price = freezeSignal.takeProfit;
        }
    }

    // EXPERT TUNING: RSI TARGET INJECTION
    if (dcaPlan && rsiExpert && rsiExpert.target) {
        // Only use if target direction aligns with trade side
        // LONG: Target > Entry. SHORT: Target < Entry.
        const isAligned = (side === 'LONG' && rsiExpert.target > dcaPlan.averageEntry) ||
            (side === 'SHORT' && rsiExpert.target < dcaPlan.averageEntry);

        if (isAligned) {
            // Override TP3 (Moonbag) with Expert Target
            dcaPlan.takeProfits.tp3.price = rsiExpert.target;
        }
    }

    if (dcaPlan) {
        // DCA Ladder Table
        response += `### 4.2. Ladder de Entradas (DCA)\n\n`;
        const discountLabel = side === 'LONG' ? 'Descuento' : 'Premium';
        response += `| Nivel | Precio | Confluencia | Factores | ${discountLabel} | Tamaño |\n`;
        response += `|-------|--------|-------------|----------|-----------|--------|\n`;

        dcaPlan.entries.forEach(entry => {
            const stars = formatConfluenceStars(entry.confluenceScore);
            const factorsText = entry.factors.slice(0, 2).join(' + ');
            const percentDiffKey = side === 'LONG' ? '-' : '+';
            response += `| **Entry ${entry.level}** | $${entry.price.toFixed(4)} | ${stars} | ${factorsText} | ${percentDiffKey}${Math.abs(entry.distanceFromCurrent).toFixed(1)}% | **${entry.positionSize}%** |\n`;
        });

        response += `\n**Precio Promedio Ponderado (WAP)**: $${dcaPlan.averageEntry.toFixed(4)}\n\n`;

        // Risk Management
        response += `### 4.3. Gestión de Riesgo\n\n`;
        response += `| Métrica | Valor | Justificación |\n`;
        response += `|---------|-------|---------------|\n`;

        // DYNAMIC TEXT BASED ON TIER
        // DYNAMIC STOP LOSS & RISK LOGIC
        // 1. Check for Active Harmonic Pattern (Structural Stop) - Priority #1
        const targetDirection = side === 'LONG' ? 'BULLISH' : 'BEARISH';
        const activeHarmonic = harmonicPatterns.find(p => p.direction === targetDirection); // Match direction
        let useHarmonicStop = false;
        let harmonicStopPrice = 0;

        if (activeHarmonic) {
            // Stop at X point or slightly beyond 1.13 extension of XA
            // For simplicity and safety, we use the pattern's invalidation point if available, or calc it.
            // Assuming pattern object might not have explicit 'invalidation', we estimate:
            // Bullish: Below X. Bearish: Above X.
            // Using a tight buffer (0.2% beyond X)
            const buffer = activeHarmonic.prz * 0.002;
            // Better: Use the computed 'stopLoss' from the Harmonic detector if we had it, 
            // but here we can infer from the pattern definition relative to PRZ/X. 
            // Let's assume PRZ is close to D. X is the anchor.
            // Realistically, if we don't have X price passed, we might need to rely on the generic. 
            // BUT, let's assume valid patterns have precise PRZ. 
            // Let's stick to the "Maximum Robustness" plan: If pattern exists, its PRZ is the entry/pivot. 
            // The Stop should be below the PRZ for Bull, above for Bear.

            // Refined Logic:
            harmonicStopPrice = side === 'LONG'
                ? activeHarmonic.prz * 0.985 // 1.5% below PRZ (Tight Structure)
                : activeHarmonic.prz * 1.015; // 1.5% above PRZ

            useHarmonicStop = true;
        }

        // 2. Tier Based Multiplier (Fallback)
        let multiplierText = "1.5";
        let tierMultiplier = 1.5;
        if (tier === 'S') { multiplierText = "2.5 (Tier S)"; tierMultiplier = 2.5; }
        else if (tier === 'A') { multiplierText = "2.0 (Tier A)"; tierMultiplier = 2.0; }
        else if (tier === 'B') { multiplierText = "1.5 (Tier B)"; tierMultiplier = 1.5; }
        else if (tier === 'C') { multiplierText = "1.0 (Sniper Tier C)"; tierMultiplier = 1.0; }

        let finalStopLoss = dcaPlan.stopLoss;
        let slJustification = "";

        if (useHarmonicStop) {
            finalStopLoss = harmonicStopPrice;
            slJustification = `🚫 ESTRUCTURAL (${activeHarmonic?.type} Invalidation)`;
            // Override the plan's SL
            dcaPlan.stopLoss = finalStopLoss;
            // Recalculate Risk
            const riskPerShare = Math.abs(dcaPlan.averageEntry - finalStopLoss);
            const riskPercent = (riskPerShare / dcaPlan.averageEntry) * 100;
            dcaPlan.totalRisk = riskPercent;
        } else {
            // Standard ATR Logic (already inside dcaPlan usually, but strictly verifying text)
            slJustification = side === 'LONG'
                ? `${multiplierText} ATR debajo del Entry 3`
                : `${multiplierText} ATR encima del Entry 3`;
        }

        response += `| **Stop Loss Global** | $${dcaPlan.stopLoss.toFixed(4)} | ${slJustification} |\n`;
        response += `| **Riesgo Total** | ${dcaPlan.totalRisk.toFixed(2)}% | Exposición máxima |\n`;

        const rr = Math.abs((dcaPlan.takeProfits.tp2.price - dcaPlan.averageEntry) / (dcaPlan.averageEntry - dcaPlan.stopLoss));
        let rrIcon = "✅";
        let rrNote = "Plan Saludable";

        if (rr < 1.0) {
            rrIcon = "⛔";
            rrNote = "CRÍTICO: Arriesgas más de lo que ganas.";
        } else if (rr < 1.5) {
            rrIcon = "⚠️";
            rrNote = "Ratio pobre. Requiere alta tasa de acierto.";
        }

        response += `| **R:R Promedio** | ${rrIcon} 1:${rr.toFixed(2)} | ${rrNote} (WAP vs TP2) |\n\n`;

        // Take Profits
        response += `### 4.4. Salidas Escalonadas\n\n`;
        response += `| TP | Precio | Salida | Objetivo |\n`;
        response += `|----|--------|--------|----------|\n`;
        response += `| **TP1** | $${dcaPlan.takeProfits.tp1.price.toFixed(4)} | **${dcaPlan.takeProfits.tp1.exitSize}%** | Asegurar ganancia + SL a Breakeven |\n`;
        response += `| **TP2** | $${dcaPlan.takeProfits.tp2.price.toFixed(4)} | **${dcaPlan.takeProfits.tp2.exitSize}%** | Capturar impulso |\n`;
        response += `| **TP3** | $${dcaPlan.takeProfits.tp3.price.toFixed(4)} | **${dcaPlan.takeProfits.tp3.exitSize}%** | Moonbag |\n\n`;

        // SMART SCENARIOS (NEW)
        response += `### 4.5. Escenarios Inteligentes ("What If")\n`;

        // Scenario A: Breakout (FOMO Protection)
        const breakoutLevel = side === 'LONG'
            ? dcaPlan.entries[0].price * 1.02 // 2% above Entry 1
            : dcaPlan.entries[0].price * 0.98; // 2% below Entry 1

        const breakoutDesc = side === 'LONG' ? "Rompe Resistencia Clave" : "Rompe Soporte Clave";
        const breakoutAction = side === 'LONG' ? "Entrar en Mercado (Buy Stop)" : "Entrar en Mercado (Sell Stop)";

        response += `**A) Si el precio se escapa (No llena entradas):**\n`;
        response += `- **Condición:** ${breakoutDesc} en **$${breakoutLevel.toFixed(4)}** con volumen fuerte.\n`;
        response += `- **Acción:** ${breakoutAction} con 30% del tamaño habitual.\n\n`;

        // Scenario B: Invalidation (Flip)
        const invalidationLevel = dcaPlan.stopLoss;
        const flipAction = side === 'LONG' ? "Buscar retest para Short" : "Buscar retest para Long";

        response += `**B) Si el análisis falla (Invalidación):**\n`;
        response += `- **Nivel Crítico:** Cierre de vela 1H por ${side === 'LONG' ? 'debajo' : 'encima'} de **$${invalidationLevel.toFixed(4)}**.\n`;
        response += `- **Consecuencia:** La tesis ${side} muere. Cancelar órdenes.\n`;
        response += `- **Plan B:** Esperar rebote y ${flipAction}.\n\n`;

        response += `### 4.6. Protocolo de Ejecución\n\n`;
        response += `1. **Colocar 3 órdenes límite** en Entry 1, 2 y 3\n`;
        const chochText = side === 'LONG' ? "confirmación CHoCH (Breakout Alcista)" : "confirmación CHoCH (Breakdown Bajista)";
        response += `2. **Esperar ${chochText}** en 1m/3m\n`;
        response += `3. **Mover SL a breakeven** tras alcanzar TP1\n`;
        response += `4. **Trailing stop** en TP2\n\n`;
        response += `> **Regla de Oro**: Si Entry 1 no se ejecuta en 24h, cancelar el setup.\n`;
    } else {
        // Fallback Logic
        let entryPrice = fibonacci.level0_618;
        let slPrice = fibonacci.level0_786;

        const isValidLong = side === 'LONG' && entryPrice < price;
        const isValidShort = side === 'SHORT' && entryPrice > price;

        if (!isValidLong && !isValidShort) {
            const atrEntryMult = 2.0;
            const atrSLMult = 3.5;
            const dir = side === 'LONG' ? -1 : 1;

            entryPrice = price + (atr * atrEntryMult * dir);
            slPrice = price + (atr * atrSLMult * dir);
        }

        const tpmult = side === 'LONG' ? 1 : -1;

        response += `### 4.2. Plan Simple (Fallback)\n\n`;
        response += `| Componente | Valor |\n`;
        response += `|-----------|-------|\n`;
        response += `| **Entrada (Ref)** | $${entryPrice.toFixed(4)} |\n`;
        response += `| **Stop Loss** | $${slPrice.toFixed(4)} |\n`;
        response += `| **TP1** | $${(price + (atr * 2 * tpmult)).toFixed(4)} |\n`;
        response += `| **TP2** | $${(price + (atr * 4 * tpmult)).toFixed(4)} |\n\n`;
    }

    response += `\n> *Máxima Operativa: Preservación de Capital.*`;

    return response;
}
