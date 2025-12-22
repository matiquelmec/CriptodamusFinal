
// --- MATH HELPERS (ROBUST) ---

// Checks if Price made Lower Low but RSI made Higher Low in the last 15 periods
export function detectBullishDivergence(prices: number[], rsiSeries: number[], lows: number[]) {
    // Need at least 20 periods
    if (prices.length < 20 || rsiSeries.length < 20) return false;

    // 1. Find recent low (current or last 3 candles)
    let recentLowIndex = -1;
    let recentLowPrice = Infinity;

    // Check last 3 closed candles
    const startCheck = prices.length - 2; // Avoid live candle
    for (let i = startCheck; i > startCheck - 3; i--) {
        if (lows[i] < recentLowPrice) {
            recentLowPrice = lows[i];
            recentLowIndex = i;
        }
    }

    // 2. Find a previous swing low (look back 5 to 20 candles)
    let pastLowIndex = -1;
    let pastLowPrice = Infinity;

    const lookbackStart = recentLowIndex - 5;
    const lookbackEnd = Math.max(0, recentLowIndex - 25);

    for (let i = lookbackStart; i > lookbackEnd; i--) {
        // Is this a pivot low? (Lower than neighbors)
        if (lows[i] < lows[i - 1] && lows[i] < lows[i + 1]) {
            // Regular Bullish Divergence: Price Lower Low, RSI Higher Low
            if (lows[i] > recentLowPrice) {
                pastLowPrice = lows[i];
                pastLowIndex = i;
                break; // Found the most recent structural low
            }
        }
    }

    if (pastLowIndex === -1) return false;

    // 3. Compare RSI
    const recentRSI = rsiSeries[recentLowIndex];
    const pastRSI = rsiSeries[pastLowIndex];

    // Bullish Div: Price made Lower Low (Verified above), RSI makes Higher Low
    if (recentRSI > pastRSI + 1) { // +1 buffer to avoid noise
        return true;
    }

    return false;
}

// Calculates just the lines (Tenkan/Kijun) for current cross check
export function calculateIchimokuLines(highs: number[], lows: number[], offset: number = 0) {
    const end = highs.length - offset;
    // Tenkan-sen (9 periods)
    const tenkan = (Math.max(...highs.slice(end - 9, end)) + Math.min(...lows.slice(end - 9, end))) / 2;
    // Kijun-sen (26 periods)
    const kijun = (Math.max(...highs.slice(end - 26, end)) + Math.min(...lows.slice(end - 26, end))) / 2;
    return { tenkan, kijun };
};

// Calculates the cloud Spans based on the provided dataset (which should be shifted historically)
export function calculateIchimokuCloud(highs: number[], lows: number[]) {
    const { tenkan, kijun } = calculateIchimokuLines(highs, lows, 0);
    // Senkou Span A (Leading Span A)
    const senkouA = (tenkan + kijun) / 2;
    // Senkou Span B (52 periods)
    const senkouB = (Math.max(...highs.slice(highs.length - 52)) + Math.min(...lows.slice(lows.length - 52))) / 2;

    return { senkouA, senkouB };
};

export function calculateBollingerStats(prices: number[], period: number = 20, stdDevMultiplier: number = 2) {
    const sma = calculateSMA(prices, period);
    const stdDev = calculateStdDev(prices, period, sma);
    const upper = sma + (stdDev * stdDevMultiplier);
    const lower = sma - (stdDev * stdDevMultiplier);
    // Bandwidth %: (Upper - Lower) / Middle * 100
    const bandwidth = sma > 0 ? ((upper - lower) / sma) * 100 : 0;

    return { upper, lower, bandwidth, sma };
};

export function calculateSMA(data: number[], period: number) {
    if (data.length < period) return data[data.length - 1];
    return data.slice(-period).reduce((a, b) => a + b, 0) / period;
};

export function calculateEMA(data: number[], period: number) {
    if (data.length < period) return data[data.length - 1];
    const k = 2 / (period + 1);
    let ema = data[0]; // Initialization could be improved with SMA of first N, but this converges enough for 100 candles
    for (let i = 1; i < data.length; i++) {
        ema = (data[i] * k) + (ema * (1 - k));
    }
    return ema;
};

