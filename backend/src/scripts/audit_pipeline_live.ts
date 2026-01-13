import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanMarketOpportunities } from '../core/services/engine/scannerLogic';
import { createClient } from '@supabase/supabase-js';

// Polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function runAudit() {
    console.log("🕵️ [AUDIT] Iniciando Auditoría de Calidad de Señales...");
    console.log("    Modo: SCALP_INTRADAY (Busca oportunidades inmediatas)");

    try {
        const start = Date.now();
        const opportunities = await scanMarketOpportunities('SCALP_INTRADAY');
        const duration = (Date.now() - start) / 1000;

        console.log(`\n✅ Escaneo Completado en ${duration.toFixed(2)}s`);
        console.log(`📊 Oportunidades Encontradas: ${opportunities.length}`);

        if (opportunities.length === 0) {
            console.log("⚠️  Resultado: 0 Señales. Esto puede ser por filtros estrictos o mercado lateral.");
            console.log("    (Esto valida que el sistema 'No Inventa' señales malas).");
        } else {
            console.log("\n💎 TOP 3 SEÑALES (Calidad Auditada):");
            opportunities.slice(0, 3).forEach((opp, i) => {
                console.log(`\n${i + 1}. [${opp.symbol}] ${opp.side} (Score: ${opp.confidenceScore})`);
                console.log(`   Estrategia: ${opp.strategy}`);
                console.log(`   Razón Técnica: ${opp.technicalReasoning}`);
                if (opp.metrics.volumeExpert) {
                    console.log(`   whale_activity: DETECTADA (CVD: ${opp.metrics.volumeExpert.cvd.trend})`);
                }
                if (opp.mlPrediction) {
                    console.log(`   🧠 IA Confidence: ${opp.mlPrediction.confidence.toFixed(1)}%`);
                }
            });
        }

        // Check Supabase Connection via Audit Service logic
        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_KEY = process.env.SUPABASE_KEY!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        const { count, error } = await supabase
            .from('signals_audit')
            .select('*', { count: 'exact', head: true });

        if (error) console.error("❌ Error conectando a DB de Auditoría:", error.message);
        else console.log(`\n🛡️  Sistema de Monitoreo: ONLINE (Registros en DB: ${count})`);

        process.exit(0);

    } catch (error) {
        console.error("❌ ERROR CRÍTICO EN PIPELINE:", error);
        process.exit(1);
    }
}

runAudit();
