/**
 * ASSET CLASSIFIER - Professional Asset Type Detection
 * 
 * Classifies crypto assets into categories for differential treatment
 * in filtering and scoring logic.
 */

export type AssetClass = 'COMMODITY' | 'LARGE_CAP' | 'MID_CAP' | 'SMALL_CAP' | 'MEME';

export interface AssetProfile {
    class: AssetClass;
    expectedRVOLRange: { min: number; max: number };
    minRVOLForSignal: number; // Threshold for HARD filter
    rvolBonusThreshold: number; // Threshold for scoring bonus
    description: string;
}

/**
 * Asset classification rules based on market behavior and fundamentals
 */
export class AssetClassifier {

    /**
     * Commodity assets (Gold, Silver, etc.)
     * - Traded globally with institutional depth
     * - Low relative volatility
     * - Smooth, professional trends
     */
    private static readonly COMMODITIES = ['PAXG', 'XAU', 'GOLD'];

    /**
     * Large Cap Crypto (Top 5 by market cap)
     * - Massive liquidity
     * - Institutional participation
     * - Lower volatility than mid/small caps
     */
    private static readonly LARGE_CAPS = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL'];

    /**
     * Mid Cap Crypto (Top 6-30)
     * - Good liquidity
     * - Mix of retail and institutional
     * - Moderate volatility
     */
    private static readonly MID_CAPS = [
        'XRP', 'ADA', 'AVAX', 'DOGE', 'DOT', 'MATIC', 'SHIB', 'LTC',
        'UNI', 'LINK', 'ATOM', 'ETC', 'XLM', 'NEAR', 'ALGO', 'FIL',
        'VET', 'SAND', 'MANA', 'AXS', 'THETA', 'ICP', 'FTM', 'HBAR',
        'EOS', 'AAVE', 'GRT', 'MKR', 'SNX', 'COMP'
    ];

    /**
     * Meme Coins - High volatility, sentiment-driven
     * Require extreme volume for valid signals
     */
    private static readonly MEMES = [
        'DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BONK', 'WIF', 'BOME',
        'DOGS', 'TURBO', 'MYRO', 'NEIRO', '1000SATS', 'ORDI',
        'BABYDOGE', 'MOODENG', 'PNUT', 'ACT', 'POPCAT', 'SLERF',
        'BRETT', 'GOAT', 'MOG', 'SPX', 'HIPPO', 'LADYS',
        'CHILLGUY', 'LUCE', 'PENGU'
    ];

    /**
     * Asset profiles with specific RVOL requirements
     */
    private static readonly PROFILES: Record<AssetClass, AssetProfile> = {
        'COMMODITY': {
            class: 'COMMODITY',
            expectedRVOLRange: { min: 0.3, max: 1.5 },
            minRVOLForSignal: 0.8,  // Very low - gold moves slowly
            rvolBonusThreshold: 1.2,
            description: 'Professional commodities with institutional flows'
        },
        'LARGE_CAP': {
            class: 'LARGE_CAP',
            expectedRVOLRange: { min: 0.5, max: 2.0 },
            minRVOLForSignal: 1.0,  // Moderate
            rvolBonusThreshold: 1.5,
            description: 'Blue-chip crypto with deep liquidity'
        },
        'MID_CAP': {
            class: 'MID_CAP',
            expectedRVOLRange: { min: 0.7, max: 2.5 },
            minRVOLForSignal: 1.2,  // Slightly higher
            rvolBonusThreshold: 1.8,
            description: 'Established projects with good liquidity'
        },
        'SMALL_CAP': {
            class: 'SMALL_CAP',
            expectedRVOLRange: { min: 0.8, max: 3.0 },
            minRVOLForSignal: 1.5,
            rvolBonusThreshold: 2.0,
            description: 'Emerging projects with variable liquidity'
        },
        'MEME': {
            class: 'MEME',
            expectedRVOLRange: { min: 1.0, max: 5.0 },
            minRVOLForSignal: 1.8,  // High - memes need hype
            rvolBonusThreshold: 2.5,
            description: 'Sentiment-driven assets requiring volume confirmation'
        }
    };

