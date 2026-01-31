
import { TechnicalIndicators } from '../../types';
import { TradingConfig } from '../../config/tradingConfig';
// import { getCurrentSessionSimple } from '../sessionExpert'; // Might need to check path or mock
// Backend often has different paths. Let's assume sessionExpert is available or inline the logic
// to avoid path hell. "London/New York" logic is simple time check.

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
    };
}

// Minimal helpers if imports fail
function calculateATR_Internal(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (highs.length < period + 1) return 0;

    // Simple Rolling ATR for robustness
    // Or just use the one from indicators if passed correctly, but often pure calc is safer here
    // But since indicators has "atr", let's trust it for now to keep code simple.
    // Wait, the logic uses calculateATR from 'mathUtils'. 
    // I should probably import it or reimplement simple version here.
    // Let's reimplement simple ATR just for the risk calc to be self-contained in backend.

    let sumTR = 0;
    for (let i = highs.length - period; i < highs.length; i++) {
        const tr1 = highs[i] - lows[i];
        const tr2 = Math.abs(highs[i] - closes[i - 1]);
        const tr3 = Math.abs(lows[i] - closes[i - 1]);
        sumTR += Math.max(tr1, tr2, tr3);
    }
    return sumTR / period;
}

function calculateRSIArray_Internal(data: number[], period: number): number[] {
    if (data.length < period + 1) return new Array(data.length).fill(50);
    // Standard Wilder's RSI Loop
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


/**
 * PAU PERDICES STRATEGY (GOLD MASTER) - BACKEND EDITION
 */
export function analyzePauPerdicesStrategy(
    symbol: string,
    currentPrice: number,
    prices: number[],
    highs: number[],
    lows: number[],
    indicators: TechnicalIndicators,
    accountBalance: number = 1000
): PauStrategyResult {

    const config = TradingConfig.pauStrategy;
    const reasons: string[] = [];
    let score = 0;

    // --- 1. ASSET FILTER ---
    const isGold = symbol.includes('XAU') || symbol.includes('GOLD') || symbol.includes('PAXG') || symbol.includes('XAG') || symbol.includes('SILVER');
    if (!isGold) {
        return createNeutralResult("Non-Precious Metal Asset", { isGold: false });
    }
    score += 10;

    // --- 2. SESSION FILTER (Simplified Locale Agnostic) ---
    // UTC Hours: London Open ~7-8 UTC. NY Close ~21 UTC.
    // Config: london_open=8, ny_close=17 (Local time usually? Let's assume config is correct hour ref)
    // Actually config says 8 and 17. 
    // Let's check current Hour.
    const hour = new Date().getUTCHours();
    // Approximation: Active from 8 UTC to 21 UTC covers both sessions well.
    const isActiveSession = (hour >= 7 && hour <= 21);

    if (isActiveSession) {
        score += 10;
        reasons.push(`✅ Session Active (UTC ${hour})`);
    } else {
        reasons.push(`⚠️ Low Volatility Session (UTC ${hour})`);
    }

    // --- 3. TREND FILTER ---
    const ema200 = indicators.ema200;
    const isUptrend = currentPrice > ema200;

    if (!isUptrend) {
        return createNeutralResult("Price below EMA200 (Downtrend)", { isGold, sessionValid: isActiveSession, trendValid: false });
    }
    score += 20;
    reasons.push("✅ Bullish Trend (> EMA200)");

    // --- 4. RSI STRUCTURE ---
    const rsiArray = calculateRSIArray_Internal(prices, 14);
    const recentRSI = rsiArray.slice(-10);
    const minRecentRSI = Math.min(...recentRSI);

    if (minRecentRSI < config.rsi.bull_support) {
        return createNeutralResult(`❌ RSI Broken Support (${config.rsi.bull_support})`, { isGold, sessionValid: isActiveSession, trendValid: true, rsiValid: false });
    }
    score += 15;
    reasons.push(`✅ RSI Structure Intact (> ${config.rsi.bull_support})`);

    // --- 5. GOLDEN ZONE (FIB) ---
    const fibs = indicators.fibonacci;
    let inGoldenZone = false;
    const fib382 = fibs.level0_382;
    const fib500 = fibs.level0_5;

    if (fib382 && fib500) {
        const zoneTop = fib382 * 1.002;
        const zoneBottom = fib500 * 0.998;
        if (currentPrice <= zoneTop && currentPrice >= zoneBottom) {
            inGoldenZone = true;
            score += 25;
            reasons.push("✅ In Golden Zone (Fib 38-50%)");
        }
    }

    // --- 6. HIDDEN DIVERGENCE ---
    const div = indicators.rsiDivergence;
    let hasHiddenBullDiv = false;
    if (div && (div.type === 'HIDDEN_BULLISH')) {
        hasHiddenBullDiv = true;
        score += 30;
        reasons.push("🚀 Hidden Bullish Divergence Detected");
    }

    // --- DECISION ---
    const triggerValid = inGoldenZone || hasHiddenBullDiv;

    if (score >= 80 && triggerValid) {
        // --- RISK (ATR) ---
        const atr = calculateATR_Internal(highs, lows, prices, 14);
        const slDist = atr * config.risk.sl_atr_multiplier; // uses local or passed ATR check? using local calc
        // wait, we have `indicators.atr` usually.
        // let's use indicators.atr if valid > 0, else local
        const finalATR = (indicators.atr && indicators.atr > 0) ? indicators.atr : atr;
        const slDistFinal = finalATR * config.risk.sl_atr_multiplier;

        const stopLoss = currentPrice - slDistFinal;
        const riskAmount = currentPrice - stopLoss;

        const tp1 = fibs.level0 || (currentPrice + slDistFinal * 2);
        const tp2 = currentPrice + (riskAmount * 3);
        const tp3 = currentPrice + (riskAmount * 5);

        const riskCapital = accountBalance * config.risk.risk_per_trade;
        const riskPerShare = currentPrice - stopLoss;
        const recommendedLotSize = riskCapital / (riskPerShare || 1);

        return {
            signal: 'LONG',
            score,
            reason: reasons,
            risk: {
                stopLoss,
                takeProfit1: tp1,
                takeProfit2: tp2,
                takeProfit3: tp3,
                riskPerShare,
                recommendedLotSize
            },
            metadata: {
                isGold: true,
                sessionValid: isActiveSession,
                trendValid: true,
                rsiValid: true,
                divergenceDetected: hasHiddenBullDiv
            }
        };
    }

    return createNeutralResult("Conditions not fully met", { isGold, sessionValid: isActiveSession, trendValid: true, rsiValid: true, divergenceDetected: hasHiddenBullDiv });
}

function createNeutralResult(reason: string, metadata: any): PauStrategyResult {
    return {
        signal: 'NEUTRAL',
        score: 0,
        reason: [reason],
        risk: { stopLoss: 0, takeProfit1: 0, takeProfit2: 0, takeProfit3: 0, riskPerShare: 0, recommendedLotSize: 0 },
        metadata: { ...metadata }
    };
}
