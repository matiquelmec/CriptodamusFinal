
import dotenv from 'dotenv';
import path from 'path';
import { IndicatorCalculator } from './core/services/engine/pipeline/IndicatorCalculator';
import { detectMarketRegime } from './core/services/marketRegimeDetector';
import { selectStrategies } from './core/services/strategySelector';
import { fetchCandles } from './core/services/api/binanceApi';
import { TradingConfig } from './core/config/tradingConfig';

// Cargar variables de entorno
dotenv.config({ path: './backend/.env' });

async function runRegimeAudit(symbol: string = 'BTC/USDT', interval: string = '15m') {
    console.log(`\n🔍 [AUDIT] Iniciando Auditoría de Régimen para ${symbol} (${interval})`);
    console.log("============================================================");

    try {
        // 1. Fetch Data
        console.log("📡 Descargando velas de Binance...");
        const cleanId = symbol.replace('/', '');
        const candles = await fetchCandles(cleanId, interval); // "15m" default for Tournament

        if (candles.length < 200) {
            console.error("❌ Error: Insuficientes velas (<200).");
            return;
        }

        const lastCandle = candles[candles.length - 1];
        console.log(`✅ Datos recibidos: ${candles.length} velas.`);
        console.log(`🕒 Última Vela: ${new Date(lastCandle.timestamp).toLocaleString()} | Close: $${lastCandle.close}`);

        // 2. Calculate Indicators
        console.log("\n🧮 Calculando Indicadores Técnicos...");
        const indicators = IndicatorCalculator.compute(symbol, candles);

        console.log(`   🔸 ADX: ${indicators.adx.toFixed(2)}`);
        console.log(`   🔸 RSI: ${indicators.rsi.toFixed(2)}`);
        console.log(`   🔸 Bollinger BW: ${indicators.bollinger.bandwidth.toFixed(2)}%`);
        console.log(`   🔸 ATR: ${indicators.atr.toFixed(2)}`);
        console.log(`   🔸 EMA Alignment: ${indicators.ema20 > indicators.ema50 ? 'BULLISH' : 'BEARISH'}`);

        // 3. Detect Regime
        console.log("\n🤖 Detectando Régimen de Mercado...");
        const regimeResult = detectMarketRegime(indicators);

        console.log(`   🏷️  RÉGIMEN: ${regimeResult.regime}`);
        // console.log(`   ℹ️  Justificación: ${regimeResult.reasoning}`); // Too long
        console.log(`   📊 Confianza: ${regimeResult.confidence}%`);

        // Check Logic Validity
        // console.log("\n🔎 Análisis de Criterios RANGO (RANGING):");
        const isLowADX = indicators.adx < 20;
        const isCompressed = indicators.bollinger.bandwidth < 3.0;

        console.log(`   ADX < 20? ${isLowADX} (${indicators.adx.toFixed(2)})`);
        console.log(`   BW < 3.0? ${isCompressed} (${indicators.bollinger.bandwidth.toFixed(2)})`);

        if (regimeResult.regime !== 'RANGING' && (!isLowADX || !isCompressed)) {
            console.log("\n💡 CONCLUSIÓN TÉCNICA:");
            console.log("   El sistema NO ve Rango porque:");
            if (!isLowADX) console.log(`   - La tendencia (ADX) es demasiado fuerte (${indicators.adx.toFixed(1)} > 20).`);
            if (!isCompressed) console.log(`   - La volatilidad (Bandas) es demasiado alta (${indicators.bollinger.bandwidth.toFixed(2)} > 3.0).`);
        }

        // 4. Select Strategies
        console.log("\n♟️  Estrategias Seleccionadas:");
        const selection = selectStrategies(regimeResult);

        selection.activeStrategies.forEach(s => {
            console.log(`   ✅ ${s.name} (${(s.weight * 100).toFixed(0)}%) - ${s.reason}`);
        });

    } catch (e: any) {
        console.error("❌ CRITICAL ERROR:", e.message);
        console.error(e);
    }
}

// Ejecutar
runRegimeAudit('BTC/USDT', '15m');
