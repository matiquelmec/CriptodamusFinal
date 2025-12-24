
import { getRawTechnicalIndicators, fetchCandles } from './cryptoService';
import { getExpertVolumeAnalysis } from './volumeExpertService';
import { detectHarmonicPatterns } from './harmonicPatterns';

async function runAudit() {
    console.log("🔍 INICIANDO AUDITORÍA DE INTEGRIDAD DEL SISTEMA (MODO DEBUG)...");
    console.log("==================================================");

    const symbol = 'BTCUSDT';
    console.log(`Paso 1: Verificando Conectividad API (fetchCandles) para ${symbol}...`);

    try {
        const candles = await fetchCandles(symbol, '1h');
        if (!candles || candles.length === 0) {
            console.error("❌ ERROR: fetchCandles devolvió 0 velas o null.");
            console.error("Posible causa: Bloqueo de IP, Sin conexión, o Símbolo inválido.");
            return;
        }
        console.log(`✅ Conectividad OK. Recibidas ${candles.length} velas.`);
        console.log(`   Última vela Close: $${candles[candles.length - 1].close}`);
    } catch (err) {
        console.error("❌ EXCEPCIÓN en fetchCandles:", err);
        return;
    }

    console.log(`\nPaso 2: Ejecutando Motor de Análisis Completo (getRawTechnicalIndicators)...`);

    try {
        // 1. Fetch Core Technicals
        const techData = await getRawTechnicalIndicators(symbol);

        if (!techData) {
            console.error("❌ ERROR CRÍTICO: getRawTechnicalIndicators devolvió NULL.");
            console.error("Esto implica un fallo en el cálculo interno (Math) o dependencias faltantes.");
            return;
        }

        // 2. Fetch Expert Volume
        console.log("Paso 3: Obteniendo Datos de Volumen Experto...");
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

        console.log("\n📉 1.1 DETALLE MACD (Trend & Momentum)");
        console.log(`   - Linea MACD:   ${techData.macd.line.toFixed(2)}`);
        console.log(`   - Señal:        ${techData.macd.signal.toFixed(2)}`);
        console.log(`   - Histograma:   ${techData.macd.histogram.toFixed(2)}`);

        console.log("\n🐚 1.2 NIVELES FIBONACCI (Institucional)");
        console.log(`   - 0.00 (Low):   $${techData.fibonacci.level0.toFixed(2)}`);
        console.log(`   - 0.382:        $${techData.fibonacci.level0_382.toFixed(2)}`);
        console.log(`   - 0.50 (Eq):    $${techData.fibonacci.level0_5.toFixed(2)}`);
        console.log(`   - 0.618 (Golden):$${techData.fibonacci.level0_618.toFixed(2)}`);
        console.log(`   - 0.786 (Deep): ${techData.fibonacci.level0_786 ? "$" + techData.fibonacci.level0_786.toFixed(2) : "N/A"}`);
        console.log(`   - 1.00 (High):  $${techData.fibonacci.level1.toFixed(2)}`);

        console.log("\n🔊 1.3 ANÁLISIS DE VOLUMEN");
        console.log(`   - Vol 24h:      ${(techData as any).volume}`); // Force access if strict type hiding it
        console.log(`   - RVOL (Rel):   ${techData.rvol.toFixed(2)}x (vs promedio 20p)`);
        console.log(`   - VWAP:         $${techData.vwap.toFixed(2)}`);


        console.log("\n🧠 2. LÓGICA EXPERTA (Caja Negra)");
        console.log("--------------------------------------------------");
        console.log(`RSI Range:      ${techData.rsiExpert?.range}`);
        console.log(`RSI Target:     ${techData.rsiExpert?.target || "Ninguno"}`);
        console.log(`Divergencia RSI: ${techData.rsiDivergence?.type || "Ninguna"}`);
        console.log(`Divergencia MACD:${techData.macdDivergence?.type || "Ninguna"}`);
        console.log(`Coinbase Prem:  ${(volumeExpert.coinbasePremium.gapPercent * 100).toFixed(4)}%`);
        console.log(`DCA Tier:       ${techData.tier || 'N/A'}`);

        console.log("\n📐 3. ESTRUCTURA DE MERCADO (Institucional)");
        console.log("--------------------------------------------------");

        if (techData.harmonicPatterns && techData.harmonicPatterns.length > 0) {
            console.log(`🦋 PATRONES ARMÓNICOS DETECTADOS: ${techData.harmonicPatterns.length}`);
            techData.harmonicPatterns.forEach(p => {
                console.log(`   - ${p.type} ${p.direction} @ $${p.prz.toFixed(2)} (Stop Estructural: $${p.stopLoss.toFixed(2)})`);
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
            console.log("👉 IMPORTANTE: Los datos mostrados son EN TIEMPO REAL de Binance.");
        } else {
            console.log("❌ FALLO DE INTEGRIDAD: Los datos parecen corruptos o vacíos.");
        }

    } catch (error) {
        console.error("❌ ERROR DE EJECUCIÓN GRAL:", error);
    }
}

runAudit();
