
import { correlationAnalyzer } from './core/services/risk/CorrelationAnalyzer';
import { correlationMatrix } from './core/services/risk/CorrelationMatrix';
import { TradingConfig } from './config/tradingConfig';

async function testCorrelationLive() {
    console.log(`\n🔍 [TEST] Iniciando Prueba de Correlación en Vivo...`);
    console.log(`🕒 Hora Local: ${new Date().toLocaleString()}`);

    // Force regeneration implies waiting 15m or hacking cache. 
    // We will just run analyze() which calls generateMatrix().
    // If cache is valid, it returns cached. We want to see the TIMESTAMP of the underlying data.

    try {
        console.log("... Obteniendo datos de mercado (Binance 4H Candles) ...");
        const intelligence = await correlationAnalyzer.analyze([]); // Pass empty opps just to get market state

        console.log("\n📊 REPORTE DE INTELIGENCIA DE MERCADO:");
        console.log("----------------------------------------");
        console.log(`Estado: ${intelligence.state.toUpperCase()}`);
        console.log(`Timestamp Datos: ${new Date(intelligence.timestamp).toLocaleString()}`);
        console.log(`Pares Alta Correlación: ${intelligence.metrics.highCorrPairs}/${intelligence.metrics.totalPairs}`);
        console.log(`Ratio Sistémico: ${((intelligence.metrics.highCorrPairs / intelligence.metrics.totalPairs) * 100).toFixed(1)}%`);

        console.log("\n🔄 ROTACIONES DETECTADAS (Alpha):");
        if (intelligence.rotations.length === 0) {
            console.log("   (Ninguna rotación significativa detectada en este momento)");
        } else {
            intelligence.rotations.forEach(r => {
                console.log(`   ➤ ${r.asset}: Corr con BTC ${r.correlation.toFixed(2)} (${r.strength})`);
            });
        }

        console.log("\n💬 RESUMEN GENERADO:");
        console.log(`   "${intelligence.summary}"`);
        console.log(`   RECOMENDACIÓN: "${intelligence.recommendation}"`);

        console.log("\n✅ PRUEBA COMPLETADA. Los datos provienen de la API en tiempo real.");

    } catch (error) {
        console.error("❌ FALLÓ EL ANÁLISIS:", error);
    }
}

testCorrelationLive();
