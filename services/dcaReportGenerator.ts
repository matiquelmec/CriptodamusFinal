import { calculateDCAPlan, formatConfluenceStars } from './dcaCalculator';
import { TechnicalIndicators } from '../types';
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
    macroContext?: import('../services/macroService').MacroContext // NEW: For educational narrative
): string {
    let response = '';

    // IV. PLAN DE EJECUCIÓN INSTITUCIONAL (DCA)
    const planType = side === 'LONG' ? 'Compra (Long)' : 'Venta (Short)';
    const headerTitle = customHeader || `## IV. Plan de Ejecución Institucional: Ladder DCA (${planType})`;
    response += `${headerTitle}\n\n`;

    // 1. EDUCATIONAL NARRATIVE (The "Why")
    response += `### 4.1. Tesis de Inversión (El "Por qué" simple)\n`;
    const narrative = generateEducationalNarrative(side, marketRegime, macroContext, rsiExpert);
    response += `${narrative}\n\n`;

    if (marketRegime) {
        response += `> **Ajuste Técnico:** Régimen ${marketRegime.regime}. Position Sizing y Take Profits adaptados.\n\n`;
    }

    response += `### 4.2. Filosofía: Promediación Inteligente\n\n`;
    const philosophyText = side === 'LONG'
        ? "El mercado rara vez ofrece el fondo exacto en la primera oportunidad. Este plan utiliza **3 zonas de confluencia decreciente** para construir una posición robusta."
        : "El mercado rara vez ofrece el tope exacto en la primera oportunidad. Este plan utiliza **3 zonas de resistencia creciente** para construir una posición short robusta.";

    response += `${philosophyText}\n\n`;

    const dcaPlan = confluenceAnalysis
        ? calculateDCAPlan(price, confluenceAnalysis, atr, side, marketRegime, {
            level0_618: fibonacci.level0_618,
            level0_65: fibonacci.level0_65,
            level0_786: fibonacci.level0_786,
            level0_886: fibonacci.level0_886,
            level0_5: fibonacci.level0_5
        })
        : null;

    // EXPERT TUNING: RSI TARGET INJECTION
    if (dcaPlan && rsiExpert && rsiExpert.target) {
        // Only use if target direction aligns with trade side
        // LONG: Target > Entry. SHORT: Target < Entry.
        const isAligned = (side === 'LONG' && rsiExpert.target > dcaPlan.averageEntry) ||
            (side === 'SHORT' && rsiExpert.target < dcaPlan.averageEntry);

        if (isAligned) {
            // Override TP3 (Moonbag) with Expert Target
            dcaPlan.takeProfits.tp3.price = rsiExpert.target;
            // Ensure TPs are still sorted? Usually Target is far out.
            // Let's assume Cardwell targets are significant.
            // Add note to response later.
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
        const slJustification = side === 'LONG'
            ? "1.5 ATR debajo del Entry 3"
            : "1.5 ATR encima del Entry 3";

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
        // HARDENING DOCTRINE: Validación Estricta de Niveles
        // No confiar ciegamente en Fibs si vamos contra-tendencia.
        let entryPrice = fibonacci.level0_618;
        let slPrice = fibonacci.level0_786;

        const isValidLong = side === 'LONG' && entryPrice < price;
        const isValidShort = side === 'SHORT' && entryPrice > price;

        // Si el Fib no es válido (ej: Short en Uptrend donde Fib es Soporte), usar ATR puro.
        if (!isValidLong && !isValidShort) {
            const atrEntryMult = 2.0; // Buscar retroceso profundo
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

// --- HELPER: EDUCATIONAL NARRATIVE GENERATOR ---
function generateEducationalNarrative(
    side: 'LONG' | 'SHORT',
    marketRegime: import('../types-advanced').MarketRegime | undefined,
    macro: import('../services/macroService').MacroContext | undefined,
    rsiExpert?: { target: number | null; range: string; }
): string {
    let story = "";

    // 1. Context (Macro Landscape)
    if (macro) {
        const isBearMarket = macro.btcRegime.regime === 'BEAR';
        const isBullMarket = macro.btcRegime.regime === 'BULL';
        const isAltSeason = macro.btcDominance.trend === 'FALLING' && macro.btcDominance.current < 55;

        if (side === 'SHORT' && isBearMarket) {
            story += "🌊 **Contexto Favorito (Correlación BTC):** Nadamos a favor de la corriente. La tendencia Macro de Bitcoin es bajista, lo que presiona a todo el mercado (incluido este activo) a la baja. ";
        } else if (side === 'LONG' && isBearMarket) {
            story += "⚠️ **Contra-Tendencia (Riesgo Macro):** Buscamos un rebote puntual contra la marea. Aunque este activo luzca bien, Bitcoin (el índice del mercado) es bajista, lo que aumenta el riesgo de fallo. ";
        } else if (side === 'SHORT' && isBullMarket) {
            story += "⚠️ **Contra-Tendencia (Riesgo Macro):** Buscamos una corrección en un mercado (BTC) que es alcista. Cuidado, es como pararse frente a un tren. ";
        } else if (side === 'LONG' && isAltSeason) {
            story += "🔥 **Altseason Detectada:** Bitcoin está cediendo protagonismo y la liquidez fluye hacia las Altcoins. Es el escenario ideal para movimientos explosivos en este par. ";
        }
    }

    // 2. Technical Driver (The Engine)
    if (rsiExpert) {
        const isSuperRange = rsiExpert.range.includes('SUPER');
        const rangeType = rsiExpert.range.includes('BULL') ? 'zona de compradores' : 'zona de vendedores';

        if (isSuperRange) {
            story += `Técnicamente, el activo entró en **Super Rango**, lo que significa que tiene un "motor turbo" encendido. No es momento de apostar en contra de la inercia (Momentum). `;
        } else {
            story += `El RSI nos indica que estamos operando en ${rangeType}, respetando la estructura de los grandes fondos. `;
        }
    }

    // 3. The "Why" (Analogy)
    if (marketRegime?.regime === 'RANGING') {
        story += side === 'LONG'
            ? "Imagina comprar barato en liquidación. El precio está en el suelo de un elevador; apostamos a que suba al piso de arriba."
            : "Imagina vender caro. El precio tocó el techo del elevador; apostamos a que baje al sótano.";
    } else if (marketRegime?.regime === 'TRENDING') {
        story += "Es como subirte a un tren en movimiento. No corremos tras él; esperamos una pequeña parada (retroceso) en la estación para subirnos antes de que siga su camino.";
    } else if (marketRegime?.regime === 'EXTREME') {
        story += "El elástico se estiró demasiado. Apostamos a que, por física simple, debe volver a su posición normal (Mean Reversion).";
    }

    return story;
}