export function calculateMACD(prices: number[], fast = 12, slow = 26, signal = 9) {
    const emaFast = calculateEMAArray(prices, fast);
    const emaSlow = calculateEMAArray(prices, slow);

    const macdLine = [];
    for (let i = 0; i < prices.length; i++) {
        macdLine.push(emaFast[i] - emaSlow[i]);
    }

    const signalLine = calculateEMAArray(macdLine, signal);
    const histogram = macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1];

    return {
        macdLine: macdLine[macdLine.length - 1],
        signalLine: signalLine[signalLine.length - 1],
        histogram: histogram
    };
}

// Helper to return array of EMAs for MACD calculation
export function calculateEMAArray(data: number[], period: number) {
    const k = 2 / (period + 1);
    const emaArray = [data[0]];
    for (let i = 1; i < data.length; i++) {
        emaArray.push((data[i] * k) + (emaArray[i - 1] * (1 - k)));
    }
    return emaArray;
};

export function calculateStdDev(data: number[], period: number, mean: number) {
    if (data.length < period) return 0;
    const slice = data.slice(-period);
    const squaredDiffs = slice.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    return Math.sqrt(avgSquaredDiff);
};

export function calculateRSI(prices: number[], period: number = 14) {
    if (prices.length < period + 1) return 50;
    const rsiArray = calculateRSIArray(prices, period);
    return rsiArray[rsiArray.length - 1];
};

// NEW: Stochastic RSI for precision entries
export function calculateStochRSI(prices: number[], period: number = 14) {
    const rsiArray = calculateRSIArray(prices, period);
    // Need at least period amount of RSIs to calc stoch
    const relevantRSI = rsiArray.slice(-period);
    const minRSI = Math.min(...relevantRSI);
    const maxRSI = Math.max(...relevantRSI);

    // StochRSI K
    let k = 0;
    if (maxRSI !== minRSI) {
        k = ((relevantRSI[relevantRSI.length - 1] - minRSI) / (maxRSI - minRSI)) * 100;
    }
    // D is usually 3-period SMA of K
    const d = k; // Simplified for now, real D requires array of Ks

    return { k, d };
};

// Full Array Wilder's RSI (For Divergence checks)
export function calculateRSIArray(data: number[], period: number): number[] {
    if (data.length < period + 1) return new Array(data.length).fill(50);

    let gains = 0;
    let losses = 0;
    const rsiArray = new Array(data.length).fill(0);

    // First average (SMA)
    for (let i = 1; i < period + 1; i++) {
        const change = data[i] - data[i - 1];
        if (change >= 0) gains += change;
        else losses += Math.abs(change);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // First RSI
    rsiArray[period] = 100 - (100 / (1 + (avgGain / avgLoss)));

    // Smoothed averages (Wilder's Smoothing)
    for (let i = period + 1; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        const currentGain = change > 0 ? change : 0;
        const currentLoss = change < 0 ? Math.abs(change) : 0;

        avgGain = ((avgGain * (period - 1)) + currentGain) / period;
        avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;

        if (avgLoss === 0) {
            rsiArray[i] = 100;
        } else {
            const rs = avgGain / avgLoss;
            rsiArray[i] = 100 - (100 / (1 + rs));
        }
    }
    return rsiArray;
};

// NEW: Cumulative VWAP (Session VWAP approx)
export function calculateCumulativeVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]) {
    // Typical Price
    let cumTPV = 0;
    let cumVol = 0;

    // We calculate for the whole loaded dataset (mimicking session start)
    for (let i = 0; i < closes.length; i++) {
        const tp = (highs[i] + lows[i] + closes[i]) / 3;
        cumTPV += (tp * volumes[i]);
        cumVol += volumes[i];
    }

    return cumVol > 0 ? cumTPV / cumVol : closes[closes.length - 1];
};

