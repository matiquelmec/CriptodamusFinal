import { Divergence } from '../types';

// Detector de Divergencias RSI/Precio/CVD
// Señal temprana de reversión de tendencia y análisis de flujo de órdenes

/**
 * Generic Divergence Detector
 * Works for RSI, MACD Line, MACD Histogram, and CVD.
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

    // === CVD SPECIFIC LOGIC (Order Flow) ===
    if (sourceName === 'CVD') {
        const priceHigh = recentCandles[endIdx].high > recentCandles[startIdx].high;
        const priceLow = recentCandles[endIdx].low < recentCandles[startIdx].low;
        const oscHigh = recentOsc[endIdx] > recentOsc[startIdx];
        const oscLow = recentOsc[endIdx] < recentOsc[startIdx];

        // 1. CVD ABSORPTION BUY (Bullish Setup)
        // Scenario: Price makes Lower Low (Liquidations/Sell pressure), but CVD makes Higher Low (Absorption by limit buys).
        // Sellers are hitting the bid aggressiveley, but passive buyers are absorbing everything. Price refuses to drop further.
        if (priceLow && oscHigh) {
            return {
                type: 'CVD_ABSORPTION_BUY',
                strength: 0.95, // Institutional Signal
                description: `Institutional Absorption (Buy): Price made Lower Low but CVD made Higher Low. Limit buyers are absorbing aggressive sellers.`
            };
        }

        // 2. CVD ABSORPTION SELL (Bearish Setup)
        // Scenario: Price makes Higher High, but CVD makes Lower High (Absorption by limit sells).
        // Buyers are hitting the ask, but passive sellers are absorbing.
        if (priceHigh && oscLow) {
            return {
                type: 'CVD_ABSORPTION_SELL',
                strength: 0.95,
                description: `Institutional Absorption (Sell): Price made Higher High but CVD made Lower High. Limit sellers are absorbing aggressive buyers.`
            };
        }

        // 3. EXHAUSTION (Less common, but valid)
        // Price flat or small move, massive CVD spike? No, that's effort vs result.
        // Let's stick to the core Absorption divergences which are the reliable reversal signals.

        return null;
    }

    // === STANDARD OSCILLATOR LOGIC (RSI, MACD) ===

    // === REGULAR BEARISH (Reversal Down) ===
    // Price: Higher High
    // Oscillator: Lower High
    if (recentCandles[endIdx].high > recentCandles[startIdx].high && recentOsc[endIdx] < recentOsc[startIdx]) {
        // Filter: meaningful values
        const isValidLevel = sourceName === 'RSI' ? recentOsc[startIdx] > 60 : true; // MACD logic simplified

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
        const isValidLevel = sourceName === 'RSI' ? recentOsc[startIdx] < 40 : true;

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
        const isValidLevel = sourceName === 'RSI' ? recentOsc[endIdx] > 40 : true;

        if (isValidLevel) {
            return {
                type: 'HIDDEN_BULLISH',
                strength: 0.9,
                description: `Hidden Bullish Divergence (${sourceName}): Price Higher Low (Continuation) while ${sourceName} cooled off (Lower Low).`
            };
        }
    }

    // === HIDDEN BEARISH (Continuation Down) ===
    // Price: Lower High
    // Oscillator: Higher High
    if (recentCandles[endIdx].high < recentCandles[startIdx].high && recentOsc[endIdx] > recentOsc[startIdx]) {
        const isValidLevel = sourceName === 'RSI' ? recentOsc[endIdx] < 60 : true;

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
 * ═══════════════════════════════════════════════════════════
 * PAU PERDICES: REGULAR DIVERGENCE DETECTION (Exit Signals)
 * ═══════════════════════════════════════════════════════════
 * Regular Divergences = REVERSIÓN (no continuación)
 * - Bearish: Precio HH, RSI LH → Vender (sale de LONG)
 * - Bullish: Precio LL, RSI HL → Comprar (sale de SHORT)
 */

/**
 * Detecta divergencia REGULAR BEARISH (reversión bajista)
 * Precio: Higher High
 * RSI: Lower High → Momentum débil, probable reversión DOWN
 */
