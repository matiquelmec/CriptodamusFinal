/**
 * MARKET REGIME DETECTOR
 * 
 * Autonomous classification system that detects market conditions
 * and recommends optimal strategies without manual intervention.
 * 
 * Regimes:
 * - TRENDING: Strong directional movement (ADX > 25)
 * - RANGING: Sideways consolidation (ADX < 20, low BB bandwidth)
 * - VOLATILE: High volatility expansion (ATR spike, BB expansion)
 * - EXTREME: Oversold/Overbought or Divergences (reversal signals)
 */

import {
    MarketRegime,
    MarketRegimeType,
    RegimeMetrics,
    TrendDirection,
    ExtremeCondition
} from '../types-advanced';
import { TechnicalIndicators } from '../types';

/**
 * Main regime detection function
 * Analyzes technical indicators to classify current market state
 */
export function detectMarketRegime(indicators: TechnicalIndicators): MarketRegime {
    const metrics = buildRegimeMetrics(indicators);
    const regime = classifyRegime(metrics);
    const strategies = getRecommendedStrategies(regime, metrics);
    const reasoning = buildReasoning(regime, metrics);
    const confidence = calculateConfidence(regime, metrics);

    return {
        regime,
        confidence,
        metrics,
        recommendedStrategies: strategies,
        reasoning
    };
}

/**
 * Build comprehensive metrics for regime detection
 */
function buildRegimeMetrics(indicators: TechnicalIndicators): RegimeMetrics {
    const { adx, atr, price, bollinger, rsi, rvol, ema20, ema50, ema100, ema200 } = indicators;

    // Calculate ATR as percentage of price
    const atrPercent = (atr / price) * 100;

    // Determine EMA alignment
    const emaAlignment = getEMAAlignment(ema20, ema50, ema100, ema200);

    // Detect extreme conditions
    const extremeCondition = detectExtremeCondition(indicators);

    return {
        adx,
        atr,
        atrPercent,
        bbBandwidth: bollinger.bandwidth,
        emaAlignment,
        rsi,
        rvol,
        extremeCondition
    };
}

/**
 * Classify market regime based on metrics
 */
function classifyRegime(metrics: RegimeMetrics): MarketRegimeType {
    const { adx, bbBandwidth, atrPercent, extremeCondition } = metrics;

    // Priority 1: EXTREME conditions (highest priority)
    if (extremeCondition) {
        return 'EXTREME';
    }

    // Priority 2: VOLATILE (expansion phase)
    // High ATR + Wide Bollinger Bands = Volatility expansion
    if (atrPercent > 3.5 && bbBandwidth > 4.0) {
        return 'VOLATILE';
    }

    // Priority 3: TRENDING (strong directional movement)
    // ADX > 25 indicates strong trend
    if (adx > 25) {
        return 'TRENDING';
    }

    // Priority 4: RANGING (default for low volatility, no trend)
    // ADX < 20 + Narrow Bollinger Bands = Range-bound market
    if (adx < 20 && bbBandwidth < 3.0) {
        return 'RANGING';
    }

    // Edge case: Moderate conditions
    // If ADX is between 20-25, check other factors
    if (adx >= 20 && adx <= 25) {
        // If bandwidth is expanding, lean towards VOLATILE
        if (bbBandwidth > 3.5) {
            return 'VOLATILE';
        }
        // Otherwise, it's a weak trend (still RANGING)
        return 'RANGING';
    }

    // Default fallback
    return 'RANGING';
}

/**
 * Determine EMA ribbon alignment
 */
function getEMAAlignment(ema20: number, ema50: number, ema100: number, ema200: number): TrendDirection {
    // Perfect bullish alignment: 20 > 50 > 100 > 200
    if (ema20 > ema50 && ema50 > ema100 && ema100 > ema200) {
        return 'BULLISH';
    }

    // Perfect bearish alignment: 20 < 50 < 100 < 200
    if (ema20 < ema50 && ema50 < ema100 && ema100 < ema200) {
        return 'BEARISH';
    }

    // Chaotic (no clear alignment)
    return 'NEUTRAL';
}

/**
 * Detect extreme market conditions
 */
function detectExtremeCondition(indicators: TechnicalIndicators): ExtremeCondition | undefined {
    const { rsi, price, bollinger } = indicators;

    // Extreme oversold
    if (rsi < 25 && price <= bollinger.lower) {
        return 'OVERSOLD';
    }

    // Extreme overbought
    if (rsi > 75 && price >= bollinger.upper) {
        return 'OVERBOUGHT';
    }

    // TODO: Implement divergence detection (requires historical data)
    // For now, we'll detect divergences in a separate service

    return undefined;
}

/**
 * Get recommended strategies for the detected regime
 */
