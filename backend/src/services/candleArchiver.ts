import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars if not already loaded (Safety)
dotenv.config({ path: path.join(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("⚠️ [CandleArchiver] Supabase credentials missing. Archiving disabled.");
}

const supabase = (SUPABASE_URL && SUPABASE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

/**
 * Service to archive closed candles for the Eternal Memory (ML Training)
 */
export const candleArchiver = {
    /**
     * Archive the last closed candle from a candle array
     * @param symbol - e.g. "BTC/USDT"
     * @param interval - e.g. "15m"
     * @param candles - Array of candles { timestamp, open, high, low, close, volume }
     */
    async archive(symbol: string, interval: string, candles: any[]): Promise<void> {
        if (!supabase || candles.length < 2) return;

        // Target: The Last CLOSED Candle (Index -2)
        // Index -1 is the current OPEN candle.
        const closedCandle = candles[candles.length - 2];

        try {
            // Clean Symbol (Remove slash for DB consistency with training data 'BTCUSDT')
            const cleanSymbol = symbol.replace('/', '').toUpperCase();

            const payload = {
                symbol: cleanSymbol,
                timeframe: interval,
                timestamp: closedCandle.timestamp, // Unix ms
                open: closedCandle.open,
                high: closedCandle.high,
                low: closedCandle.low,
                close: closedCandle.close,
                volume: closedCandle.volume
            };

            // Upsert (Insert or Update if exists)
            const { error } = await supabase
                .from('market_candles')
                .upsert(payload, { onConflict: 'symbol, timeframe, timestamp' });

            if (error) {
                console.warn(`[CandleArchiver] Failed to save ${cleanSymbol}: ${error.message}`);
            } else {
                // Low verbosity success log (optional, maybe too noisy for 50 coins)
                // console.log(`[CandleArchiver] Saved ${cleanSymbol} [${new Date(closedCandle.timestamp).toLocaleTimeString()}]`);
            }
        } catch (e) {
            console.error(`[CandleArchiver] Error:`, e);
        }
    }
};
