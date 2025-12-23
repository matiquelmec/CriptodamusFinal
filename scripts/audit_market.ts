
import { scanMarketOpportunities } from '../services/cryptoService';

async function runAudit() {
    console.log("🔍 Iniciando Auditoría Manual de Mercado...");
    console.log("------------------------------------------------");

    try {
        // Ejecutamos el scanner en modo 'SCALP_AGRESSIVE' (que es el default)
        const opportunities = await scanMarketOpportunities('SCALP_AGRESSIVE');

        if (opportunities.length === 0) {
            console.log("❌ No se encontraron oportunidades que pasen el filtro final.");
            console.log("POSIBLES CAUSAS:");
            console.log("1. RVOL (< 0.5): El mercado puede estar muy lento (sin volumen).");
            console.log("2. Score (< 60): Las señales técnicas no tienen suficiente confluencia.");
            console.log("3. Elder's Rule: Contra-tendencia diaria (Daily Bearish vs Intraday Bullish).");
        } else {
            console.log(`✅ Se encontraron ${opportunities.length} oportunidades:`);
            opportunities.forEach(opp => {
                console.log(`\n💎 ${opp.symbol}`);
                console.log(`   Estrategia: ${opp.strategy}`);
                console.log(`   Confianza: ${opp.confidenceScore}/100`);
                console.log(`   RVOL: ${opp.metrics?.rvol}x`);
                console.log(`   RSI: ${opp.metrics?.rsi}`);
                console.log(`   Nota: ${opp.technicalReasoning}`);
            });
        }

    } catch (error) {
        console.error("⚠️ Error durante la auditoría:", error);
    }
}

runAudit();
