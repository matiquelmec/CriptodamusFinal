import { MarketRisk, FundamentalTier } from '../../types';
import { fetchCandles, fetchCryptoData } from '../api/binanceApi';
import { TradingConfig } from '../../config/tradingConfig'; // Import from new API module

// NEW: FUNDAMENTAL TIER CALCULATOR
// Approximates tier based on Symbol (Hardcoded Elite) or Volume/Memes
export const calculateFundamentalTier = (symbol: string, isMeme: boolean): FundamentalTier => {
    // Tiers from Config
    const { s_tier, a_tier_bluechips, c_tier_patterns } = TradingConfig.assets.tiers;

    // S TIER: The Kings
    if ((s_tier as unknown as string[]).includes(symbol)) return 'S';

    // C TIER: Memes & Low Cap Speculation
    if (isMeme) return 'C';
    if ((c_tier_patterns as unknown as string[]).some(p => symbol.includes(p))) return 'C';

    // A TIER: Established Blue Chips
    if ((a_tier_bluechips as unknown as string[]).includes(symbol)) return 'A';

    // B TIER: The rest
    return 'B';
};

// NEW: Market Risk Detector (Volatility & Manipulation Proxy)
export const getMarketRisk = async (): Promise<MarketRisk> => {
    try {
        // Use BTCUSDT as proxy for general market volatility AND volume manipulation
        const candles = await fetchCandles('BTCUSDT', '1h');
        if (candles.length < 24) return { level: 'LOW', note: 'Normal', riskType: 'NORMAL' };

        const currentCandle = candles[candles.length - 1]; // Latest open candle
        const prevCandles = candles.slice(candles.length - 25, candles.length - 1);

        // 1. VOLATILITY CHECK
        const ranges = prevCandles.map(c => (c.high - c.low) / c.open);
        const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
        const currentRange = (currentCandle.high - currentCandle.low) / currentCandle.open;

        // 2. MANIPULATION CHECK (Volume Anomaly)
        const volumes = prevCandles.map(c => c.volume);
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const currentVolume = currentCandle.volume;
        const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;

        // --- RISK LOGIC ---

        // Case A: Whale Manipulation (Massive Volume + Potential Churn)
        // If volume is > Config Threshold (3.5x), someone is aggressively entering/exiting BTC
        if (volumeRatio > TradingConfig.risk.whale_volume_ratio) {
            return {
                level: 'HIGH',
                note: `🐋 BALLENAS DETECTADAS: Volumen BTC anormal (x${volumeRatio.toFixed(1)}). Posible manipulación.`,
                riskType: 'MANIPULATION'
            };
        }

        // Case B: High Volatility (News Impact)
        // If volatility is 3x avg or > 2.5% absolute in 1h
        if (currentRange > avgRange * 3 || currentRange > 0.025) {
            return {
                level: 'HIGH',
                note: '🚨 NOTICIAS/VOLATILIDAD: BTC moviéndose agresivamente. Mercado inestable.',
                riskType: 'VOLATILITY'
            };
        }

        // Case C: Medium Caution
        if (currentRange > avgRange * 1.8) {
            return { level: 'MEDIUM', note: '⚠️ Volatilidad superior al promedio.', riskType: 'VOLATILITY' };
        }

        if (volumeRatio > 2.0) {
            return { level: 'MEDIUM', note: '⚠️ Volumen BTC elevado. Precaución.', riskType: 'MANIPULATION' };
        }

        return { level: 'LOW', note: 'Condiciones estables.', riskType: 'NORMAL' };
    } catch (e) {
        return { level: 'LOW', note: 'Riesgo desconocido', riskType: 'NORMAL' };
    }
};

/**
 * KELLY CRITERION (Half-Kelly for Capital Preservation)
 * Formula: f* = (p*b - q) / b
 * p = Probability of win (Win Rate)
 * b = Odds (Risk/Reward)
 */
