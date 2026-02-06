/**
 * PIPELINE STAGE 3: STRATEGY SCORER
 * 
 * Validates the technical indicators against the centralized configuration
 * to generate a confidence score and reasoning.
 */

import { TechnicalIndicators } from '../../../types';
import { TradingConfig } from '../../../config/tradingConfig';
import { SentimentAnalysis } from '../../../../services/newsService';

export interface ScoringResult {
    score: number;
    reasoning: string[];
    strategies: string[];
}

export class StrategyScorer {

    static score(
        symbol: string,
        indicators: TechnicalIndicators,
        signalSide: 'LONG' | 'SHORT' = 'LONG',
        sentiment?: SentimentAnalysis,
        strategyWeights: Record<string, number> = {}
    ): ScoringResult {
        let score = 0;
        const reasoning: string[] = [];
        const strategies: string[] = [];
        const weights = TradingConfig.scoring.weights;

        const isLong = signalSide === 'LONG';
        const isShort = signalSide === 'SHORT';

        // --- STAGE 0: INTEGRITY CHECKMATE ---
        if (indicators.invalidated) {
            console.error(`[Scorer] ⛔ SCORING ABORTED for ${symbol}: Technical Indicators reach Scorer in INVALIDated state.`);
            return {
                score: 0,
                reasoning: [`🚨 SYSTEM_INTEGRITY_SHIELD: ${indicators.technicalReasoning || 'Unknown Corruption Detected'}`],
                strategies: []
            };
        }

        // 1. Trend Alignment (Institutional EMA Hierarchy)
        const trend = indicators.trendStatus.emaAlignment;
        const trendSide = trend === 'BULLISH' ? 'LONG' : trend === 'BEARISH' ? 'SHORT' : 'NEUTRAL';

        if (signalSide === trendSide) {
            score += weights.ema_alignment_bullish;
            reasoning.push(`✅ Trend Aligned (${trend} EMA Hierarchy) (+${weights.ema_alignment_bullish})`);
        } else if (trendSide !== 'NEUTRAL') {
            const penalty = 15;
            score -= penalty;
            reasoning.push(`⚠️ Trend Conflict: Fighting against EMA trend (-${penalty})`);
        }

        // 2. Momentum (RSI Side-Aware)
        if (isLong) {
            if (indicators.rsi < TradingConfig.indicators.rsi.oversold) {
                score += weights.rsi_oversold;
                reasoning.push(`✅ Momentum: RSI Oversold (Bullish Reversal) (+${weights.rsi_oversold})`);
            } else if (indicators.rsi > 70) {
                score -= 10;
                reasoning.push(`⚠️ Momentum: RSI Overbought (Bullish Exhaustion) (-10)`);
            }
        } else {
            if (indicators.rsi > TradingConfig.indicators.rsi.overbought) {
                score += weights.rsi_overbought;
                reasoning.push(`✅ Momentum: RSI Overbought (Bearish Rejection) (+${weights.rsi_overbought})`);
            } else if (indicators.rsi < 30) {
                score -= 10;
                reasoning.push(`⚠️ Momentum: RSI Oversold (Bearish Exhaustion) (-10)`);
            }
        }

        // 3. Patterns (Context Validated)
        if (indicators.nPattern?.detected) {
            const nTrendSide = indicators.nPattern.type === 'BULLISH' ? 'LONG' : 'SHORT';
            if (nTrendSide === signalSide) {
                score += weights.chart_pattern_breakout;
                strategies.push('N_PATTERN');
                reasoning.push(`✅ ${signalSide} N-Pattern: Break & Retest Confirmed (+${weights.chart_pattern_breakout})`);
            }
        }

        if (indicators.boxTheory?.active) {
            const boxSide = indicators.boxTheory.signal === 'BULLISH' ? 'LONG' : indicators.boxTheory.signal === 'BEARISH' ? 'SHORT' : 'NEUTRAL';
            if (boxSide === signalSide) {
                score += weights.chart_pattern_breakout;
                strategies.push('BOX_THEORY');
                reasoning.push(`✅ Box Theory: Rejection from 0.5 Level Aligned (+${weights.chart_pattern_breakout})`);
            }
        }

        // 4. Divergences
        if (indicators.rsiDivergence) {
            const divType = indicators.rsiDivergence.type; // BULLISH or BEARISH
            const divSide = divType === 'BULLISH' ? 'LONG' : 'SHORT';
            if (divSide === signalSide) {
                score += weights.rsi_divergence;
                strategies.push('DIVERGENCE');
                reasoning.push(`💎 RSI ${divType} Divergence Detected (+${weights.rsi_divergence})`);
            }
        }

        // 5. Mean Reversion (Z-Score)
        if (isLong && indicators.zScore < -2) {
            score += TradingConfig.scoring.advisor.z_score_extreme;
            reasoning.push(`📉 Z-Score Extreme Oversold: Prime for Bounce (+${TradingConfig.scoring.advisor.z_score_extreme})`);
        } else if (isShort && indicators.zScore > 2) {
            score += TradingConfig.scoring.advisor.z_score_extreme;
            reasoning.push(`📈 Z-Score Extreme Overbought: Prime for Rejection (+${TradingConfig.scoring.advisor.z_score_extreme})`);
        }

        // 6. Institutional Flow (CVD)
        if (indicators.cvdDivergence && indicators.cvdDivergence !== 'NONE') {
            const cvdSide = indicators.cvdDivergence === 'BULLISH' ? 'LONG' : indicators.cvdDivergence === 'BEARISH' ? 'SHORT' : 'NEUTRAL';
            if (cvdSide === signalSide) {
                score += weights.cvd_divergence_boost;
                reasoning.push(`🐋 CVD ${signalSide} Divergence: Whale Activity Aligned (+${weights.cvd_divergence_boost})`);
            }
        }

        // Absorption Check
        if (indicators.volumeExpert?.cvd?.divergence?.includes('ABSORPTION')) {
            const absorptionSide = indicators.volumeExpert.cvd.divergence === 'CVD_ABSORPTION_BUY' ? 'LONG' : 'SHORT';
            if (absorptionSide === signalSide) {
                score += 15;
                reasoning.push(`🧱 Institutional Absorption Detected (+15)`);
            }
        }

        // 7. Liquidity Magnets (Side-Correct)
        if (indicators.volumeExpert?.liquidity?.orderBook) {
            const ob = indicators.volumeExpert.liquidity.orderBook;

            // Support Wall (Long Confirmation)
            if (isLong && ob.bidWall) {
                const dist = Math.abs(indicators.price - ob.bidWall.price) / indicators.price;
                if (dist < 0.01) {
                    let boost = 10;
                    let desc = `🧱 Support Wall: ${ob.bidWall.volume.toFixed(2)} BTC`;

                    if (ob.bidWall.strength >= 80) { boost += 10; desc += ' (Whale)'; }
                    if (ob.bidWall.isPersistent) { boost += 20; desc += ' (ARCHITECT APPROVED 🏛️)'; }

                    score += boost;
                    reasoning.push(`✅ ${desc} (+${boost})`);
                }
            }

            // Resistance Wall (Short Confirmation)
            else if (isShort && ob.askWall) {
                const dist = Math.abs(indicators.price - ob.askWall.price) / indicators.price;
                if (dist < 0.01) {
                    let boost = 10;
                    let desc = `🧱 Resistance Wall: ${ob.askWall.volume.toFixed(2)} BTC`;

                    if (ob.askWall.strength >= 80) { boost += 10; desc += ' (Whale)'; }
                    if (ob.askWall.isPersistent) { boost += 20; desc += ' (ARCHITECT APPROVED 🏛️)'; }

                    score += boost;
                    reasoning.push(`✅ ${desc} (+${boost})`);
                }
            }
        }

        if (indicators.volumeExpert?.liquidity?.liquidationClusters) {
            const liqs = indicators.volumeExpert.liquidity.liquidationClusters;
            // For a LONG, we want to see SHORT liquidations above us (Magnets).
            // Actually, usually we target opposite liquidity.
            const oppositeLiq = isLong ? 'SHORT_LIQ' : 'LONG_LIQ';
            const magnet = liqs.find(c => c.type === oppositeLiq);

            if (magnet) {
                const distPercent = Math.abs(magnet.priceMin - indicators.price) / indicators.price;
                if (distPercent < 0.02) {
                    score += weights.liquidation_flutter;
                    reasoning.push(`🧲 Liquidity Magnet: Near ${magnet.type} Cluster (+${weights.liquidation_flutter})`);
                }
            }
        }

        // 8. Fair Value Gaps (Context Correct)
        if (isLong && indicators.fairValueGaps?.bullish) {
            const fvg = indicators.fairValueGaps.bullish.find(f => indicators.price >= f.bottom && indicators.price <= f.top * 1.005);
            if (fvg) {
                score += 15;
                reasoning.push(`🧲 FVG Support: Testing Bullish Imbalance (+15)`);
            }
        } else if (isShort && indicators.fairValueGaps?.bearish) {
            const fvg = indicators.fairValueGaps.bearish.find(f => indicators.price <= f.top && indicators.price >= f.bottom * 0.995);
            if (fvg) {
                score += 15;
                reasoning.push(`🧲 FVG Resistance: Testing Bearish Imbalance (+15)`);
            }
        }

        // 9. Volume Profile (AMT Logic)
        if (indicators.volumeProfile) {
            const poc = indicators.volumeProfile.poc;
            const pocDist = Math.abs(indicators.price - poc) / indicators.price;

            if (isLong && indicators.price > poc && pocDist < 0.01) {
                score += 10;
                reasoning.push(`📊 Volume Profile: Retesting POC as Support (+10)`);
            } else if (isShort && indicators.price < poc && pocDist < 0.01) {
                score += 10;
                reasoning.push(`📊 Volume Profile: Retesting POC as Resistance (+10)`);
            }

            // LVN Rejection
            if (indicators.volumeProfile.lowVolumeNodes) {
                const nearLVN = indicators.volumeProfile.lowVolumeNodes.find(lvn => Math.abs(indicators.price - lvn) / lvn < 0.005);
                if (nearLVN) {
                    score += 12;
                    reasoning.push(`📉 AMT: Rejection Probable from LVN Cluster (+12)`);
                }
            }
        }

        // 10. Ichimoku Alignment
        if (indicators.ichimokuData) {
            const cloudTop = Math.max(indicators.ichimokuData.senkouA, indicators.ichimokuData.senkouB);
            const cloudBottom = Math.min(indicators.ichimokuData.senkouA, indicators.ichimokuData.senkouB);

            if (isLong && indicators.price > cloudTop) {
                score += 15;
                reasoning.push(`☁️ Ichimoku: Bullish Cloud Breakout (+15)`);
            } else if (isShort && indicators.price < cloudBottom) {
                score += 15;
                reasoning.push(`☁️ Ichimoku: Bearish Cloud Breakout (+15)`);
            }
        }

        // 11. Sentiment Awareness (Contrarian Logic at Extremes)
        if (sentiment) {
            const isBullishSentiment = sentiment.sentiment === 'BULLISH';
            const isBearishSentiment = sentiment.sentiment === 'BEARISH';
            const isExtreme = Math.abs(sentiment.score) > 0.8;

            if (isLong) {
                if (isBullishSentiment && !isExtreme) {
                    score += 10;
                    reasoning.push(`📰 Sentiment: Bullish Bias Aligned (+10)`);
                } else if (isBearishSentiment && isExtreme) {
                    score += 15;
                    reasoning.push(`📰 Sentiment: Extreme Fear (Contrarian Buy Signal) (+15)`);
                }
            } else if (isShort) {
                if (isBearishSentiment && !isExtreme) {
                    score += 10;
                    reasoning.push(`📰 Sentiment: Bearish Bias Aligned (+10)`);
                } else if (isBullishSentiment && isExtreme) {
                    score += 15;
                    reasoning.push(`📰 Sentiment: Extreme Euphoria (Contrarian Sell Signal) (+15)`);
                }
            }
        }

        // --- NEW: THE PSYCHOLOGIST'S HACK (Contrarian Rule) ---
        const psychConfig = (TradingConfig as any).psychologistHack;
        if (psychConfig?.enabled && indicators.volumeExpert?.derivatives?.buySellRatio && indicators.ema20) {
            const lsRatio = indicators.volumeExpert.derivatives.buySellRatio;
            const price = indicators.price;
            const ema20 = indicators.ema20;
            const distToEma20 = Math.abs(price - ema20) / ema20;

            if (distToEma20 < psychConfig.ema20_proximity_threshold) {
                const isOverLong = lsRatio > psychConfig.retail_long_extreme;
                const isOverShort = lsRatio < psychConfig.retail_short_extreme;

                if (isLong && isOverLong) {
                    score -= psychConfig.penalty_score;
                    reasoning.push(`🚨 Psicólogo: Minoristas sobre-apalancados en LONG en zona de valor. Esperando Stop Run (-${psychConfig.penalty_score})`);
                } else if (isShort && isOverShort) {
                    score -= psychConfig.penalty_score;
                    reasoning.push(`🚨 Psicólogo: Minoristas sobre-apalancados en SHORT en zona de valor. Esperando Stop Run (-${psychConfig.penalty_score})`);
                }
            }
        }

        // 12. Meta-Scoring (Dynamic Weights based on Global Performance)
        if (strategies.length > 0) {
            let combinedMultiplier = 1.0;
            strategies.forEach(s => {
                if (strategyWeights[s]) {
                    // We take the average or the best? Usually best-performing strategy leads the way
                    combinedMultiplier = Math.max(combinedMultiplier, strategyWeights[s]);
                }
            });

            if (combinedMultiplier !== 1.0) {
                const oldScore = score;
                score = score * combinedMultiplier;
                const type = combinedMultiplier > 1 ? 'Boost' : 'Penalty';
                reasoning.push(`🧠 Meta-Scoring: Strategy ${type} applied (x${combinedMultiplier.toFixed(2)})`);
            }
        }

        // Final Boost for God Mode
        if (score >= TradingConfig.scoring.god_mode_threshold) {
            reasoning.push(`🔥 GOD MODE: Institutional Grade Confluence`);
        }

        return {
            score: Math.max(0, Math.min(100, score)),
            reasoning,
            strategies
        };
    }
}
