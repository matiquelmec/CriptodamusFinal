
import { TechnicalIndicators } from '../../types';
import { TradingConfig } from '../../config/tradingConfig';
import { getCurrentSessionSimple } from '../sessionExpert';
import { calculateATR, calculateRSIArray } from '../mathUtils';

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
        recommendedLotSize: number; // Placeholder for lot calc
    };
    metadata: {
        isGold: boolean;
        sessionValid: boolean;
        trendValid: boolean;
        rsiValid: boolean;
        divergenceDetected: boolean;
    };
}

/**
 * PAU PERDICES STRATEGY (GOLD MASTER)
 * 
 * "The Sniper Approach"
 * 1. Asset: XAU/USDT Only.
 * 2. Trend: Price > 200 EMA.
 * 3. Session: London or New York (Active Flow).
 * 4. RSI Logic: Constance Brown Range (Must hold 40 in uptrend).
 * 5. Setup: Retracement to Fib 0.382 - 0.50 (Golden Zone).
 * 6. Trigger: Hidden Bullish Divergence.
 */
export function analyzePauPerdicesStrategy(
    symbol: string,
    currentPrice: number,
    prices: number[], // Close prices
    highs: number[],
    lows: number[],
    indicators: TechnicalIndicators,
    accountBalance: number = 1000 // Default for risk calc if unknown
): PauStrategyResult {

    const config = TradingConfig.pauStrategy;
    const reasons: string[] = [];
    let score = 0;

    // --- 1. ASSET FILTER ---
    // Strict Match or "Gold" pattern
    const isGold = symbol.includes('XAU') || symbol.includes('GOLD') || symbol.includes('PAXG');
    if (!isGold) {
        return createNeutralResult("Non-Gold Asset", { isGold: false });
    }
    score += 10;

    // --- 2. SESSION FILTER (RITMO CIRCADIANO) ---
    const sessionInfo = getCurrentSessionSimple();
    const isActiveSession = ['LONDON', 'NEW_YORK'].includes(sessionInfo.session);

    // Check Config Hours (Manual fallback if sessionExpert purely relies on system time)
    // Here we trust sessionExpert which is already robust.
    if (isActiveSession) {
        score += 10;
        reasons.push(`✅ Session Active: ${sessionInfo.session}`);
    } else {
        reasons.push(`⚠️ Low Volatility Session: ${sessionInfo.session}`);
        // We don't abort, but we don't add points. Sniper waits.
    }

    // --- 3. TREND FILTER (INSTITUTIONAL INERTIA) ---
    const ema200 = indicators.ema200;
    const isUptrend = currentPrice > ema200;

    if (!isUptrend) {
        // Pau focuses on Trend Following. If under EMA200, only look for Shorts (or abort if strategy is Buy Only)
        // For this specific logic (Fib Retracement Buy), we need Uptrend.
        return createNeutralResult("Price below EMA200 (Downtrend)", { isGold, sessionValid: isActiveSession, trendValid: false });
    }
    score += 20;
    reasons.push("✅ Bullish Trend (> EMA200)");


    // --- 4. RSI STRUCTURE (CONSTANCE BROWN) ---
    // Recalculate RSI array since TechnicalIndicators only provides snapshot
    const rsiArray = calculateRSIArray(prices, 14);

    // Rule: In Bull Trend, RSI should NOT break 40.
    // We check the recent Swing Low of the RSI to ensure it held 40.
    // Let's check last 10 periods.
    const recentRSI = rsiArray.slice(-10);
    const minRecentRSI = Math.min(...recentRSI);

    if (minRecentRSI < config.rsi.bull_support) {
        // INVALIDATION: Structure Broken.
        return createNeutralResult(`❌ RSI Broken Support (${config.rsi.bull_support})`, { isGold, sessionValid: isActiveSession, trendValid: true, rsiValid: false });
    }
    score += 15;
    reasons.push(`✅ RSI Structure Intact (> ${config.rsi.bull_support})`);


    // --- 5. SETUP: FIBONACCI RETRACEMENT (GOLDEN ZONE) ---
    // We need to know if we are IN a retracement.
    // Simplified: Price is below recent high, but above Swing Low.
    const fibs = indicators.fibonacci;
    let inGoldenZone = false;

    // Check existing AutoFibs. 
    // If Uptrend, we look for price bouncing off 0.382 or 0.5 level.
    // Use properties directly
    const fib382 = fibs.level0_382;
    const fib500 = fibs.level0_5;

    if (fib382 && fib500) {
        // Check if price is near these levels (within 0.2% tolerance?)
        // Or better: If low of recent candles touched this zone.
        const zoneTop = fib382 * 1.002;
        const zoneBottom = fib500 * 0.998;

        if (currentPrice <= zoneTop && currentPrice >= zoneBottom) {
            inGoldenZone = true;
            score += 25;
            reasons.push("✅ In Golden Zone (Fib 38-50%)");
        }
    }


    // --- 6. TRIGGER: HIDDEN DIVERGENCE ---
    // We check indicators.rsiDivergence (from new types)
    const div = indicators.rsiDivergence;
    let hasHiddenBullDiv = false;

    // div is Divergence | null. type property is string enum.
    if (div && (div.type === 'HIDDEN_BULLISH')) {
        hasHiddenBullDiv = true;
        // Check if fresh (last 2-3 candles) - Detector usually gives recent.
        score += 30;
        reasons.push("🚀 Hidden Bullish Divergence Detected");
    }

    // --- FINAL DECISION ---
    // We need High Score AND specific triggers
    const triggerValid = inGoldenZone || hasHiddenBullDiv; // Ideally BOTH, but Divergence implies a reaction.

    // Strongest Signal: Trend + Session + RSI Structure + (Zone OR Divergence)
    if (score >= 80 && triggerValid) {

        // --- RISK CALCULATION (ATR) ---
        const atr = calculateATR(highs, lows, prices, 14); // Current ATR
        const slDist = atr * config.risk.sl_atr_multiplier;
        const stopLoss = currentPrice - slDist;

        // Targets (Fib Extensions relative to Swing)
        // Simplified: TP1 = Recent High. TP2 = Extension.
        // We can approximate extensions using the Risk distance if Fib levels aren't granular.
        // We use level0 (High) as TP1.
        const fib0 = fibs.level0;

        const riskAmount = currentPrice - stopLoss;
        const tp1 = fib0 || (currentPrice + slDist * 2);
        const tp2 = currentPrice + (riskAmount * 3); // 1:3 R:R (Home run)
        const tp3 = currentPrice + (riskAmount * 5); // Moonbag

        // Position Sizing
        const riskCapital = accountBalance * config.risk.risk_per_trade; // $10 for $1000 acc
        // Risk per share = currentPrice - stopLoss
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
