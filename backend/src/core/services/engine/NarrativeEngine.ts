import { SentimentAnalysis } from '../../../services/newsService';
import { TechnicalIndicators } from '../../types';
import { systemAlerts } from '../../../services/systemAlertService';

/**
 * NARRATIVE ENGINE (Phase 12)
 * Detects "Narrative Divergence" where price action contradicts news sentiment.
 * This is the signature of Institutional Absorption or Distribution.
 */
export const checkNarrativeDivergence = (
    sentiment: SentimentAnalysis | null,
    indicators: TechnicalIndicators
): { score: number; reason: string | null } => {

    if (!sentiment || !indicators) return { score: 0, reason: null };

    const { score: sScore, sentiment: sType } = sentiment;
    const { rvol, price, ema200, ema50, rsi } = indicators;

    // THRESHOLDS (Elite Configuration)
    const FEAR_THRESHOLD = -0.4;
    const EUPHORIA_THRESHOLD = 0.4;
    const HIGH_VOLUME_RVOL = 1.2; // 20% above average volume required to prove "Effort"

    // 1. BULLISH ABSORPTION (The "Bear Trap")
    // Context: News is BAD (Fear), but Price is holding Support with HIGH VOLUME.
    // Meaning: Institutions are buying the panic.
    if (sScore <= FEAR_THRESHOLD) {
        // Condition A: Technical Support (Above Long Term EMA200 or Short Term EMA50)
        const holdingSupport = price > ema200 || price > ema50;

        // Condition B: Not Catching a Knife (RSI not dead)
        const healthyMomentum = rsi > 35;

        // Condition C: The Lie Detector (Volume)
        // If news is bad and price holds, we need VOLUME to prove limits are absorbing market sells.
        const highEffort = rvol >= HIGH_VOLUME_RVOL;

        if (holdingSupport && healthyMomentum && highEffort) {
            const reason = `💎 NARRATIVE DIVERGENCE: Institutional Absorption detected. Bad News (${sScore.toFixed(2)}) + Support Hold + High Vol (RVOL ${rvol.toFixed(1)}).`;
            // console.log(`[NarrativeEngine] ${reason}`);
            return { score: 25, reason };
        }
    }

    // 2. BEARISH DISTRIBUTION (The "Bull Trap")
    // Context: News is GOOD (Euphoria), but Price is failing Resistance with HIGH VOLUME.
    // Meaning: Institutions are selling into the strength.
    if (sScore >= EUPHORIA_THRESHOLD) {
        // Condition A: Technical Weakness (Below Long Term EMA)
        const failingResistance = price < ema200;

        // Condition B: Momentum Exhaustion despite good news
        const exhaustedMomentum = rsi < 65;

        // Condition C: The Lie Detector (Volume)
        // Huge volume but price isn't flying? Someone is selling.
        const highEffort = rvol >= HIGH_VOLUME_RVOL;

        if (failingResistance && exhaustedMomentum && highEffort) {
            const reason = `⚠️ NARRATIVE DIVERGENCE: Institutional Distribution detected. Good News (${sScore.toFixed(2)}) + Price Lag + High Vol (RVOL ${rvol.toFixed(1)}).`;
            // console.log(`[NarrativeEngine] ${reason}`);
            return { score: -25, reason };
        }
    }

    return { score: 0, reason: null };
};
