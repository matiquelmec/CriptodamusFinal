/**
 * PIPELINE STAGE 4: FILTER ENGINE
 * 
 * Applies hard filters to potential opportunities based on:
 * 1. Global Market Risk (Kill Switch)
 * 2. Trading Style Constraints (e.g. Meme vs Institutional)
 * 3. Configuration Blacklists
 */

import { AIOpportunity, MarketRisk, TradingStyle } from '../../../types';
import { TradingConfig } from '../../../config/tradingConfig';

export class FilterEngine {

    /**
     * Determine if an opportunity should be discarded
     */
    static shouldDiscard(
        opportunity: AIOpportunity,
        risk: MarketRisk,
        style: TradingStyle
    ): { discarded: boolean; reason?: string } {

        // 1. RISK SHIELD (Global Kill Switch)
        if (risk.level === 'HIGH' && risk.riskType === 'MANIPULATION') {
            // Only allow specialized strategies in high risk
            if (style !== 'SCALP_AGRESSIVE') {
                return { discarded: true, reason: 'Risk Shield Active: Whale Manipulation Detected' };
            }
        }

        // 2. Minimum Score Filter (Updated to 75)
        const minScore = TradingConfig.scoring.min_score_entry;
        if (opportunity.confidenceScore < minScore) {
            return { discarded: true, reason: `Score ${opportunity.confidenceScore} below Institutional Threshold ${minScore}` };
        }

        // 3. THE GATEKEEPER (Liquidity & Trend Filters)
        if (opportunity.metrics) {
            const { adx, volume24h } = opportunity.metrics;
            const filters = TradingConfig.scoring.filters;

            // Liquidity Check
            if (volume24h && volume24h < filters.min_volume_24h) {
                return { discarded: true, reason: `Low Liquidity ($${(volume24h / 1000000).toFixed(1)}M < $5M)` };
            }

            // Trend Strength Check (Ignore for Mean Reversion strategies)
            const isReversionStrategy = style === 'SCALP_AGRESSIVE' && opportunity.technicalReasoning.includes('Mean Reversion');
            if (!isReversionStrategy && adx && adx < filters.min_adx) {
                return { discarded: true, reason: `Weak Trend (ADX ${adx} < ${filters.min_adx})` };
            }
        }

        // 4. Asset/Style Mismatch
        const isMeme = (TradingConfig.assets.tiers.c_tier_patterns as unknown as string[]).some(p => opportunity.symbol.includes(p)) ||
            (TradingConfig.assets.meme_list as unknown as string[]).includes(opportunity.symbol);

        if (style === 'MEME_SCALP' && !isMeme) {
            return { discarded: true, reason: 'Strategy Restricted to Meme Assets' };
        }

        if (style === 'SWING_INSTITUTIONAL' && isMeme) {
            return { discarded: true, reason: 'Institutional Strategy excludes Memes' };
        }

        // 5. Blacklist
        if ((TradingConfig.assets.tiers.ignored_symbols as unknown as string[]).includes(opportunity.symbol)) {
            return { discarded: true, reason: 'Asset Blacklisted' };
        }

        return { discarded: false };
    }

    /**
     * APEX SAFETY: Multi-factored Whipsaw Protection
     * Ensures reversals after losses meet institutional-grade conviction levels.
     */
    static checkApexSafety(
        opportunity: AIOpportunity,
        history: any[],
        mlStats: any | null // Use any for robustness against type drift
    ): { discarded: boolean; reason?: string; penalty?: number } {
        if (!history || history.length === 0) return { discarded: false };

        const lastSignal = history[0];
        const isLoss = lastSignal.status === 'LOSS';
        const isOpposite = lastSignal.side !== opportunity.side;
        const safety = (TradingConfig.risk as any).safety; // Use cast to avoid compile errors if types haven't refreshed

        if (!safety) return { discarded: false };

        // 1. APEX WHIPSAW PROTECTION (Direction Flip after Loss)
        if (isLoss && isOpposite) {
            let penalty = safety.direction_flip_penalty;

            // A. ML Regime Performance Guard
            // If Brain Health in this regime is low, double the penalty
            const currentRegime = opportunity.metrics?.marketRegime?.regime;
            if (mlStats && currentRegime && mlStats.regimeStats && mlStats.regimeStats[currentRegime]) {
                const accuracy = mlStats.regimeStats[currentRegime].rate;
                if (accuracy < 0.5) {
                    penalty *= 1.5;
                }
            }

            // B. Institutional Volume Guard
            // A reversal after a loss MUST be backed by a volume climax
            const rvol = opportunity.metrics?.rvol || 0;
            if (rvol < 2.0) {
                return {
                    discarded: true,
                    reason: `Apex Guard: Reversal requires Volume Climax (>2.0x), found ${rvol.toFixed(1)}x`
                };
            }

            // C. High Conviction Threshold
            const adjustedScore = opportunity.confidenceScore - penalty;
            if (adjustedScore < safety.high_conviction_threshold) {
                return {
                    discarded: true,
                    reason: `Apex Guard: Reversal Confidence ${adjustedScore.toFixed(0)} < ${safety.high_conviction_threshold} (Penalty: -${penalty})`
                };
            }
        }

        // 2. CONSECUTIVE LOSS COOLDOWN (Future Expansion)
        // If 2+ losses in a row, we could block the asset entirely here.

        return { discarded: false };
    }
}
