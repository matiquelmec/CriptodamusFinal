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

        // 5. Institutional Flow
        if (indicators.zScore < -2) {
            score += TradingConfig.scoring.advisor.z_score_extreme; // Mean Reversion Potential
            strategies.push('MEAN_REVERSION');
            reasoning.push(`📉 Z-Score Extreme Oversold (-2 StdDev) (+${TradingConfig.scoring.advisor.z_score_extreme})`);
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
