import { fetchCandles } from '../core/services/api/binanceApi';
import { IndicatorCalculator } from '../core/services/engine/pipeline/IndicatorCalculator';
import { systemAlerts } from '../services/systemAlertService';
import dotenv from 'dotenv';

dotenv.config();

async function runDiagnostic() {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
    console.log('🔍 [Diagnóstico] Iniciando auditoría sistemática de integridad para:', symbols.join(', '));

    for (const symbol of symbols) {
        try {
            console.log(`\n--- Auditando ${symbol} ---`);
            const candles = await fetchCandles(symbol, '15m');

            if (!candles || candles.length < 150) {
                console.error(`❌ ${symbol}: Velas insuficientes (${candles?.length || 0}/150)`);
                continue;
            }

            const lastCandle = candles[candles.length - 1];
            const now = Date.now();
            const staleness = (now - lastCandle.timestamp) / 60000;

            console.log(`📊 Frescura: ${staleness.toFixed(1)}m de antigüedad`);
            if (staleness > 45) {
                console.warn(`⚠️ ${symbol}: Datos OBSOLETOS (> 45m)`);
            }

            const indicators = IndicatorCalculator.compute(symbol, candles);

            if (indicators.invalidated) {
                console.error(`❌ ${symbol}: ESCUDO RECHAZADO - ${indicators.technicalReasoning}`);
            } else {
                console.log(`✅ ${symbol}: ESCUDO APROBADO (Precio: ${indicators.price}, RSI: ${indicators.rsi.toFixed(2)})`);
            }

        } catch (err: any) {
            console.error(`💥 ${symbol}: Auditoría falló - ${err.message}`);
        }
    }
}

runDiagnostic();
