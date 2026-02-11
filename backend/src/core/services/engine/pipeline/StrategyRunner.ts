/**
 * PIPELINE STAGE 3.5: STRATEGY RUNNER
 * 
 * Orchestrates the execution of specific trading strategies based on
 * the detected market regime.
 */

import { TechnicalIndicators, MarketRisk } from '../../../types';
import { detectMarketRegime } from '../../marketRegimeDetector';
import { selectStrategies } from '../../strategySelector';
import { TradingConfig } from '../../../config/tradingConfig';

// Strategy Adapters
import { analyzeIchimoku } from '../../strategies/IchimokuAdapter';
import { analyzeFreezeStrategy } from '../../strategies/FreezeStrategy';
import { analyzeMemeSignal } from '../../strategies/MemeStrategy';
import { analyzeSwingSignal } from '../../strategies/SwingStrategy';
import { analyzeBreakoutSignal } from '../../strategies/BreakoutStrategy';
import { analyzeScalpSignal } from '../../strategies/ScalpStrategy';
import { analyzePinballSignal } from '../../strategies/PinballStrategy';
import { analyzeFailedAuction } from '../../strategies/failedAuctionStrategy';
import { analyzePauPerdicesStrategy } from '../../strategies/PauPerdicesStrategy';

export class StrategyRunner {

