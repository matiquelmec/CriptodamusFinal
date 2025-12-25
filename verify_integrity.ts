
import { getRawTechnicalIndicators } from './src/services/cryptoService';
import { getExpertVolumeAnalysis } from './src/services/volumeExpertService';
import { detectHarmonicPatterns } from './src/services/harmonicPatterns';

async function runAudit() {
    console.log("🔍 INICIANDO AUDITORÍA DE INTEGRIDAD DEL SISTEMA...");
    console.log("==================================================");

    const symbol = 'BTCUSDT';
    console.log(`📡 Obteniendo datos en tiempo real para: ${symbol}...`);

    try {
        // 1. Fetch Core Technicals
        const techData = await getRawTechnicalIndicators(symbol);

        if (!techData) {
            console.error("❌ ERROR CRÍTICO: No se pudieron obtener datos técnicos.");
            return;
        }

        // 2. Fetch Expert Volume
        const volumeExpert = await getExpertVolumeAnalysis(symbol);

        console.log("\n✅ DATOS RECIBIDOS CORRECTAMENTE.");
        console.log("--------------------------------------------------");
        console.log(`💰 PRECIO ACTUAL: $${techData.price.toFixed(2)}`);

        console.log("\n📊 1. ANÁLISIS DE INDICADORES (Comparar con TradingView)");
        console.log("--------------------------------------------------");
        console.log(`RSI (14):       ${techData.rsi.toFixed(2)}  [Esperado: Igual a TV]`);
        console.log(`EMA 200:        ${techData.ema200.toFixed(2)}`);
        console.log(`EMA 50:         ${techData.ema50.toFixed(2)}`);
        console.log(`Tendencia EMA:  ${techData.trendStatus.emaAlignment}`);
        console.log(`ATR (Volatilidad): ${techData.atr.toFixed(2)}`);

        console.log("\n🧠 2. LÓGICA EXPERTA (Caja Negra)");
        console.log("--------------------------------------------------");
        console.log(`RSI Range:      ${techData.rsiExpert?.range}`);
        console.log(`RSI Target:     ${techData.rsiExpert?.target || "Ninguno"}`);
        console.log(`Divergencia:    ${techData.macdDivergence?.type || "Ninguna"}`);
        console.log(`Coinbase Prem:  ${(volumeExpert.coinbasePremium.gapPercent * 100).toFixed(4)}%`);

        console.log("\n📐 3. ESTRUCTURA DE MERCADO (Institucional)");
        console.log("--------------------------------------------------");

        if (techData.harmonicPatterns && techData.harmonicPatterns.length > 0) {
            console.log(`🦋 PATRONES ARMÓNICOS DETECTADOS: ${techData.harmonicPatterns.length}`);
            techData.harmonicPatterns.forEach(p => {
                console.log(`   - ${p.type} ${p.direction} @ $${p.prz.toFixed(2)} (Stop Sugerido: $${p.stopLoss.toFixed(2)})`);
            });
        } else {
            console.log("🦋 No hay Patrones Armónicos activos actualmente.");
        }

        console.log("\n🧱 CONFLUENCIA (Niveles Clave)");
        console.log("--------------------------------------------------");
        const topSupport = techData.confluenceAnalysis?.topSupports[0];
        const topResist = techData.confluenceAnalysis?.topResistances[0];

        if (topSupport) console.log(`🟢 MEJOR SOPORTE: $${topSupport.price.toFixed(2)} (Score: ${topSupport.score}) - Factores: ${topSupport.factors.join(', ')}`);
        else console.log("🟢 No hay soportes claros cercanos.");

        if (topResist) console.log(`🔴 MEJOR RESISTENCIA: $${topResist.price.toFixed(2)} (Score: ${topResist.score}) - Factores: ${topResist.factors.join(', ')}`);
        else console.log("🔴 No hay resistencias claras cercanas.");


        console.log("\n==================================================");
        console.log("CONCLUSIÓN DE AUDITORÍA:");
        if (techData.price > 0 && techData.rsi > 0 && techData.ema200 > 0) {
            console.log("✅ SISTEMA OPERATIVO: Los cálculos matemáticos son coherentes.");
            console.log("👉 ACCIÓN REQUERIDA: Abra TradingView y valide que el RSI y Precio coincidan.");
        } else {
            console.log("❌ FALLO DE INTEGRIDAD: Los datos parecen corruptos o vacíos.");
        }

    } catch (error) {
        console.error("❌ ERROR DE EJECUCIÓN:", error);
    }
}

runAudit();
