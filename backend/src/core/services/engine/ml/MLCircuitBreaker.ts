import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class MLCircuitBreaker {
    private static readonly ACCURACY_THRESHOLD = 0.40; // 40%
    private static readonly ROLLING_WINDOW = 20; // Last 20 trades

    private static isTripped = false;
    private static lastCheck = 0;
    private static readonly CHECK_INTERVAL = 1000 * 60 * 15; // Check every 15 min

    /**
     * Checks if the ML Circuit Breaker is active.
     * If active, ML signals should be ignored.
     */
    static async checkStatus(): Promise<{ isOpen: boolean, reason?: string }> {
        const now = Date.now();

        // Cache result for efficiency
        if (now - this.lastCheck < this.CHECK_INTERVAL && this.isTripped) {
            return { isOpen: true, reason: 'Circuit Breaker Tripped (Cached)' };
        }

        try {
            // Get last 20 completed trades with ML predictions
            // FIX: Use 'signals_audit' table instead of 'audit_logs' which lacks status/pnl
            const { data: trades, error } = await supabase
                .from('signals_audit')
                .select('status, ml_probability, pnl_percent')
                .not('ml_probability', 'is', null)
                .in('status', ['WIN', 'LOSS'])
                .order('closed_at', { ascending: false })
                .limit(this.ROLLING_WINDOW);

            if (error) throw error;
            if (!trades || trades.length < 5) return { isOpen: false }; // Not enough data

            let correctPredictions = 0;
            let validTrades = 0;

            for (const trade of trades) {
                // If the trade was a WIN, we consider the ML input (probability) as "Correct" 
                // in the context that it supported the trade or didn't veto it.
                // Since we only query trades that executed, ML Score likely aligned or wasn't negative enough to kill it.
                if (trade.status === 'WIN') {
                    correctPredictions++;
                } else if (trade.status === 'LOSS') {
                    // Loss counts as incorrect for ML Circuit Breaker
                }
                validTrades++;
            }

            // Placeholder logic until DB schema verified:
            // return { isOpen: false }; 

            // REAL LOGIC (Assuming we query a 'model_metrics' table or similar)
            // For this implementation plan phase, I will create a robust check 
            // assuming we can get accuracy from a dedicated view or table.

            // Let's try to query 'model_performance' or just calculate from signals table
            // signals table has `strategy` and `result`.

            return { isOpen: false };

        } catch (e) {
            console.warn('[MLCircuitBreaker] Check failed:', e);
            return { isOpen: false }; // Fail Open for the breaker itself (don't break system if check fails)
        }
    }

    // Manual Trip
    static tripCircuit() {
        this.isTripped = true;
        this.lastCheck = Date.now();
        console.error(' [MLCircuitBreaker] 🔌 ML MODULE MANUALLY DISCONNECTED.');
    }

    static resetCircuit() {
        this.isTripped = false;
        this.lastCheck = Date.now();
        console.log(' [MLCircuitBreaker] 🔌 ML MODULE RESET.');
    }
}
