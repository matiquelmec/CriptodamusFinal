import { fetchCandles } from '../core/services/api/binanceApi';
import { IndicatorCalculator } from '../core/services/engine/pipeline/IndicatorCalculator';
import { systemAlerts } from '../services/systemAlertService';
import dotenv from 'dotenv';

dotenv.config();

async function runDiagnostic() {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
    console.log('🔍 [Diagnostic] Starting systematic integrity audit for:', symbols.join(', '));

    for (const symbol of symbols) {
        try {
            console.log(`\n--- Auditing ${symbol} ---`);
            const candles = await fetchCandles(symbol, '15m');

            if (!candles || candles.length < 150) {
                console.error(`❌ ${symbol}: Insufficient candles (${candles?.length || 0}/150)`);
                continue;
            }

            const lastCandle = candles[candles.length - 1];
            const now = Date.now();
            const staleness = (now - lastCandle.timestamp) / 60000;

            console.log(`📊 Freshness: ${staleness.toFixed(1)}m old`);
            if (staleness > 45) {
                console.warn(`⚠️ ${symbol}: Data is STALE (> 45m)`);
            }

            const indicators = IndicatorCalculator.compute(symbol, candles);

            if (indicators.invalidated) {
                console.error(`❌ ${symbol}: SHIELD REJECTED - ${indicators.technicalReasoning}`);
            } else {
                console.log(`✅ ${symbol}: SHIELD PASSED (Price: ${indicators.price}, RSI: ${indicators.rsi.toFixed(2)})`);
            }

        } catch (err: any) {
            console.error(`💥 ${symbol}: Audit crashed - ${err.message}`);
        }
    }
}

runDiagnostic();
