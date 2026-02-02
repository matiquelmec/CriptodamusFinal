
/**
 * DATA INTEGRITY GUARD (DIG)
 * 
 * Centralized service to calculate "System Confidence" based on data freshness and reliability.
 * "Si hay duda, no hay duda."
 */

export interface IntegrityReport {
    score: number; // 0.0 to 1.0 (1.0 = All Primary sources active & fresh)
    status: 'OPTIMAL' | 'DEGRADED' | 'HALTED' | 'DOUBTFUL';
    staleSources: string[];
    missingCritical: string[];
}

export class DataIntegrityGuard {

    /**
     * Aggregates integrity across all subsystems to determine if signal generation is safe.
     */
    static async getSystemIntegrityReport(context: {
        candles: any[],
        globalData: any,
        newsSentiment: any,
        economicShield: any
    }): Promise<IntegrityReport> {
        const staleSources: string[] = [];
        const missingCritical: string[] = [];
        let score = 1.0;

        // 1. RAW CANDLE INTEGRITY (The Foundation)
        if (!context.candles || context.candles.length < 200) {
            score -= 0.5;
            missingCritical.push('CANDLES_INSUFFICIENT');
        } else {
            const lastCandle = context.candles[context.candles.length - 1];
            const msSinceLast = Date.now() - lastCandle.timestamp;
            if (msSinceLast > 30 * 60 * 1000) { // > 30 mins stale
                score -= 0.4;
                staleSources.push('CEX_CANDLES_STALE');
            }
        }

        // 2. GLOBAL MARKET INTEGRITY (Gold, DXY)
        // If Gold Price is 0 or 2000 (default fallback), it's doubtful.
        if (context.globalData.goldPrice === 0 || context.globalData.goldPrice === 2000) {
            score -= 0.15;
            staleSources.push('GLOBAL_GOLD_DATA');
        }
        if (context.globalData.btcDominance === 55) { // Hardcoded default check
            score -= 0.1;
            staleSources.push('GLOBAL_DOMINANCE_DATA');
        }

        // 3. ECONOMIC INTEGRITY
        if (context.economicShield.reason === 'Calendar Unreachable') {
            score -= 0.2; // High risk of missing a major CPI/FOMC event
            staleSources.push('ECONOMIC_CALENDAR');
        }

        // 4. NEWS/SENTIMENT INTEGRITY
        if (context.newsSentiment.summary === "Market data unavailable." || context.newsSentiment.headlineCount === 0) {
            score -= 0.15;
            staleSources.push('AI_SENTIMENT_DATA');
        }

        // FINAL EVALUATION
        score = Math.max(0, score);
        let status: IntegrityReport['status'] = 'OPTIMAL';

        if (score < 0.5 || missingCritical.length > 0) status = 'HALTED';
        else if (score < 0.7) status = 'DEGRADED';
        else if (score < 0.9) status = 'DOUBTFUL';

        return {
            score,
            status,
            staleSources,
            missingCritical
        };
    }
}
