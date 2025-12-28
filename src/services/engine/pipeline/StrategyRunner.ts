/**
 * PIPELINE STAGE 3.5: STRATEGY RUNNER
 * 
 * Orchestrates the execution of specific trading strategies based on
 * the detected market regime.
 */

import { TechnicalIndicators, MarketRisk } from '../../../types';
import { detectMarketRegime } from '../../marketRegimeDetector';
import { selectStrategies } from '../../strategySelector';

// Strategy Adapters
import { analyzeIchimoku } from '../../strategies/IchimokuAdapter';
import { analyzeFreezeStrategy } from '../../strategies/FreezeStrategy';
import { analyzeMemeSignal } from '../../strategies/MemeStrategy';
import { analyzeSwingSignal } from '../../strategies/SwingStrategy';
import { analyzeBreakoutSignal } from '../../strategies/BreakoutStrategy';
import { analyzeScalpSignal } from '../../strategies/ScalpStrategy';
import { analyzePinballSignal } from '../../strategies/PinballStrategy';

export class StrategyRunner {

    static run(
        indicators: TechnicalIndicators,
        risk: MarketRisk,
        highs: number[],
        lows: number[],
        prices: number[],
        volumes: number[]
    ) {
        // 1. Detect Regime & Select Strategies
        const marketRegime = detectMarketRegime(indicators);
        const selection = selectStrategies(marketRegime);

        let bestStrategyResult: {
            id: string;
            score: number;
            signal: 'LONG' | 'SHORT' | 'NEUTRAL';
            reason: string;
        } | null = null;

        const strategyDetails: string[] = [];
        let totalScoreBoost = 0;

        // 2. Run Active Strategies
        for (const strategy of selection.activeStrategies) {
            if (strategy.weight === 0) continue;

            let result = null;
            let name = "";

            try {
                switch (strategy.id) {
                    case 'ichimoku_dragon':
                        result = analyzeIchimoku(highs, lows, prices);
                        // Note: Adapter might need indicators usually, but looking at legacy code it took arrays
                        name = "Ichimoku Cloud";
                        break;
                    case 'breakout_momentum':
                        result = analyzeBreakoutSignal(
                            prices,
                            highs,
                            lows,
                            indicators.rvol,
                            indicators.confluenceAnalysis?.topResistances.map(r => r.price)
                        );
                        name = "Breakout Momentum";
                        break;
                    case 'smc_liquidity':
                        // Ensure orderBlocks structure is compatible, logic expects { bullishOB, bearishOB } 
                        // Our types: { bullish, bearish }. Need to check if analyzeSwingSignal handles this or if we map.
                        // analyzeSwingSignal expects: { bullishOB: ..., bearishOB: ... }
                        // indicators.orderBlocks comes from AdvancedAnalyzer: { bullish: ..., bearish: ... }
                        // Mapping needed.
                        const compatibleOBs = indicators.orderBlocks ? {
                            bullishOB: indicators.orderBlocks.bullish,
                            bearishOB: indicators.orderBlocks.bearish
                        } : undefined;

                        result = analyzeSwingSignal(
                            prices,
                            highs,
                            lows,
                            indicators.fibonacci,
                            volumes,
                            compatibleOBs
                        );
                        name = "SMC Liquidity";
                        break;
                    case 'quant_volatility':
                        // Maps to Scalp Strategy in legacy logic
                        result = analyzeScalpSignal(prices, indicators.vwap, indicators.rsi);
                        name = "Quant Volatility";
                        break;
                    case 'meme_hunter':
                        result = analyzeMemeSignal(
                            prices,
                            indicators.vwap,
                            indicators.rvol,
                            indicators.rsi,
                            indicators.stochRsi
                        );
                        name = "Meme Hunter";
                        break;
                    case 'divergence_hunter':
                        // Maps to Pinball in legacy logic (approx) or specialized Divergence check
                        // Legacy scanner used Pinball or General Divergence
                        result = analyzePinballSignal(
                            prices,
                            lows,
                            highs,
                            indicators.ema50,
                            indicators.ema200,
                            indicators.emaSlope,
                            indicators.adx
                        );
                        name = "Pinball/Divergence";
                        break;
                }

                if (result && result.signal !== 'NEUTRAL') {
                    // Apply Weight
                    const weightedScore = result.score * strategy.weight;

                    if (!bestStrategyResult || weightedScore > (bestStrategyResult.score * (selectStrategies(marketRegime).activeStrategies.find(s => s.id === bestStrategyResult?.id)?.weight || 1))) {
                        bestStrategyResult = {
                            id: strategy.id,
                            score: result.score, // Raw Score
                            signal: result.signal,
                            reason: result.reason
                        };
                    }

                    if (weightedScore > 10) { // Threshold for noting it
                        strategyDetails.push(`${name}: ${result.signal} (${result.score}) - ${result.reason}`);
                        totalScoreBoost += weightedScore; // Accumulate weighted score
                    }
                }

            } catch (err) {
                console.warn(`[StrategyRunner] Failed to run ${strategy.id}`, err);
            }
        }

        // 3. Freeze Strategy (Priority Override)
        const freezeSignal = analyzeFreezeStrategy(indicators, risk);
        if (freezeSignal.active) {
            totalScoreBoost += 25;
            strategyDetails.push(`❄️ FREEZE PROTOCOL ACTIVE: High Probability Reversal (+25)`);
            if (!bestStrategyResult) {
                bestStrategyResult = {
                    id: 'freeze_protocol',
                    score: 95,
                    signal: freezeSignal.type === 'BULLISH' ? 'LONG' : freezeSignal.type === 'BEARISH' ? 'SHORT' : 'NEUTRAL',
                    reason: 'Freeze Protocol Triggered'
                };
            }
        }

        return {
            primaryStrategy: bestStrategyResult,
            details: strategyDetails,
            scoreBoost: Math.min(100, totalScoreBoost), // Cap valid boost
            marketRegime
        };

    }
}