// NEW: Auto Fibonacci Retracements (Dynamic Lookback with FRACTALS)
// Implements Bill Williams Fractals (5 bars) for institutional anchor points
export function calculateFractals(highs: number[], lows: number[]) {
    const fractalHighs: { price: number; index: number }[] = [];
    const fractalLows: { price: number; index: number }[] = [];

    // Need at least 5 bars. Loop from 2 to length-2
    for (let i = 2; i < highs.length - 2; i++) {
        // Bearish Fractal (High)
        const isHigh = highs[i] > highs[i - 1] && highs[i] > highs[i - 2] &&
                       highs[i] > highs[i + 1] && highs[i] > highs[i + 2];
        if (isHigh) fractalHighs.push({ price: highs[i], index: i });

        // Bullish Fractal (Low)
        const isLow = lows[i] < lows[i - 1] && lows[i] < lows[i - 2] &&
                      lows[i] < lows[i + 1] && lows[i] < lows[i + 2];
        if (isLow) fractalLows.push({ price: lows[i], index: i });
    }
    return { fractalHighs, fractalLows };
}

export function calculateAutoFibs(highs: number[], lows: number[], ema200: number) {
    const currentPrice = highs[highs.length - 1];
    const isUptrend = currentPrice > ema200;

    // Use Fractals for precision anchoring
    const { fractalHighs, fractalLows } = calculateFractals(highs, lows);
    
    // Fallback if no fractals found (rare but possible in very short arrays)
    if (fractalHighs.length === 0 || fractalLows.length === 0) {
        // Simple Min/Max fallback
         const lookback = Math.min(highs.length, 300);
         const subsetHighs = highs.slice(-lookback);
         const subsetLows = lows.slice(-lookback);
         const maxHigh = Math.max(...subsetHighs);
         const minLow = Math.min(...subsetLows);
         const diff = maxHigh - minLow;
         
         if (isUptrend) {
             return {
                 trend: 'UP' as const,
                 level0: maxHigh,
                 level0_236: maxHigh - (diff * 0.236),
                 level0_382: maxHigh - (diff * 0.382),
                 level0_5: maxHigh - (diff * 0.5),
                 level0_618: maxHigh - (diff * 0.618),
                 level0_65: maxHigh - (diff * 0.65), // Institutional Zone Start
                 level0_786: maxHigh - (diff * 0.786),
                 level0_886: maxHigh - (diff * 0.886), // Stop Hunt / Shark
                 level1: minLow,
                 tp1: maxHigh + (diff * 0.272),
                 tp2: maxHigh + (diff * 0.618),
                 tp3: maxHigh + (diff * 1.0),
                 tp4: maxHigh + (diff * 1.618), // Golden Extension
                 tp5: maxHigh + (diff * 2.618)  // Euphoria
             };
         } else {
             return {
                 trend: 'DOWN' as const,
                 level0: minLow,
                 level0_236: minLow + (diff * 0.236),
                 level0_382: minLow + (diff * 0.382),
                 level0_5: minLow + (diff * 0.5),
                 level0_618: minLow + (diff * 0.618),
                 level0_65: minLow + (diff * 0.65),
                 level0_786: minLow + (diff * 0.786),
                 level0_886: minLow + (diff * 0.886),
                 level1: maxHigh,
                 tp1: minLow - (diff * 0.272),
                 tp2: minLow - (diff * 0.618),
                 tp3: minLow - (diff * 1.0),
                 tp4: minLow - (diff * 1.618),
                 tp5: minLow - (diff * 2.618)
             };
         }
    }

    let anchorHigh = -Infinity;
    let anchorLow = Infinity;

    if (isUptrend) {
        // En tendencia alcista:
        // 1. Encontrar el MAXIMO MAS ALTO RECIENTE (Swing High)
        // 2. Encontrar el MINIMO MAS BAJO ANTERIOR a ese máximo (Swing Low origen)
        
        // Tomamos el fractal High más alto de los últimos X periodos relevantes
        const relevantHighs = fractalHighs.filter(f => f.index > highs.length - 300);
        if (relevantHighs.length > 0) {
            // Find the absolute highest fractal
            const highestFractal = relevantHighs.reduce((prev, curr) => curr.price > prev.price ? curr : prev);
            anchorHigh = highestFractal.price;

            // Find the lowest fractal BEFORE that high (origin of the move)
            const relevantLows = fractalLows.filter(f => f.index < highestFractal.index && f.index > highestFractal.index - 300);
            if (relevantLows.length > 0) {
                 const lowestFractal = relevantLows.reduce((prev, curr) => curr.price < prev.price ? curr : prev);
                 anchorLow = lowestFractal.price;
            } else {
                 anchorLow = Math.min(...lows.slice(Math.max(0, highestFractal.index - 100), highestFractal.index));
            }
        }
    } else {
        // En tendencia bajista:
        // 1. Encontrar el MINIMO MAS BAJO RECIENTE (Swing Low)
        // 2. Encontrar el MAXIMO MAS ALTO ANTERIOR a ese mínimo (Swing High origen)
        
        const relevantLows = fractalLows.filter(f => f.index > lows.length - 300);
        if (relevantLows.length > 0) {
            const lowestFractal = relevantLows.reduce((prev, curr) => curr.price < prev.price ? curr : prev);
            anchorLow = lowestFractal.price;

             const relevantHighs = fractalHighs.filter(f => f.index < lowestFractal.index && f.index > lowestFractal.index - 300);
             if (relevantHighs.length > 0) {
                 const highestFractal = relevantHighs.reduce((prev, curr) => curr.price > prev.price ? curr : prev);
                 anchorHigh = highestFractal.price;
             } else {
                 anchorHigh = Math.max(...highs.slice(Math.max(0, lowestFractal.index - 100), lowestFractal.index));
             }
        }
    }
    
    // Safety check
    if (anchorHigh === -Infinity) anchorHigh = Math.max(...highs);
    if (anchorLow === Infinity) anchorLow = Math.min(...lows);

    const diff = anchorHigh - anchorLow;

    if (isUptrend) {
        // Retracement calc (Downwards from High)
        return {
            trend: 'UP' as const,
            level0: anchorHigh, // Top (0%)
            level0_236: anchorHigh - (diff * 0.236),
            level0_382: anchorHigh - (diff * 0.382),
            level0_5: anchorHigh - (diff * 0.5),
            level0_618: anchorHigh - (diff * 0.618), // Golden Pocket Top
            level0_65: anchorHigh - (diff * 0.65),   // Golden Pocket Bottom
            level0_786: anchorHigh - (diff * 0.786),
            level0_886: anchorHigh - (diff * 0.886), // Deep
            level1: anchorLow, // Bottom (100%)
            tp1: anchorHigh + (diff * 0.272),
            tp2: anchorHigh + (diff * 0.618),
            tp3: anchorHigh + (diff * 1.0),
            tp4: anchorHigh + (diff * 1.618),
            tp5: anchorHigh + (diff * 2.618)
        };
    } else {
        // Retracement calc (Upwards from Low)
        return {
            trend: 'DOWN' as const,
            level0: anchorLow, // Bottom (0%)
            level0_236: anchorLow + (diff * 0.236),
            level0_382: anchorLow + (diff * 0.382),
            level0_5: anchorLow + (diff * 0.5),
            level0_618: anchorLow + (diff * 0.618),
            level0_65: anchorLow + (diff * 0.65),
            level0_786: anchorLow + (diff * 0.786),
            level0_886: anchorLow + (diff * 0.886),
            level1: anchorHigh, // Top (100%)
            tp1: anchorLow - (diff * 0.272),
            tp2: anchorLow - (diff * 0.618),
            tp3: anchorLow - (diff * 1.0),
            tp4: anchorLow - (diff * 1.618),
            tp5: anchorLow - (diff * 2.618)
        };
    }
}

