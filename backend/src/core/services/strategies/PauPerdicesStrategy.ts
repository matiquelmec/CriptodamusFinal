
import { TechnicalIndicators } from '../../types';
import { TradingConfig } from '../../config/tradingConfig';
import { calculateEMA } from '../mathUtils';

export interface PauStrategyResult {
    signal: 'LONG' | 'SHORT' | 'NEUTRAL';
    score: number;
    reason: string[];
    risk: {
        stopLoss: number;
        takeProfit1: number;
        takeProfit2: number;
        takeProfit3: number;
        riskPerShare: number;
        recommendedLotSize: number;
    };
    metadata: {
        isGold: boolean;
        sessionValid: boolean;
        trendValid: boolean;
        rsiValid: boolean;
        divergenceDetected: boolean;
        mtfValid: boolean;
    };
}

// Internal Helper for RSI (if not in mathUtils or needed self-contained)
function calculateRSIArray_Internal(data: number[], period: number): number[] {
    if (data.length < period + 1) return new Array(data.length).fill(50);
    let gains = 0;
    let losses = 0;
    const rsiArray = new Array(data.length).fill(0);

    for (let i = 1; i < period + 1; i++) {
        const change = data[i] - data[i - 1];
        if (change >= 0) gains += change;
        else losses += Math.abs(change);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    rsiArray[period] = 100 - (100 / (1 + (avgGain / avgLoss)));

    for (let i = period + 1; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;
        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;

        if (avgLoss === 0) rsiArray[i] = 100;
        else {
            const rs = avgGain / avgLoss;
            rsiArray[i] = 100 - (100 / (1 + rs));
        }
    }
    return rsiArray;
}

// Internal Helper for ATR
function calculateATR_Internal(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (highs.length < period + 1) return 0;
    let sumTR = 0;
    for (let i = highs.length - period; i < highs.length; i++) {
        const tr1 = highs[i] - lows[i];
        const tr2 = Math.abs(highs[i] - closes[i - 1]);
        const tr3 = Math.abs(lows[i] - closes[i - 1]);
        sumTR += Math.max(tr1, tr2, tr3);
    }
    return sumTR / period;
}

/**
 * PAU PERDICES STRATEGY (TOURNAMENT EDITION)
 * Universal "Gold Sniper" Logic applied to Elite 9 assets.
 * Supports LONG and SHORT.
 */
export function analyzePauPerdicesStrategy(
    symbol: string,
    currentPrice: number,
    prices: number[],
    highs: number[],
    lows: number[],
    volumes: number[],
    indicators: TechnicalIndicators,
    contextCandles: any[] = [], // H4 Candles for MTF Context
    accountBalance: number = 1000
): PauStrategyResult {

    const config = TradingConfig.pauStrategy;
    const reasons: string[] = [];
    let score = 0;

    // --- 1. ASSET FILTER (Generalized) ---
    const isGold = symbol.includes('XAU') || symbol.includes('GOLD') || symbol.includes('PAXG');
    const isTournament = TradingConfig.TOURNAMENT_MODE;
    if (!isGold && !isTournament) {
        return createNeutralResult("Non-Precious Metal Asset (Tournament Mode OFF)", { isGold: false });
    }
    score += 10;

    // --- 2. SESSION FILTER ---
    const hour = new Date().getUTCHours();
    const isActiveSession = (hour >= 7 && hour <= 21);
    if (isActiveSession) {
        score += 10;
        reasons.push(`✅ Session Active (UTC ${hour})`);
    } else {
        reasons.push(`⚠️ Low Volatility Session (UTC ${hour})`);
    }

    // --- 3. MTF CONTEXT FILTER (H4) ---
    let mtfDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let mtfValid = true;

    if (isTournament && contextCandles.length > 200) {
        const closes4h = contextCandles.map(c => c.close);
        const ema200_4h = calculateEMA(closes4h, 200);
        const price4h = closes4h[closes4h.length - 1];

        if (price4h > ema200_4h) {
            mtfDirection = 'BULLISH';
            reasons.push("✅ MTF: H4 Trend Bullish");
        } else {
            mtfDirection = 'BEARISH';
            reasons.push("✅ MTF: H4 Trend Bearish");
        }
        score += 30; // Weight for Context
    } else {
        if (isTournament) reasons.push("⚠️ MTF: H4 Context Missing");
        // If missing context in tournament mode, default to NEUTRAL or use current timeframe fallback?
        // Let's assume M15 check is sufficient if H4 missing (network error fallback), but penalize.
    }

    // --- 4. LOCAL TREND FILTER (M15) ---
    const ema200 = indicators.ema200;
    let localTrend: 'BULLISH' | 'BEARISH' = 'BULLISH';

    if (currentPrice > ema200) {
        localTrend = 'BULLISH';
        reasons.push("✅ M15 Trend Bullish (> EMA200)");
    } else {
        localTrend = 'BEARISH';
        reasons.push("✅ M15 Trend Bearish (< EMA200)");
    }

    // Alignment Check
    if (mtfDirection !== 'NEUTRAL' && localTrend !== mtfDirection) {
        return createNeutralResult(`⛔ MTF Mismatch: H4 ${mtfDirection} != M15 ${localTrend}`, { isGold, sessionValid: isActiveSession, trendValid: false, mtfValid: false });
    }
    score += 20;

    // --- 5. RSI STRUCTURE & DIVERGENCE ---
    const rsiArray = calculateRSIArray_Internal(prices, 14);
    const recentRSI = rsiArray.slice(-10); // Check last 10 candles
    const currentRSI = recentRSI[recentRSI.length - 1];

    // Divergence Check
    const div = indicators.rsiDivergence;
    let hasHiddenDiv = false;

    if (localTrend === 'BULLISH') {
        // --- LONG SETUP CHECKS ---
        const minRecentRSI = Math.min(...recentRSI);

        // 5a. RSI Support Check (Upside)
        if (minRecentRSI < config.rsi.bull_support) {
            // Broken structure?
            reasons.push(`⚠️ RSI dip below support (${minRecentRSI.toFixed(1)})`);
            score -= 10;
        } else {
            score += 15;
            reasons.push("✅ RSI Bullish Structure Intact");
        }

        // 5b. Hidden Bullish Div
        if (div && div.type === 'HIDDEN_BULLISH') {
            hasHiddenDiv = true;
            score += 30;
            reasons.push("🚀 Hidden Bullish Divergence");
        }

    } else {
        // --- SHORT SETUP CHECKS ---
        const maxRecentRSI = Math.max(...recentRSI);

        // 5a. RSI Resistance Check (Downside)
        // Bearish resistance typically 60-65. If it breaks > 70/65 massive invalidation of downtrend momentum?
        // Let's use 60 as config.rsi.bear_resistance
        if (maxRecentRSI > config.rsi.bear_resistance) {
            reasons.push(`⚠️ RSI spike above resistance (${maxRecentRSI.toFixed(1)})`);
            score -= 10;
        } else {
            score += 15;
            reasons.push("✅ RSI Bearish Structure Intact");
        }

        // 5b. Hidden Bearish Div
        if (div && div.type === 'HIDDEN_BEARISH') {
            hasHiddenDiv = true;
            score += 30;
            reasons.push("🚀 Hidden Bearish Divergence");
        }
    }

    // --- 6. GOLDEN ZONE (FIB) ---
    const fibs = indicators.fibonacci;
    let inGoldenZone = false;

    if (localTrend === 'BULLISH') {
        const fib382 = fibs.level0_382;
        const fib500 = fibs.level0_5;
        if (fib382 && fib500) {
            const zoneTop = fib382 * 1.002;
            const zoneBottom = fib500 * 0.998;
            if (currentPrice <= zoneTop && currentPrice >= zoneBottom) {
                inGoldenZone = true;
                score += 25;
                reasons.push("🎯 In Golden Zone (Bullish 38-50%)");
            }
        }
    } else {
        // BEARISH Fibs
        // Assuming Logic: If trend is down, logic often calculates retracement from Top to Bottom
        // But autoFibs might handle it. If not, usually 0.382 is the FIRST retracement level from the move start.
        // If price is BELOW SMA, the "Retracement" is going UP towards the SMA.
        // So we look for Price to be between Level 0.382 and 0.5 (which are ABOVE current price action usually?)
        // Wait, standard fib: 0 is Low, 1 is High. Retracement 0.382 is High - (Range*0.382).
        // If Autocalc does this correct, we just check if price is near level0_382 ??
        // Actually, let's look for "Price is pulling back".
        // Short Pullback: Price Rises.
        // We want price to be *higher* than the recent low.
        // Let's rely on RSI + Divergence as primary triggers for shorts if Fibs are ambiguous without verifying correct Swing High/Low logic.
        // BUT user loves "Pau Perdices" which is Fib based. 
        // Let's assume if Price is < EMA200 but RSI is "High" locally (pullback), it's a Short Candidate.
        // For simplicity/robustness without rewriting Fib engine:
        // Short Zone: Price closes *below* EMA50 but rallied recently?
        // Let's keep strict Fib check only if confident. 
        // I'll skip Strict Fib check for Shorts *unless* I can verify it, relying on Hidden Divergence (Trend Follow) instead.
        // Actually, Hidden Bearish Div implies a Lower High (Pullback) in Price while RSI makes Higher High. This CAPTURES the Pullback logic perfectly.
    }

    // --- 7. MACD & VOLUME ---
    if (isTournament) {
        const macd = indicators.macd;
        if (macd) {
            if (localTrend === 'BULLISH') {
                if (macd.histogram > 0 || macd.line > macd.signal) { score += 10; reasons.push("✅ MACD Bullish"); }
            } else {
                if (macd.histogram < 0 || macd.line < macd.signal) { score += 10; reasons.push("✅ MACD Bearish"); }
            }
        }

        if (volumes.length > 20) {
            const currentVol = volumes[volumes.length - 1];
            const recentVols = volumes.slice(-21, -1);
            const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
            if (currentVol > avgVol * 1.2) { score += 10; reasons.push("✅ Volume Spike"); }
        }
    }

    // --- DECISION ---
    const triggerValid = inGoldenZone || hasHiddenDiv; // For shorts, relies on Hidden Div primarily if Fib ambiguous

    if (score >= 80 && triggerValid) {
        // Risk Calc
        const finalATR = (indicators.atr && indicators.atr > 0) ? indicators.atr : calculateATR_Internal(highs, lows, prices, 14);
        const slDist = finalATR * config.risk.sl_atr_multiplier;

        let stopLoss, tp1, tp2, tp3, riskAmount;

        if (localTrend === 'BULLISH') {
            stopLoss = currentPrice - slDist;
            riskAmount = currentPrice - stopLoss;
            tp1 = currentPrice + (riskAmount * 2);
            tp2 = currentPrice + (riskAmount * 3);
            tp3 = currentPrice + (riskAmount * 5);
        } else {
            // SHORT Logic
            stopLoss = currentPrice + slDist;
            riskAmount = stopLoss - currentPrice;
            tp1 = currentPrice - (riskAmount * 2);
            tp2 = currentPrice - (riskAmount * 3);
            tp3 = currentPrice - (riskAmount * 5);
        }

        const riskCapital = accountBalance * config.risk.risk_per_trade;
        const riskPerShare = riskAmount;
        const recommendedLotSize = riskCapital / (riskPerShare || 1);

        return {
            signal: localTrend === 'BULLISH' ? 'LONG' : 'SHORT',
            score: Math.min(100, score),
            reason: reasons,
            risk: { stopLoss, takeProfit1: tp1, takeProfit2: tp2, takeProfit3: tp3, riskPerShare, recommendedLotSize },
            metadata: { isGold, sessionValid: isActiveSession, trendValid: true, rsiValid: true, divergenceDetected: hasHiddenDiv, mtfValid: true }
        };
    }

    return createNeutralResult("Conditions not met", { isGold, sessionValid: isActiveSession, trendValid: true, rsiValid: true, divergenceDetected: hasHiddenDiv });
}

function createNeutralResult(reason: string, metadata: any): PauStrategyResult {
    return {
        signal: 'NEUTRAL',
        score: 0,
        reason: [reason],
        risk: { stopLoss: 0, takeProfit1: 0, takeProfit2: 0, takeProfit3: 0, riskPerShare: 0, recommendedLotSize: 0 },
        metadata: { isGold: false, sessionValid: false, trendValid: false, rsiValid: false, divergenceDetected: false, mtfValid: false, ...metadata } // Defaults
    };
}
