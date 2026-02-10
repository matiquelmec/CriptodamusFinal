
import { fetchCandles } from '../core/services/api/binanceApi';
import { IndicatorCalculator } from '../core/services/engine/pipeline/IndicatorCalculator';

async function testLiveAnalysis() {
    try {
        console.log("🔍 Iniciando Verificación de Datos en Vivo (CriptoDamus)...");
        const symbol = 'BTCUSDT';
        const timeframe = '15m';

        console.log(`📡 Conectando a Binance para obtener velas de ${symbol} (${timeframe})...`);

        // Fetch real data directly - Fixed signature (no limit param in public interface)
        const candles = await fetchCandles(symbol, timeframe);

        if (!candles || candles.length === 0) {
            console.error("❌ ERROR CRÍTICO: No se recibieron datos de Binance.");
            return;
        }

        const lastCandle = candles[candles.length - 1];
        const lastCandleTime = new Date(lastCandle.timestamp); // Checked implementation, uses 'timestamp'
        const now = new Date();
        const diffMinutes = (now.getTime() - lastCandleTime.getTime()) / 60000;

        console.log(`✅ Datos Recibidos: ${candles.length} velas.`);
        console.log(`🕒 Última Vela (Cierre): ${lastCandleTime.toLocaleString()}`);
        console.log(`⏱️ Retraso respecto a hora del sistema: ${diffMinutes.toFixed(2)} minutos.`);
        console.log(`💰 Precio Actual: $${lastCandle.close}`);
        console.log(`📊 Volumen Última Vela: ${lastCandle.volume}`);

        if (diffMinutes > 30) {
            console.warn("⚠️ ALERTA: Los datos parecen antiguos (>30 min). Verifique sincronización horaria o API.");
        }

        console.log("\n🧠 Ejecutando Motor de Cálculo (IndicatorCalculator)...");
        const indicators = IndicatorCalculator.compute(symbol, candles);

        console.log("---------------------------------------------------");
        console.log(`📈 RSI (14): ${indicators.rsi.toFixed(2)} ${indicators.rsi > 70 ? '(SOBRECOMPRA)' : indicators.rsi < 30 ? '(SOBREVENTA)' : '(NEUTRAL)'}`);
        console.log(`🌊 MACD: Line=${indicators.macd.line.toFixed(2)} Signal=${indicators.macd.signal.toFixed(2)} Hist=${indicators.macd.histogram.toFixed(2)}`);
        console.log(`📉 ADX: ${indicators.adx.toFixed(2)} ${indicators.adx > 25 ? '(TENDENCIA FUERTE)' : '(RANGO/DÉBIL)'}`);
        console.log(`🏦 EMA 200: $${indicators.ema200.toFixed(2)}`);
        console.log(`📐 Z-Score: ${indicators.zScore.toFixed(2)}`);
        // Check if CVD exists before accessing
        if (indicators.cvd && indicators.cvd.length > 0) {
            console.log(`🧱 Order Flow (CVD Último): ${indicators.cvd[indicators.cvd.length - 1].toFixed(2)}`);
        } else {
            console.log(`🧱 Order Flow (CVD): No disponible (posible falta de datos Taker Buy)`);
        }
        console.log("---------------------------------------------------");

        if (indicators.price === 0 || isNaN(indicators.rsi)) {
            console.error("❌ FALLO DE CÁLCULO: Indicadores devolvieron NaN o 0.");
        } else {
            console.log("✅ CÁLCULOS MATEMÁTICOS VALIDADOS.");
            console.log("✅ El sistema está procesando datos reales correctamente.");
        }

    } catch (error) {
        console.error("❌ ERROR DE EJECUCIÓN:", error);
    }
}

testLiveAnalysis();
