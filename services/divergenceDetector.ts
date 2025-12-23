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
/**
 * Generic Divergence Detector
 * Works for RSI, MACD Line, MACD Histogram, etc.
 */
export function detectGenericDivergence(
    candles: any[],
    oscillatorValues: number[],
    sourceName: string = 'RSI',
    pivotLookback: number = 5
): Divergence | null {
    if (!candles || !oscillatorValues || candles.length < pivotLookback || oscillatorValues.length < pivotLookback) {
        return null;
    }

    const recentCandles = candles.slice(-pivotLookback);
    const recentOsc = oscillatorValues.slice(-pivotLookback);

    // Indices (0 = oldest in slice, 4 = newest in slice)
    const startIdx = 0;
    const endIdx = pivotLookback - 1;

    // === REGULAR BEARISH (Reversal Down) ===
    // Price: Higher High
    // Oscillator: Lower High
    if (recentCandles[endIdx].high > recentCandles[startIdx].high && recentOsc[endIdx] < recentOsc[startIdx]) {
        // Filter: meaningful values (e.g. RSI > 60 for bearish div)
        const isValidLevel = sourceName === 'RSI' ? recentOsc[startIdx] > 60 : recentOsc[startIdx] > 0; // MACD > 0 for bearish div

        if (isValidLevel) {
            return {
                type: 'BEARISH',
                strength: 0.8,
                description: `Regular Bearish Divergence (${sourceName}): Price made Higher High, but ${sourceName} made Lower High.`
            };
        }
    }

    // === REGULAR BULLISH (Reversal Up) ===
    // Price: Lower Low
    // Oscillator: Higher Low
    if (recentCandles[endIdx].low < recentCandles[startIdx].low && recentOsc[endIdx] > recentOsc[startIdx]) {
        // Filter
        const isValidLevel = sourceName === 'RSI' ? recentOsc[startIdx] < 40 : recentOsc[startIdx] < 0; // MACD < 0 for bullish div

        if (isValidLevel) {
            return {
                type: 'BULLISH',
                strength: 0.8,
                description: `Regular Bullish Divergence (${sourceName}): Price made Lower Low, but ${sourceName} made Higher Low.`
            };
        }
    }

    // === HIDDEN BULLISH (Continuation Up) ===
    // Price: Higher Low
    // Oscillator: Lower Low
    if (recentCandles[endIdx].low > recentCandles[startIdx].low && recentOsc[endIdx] < recentOsc[startIdx]) {
        const isValidLevel = sourceName === 'RSI' ? recentOsc[endIdx] > 40 : recentOsc[endIdx] > 0; // MACD usually stays positive in strong uptrend pullbacks

        if (isValidLevel) {
            return {
                type: 'HIDDEN_BULLISH',
                strength: 0.9, // Higher confidence for hidden divs in expert doc
                description: `Hidden Bullish Divergence (${sourceName}): Price Higher Low (Continuation) while ${sourceName} cooled off (Lower Low).`
            };
        }
    }

    // === HIDDEN BEARISH (Continuation Down) ===
    // Price: Lower High
    // Oscillator: Higher High
    if (recentCandles[endIdx].high < recentCandles[startIdx].high && recentOsc[endIdx] > recentOsc[startIdx]) {
        const isValidLevel = sourceName === 'RSI' ? recentOsc[endIdx] < 60 : recentOsc[endIdx] < 0;

        if (isValidLevel) {
            return {
                type: 'HIDDEN_BEARISH',
                strength: 0.9,
                description: `Hidden Bearish Divergence (${sourceName}): Price Lower High (Continuation) while ${sourceName} bounced high (Higher High).`
            };
        }
    }

    return null;
}

/**
 * Detecta divergencias (Legacy Wrapper or Specific Logic)
 */
export function detectDivergences(
    candles: any[],
    rsiValues: number[]
): Divergence | null {
    return detectGenericDivergence(candles, rsiValues, 'RSI');
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
