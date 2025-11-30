import { MarketData, IchimokuCloud, IchimokuSignal } from '../types';

/**
 * Calculates full Ichimoku components with advanced historical context.
 * Note: Arrays are expected to be sorted [oldest ... newest].
 */
export const calculateIchimokuData = (
    highs: number[],
    lows: number[],
    closes: number[]
): IchimokuCloud | null => {
    if (highs.length < 52) return null;

    const currentIdx = highs.length - 1;

    // 1. Tenkan-sen (9)
    const tenkanHigh = Math.max(...highs.slice(currentIdx - 8, currentIdx + 1));
    const tenkanLow = Math.min(...lows.slice(currentIdx - 8, currentIdx + 1));
    const tenkan = (tenkanHigh + tenkanLow) / 2;

    // 2. Kijun-sen (26)
    const kijunHigh = Math.max(...highs.slice(currentIdx - 25, currentIdx + 1));
    const kijunLow = Math.min(...lows.slice(currentIdx - 25, currentIdx + 1));
    const kijun = (kijunHigh + kijunLow) / 2;

    // 3. Current Cloud (Calculated 26 periods ago)
    const pastIdx = currentIdx - 26;
    if (pastIdx < 52) return null; // Need enough history for Senkou B at pastIdx

    const pastTenkan = (Math.max(...highs.slice(pastIdx - 8, pastIdx + 1)) + Math.min(...lows.slice(pastIdx - 8, pastIdx + 1))) / 2;
    const pastKijun = (Math.max(...highs.slice(pastIdx - 25, pastIdx + 1)) + Math.min(...lows.slice(pastIdx - 25, pastIdx + 1))) / 2;
    const senkouA = (pastTenkan + pastKijun) / 2;

    const past52High = Math.max(...highs.slice(pastIdx - 51, pastIdx + 1));
    const past52Low = Math.min(...lows.slice(pastIdx - 51, pastIdx + 1));
    const senkouB = (past52High + past52Low) / 2;

    // 4. Future Cloud (Projected 26 periods ahead from NOW)
    // We use CURRENT Tenkan/Kijun/52-High-Low to project A and B for t+26
    const futureSenkouA = (tenkan + kijun) / 2;
    const current52High = Math.max(...highs.slice(currentIdx - 51, currentIdx + 1));
    const current52Low = Math.min(...lows.slice(currentIdx - 51, currentIdx + 1));
    const futureSenkouB = (current52High + current52Low) / 2;
    const futureCloud = futureSenkouA > futureSenkouB ? 'BULLISH' : 'BEARISH';

    // 5. Chikou Span Validation (The most complex part)
    // Chikou is Current Close plotted 26 periods BACK.
    // We need to check if that point (Time: t-26, Price: Close[t]) is "free".
    // "Free" means it is NOT inside the candle body at t-26 AND NOT inside the cloud at t-26.

    // The candle at t-26
    const chikouTimeIdx = currentIdx - 26;
    const targetCandleHigh = highs[chikouTimeIdx];
    const targetCandleLow = lows[chikouTimeIdx];
    const currentClose = closes[currentIdx]; // This is the Chikou Value

    // The Cloud at t-26 (Calculated at t-52)
    const cloudTimeIdx = chikouTimeIdx - 26; // t-52
    let chikouCloudTop = 0;
    let chikouCloudBottom = 0;

    if (cloudTimeIdx >= 0) {
        // Calculate Cloud for the Chikou moment
        const cTenkan = (Math.max(...highs.slice(cloudTimeIdx - 8, cloudTimeIdx + 1)) + Math.min(...lows.slice(cloudTimeIdx - 8, cloudTimeIdx + 1))) / 2;
        const cKijun = (Math.max(...highs.slice(cloudTimeIdx - 25, cloudTimeIdx + 1)) + Math.min(...lows.slice(cloudTimeIdx - 25, cloudTimeIdx + 1))) / 2;
        const cSenkouA = (cTenkan + cKijun) / 2;

        const c52High = Math.max(...highs.slice(cloudTimeIdx - 51, cloudTimeIdx + 1));
        const c52Low = Math.min(...lows.slice(cloudTimeIdx - 51, cloudTimeIdx + 1));
        const cSenkouB = (c52High + c52Low) / 2;

        chikouCloudTop = Math.max(cSenkouA, cSenkouB);
        chikouCloudBottom = Math.min(cSenkouA, cSenkouB);
    }

    // Check Obstacles & Direction
    let chikouFree = true;
    let chikouDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

    // Obstacle 1: Price Action at t-26
    const isTangledInPrice = currentClose <= targetCandleHigh && currentClose >= targetCandleLow;
    const isTangledInCloud = currentClose <= chikouCloudTop && currentClose >= chikouCloudBottom;

    if (isTangledInPrice || isTangledInCloud) {
        chikouFree = false;
    }

    // Directional Check (Expert Mode)
    // For BULLISH: Chikou must be ABOVE the High of t-26
    if (currentClose > targetCandleHigh) {
        chikouDirection = 'BULLISH';
    }
    // For BEARISH: Chikou must be BELOW the Low of t-26
    else if (currentClose < targetCandleLow) {
        chikouDirection = 'BEARISH';
    }

    // Cloud Thickness (Volatility Proxy)
    const cloudThickness = Math.abs(senkouA - senkouB) / ((senkouA + senkouB) / 2);

    // TK Separation (C-Clamp)
    const tkSeparation = Math.abs(tenkan - kijun) / kijun;

    return {
        tenkan,
        kijun,
        senkouA,
        senkouB,
        chikou: currentClose,
        currentPrice: currentClose,
        chikouSpanFree: chikouFree,
        chikouDirection,
        futureCloud,
        cloudThickness,
        priceVsKijun: (currentClose - kijun) / kijun,
        tkSeparation
    };
};
export const analyzeIchimokuSignal = (data: IchimokuCloud): IchimokuSignal => {
    const { tenkan, kijun, senkouA, senkouB, chikou, currentPrice, chikouSpanFree, chikouDirection, futureCloud, cloudThickness, priceVsKijun, tkSeparation } = data;

    // 1. Determine Cloud Status (Current)
    const cloudTop = Math.max(senkouA, senkouB);
    const cloudBottom = Math.min(senkouA, senkouB);

    let cloudStatus: 'ABOVE' | 'BELOW' | 'INSIDE' = 'INSIDE';
    if (currentPrice > cloudTop) cloudStatus = 'ABOVE';
    if (currentPrice < cloudBottom) cloudStatus = 'BELOW';

    // 2. TK Cross Analysis (Dynamic Threshold)
    let tkCross: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    const tkDiff = tenkan - kijun;
    const threshold = currentPrice * 0.0002; // 0.02% separation required

    if (tkDiff > threshold) tkCross = 'BULLISH';
    if (tkDiff < -threshold) tkCross = 'BEARISH';

    // 3. Chikou Span Validation (Directional)
    let chikouStatus: 'VALID' | 'INVALID' = 'INVALID';

    // 4. Scoring Logic
    let score = 0;
    let side: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
    let strength: 'STRONG' | 'NEUTRAL' | 'WEAK' = 'NEUTRAL';
    let reason = "Mercado en rango o consolidación.";
    let trigger = "Esperando configuración clara.";
    let stopLoss = kijun; // Default SL is Kijun

    // --- BULLISH SCENARIO ---
    if (tkCross === 'BULLISH') {
        // Evaluate Strength based on Cloud Position
        if (cloudStatus === 'ABOVE') strength = 'STRONG'; // San Yaku Kouten (Three Role Reversal)
        else if (cloudStatus === 'INSIDE') strength = 'NEUTRAL';
        else strength = 'WEAK'; // Below cloud (Counter-trend)

        // Check Chikou for LONG
        // Must be BULLISH (Above past price) AND Free
        if (chikouDirection === 'BULLISH' && chikouSpanFree) {
            chikouStatus = 'VALID';
        }

        // Kumo Twist (Future Cloud) Support
        const futureSupport = futureCloud === 'BULLISH';

        // Base Score
        score = 60;
        if (strength === 'STRONG') score += 20;
        if (strength === 'NEUTRAL') score += 10;

        if (chikouStatus === 'VALID') score += 15;
        if (futureSupport) score += 5;
        if (cloudThickness > 0.005) score += 5; // Thick cloud support is good

        // C-Clamp Check (Over-extension)
        if (tkSeparation > 0.02) { // > 2% separation is huge
            score -= 10;
            reason += " [C-Clamp Warning: Posible reversión a la media]";
        }

        if (score >= 75) {
            side = 'LONG';
            reason = `Ichimoku LONG (${strength}): Cruce TK ${strength === 'STRONG' ? 'sobre' : 'en/bajo'} Nube.`;
            if (chikouStatus === 'VALID') reason += " Chikou confirma.";
            trigger = "TK Cross Bullish";

            // Dynamic Stop Loss
            // For Long: SL below Kijun or Senkou B (whichever is closer support)
            // But usually, Kijun is the trailing stop.
            // If Strong (Above Cloud), Senkou B is also support.
            stopLoss = Math.min(kijun, cloudTop);
        }
    }

    // --- BEARISH SCENARIO ---
    else if (tkCross === 'BEARISH') {
        // Evaluate Strength
        if (cloudStatus === 'BELOW') strength = 'STRONG';
        else if (cloudStatus === 'INSIDE') strength = 'NEUTRAL';
        else strength = 'WEAK'; // Above cloud

        if (chikouDirection === 'BEARISH' && chikouSpanFree) {
            chikouStatus = 'VALID';
        }

        const futureResist = futureCloud === 'BEARISH';

        score = 60;
        if (strength === 'STRONG') score += 20;
        if (strength === 'NEUTRAL') score += 10;

        if (chikouStatus === 'VALID') score += 15;
        if (futureResist) score += 5;
        if (cloudThickness > 0.005) score += 5;

        // C-Clamp Check
        if (tkSeparation > 0.02) {
            score -= 10;
            reason += " [C-Clamp Warning: Posible reversión a la media]";
        }

        if (score >= 75) {
            side = 'SHORT';
            reason = `Ichimoku SHORT (${strength}): Cruce TK ${strength === 'STRONG' ? 'bajo' : 'en/sobre'} Nube.`;
            if (chikouStatus === 'VALID') reason += " Chikou confirma.";
            trigger = "TK Cross Bearish";

            // Dynamic Stop Loss
            // For Short: SL above Kijun or Senkou B
            stopLoss = Math.max(kijun, cloudBottom);
        }
    }

    // --- Kumo Breakout (Early Signal) ---
    else if (cloudStatus === 'ABOVE' && currentPrice > cloudTop * 1.001 && tenkan > kijun) {
        score = 70;
        side = 'LONG';
        strength = 'NEUTRAL'; // Breakouts are good but risky if TK is far
        reason = "Kumo Breakout: El precio ha roto la nube con fuerza.";
        trigger = "Price Breakout > Kumo Cloud";
        stopLoss = cloudTop; // Support is now the cloud top
    }
    else if (cloudStatus === 'BELOW' && currentPrice < cloudBottom * 0.999 && tenkan < kijun) {
        score = 70;
        side = 'SHORT';
        strength = 'NEUTRAL';
        reason = "Kumo Breakdown: El precio ha caído bajo la nube.";
        trigger = "Price Breakdown < Kumo Cloud";
        stopLoss = cloudBottom;
    }

    return {
        score,
        side,
        strength,
        reason,
        trigger,
        stopLoss,
        metrics: {
            tkCross,
            cloudStatus,
            chikouStatus,
            futureCloud,
            cloudThickness: (cloudThickness * 100).toFixed(2) + '%'
        }
    };
};