function getRecommendedStrategies(regime: MarketRegimeType, metrics: RegimeMetrics): string[] {
    switch (regime) {
        case 'TRENDING':
            // Trend-following strategies
            return ['ichimoku_dragon', 'breakout_momentum', 'smc_liquidity'];

        case 'RANGING':
            // Mean reversion strategies
            return ['mean_reversion', 'smc_liquidity', 'quant_volatility'];

        case 'VOLATILE':
            // Volatility expansion strategies
            return ['quant_volatility', 'breakout_momentum', 'meme_hunter'];

        case 'EXTREME':
            // Reversal strategies
            if (metrics.extremeCondition === 'OVERSOLD' || metrics.extremeCondition === 'BULLISH_DIVERGENCE') {
                return ['divergence_hunter', 'smc_liquidity', 'mean_reversion'];
            } else {
                return ['divergence_hunter', 'smc_liquidity', 'quant_volatility'];
            }

        default:
            return ['smc_liquidity'];
    }
}

/**
 * Build human-readable reasoning
 */
function buildReasoning(regime: MarketRegimeType, metrics: RegimeMetrics): string {
    const { adx, bbBandwidth, atrPercent, emaAlignment, extremeCondition } = metrics;

    switch (regime) {
        case 'TRENDING':
            return `Mercado en TENDENCIA ${emaAlignment === 'BULLISH' ? 'ALCISTA' : emaAlignment === 'BEARISH' ? 'BAJISTA' : 'INDEFINIDA'}. ` +
                `ADX = ${adx.toFixed(1)} (fuerte direccionalidad). ` +
                `Estrategias de seguimiento de tendencia activadas.`;

        case 'RANGING':
            return `Mercado en RANGO (consolidación). ` +
                `ADX = ${adx.toFixed(1)} (sin tendencia clara), ` +
                `BB Bandwidth = ${bbBandwidth.toFixed(2)}% (compresión). ` +
                `Estrategias de reversión a la media activadas.`;

        case 'VOLATILE':
            return `Mercado en EXPANSIÓN VOLÁTIL. ` +
                `ATR = ${atrPercent.toFixed(2)}% del precio, ` +
                `BB Bandwidth = ${bbBandwidth.toFixed(2)}% (bandas abiertas). ` +
                `Estrategias de momentum y breakout activadas.`;

        case 'EXTREME':
            const condition = extremeCondition === 'OVERSOLD' ? 'SOBREVENTA EXTREMA' :
                extremeCondition === 'OVERBOUGHT' ? 'SOBRECOMPRA EXTREMA' :
                    extremeCondition === 'BULLISH_DIVERGENCE' ? 'DIVERGENCIA ALCISTA' :
                        'DIVERGENCIA BAJISTA';
            return `Condición EXTREMA detectada: ${condition}. ` +
                `RSI = ${metrics.rsi.toFixed(1)}. ` +
                `Estrategias de reversión y captura de extremos activadas.`;

        default:
            return 'Régimen no clasificado.';
    }
}

/**
 * Calculate confidence score (0-100)
 */
function calculateConfidence(regime: MarketRegimeType, metrics: RegimeMetrics): number {
    const { adx, bbBandwidth, atrPercent, emaAlignment, rvol } = metrics;

    let confidence = 50; // Base confidence

    switch (regime) {
        case 'TRENDING':
            // Higher ADX = higher confidence
            if (adx > 30) confidence += 20;
            else if (adx > 25) confidence += 10;

            // EMA alignment confirms trend
            if (emaAlignment !== 'NEUTRAL') confidence += 15;

            // Volume confirms trend
            if (rvol > 1.2) confidence += 15;
            break;

        case 'RANGING':
            // Very low ADX = high confidence in range
            if (adx < 15) confidence += 20;
            else if (adx < 20) confidence += 10;

            // Narrow bands confirm range
            if (bbBandwidth < 2.0) confidence += 20;
            else if (bbBandwidth < 3.0) confidence += 10;
            break;

        case 'VOLATILE':
            // High ATR = high confidence
            if (atrPercent > 5.0) confidence += 20;
            else if (atrPercent > 3.5) confidence += 10;

            // Wide bands confirm volatility
            if (bbBandwidth > 5.0) confidence += 20;
            else if (bbBandwidth > 4.0) confidence += 10;
            break;

        case 'EXTREME':
            // Extreme RSI = high confidence
            if (metrics.rsi < 20 || metrics.rsi > 80) confidence += 30;
            else if (metrics.rsi < 25 || metrics.rsi > 75) confidence += 20;
            break;
    }

    // Cap confidence at 95 (never 100%, markets are unpredictable)
    return Math.min(confidence, 95);
}
