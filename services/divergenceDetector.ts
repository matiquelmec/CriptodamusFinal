// Detector de Divergencias RSI/Precio
// Señal temprana de reversión de tendencia

export interface Divergence {
    type: 'BULLISH' | 'BEARISH' | 'HIDDEN_BULLISH' | 'HIDDEN_BEARISH' | null;
    strength: number; // 0-1
    description: string;
}

/**
 * Detecta divergencias entre precio y RSI
 * @param candles - Array de velas (mínimo 5)
 * @param rsiValues - Array de valores RSI correspondientes
 * @returns Divergencia detectada o null
 */
export function detectDivergences(
    candles: any[],
    rsiValues: number[]
): Divergence | null {
    // Validación de datos
    if (!candles || !rsiValues || candles.length < 5 || rsiValues.length < 5) {
        return null;
    }

    const recentCandles = candles.slice(-5);
    const recentRSI = rsiValues.slice(-5);

    // Validar que los datos sean válidos
    if (recentCandles.some(c => !c || typeof c.high !== 'number' || typeof c.low !== 'number')) {
        return null;
    }

    if (recentRSI.some(r => typeof r !== 'number' || isNaN(r))) {
        return null;
    }

    // === DIVERGENCIA BAJISTA REGULAR ===
    // Precio: Higher High (HH)
    // RSI: Lower High (LH)
    // Interpretación: Agotamiento alcista, posible reversión a la baja
    const priceHigherHigh = recentCandles[4].high > recentCandles[0].high;
    const rsiLowerHigh = recentRSI[4] < recentRSI[0];

    if (priceHigherHigh && rsiLowerHigh && recentRSI[0] > 60) {
        return {
            type: 'BEARISH',
            strength: 0.8,
            description: 'Divergencia Bajista: Precio hace máximos más altos pero RSI hace máximos más bajos. Señal de agotamiento alcista.'
        };
    }

    // === DIVERGENCIA ALCISTA REGULAR ===
    // Precio: Lower Low (LL)
    // RSI: Higher Low (HL)
    // Interpretación: Agotamiento bajista, posible reversión al alza
    const priceLowerLow = recentCandles[4].low < recentCandles[0].low;
    const rsiHigherLow = recentRSI[4] > recentRSI[0];

    if (priceLowerLow && rsiHigherLow && recentRSI[0] < 40) {
        return {
            type: 'BULLISH',
            strength: 0.8,
            description: 'Divergencia Alcista: Precio hace mínimos más bajos pero RSI hace mínimos más altos. Señal de agotamiento bajista.'
        };
    }

    // === DIVERGENCIA OCULTA ALCISTA (Hidden Bullish) ===
    // Precio: Higher Low (HL) - Tendencia alcista intacta
    // RSI: Lower Low (LL)
    // Interpretación: Continuación de tendencia alcista
    const priceHigherLow = recentCandles[4].low > recentCandles[0].low;
    const rsiLowerLow = recentRSI[4] < recentRSI[0];

    if (priceHigherLow && rsiLowerLow && recentRSI[4] > 40) {
        return {
            type: 'HIDDEN_BULLISH',
            strength: 0.6,
            description: 'Divergencia Oculta Alcista: Señal de continuación de tendencia alcista.'
        };
    }

    // === DIVERGENCIA OCULTA BAJISTA (Hidden Bearish) ===
    // Precio: Lower High (LH) - Tendencia bajista intacta
    // RSI: Higher High (HH)
    // Interpretación: Continuación de tendencia bajista
    const priceLowerHigh = recentCandles[4].high < recentCandles[0].high;
    const rsiHigherHigh = recentRSI[4] > recentRSI[0];

    if (priceLowerHigh && rsiHigherHigh && recentRSI[4] < 60) {
        return {
            type: 'HIDDEN_BEARISH',
            strength: 0.6,
            description: 'Divergencia Oculta Bajista: Señal de continuación de tendencia bajista.'
        };
    }

    return null;
}

/**
 * Formatea la divergencia para mostrar en el reporte
 */
export function formatDivergenceReport(divergence: Divergence | null): string {
    if (!divergence || !divergence.type) return '';

    let report = `\n## 🔍 DIVERGENCIA DETECTADA\n\n`;

    const icon = divergence.type.includes('BULLISH') ? '🟢' : '🔴';
    const typeText = divergence.type.replace('_', ' ');

    report += `**Tipo**: ${icon} ${typeText}\n`;
    report += `**Fuerza**: ${(divergence.strength * 100).toFixed(0)}%\n\n`;
    report += `**Explicación**: ${divergence.description}\n\n`;

    // Educación adicional según el tipo
    if (divergence.type === 'BEARISH') {
        report += `**¿Qué significa?**\n`;
        report += `El precio está subiendo pero el momentum (RSI) está bajando. `;
        report += `Esto indica que los compradores están perdiendo fuerza. `;
        report += `Históricamente, precede correcciones del 10-30%.\n\n`;
        report += `**Acción Recomendada**:\n`;
        report += `- ✅ Considerar tomar ganancias si estás en LONG\n`;
        report += `- ✅ Preparar SHORT en resistencia clave\n`;
        report += `- ⏰ Esperar confirmación (vela roja con volumen)\n\n`;
    } else if (divergence.type === 'BULLISH') {
        report += `**¿Qué significa?**\n`;
        report += `El precio está cayendo pero el momentum (RSI) está subiendo. `;
        report += `Esto indica que los vendedores están perdiendo fuerza. `;
        report += `Históricamente, precede rebotes del 15-40%.\n\n`;
        report += `**Acción Recomendada**:\n`;
        report += `- ✅ Preparar compra en zona de soporte\n`;
        report += `- ✅ Esperar confirmación (vela verde con volumen)\n`;
        report += `- 🎯 Objetivo: Resistencia más cercana\n\n`;
    } else if (divergence.type === 'HIDDEN_BULLISH') {
        report += `**¿Qué significa?**\n`;
        report += `La tendencia alcista sigue intacta. Esta divergencia oculta sugiere `;
        report += `que después de una corrección saludable, la tendencia continuará.\n\n`;
        report += `**Acción Recomendada**:\n`;
        report += `- ✅ Mantener posiciones LONG\n`;
        report += `- ✅ Agregar en pullbacks\n\n`;
    } else if (divergence.type === 'HIDDEN_BEARISH') {
        report += `**¿Qué significa?**\n`;
        report += `La tendencia bajista sigue intacta. Esta divergencia oculta sugiere `;
        report += `que después de un rebote técnico, la tendencia bajista continuará.\n\n`;
        report += `**Acción Recomendada**:\n`;
        report += `- ✅ Evitar LONGs\n`;
        report += `- ✅ Considerar SHORTs en resistencias\n\n`;
    }

    return report;
}