export const calculateKellySize = (winRate: number = 0.55, rr: number = 2.0): number => {
    const q = 1 - winRate;
    const b = rr;

    // Standard Kelly
    const kelly = (winRate * b - q) / b;

    // Half-Kelly (Conservative)
    const halfKelly = kelly * 0.5;

    // Safety Thresholds: Min 0.5%, Max 5.0% of equity
    return Math.max(0.005, Math.min(0.05, halfKelly));
};

/**
 * VOLATILITY TARGETING (Dynamic Leverage)
 * Adjusts leverage based on ATR to normalize risk per volatility unit.
 */
export const getVolatilityAdjustedLeverage = (atr: number, price: number, riskPerTrade: number = 0.01): number => {
    const atrPercent = atr / price;
    if (atrPercent === 0) return 1.0;

    // If ATR is 2%, and we risk 1%, leverage is 0.5x
    // Sensitivity factor (1.5) to keep it safe
    const leverage = riskPerTrade / (atrPercent * 1.5);

    return Math.max(1.0, Math.min(20.0, leverage)); // Max 20x for safety
};

/**
 * PORTFOLIO HEATMAP (Professional Pearson Correlation)
 * Logic:
 * 1. Categorize assets by Sector/Type (Base).
 * 2. If historical price data is provided, calculate Pearson Correlation.
 * 3. Penalize or BLOCK if correlation with existing positions is too high (>0.80).
 */
export const calculatePortfolioCorrelation = async (
    newSymbol: string,
    openPositions: string[],
    isMeme: boolean,
    currentPrices?: number[] // Historical prices of the new signal asset
): Promise<{ score: number; recommendation: 'PROCEED' | 'REDUCE' | 'BLOCK' }> => {

    const tiers = TradingConfig.assets.tiers;
    const isNewS_Tier = (tiers.s_tier as unknown as string[]).includes(newSymbol);
    const isNewA_Tier = (tiers.a_tier_bluechips as unknown as string[]).includes(newSymbol);
    const isNewC_Tier = isMeme || (tiers.c_tier_patterns as unknown as string[]).some(p => newSymbol.includes(p));

    let maxCorrelation = 0;
    let overlapCount = 0;

    // 1. Sector overlap check (Base)
    openPositions.forEach(symbol => {
        if (isNewC_Tier && (tiers.c_tier_patterns as unknown as string[]).some(p => symbol.includes(p))) overlapCount++;
        if (isNewS_Tier && (tiers.s_tier as unknown as string[]).includes(symbol)) overlapCount++;
        if (isNewA_Tier && (tiers.a_tier_bluechips as unknown as string[]).includes(symbol)) overlapCount++;
    });

    const sectorScore = overlapCount === 0 ? 0 : overlapCount === 1 ? 0.5 : overlapCount === 2 ? 0.8 : 1.0;

    // 2. Real Correlation Check (Elite)
    if (currentPrices && currentPrices.length >= 20 && openPositions.length > 0) {
        const { calculatePearsonCorrelation } = await import('../mathUtils');

        for (const openSymbol of openPositions) {
            try {
                // Fetch candles for the open position (cached)
                const openCandles = await fetchCandles(openSymbol.replace('/', ''), '15m');
                if (openCandles && openCandles.length >= 20) {
                    const openPrices = openCandles.map(c => c.close);
                    const corr = Math.abs(calculatePearsonCorrelation(currentPrices, openPrices));
                    if (corr > maxCorrelation) maxCorrelation = corr;
                }
            } catch (e) {
                // Skip if fetch fails
            }
        }
    }

    // Final Heatmap Score: Max of sector logic and real correlation
    const finalScore = Math.max(sectorScore, maxCorrelation);

    let recommendation: 'PROCEED' | 'REDUCE' | 'BLOCK' = 'PROCEED';
    if (finalScore >= 0.85) recommendation = 'BLOCK'; // Ultra-correlated -> No diversifaction
    else if (finalScore >= 0.65) recommendation = 'REDUCE'; // Strong correlation -> Half size

    return { score: finalScore, recommendation };
};
