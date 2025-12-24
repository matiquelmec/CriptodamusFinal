
import { scanMarketOpportunities } from './cryptoService';
import { TradingStyle } from '../types';

async function runScannerAudit() {
    console.log("🔍 INICIANDO AUDITORÍA DEL ESCÁNER DE OPORTUNIDADES...");
    console.log("======================================================");

    try {
        console.log("🚀 Ejecutando scanMarketOpportunities('SCALP_AGRESSIVE')...");
        // Scan limited set for speed
        const opportunities = await scanMarketOpportunities('SCALP_AGRESSIVE');

        if (opportunities.length === 0) {
            console.log("⚠️ El escáner no encontró oportunidades (esto es normal si el mercado está difícil o filtro de volumen actuando).");
            console.log("   Intentando modo 'MEME_SCALP' para forzar resultados...");
            const memeOpp = await scanMarketOpportunities('MEME_SCALP');
            if (memeOpp.length > 0) processResult(memeOpp);
            else console.log("❌ No se encontraron oportunidades en ningún modo para auditar.");
            return;
        }

        processResult(opportunities);

    } catch (error) {
        console.error("❌ ERROR CRÍTICO EN ESCÁNER:", error);
    }
}

function processResult(opportunities: any[]) {
    console.log(`✅ Oportunidades Encontradas: ${opportunities.length}`);

    // Pick the best one
    const bestOpp = opportunities[0];
    console.log(`\n🏆 MEJOR OPORTUNIDAD: ${bestOpp.symbol} (Score: ${bestOpp.confidenceScore})`);

    console.log("\n📊 1. DATOS DE INDICADORES EN ESCÁNER");
    console.log("---------------------------------------");
    console.log(`RSI:            ${bestOpp.metrics?.rsi}`);
    console.log(`RVOL:           ${bestOpp.metrics?.rvol}`);
    console.log(`VWAP Dist:      ${bestOpp.metrics?.vwapDist}%`);
    console.log(`Z-Score:        ${bestOpp.metrics?.zScore ?? "FALTA"}`);
    console.log(`EMA Slope:      ${bestOpp.metrics?.emaSlope ?? "FALTA"}`);

    console.log("\n🧠 2. LÓGICA EXPERTA");
    console.log("---------------------------------------");
    console.log(`Squeeze:        ${bestOpp.metrics?.isSqueeze}`);
    console.log(`MACD Divergencia: ${bestOpp.metrics?.macdDivergence || "Ninguna"}`);
    // Check for RSI Divergence (Suspected Missing)
    console.log(`RSI Divergencia:  ${(bestOpp.metrics as any)?.rsiDivergence || "NO IMPLEMENTADO EN INTERFACE"}`);

    console.log(`Expert Volume:  ${bestOpp.metrics?.volumeExpert ? "✅ PRESENTE" : "❌ AUSENTE (Opcional, depende de API)"}`);

    console.log("\n📐 3. ESTRUCTURA (Harmonics)");
    console.log("---------------------------------------");
    if (bestOpp.harmonicPatterns && bestOpp.harmonicPatterns.length > 0) {
        console.log(`✅ Patrones Armónicos: ${bestOpp.harmonicPatterns.length}`);
        console.log(`   - Tipo: ${bestOpp.harmonicPatterns[0].type}`);
    } else {
        console.log("⚠️ No tiene patrones armónicos (Normal si no hay, pero verificar si array existe)");
        console.log(`   - Array existe? ${Array.isArray(bestOpp.harmonicPatterns) ? "SI" : "NO"}`);
    }

    console.log("\n🧱 4. RISK MANAGEMENT (DCA Plan)");
    console.log("---------------------------------------");
    if (bestOpp.dcaPlan) {
        console.log("✅ DCA Plan Generado");
        console.log(`   - Stop Loss: ${bestOpp.stopLoss}`);
        console.log(`   - Entries:   ${bestOpp.dcaPlan.entries.length}`);
    } else {
        console.log("❌ DCA Plan FALTANTE");
    }

    console.log("\n======================================================");
    if (bestOpp.metrics?.zScore !== undefined && bestOpp.dcaPlan) {
        console.log("✅ AUDITORÍA DE ESCÁNER: APROBADA (La mayoría de datos críticos presentes)");
        console.log("👉 NOTA: Verificar si falta RSI Divergence.");
    } else {
        console.log("❌ AUDITORÍA DE ESCÁNER: FALLÓ (Faltan datos críticos)");
    }
}

runScannerAudit();
