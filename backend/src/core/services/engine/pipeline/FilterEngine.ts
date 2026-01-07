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
}
