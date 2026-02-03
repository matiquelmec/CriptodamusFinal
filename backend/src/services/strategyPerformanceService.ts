import { createClient } from '@supabase/supabase-js';

export interface StrategyWeight {
    strategy: string;
    winRate: number;
    weight: number; // 0.8 to 1.2
}

class StrategyPerformanceService {
    private supabase: any = null;
    private cachedWeights: Record<string, StrategyWeight> = {};
    private lastUpdate: number = 0;

    constructor() {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_KEY;
        if (url && key) {
            this.supabase = createClient(url, key);
        }
    }

    /**
     * Get dynamic weight for a specific strategy based on recent performance.
     */
    public async getStrategyWeight(strategyName: string): Promise<number> {
        // Update cache every 1 hour
        if (Date.now() - this.lastUpdate > 3600000) {
            await this.refreshWeights();
        }

        return this.cachedWeights[strategyName]?.weight || 1.0;
    }

    public async refreshWeights() {
        if (!this.supabase) return;

        try {
            console.log("🧠 [MetaScoring] Refreshing Strategy Performance Weights...");

            // Query last 100 closed signals
            const { data, error } = await this.supabase
                .from('signals_audit')
                .select('strategy, status')
                .in('status', ['WIN', 'LOSS'])
                .order('closed_at', { ascending: false })
                .limit(100);

            if (error || !data) return;

            const stats: Record<string, { wins: number, total: number }> = {};

            data.forEach((sig: any) => {
                const strat = sig.strategy || 'UNKNOWN';
                if (!stats[strat]) stats[strat] = { wins: 0, total: 0 };
                stats[strat].total++;
                if (sig.status === 'WIN') stats[strat].wins++;
            });

            const newWeights: Record<string, StrategyWeight> = {};

            Object.keys(stats).forEach(strat => {
                const winRate = stats[strat].wins / stats[strat].total;

                // Dynamic Weight Logic:
                // WinRate 50% -> Weight 1.0
                // WinRate 70% -> Weight 1.2 (Boost)
                // WinRate 30% -> Weight 0.8 (Penalty)
                let weight = 1.0 + (winRate - 0.5);
                weight = Math.max(0.7, Math.min(1.3, weight)); // Cap between 0.7x and 1.3x

                newWeights[strat] = {
                    strategy: strat,
                    winRate,
                    weight
                };

                console.log(`🧠 [MetaScoring] Strategy ${strat}: WR ${(winRate * 100).toFixed(1)}% -> Weight x${weight.toFixed(2)}`);
            });

            this.cachedWeights = newWeights;
            this.lastUpdate = Date.now();

        } catch (e) {
            console.error("❌ [MetaScoring] Error updating weights:", e);
        }
    }

    public getAllWeights() {
        return this.cachedWeights;
    }
}

export const strategyPerformanceService = new StrategyPerformanceService();