// --- NEW METRICS FOR 100% AI POTENTIAL ---

export function calculateATR(highs: number[], lows: number[], closes: number[], period: number) {
    if (highs.length < period) return 0;
    let trSum = 0;
    // Simple average for first TR (could be improved, but sufficient)
    for (let i = 1; i < period + 1; i++) {
        const hl = highs[i] - lows[i];
        const hc = Math.abs(highs[i] - closes[i - 1]);
        const lc = Math.abs(lows[i] - closes[i - 1]);
        trSum += Math.max(hl, hc, lc);
    }
    let atr = trSum / period;
    // Smoothed ATR
    for (let i = period + 1; i < highs.length; i++) {
        const hl = highs[i] - lows[i];
        const hc = Math.abs(highs[i] - closes[i - 1]);
        const lc = Math.abs(lows[i] - closes[i - 1]);
        const tr = Math.max(hl, hc, lc);
        atr = ((atr * (period - 1)) + tr) / period;
    }
    return atr;
}

// REAL ADX (Directional Movement System)
export function calculateADX(highs: number[], lows: number[], closes: number[], period: number) {
    if (highs.length < period * 2) return 20; // Not enough data, return neutral

    // 1. Calculate TR, +DM, -DM per candle
    // We use a simplified Wilder's smoothing logic to avoid massive arrays overhead in browser
    let tr = 0;
    let plusDM = 0;
    let minusDM = 0;

    // Initial accumulation (SMA)
    for (let i = 1; i <= period; i++) {
        const up = highs[i] - highs[i - 1];
        const down = lows[i - 1] - lows[i];

        const pdm = (up > down && up > 0) ? up : 0;
        const mdm = (down > up && down > 0) ? down : 0;
        const trueRange = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));

        tr += trueRange;
        plusDM += pdm;
        minusDM += mdm;
    }

    // Smooth over time
    let smTR = tr;
    let smPlusDM = plusDM;
    let smMinusDM = minusDM;
    let lastADX = 0;

    // Calculate DX series
    for (let i = period + 1; i < highs.length; i++) {
        const up = highs[i] - highs[i - 1];
        const down = lows[i - 1] - lows[i];
        const pdm = (up > down && up > 0) ? up : 0;
        const mdm = (down > up && down > 0) ? down : 0;
        const trueRange = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));

        smTR = smTR - (smTR / period) + trueRange;
        smPlusDM = smPlusDM - (smPlusDM / period) + pdm;
        smMinusDM = smMinusDM - (smMinusDM / period) + mdm;

        const pDI = (smPlusDM / smTR) * 100;
        const mDI = (smMinusDM / smTR) * 100;

        const dx = (Math.abs(pDI - mDI) / (pDI + mDI)) * 100;

        if (i === period * 2 - 1) {
            lastADX = dx; // First ADX is DX
        } else if (i >= period * 2) {
            lastADX = ((lastADX * (period - 1)) + dx) / period;
        }
    }

    return lastADX;
}