export function detectRegularBearishDivergence(
    candles: any[],
    rsiValues: number[],
    lookback: number = 10
): boolean {
    if (candles.length < lookback || rsiValues.length < lookback) return false;

    const recent = candles.slice(-lookback);
    const recentRSI = rsiValues.slice(-lookback);

    // Encontrar picos de precio (highs)
    let firstPeak = -1, secondPeak = -1;
    let firstPeakRSI = 0, secondPeakRSI = 0;

    for (let i = 2; i < recent.length - 2; i++) {
        const isLocalHigh = recent[i].high > recent[i - 1].high &&
            recent[i].high > recent[i - 2].high &&
            recent[i].high > recent[i + 1].high &&
            recent[i].high > recent[i + 2].high;

        if (isLocalHigh) {
            if (firstPeak === -1) {
                firstPeak = i;
                firstPeakRSI = recentRSI[i];
            } else {
                secondPeak = i;
                secondPeakRSI = recentRSI[i];
                break;
            }
        }
    }

    if (firstPeak === -1 || secondPeak === -1) return false;

    // REGULAR BEARISH: Price Higher High, RSI Lower High
    const priceHH = recent[secondPeak].high > recent[firstPeak].high;
    const rsiLH = secondPeakRSI < firstPeakRSI - 3; // -3 buffer

    return priceHH && rsiLH;
}

/**
 * Detecta divergencia REGULAR BULLISH (reversión alcista)
 * Precio: Lower Low
 * RSI: Higher Low → Momentum recuperándose, probable reversión UP
 * Usado para salir de posiciones SHORT
 */
export function detectRegularBullishDivergence(
    candles: any[],
    rsiValues: number[],
    lookback: number = 10
): boolean {
    if (candles.length < lookback || rsiValues.length < lookback) return false;

    const recent = candles.slice(-lookback);
    const recentRSI = rsiValues.slice(-lookback);

    // Encontrar valles de precio (lows)
    let firstTrough = -1, secondTrough = -1;
    let firstTroughRSI = 0, secondTroughRSI = 0;

    for (let i = 2; i < recent.length - 2; i++) {
        const isLocalLow = recent[i].low < recent[i - 1].low &&
            recent[i].low < recent[i - 2].low &&
            recent[i].low < recent[i + 1].low &&
            recent[i].low < recent[i + 2].low;

        if (isLocalLow) {
            if (firstTrough === -1) {
                firstTrough = i;
                firstTroughRSI = recentRSI[i];
            } else {
                secondTrough = i;
                secondTroughRSI = recentRSI[i];
                break;
            }
        }
    }

    if (firstTrough === -1 || secondTrough === -1) return false;

    // REGULAR BULLISH: Price Lower Low, RSI Higher Low
    const priceLL = recent[secondTrough].low < recent[firstTrough].low;
    const rsiHL = secondTroughRSI > firstTroughRSI + 3; // +3 buffer

    return priceLL && rsiHL;
}

/**
 * Detecta divergencias (Legacy Wrapper)
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

    const isBullish = divergence.type.includes('BULLISH') || divergence.type.includes('BUY');
    const icon = isBullish ? '🟢' : '🔴';
    const typeText = divergence.type.replace(/_/g, ' ');

    report += `**Tipo**: ${icon} ${typeText}\n`;
    report += `**Fuerza**: ${(divergence.strength * 100).toFixed(0)}%\n\n`;
    report += `**Explicación**: ${divergence.description}\n\n`;

    // Educación adicional
    if (divergence.type.includes('CVD')) {
        report += `**🧠 ANÁLISIS INSTITUCIONAL (Order Flow)**\n`;
        if (divergence.type.includes('BUY')) {
            report += `Detectada **Absorción Pasiva**. Las "Ballenas" están poniendo órdenes Limit de compra y absorbiendo todas las ventas agresivas. El precio no baja aunque vendan mucho. Señal muy potente de suelo. 🐋\n`;
        } else {
            report += `Detectada **Absorción Pasiva**. Las "Ballenas" están poniendo órdenes Limit de venta y absorbiendo todas las compras agresivas. El precio no sube aunque compren mucho. Señal muy potente de techo. 🐋\n`;
        }
    } else if (divergence.type === 'BEARISH') {
        report += `**¿Qué significa?**\n`;
        report += `El precio sube, momentum baja. Compradores agotados.\n`;
    } else if (divergence.type === 'BULLISH') {
        report += `**¿Qué significa?**\n`;
        report += `El precio baja, momentum sube. Vendedores agotados.\n`;
    }

    return report;
}