    /**
     * Classify an asset based on its symbol
     */
    static classify(symbol: string): AssetProfile {
        // Remove trading pair suffixes (e.g., BTC/USDT -> BTC)
        const cleanSymbol = symbol.replace(/\/.*$/, '').replace('USDT', '').replace('USD', '').toUpperCase();

        // Check commodities first (highest priority)
        if (this.COMMODITIES.some(c => cleanSymbol.includes(c))) {
            return this.PROFILES.COMMODITY;
        }

        // Check memes (need to check before large caps since DOGE could match both)
        if (this.MEMES.includes(cleanSymbol)) {
            return this.PROFILES.MEME;
        }

        // Check large caps
        if (this.LARGE_CAPS.includes(cleanSymbol)) {
            return this.PROFILES.LARGE_CAP;
        }

        // Check mid caps
        if (this.MID_CAPS.includes(cleanSymbol)) {
            return this.PROFILES.MID_CAP;
        }

        // Default to small cap for unknown assets
        return this.PROFILES.SMALL_CAP;
    }

    /**
     * Get RVOL scoring adjustment based on asset class and current RVOL
     * Returns a score adjustment (positive or negative)
     */
    /**
     * Get RVOL scoring adjustment based on asset class, current RVOL, and Market Regime
     * Returns a score adjustment (positive or negative)
     */
    static getRVOLScoreAdjustment(
        symbol: string,
        rvol: number,
        marketRegime?: 'BULL' | 'BEAR' | 'RANGE_BOUND' | 'NEUTRAL',
        volatility?: number
    ): number {
        const profile = this.classify(symbol);

        // REGIME-BASED MULTIPLIER
        // Adjust thresholds based on market conditions
        let regimeMultiplier = 1.0;

        if (marketRegime === 'RANGE_BOUND') {
            // Lateral market: lower volume is expected, so we lower the bar
            regimeMultiplier = 0.8; // -20% requirement
        } else if (marketRegime === 'BULL' && volatility && volatility > 0.05) {
            // High volatility Bull market: requires stronger confirmation
            regimeMultiplier = 1.2; // +20% requirement
        } else if (marketRegime === 'BEAR') {
            // Bear market: low volume is common, but high volume is suspicious (capitulation?)
            // We keep it standard or slightly lower
            regimeMultiplier = 0.9;
        }

        // Apply multiplier to thresholds
        const minRVOL = profile.minRVOLForSignal * regimeMultiplier;
        const bonusRVOL = profile.rvolBonusThreshold * regimeMultiplier;

        // Extreme volume surge (very bullish)
        if (rvol >= bonusRVOL * 1.5) return +15;

        // High volume confirmation (bullish)
        // High volume confirmation (bullish)
        if (rvol >= bonusRVOL) return +10;

        // Above average volume (positive)
        // Above average volume (positive)
        if (rvol >= minRVOL * 1.2) return +5;

        // Normal volume (neutral)
        // Normal volume (neutral)
        if (rvol >= minRVOL) return 0;

        // Below normal but not critical (slight penalty)
        // Below normal but not critical (slight penalty)
        if (rvol >= minRVOL * 0.7) return -5;

        // Low volume (penalty)
        // Low volume (penalty)
        if (rvol >= minRVOL * 0.5) return -10;

        // Dead volume (severe penalty)
        return -15;
    }

    /**
     * Determine if RVOL is critically low (hard filter failure)
     * This is the ONLY place where we hard-block signals based on RVOL
     */
    static isRVOLCriticallyLow(symbol: string, rvol: number): boolean {
        const profile = this.classify(symbol);

        // Hard filter: Must have at least 50% of minimum expected RVOL
        // This prevents dead/manipulated markets but allows normal conditions
        return rvol < (profile.minRVOLForSignal * 0.5);
    }

    /**
     * Get human-readable explanation of RVOL status
     */
    static getRVOLStatusMessage(symbol: string, rvol: number): string {
        const profile = this.classify(symbol);
        const adjustment = this.getRVOLScoreAdjustment(symbol, rvol);

        if (rvol >= profile.rvolBonusThreshold * 1.5) {
            return `Volume Surge (${rvol.toFixed(2)}x) - Extreme conviction [+15 score]`;
        }
        if (rvol >= profile.rvolBonusThreshold) {
            return `High Volume (${rvol.toFixed(2)}x) - Strong confirmation [+10 score]`;
        }
        if (rvol >= profile.minRVOLForSignal) {
            return `Normal Volume (${rvol.toFixed(2)}x) - Acceptable [${adjustment >= 0 ? '+' : ''}${adjustment} score]`;
        }
        if (rvol >= profile.minRVOLForSignal * 0.5) {
            return `Low Volume (${rvol.toFixed(2)}x) - Penalty applied [${adjustment} score]`;
        }
        return `Dead Volume (${rvol.toFixed(2)}x) - Critically low`;
    }
}