    static run(
        indicators: TechnicalIndicators,
        risk: MarketRisk,
        highs: number[],
        lows: number[],
        prices: number[],
        volumes: number[],
        contextCandles: any[] = [] // Optional 4h candles
    ) {
        // 0. SPECIAL OVERRIDE: PAU PERDICES (TOURNAMENT MODE / GOLD SNIPER)
        const symbol = indicators.symbol || 'UNKNOWN';
        const isTarget = TradingConfig.TOURNAMENT_MODE || symbol.includes('XAU') || symbol.includes('GOLD') || symbol.includes('PAXG');
        let pauFailReason: string | null = null;

        if (isTarget) {
            // Pass contextCandles (4h) as the last argument
            const pauResult = analyzePauPerdicesStrategy(symbol, prices[prices.length - 1], prices, highs, lows, volumes, indicators, contextCandles);
            if (pauResult.signal !== 'NEUTRAL') {
                return {
                    primaryStrategy: {
                        id: 'pau_perdices_gold',
                        score: pauResult.score,
                        signal: pauResult.signal,
                        reason: pauResult.reason.join(". "),
                        isFresh: true,
                        specificTrigger: pauResult.reason[0] || 'Sniper Setup',
                        risk: pauResult.risk // NEW: Propagate calculated risk
                    },
                    details: pauResult.reason,
                    scoreBoost: 50, // Massive priority boost
                    marketRegime: detectMarketRegime(indicators) // Still return regime for context
                };
            } else {
                pauFailReason = pauResult.reason.join(", ");
            }
        }

        // 1. Detect Regime & Select Strategies
        const marketRegime = detectMarketRegime(indicators);
        const selection = selectStrategies(marketRegime);

        let bestStrategyResult: {
            id: string;
            score: number;
            signal: 'LONG' | 'SHORT' | 'NEUTRAL';
            reason: string;
            isFresh?: boolean;
            specificTrigger?: string;
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
                        const ichi = analyzeIchimoku(highs, lows, prices);
                        if (ichi) {
                            result = {
                                score: ichi.score,
                                signalSide: ichi.signalSide,
                                detectionNote: ichi.detectionNote
                            };
                        }
                        name = "Ichimoku Cloud";
                        break;
                    case 'breakout_momentum':
                        // V2 Institutional: Pass full indicators (CVD, RVOL)
                        result = analyzeBreakoutSignal(
                            prices,
                            highs,
                            lows,
                            indicators
                        );
                        name = "Breakout Momentum (Inst)";
                        break;

                    case 'quant_volatility': // Scalp Strategy
                        // V2 Institutional: Pass full indicators (CVD, VWAP)
                        result = analyzeScalpSignal(
                            prices,
                            indicators
                        );
                        name = "Quant Volatility (Scalp)";
                        break;

                    case 'meme_hunter':
                        // Meme Strategy (Not heavily refactored yet, kept as is for now or use subset)
                        // Wait, current signature is: (prices, vwap, rvol, rsi, stochRsi)
                        // Let's keep it specific or refactor it? 
                        // To be safe and compliant with current code, I will KEEP the old signature 
                        // UNLESS I update MemeStrategy.ts too. I did NOT touch MemeStrategy.ts in this run. 
                        // I only touched Breakout, Pinball, Scalp.
                        // So Meme stays same.
                        result = analyzeMemeSignal(
                            prices,
                            indicators.vwap,
                            indicators.rvol || 0,
                            indicators.rsi,
                            indicators.stochRsi
                        );
                        name = "Meme Hunter";
                        break;

                    case 'divergence_hunter': // Using Pinball Strategy file logic often
                        // V2 Institutional: Pass full indicators (OrderBlocks)
                        result = analyzePinballSignal(
                            prices,
                            indicators
                        );
                        name = "Pinball / Divergence (Inst)";
                        break;
                    case 'mean_reversion':
                        // Maps to Swing Strategy (Reversion to Mean in Range)
                        // analyzeSwingSignal logic is robust for this (Bollinger/RSI reversion)
                        result = analyzeSwingSignal(
                            prices,
                            highs,
                            lows,
                            indicators
                        );
                        // ENRICHMENT: Check for Failed Auction (AMT Style)
                        const failedAuction = analyzeFailedAuction(indicators, marketRegime, prices[prices.length - 1]);
                        if (failedAuction.side !== 'NEUTRAL') {
                            // If Failed Auction matches Mean Reversion direction, boost confidence
                            if (result && result.signalSide === failedAuction.side) {
                                result.score = Math.min(100, result.score + 15);
                                result.detectionNote += ` + Institutional Failed Auction Confirmation.`;
                            } else if (!result || result.signalSide === 'NEUTRAL') {
                                // Or use it as primary signal
                                result = {
                                    score: failedAuction.confidence,
                                    signalSide: failedAuction.side,
                                    detectionNote: failedAuction.reason
                                };
                            }
                        }
                        name = "Mean Reversion (Range/AMT)";
                        break;
                }

                if (result && result.signalSide !== 'NEUTRAL' as any) { // fix typing 'NEUTRAL' check vs signalSide property which is LONG/SHORT usually
                    // Note regarding typing: The adapter returns { signalSide: 'LONG'|'SHORT' }.
                    // The code above checked result.signal === 'NEUTRAL'.
                    // I should adapt to result.signalSide or map it.
                    // The original code copied used result.signal. 
                    // But adapters return signalSide.
                    // I will map signalSide to signal to match legacy expectation if needed, or use signalSide.
                    // Let's use signalSide.
                    const signal = result.signalSide; // LONG or SHORT

                    // Apply Weight
                    const weightedScore = result.score * strategy.weight;

                    if (!bestStrategyResult || weightedScore > (bestStrategyResult.score * (selectStrategies(marketRegime).activeStrategies.find(s => s.id === bestStrategyResult?.id)?.weight || 1))) {
                        bestStrategyResult = {
                            id: strategy.id,
                            score: result.score, // Raw Score
                            signal: signal,
                            reason: result.detectionNote, // Mapped from detectionNote
                            isFresh: (result as any).isFresh, // Optional, bubbled up from adapter
                            specificTrigger: (result as any).specificTrigger
                        };
                    }

                    if (weightedScore > 10) { // Threshold for noting it
                        strategyDetails.push(`${name}: ${signal} (${result.score}) - ${result.detectionNote}`);
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
            const boost = TradingConfig.scoring.weights.freeze_protocol_boost || 25;
            totalScoreBoost += boost;
            strategyDetails.push(`❄️ FREEZE PROTOCOL ACTIVE: High Probability Reversal (+${boost})`);
            if (!bestStrategyResult) {
                bestStrategyResult = {
                    id: 'freeze_protocol',
                    score: 95,
                    signal: freezeSignal.type === 'BULLISH' ? 'LONG' : freezeSignal.type === 'BEARISH' ? 'SHORT' : 'NEUTRAL',
                    reason: 'Freeze Protocol Triggered'
                };
            }
        }

        // Default Fallback (If Pau Failed and no other strategy matched)
        if (!bestStrategyResult && pauFailReason) {
            bestStrategyResult = {
                id: 'pau_perdices_gold',
                score: 0,
                signal: 'NEUTRAL',
                reason: `Pau Ignored: ${pauFailReason}`,
                isFresh: false
            };
        }

        return {
            primaryStrategy: bestStrategyResult,
            details: strategyDetails,
            scoreBoost: Math.min(100, totalScoreBoost), // Cap valid boost
            marketRegime
        };
    }
}
