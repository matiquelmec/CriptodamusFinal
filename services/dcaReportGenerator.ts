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
    confluenceAnalysis: ConfluenceAnalysis | undefined
): string {
    let response = '';

    // IV. PLAN DE EJECUCIÓN INSTITUCIONAL (DCA)
    response += `## IV. Plan de Ejecución Institucional: Ladder DCA de 3 Niveles\\n\\n`;
    response += `### 4.1. Filosofía: Promediación Inteligente\\n\\n`;
    response += `El mercado rara vez ofrece el fondo exacto en la primera oportunidad. Este plan utiliza **3 zonas de confluencia decreciente** para construir una posición robusta.\\n\\n`;

    // Calculate DCA Plan
    const dcaPlan = confluenceAnalysis
        ? calculateDCAPlan(price, confluenceAnalysis, atr, 'LONG', {
            level0_618: fibonacci.level0_618,
            level0_786: fibonacci.level0_786,
            level0_5: fibonacci.level0_5
        })
        : null;

    if (dcaPlan) {
        // DCA Ladder Table
        response += `### 4.2. Ladder de Entradas (DCA)\\n\\n`;
        response += `| Nivel | Precio | Confluencia | Factores | Descuento | Tamaño |\\n`;
        response += `|-------|--------|-------------|----------|-----------|--------|\\n`;

        dcaPlan.entries.forEach(entry => {
            const stars = formatConfluenceStars(entry.confluenceScore);
            const factorsText = entry.factors.slice(0, 2).join(' + ');
            response += `| **Entry ${entry.level}** | $${entry.price.toFixed(4)} | ${stars} | ${factorsText} | -${entry.distanceFromCurrent.toFixed(1)}% | **${entry.positionSize}%** |\\n`;
        });

        response += `\\n**Precio Promedio Ponderado (WAP)**: $${dcaPlan.averageEntry.toFixed(4)}\\n\\n`;

        // Risk Management
        response += `### 4.3. Gestión de Riesgo\\n\\n`;
        response += `| Métrica | Valor | Justificación |\\n`;
        response += `|---------|-------|---------------|\\n`;
        response += `| **Stop Loss Global** | $${dcaPlan.stopLoss.toFixed(4)} | 1.5 ATR debajo del Entry 3 |\\n`;
        response += `| **Riesgo Total** | ${dcaPlan.totalRisk.toFixed(2)}% | Exposición máxima |\\n`;

        const rr = Math.abs((dcaPlan.takeProfits.tp2.price - dcaPlan.averageEntry) / (dcaPlan.averageEntry - dcaPlan.stopLoss));
        response += `| **R:R Promedio** | 1:${rr.toFixed(2)} | Basado en WAP vs TP2 |\\n\\n`;

        // Take Profits
        response += `### 4.4. Salidas Escalonadas\\n\\n`;
        response += `| TP | Precio | Salida | Objetivo |\\n`;
        response += `|----|--------|--------|----------|\\n`;
        response += `| **TP1** | $${dcaPlan.takeProfits.tp1.price.toFixed(4)} | **${dcaPlan.takeProfits.tp1.exitSize}%** | Asegurar ganancia + SL a Breakeven |\\n`;
        response += `| **TP2** | $${dcaPlan.takeProfits.tp2.price.toFixed(4)} | **${dcaPlan.takeProfits.tp2.exitSize}%** | Capturar impulso |\\n`;
        response += `| **TP3** | $${dcaPlan.takeProfits.tp3.price.toFixed(4)} | **${dcaPlan.takeProfits.tp3.exitSize}%** | Moonbag |\\n\\n`;

        // Protocol
        response += `### 4.5. Protocolo\\n\\n`;
        response += `1. **Colocar 3 órdenes límite** en Entry 1, 2 y 3\\n`;
        response += `2. **Esperar confirmación CHoCH** en 1m/3m\\n`;
        response += `3. **Mover SL a breakeven** tras alcanzar TP1\\n`;
        response += `4. **Trailing stop** en TP2\\n\\n`;
        response += `> **Regla de Oro**: Si Entry 1 no se ejecuta en 24h, cancelar el setup.\\n`;
    } else {
        // Fallback simple
        const entryPrice = fibonacci.level0_618;
        const slPrice = fibonacci.level0_786;
        response += `### 4.2. Plan Simple\\n\\n`;
        response += `| Componente | Valor |\\n`;
        response += `|-----------|-------|\\n`;
        response += `| **Entrada** | $${entryPrice.toFixed(4)} |\\n`;
        response += `| **Stop Loss** | $${slPrice.toFixed(4)} |\\n`;
        response += `| **TP1** | $${(price + atr * 2).toFixed(4)} |\\n`;
        response += `| **TP2** | $${(price + atr * 4).toFixed(4)} |\\n\\n`;
    }

    response += `\\n> *Máxima Operativa: Preservación de Capital.*`;

    return response;
}