export function calculatePivotPoints(highs: number[], lows: number[], closes: number[]) {
    // Standard Pivot Points based on previous candle (High/Low/Close)
    const h = highs[highs.length - 2]; // Previous completed candle
    const l = lows[lows.length - 2];
    const c = closes[closes.length - 2];

    const p = (h + l + c) / 3;
    const r1 = (2 * p) - l;
    const s1 = (2 * p) - h;
    const r2 = p + (h - l);
    const s2 = p - (h - l);
    return { p, r1, s1, r2, s2 };
}

export function formatVolume(vol: number) { return vol >= 1e9 ? (vol / 1e9).toFixed(1) + 'B' : (vol / 1e6).toFixed(1) + 'M'; }

// Helper to get current market session (UTC)
export function getMarketSession(): { session: 'ASIA' | 'LONDON' | 'NEW_YORK' | 'OTHER', note: string } {
    const now = new Date();
    const hour = now.getUTCHours();
    if (hour >= 13 && hour < 21) return { session: 'NEW_YORK', note: "Alta Volatilidad / Reversiones" };
    if (hour >= 7 && hour < 13) return { session: 'LONDON', note: "Definición de Tendencia / Breakouts Reales" };
    if (hour >= 0 && hour < 7) return { session: 'ASIA', note: "Rango / Manipulación (Liquidity Hunts)" };
    return { session: 'OTHER', note: "Baja Liquidez / Cierre Diario" };
}
