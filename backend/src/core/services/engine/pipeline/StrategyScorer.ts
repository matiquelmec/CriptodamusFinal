/**
 * PIPELINE STAGE 3: STRATEGY SCORER
 * 
 * Validates the technical indicators against the centralized configuration
 * to generate a confidence score and reasoning.
 */

import { TechnicalIndicators } from '../../../types';
import { TradingConfig } from '../../../config/tradingConfig';

export interface ScoringResult {
    score: number;
    reasoning: string[];
    strategies: string[];
}

export class StrategyScorer {

    static score(symbol: string, indicators: TechnicalIndicators): ScoringResult {
        let score = 0;
        const reasoning: string[] = [];
        const strategies: string[] = [];
        const weights = TradingConfig.scoring.weights;

        // 1. Trend Alignment (EMA)
        if (indicators.trendStatus.emaAlignment === 'BULLISH') {
            score += weights.ema_alignment_bullish;
            reasoning.push(`✅ Trend Aligned (Bullish EMA Hierarchy) (+${weights.ema_alignment_bullish})`);
        } else if (indicators.trendStatus.emaAlignment === 'BEARISH') {
            score += weights.ema_alignment_bearish; // Context dependent, usually for shorts
            // reasoning.push(`⚠️ Bearish Trend Alignment`); 
        }

        // 2. Momentum (RSI)
        if (indicators.rsi < TradingConfig.indicators.rsi.oversold) {
            score += weights.rsi_oversold;
            reasoning.push(`✅ RSI Oversold (<${TradingConfig.indicators.rsi.oversold}) (+${weights.rsi_oversold})`);
        } else if (indicators.rsi > TradingConfig.indicators.rsi.overbought) {
            // Context needs to handle Short vs Long. 
            // For now we assume general "Activity" scoring, specifics handled by FilterEngine
            // score += weights.rsi_overbought; 
        }

        // 3. Advanced Patterns
        if (indicators.nPattern?.detected && indicators.nPattern.type === 'BULLISH') {
            score += weights.chart_pattern_breakout;
            strategies.push('N_PATTERN');
            reasoning.push(`✅ Bullish N-Pattern (Break & Retest) (+${weights.chart_pattern_breakout})`);
        }

        if (indicators.boxTheory?.active && indicators.boxTheory.signal === 'BULLISH') {
            score += weights.chart_pattern_breakout;
            strategies.push('BOX_THEORY');
            reasoning.push(`✅ Box Theory Rejection from 0.5 Level (+${weights.chart_pattern_breakout})`);
        }

        // 4. Divergences (High Value)
        if (indicators.rsiDivergence) {
            score += weights.rsi_divergence;
            strategies.push('DIVERGENCE');
            reasoning.push(`💎 RSI Divergence Detected (+${weights.rsi_divergence})`);
        }

        // 5. Institutional Flow (God Tier)
        if (indicators.zScore < -2) {
            score += TradingConfig.scoring.advisor.z_score_extreme;
            strategies.push('MEAN_REVERSION');
            reasoning.push(`📉 Z-Score Extreme Oversold (-2 StdDev) (+${TradingConfig.scoring.advisor.z_score_extreme})`);
        }

        // 5.1 Smart Money Footprint (CVD)
        if (indicators.cvdDivergence === 'BULLISH') {
            score += weights.cvd_divergence_boost;
            reasoning.push(`🐋 CVD Divergence (Whale Accumulation) (+${weights.cvd_divergence_boost})`);
        } else if (indicators.volumeExpert?.cvd?.divergence?.includes('ABSORPTION')) {
            // PROFESSIONAL TRADER RULE: Absorption must align with RSI context to be a valid reversal signal.
            // If price is overbought (RSI > 75) and we see "Absorption", but no SHORT signal, it's just a strong pump.
            const isShortAbsorption = indicators.volumeExpert.cvd.divergence === 'CVD_ABSORPTION_SELL' && indicators.rsi > 70;
            const isLongAbsorption = indicators.volumeExpert.cvd.divergence === 'CVD_ABSORPTION_BUY' && indicators.rsi < 30;

            if (isShortAbsorption || isLongAbsorption) {
                score += weights.cvd_divergence_boost;
                reasoning.push(`🧱 Passive Absorption Detected (Institutional Reversal) (+${weights.cvd_divergence_boost})`);
            } else {
                score += 5; // Reduced boost for absorption without extreme context
                reasoning.push(`🧱 Micro-Absorption Detected (+5)`);
            }
        }

        // 5.2 Liquidation Fuel
        if (indicators.volumeExpert?.liquidity?.liquidationClusters) {
            const liqs = indicators.volumeExpert.liquidity.liquidationClusters;
            const signalSide = indicators.rsi > 50 ? 'SHORT' : 'LONG'; // Rough proxy if side not explicit

            // If we have a cluster in the direction of the trade (Magnet)
            const magnet = liqs.find(c =>
                (c.type === 'SHORT_LIQ' && signalSide === 'LONG') ||
                (c.type === 'LONG_LIQ' && signalSide === 'SHORT')
            );

            if (magnet) {
                const distPercent = Math.abs(magnet.priceMin - indicators.price) / indicators.price;
                if (distPercent < 0.02) {
                    score += weights.liquidation_flutter;
                    reasoning.push(`🧲 Liquidity Magnet: Near ${magnet.type} Cluster (+${weights.liquidation_flutter})`);
                }
            }
        }

        // 5.3 Institutional Walls
        if (indicators.volumeExpert?.liquidity?.orderBook) {
            const ob = indicators.volumeExpert.liquidity.orderBook;
            const bidWall = ob.bidWall;
            const askWall = ob.askWall;

            // Check Support (Bids)
            if (bidWall && bidWall.strength > 70) {
                const dist = Math.abs(indicators.price - bidWall.price) / indicators.price;
                if (dist < 0.015) {
                    score += 15; // Wall confirmed boost
                    reasoning.push(`🧱 Structural Support: Buy Wall at $${bidWall.price.toFixed(2)} (+15)`);
                }
            }

            // Check Resistance (Asks)
            if (askWall && askWall.strength > 70) {
                const dist = Math.abs(indicators.price - askWall.price) / indicators.price;
                if (dist < 0.015) {
                    score += 15;
                    reasoning.push(`🧱 Structural Resistance: Sell Wall at $${askWall.price.toFixed(2)} (+15)`);
                }
            }
        }

        // 5.5 Fair Value Gaps (The Magnet) - NEW CONNECTED FEATURE
        if (indicators.fairValueGaps?.bullish) {
            // Find FVG we are inside or just above
            const activeFVG = indicators.fairValueGaps.bullish.find(fvg =>
                indicators.price >= fvg.bottom && indicators.price <= (fvg.top * 1.01) // Inside or 1% above
            );
            if (activeFVG) {
                score += weights.order_block_retest; // Similar weight to OB retest
                reasoning.push(`🧲 FVG Support: Retesting Bullish Imbalance (+${weights.order_block_retest})`);
            }
        }

        // 5.6 Volume Profile (The Value) - NEW CONNECTED FEATURE
        if (indicators.volumeProfile) {
            const pocDist = Math.abs(indicators.price - indicators.volumeProfile.poc) / indicators.price;
            if (pocDist < 0.01 && indicators.price > indicators.volumeProfile.poc) {
                score += 10;
                reasoning.push(`📊 Volume Profile: Retesting POC as Support`);
            }
        }

        // 5.7 Ichimoku Cloud (The Trend) - NEW CONNECTED FEATURE
        if (indicators.ichimokuData) {
            const cloudTop = Math.max(indicators.ichimokuData.senkouA, indicators.ichimokuData.senkouB);
            if (indicators.price > cloudTop && indicators.ichimokuData.chikouSpanFree) {
                score += 15;
                reasoning.push(`☁️ Ichimoku: Full Kumo Breakout (Strong Trend)`);
            }
        }



        // 5.4 Harmonic Precision
        if (indicators.harmonicPatterns && indicators.harmonicPatterns.length > 0) {
            const pattern = indicators.harmonicPatterns[0];
            if (pattern.direction === 'BULLISH') {
                score += weights.harmonic_pattern;
                strategies.push(`HARMONIC_${pattern.type}`);
                reasoning.push(`✨ ${pattern.type} Harmonic Pattern (+${weights.harmonic_pattern})`);
            }
        }

        // 6. "God Mode" / Golden Ticket
        // If multiple strong signals align
        if (score > TradingConfig.scoring.god_mode_threshold) {
            reasoning.push(`🔥 GOD MODE: Extremely High Confluence`);
        }

        return {
            score: Math.min(100, score),
            reasoning,
            strategies
        };
    }
}
