import { predictNextMove } from '../ml/inference';

async function auditBrain() {
    console.log("🧠 INICIANDO AUDITORÍA NEURONAL (LSTM)...");
    console.log("------------------------------------------");

    try {
        const symbol = 'BTCUSDT';
        console.log(`📡 Obteniendo datos en tiempo real para ${symbol}...`);

        const start = Date.now();
        const result = await predictNextMove(symbol);
        const duration = Date.now() - start;

        if (!result) {
            console.error("❌ ERROR: El cerebro no respondió (Null Result).");
            return;
        }

        console.log("\n✅ DIAGNÓSTICO COMPLETADO:");
        console.log(`⏱️ Tiempo de Inferencia: ${duration}ms`);
        console.log(`📊 Probabilidad Alcista: ${(result.probabilityUp * 100).toFixed(2)}%`);
        console.log(`🎯 Señal: ${result.signal}`);
        console.log(`🔥 Confianza: ${(result.confidence * 100).toFixed(2)}%`); // 0-1 range to %

        console.log("\nINTERPRETACIÓN:");
        if (result.probabilityUp > 0.6) console.log(">> El modelo detecta patrones claros de COMPRA.");
        else if (result.probabilityUp < 0.4) console.log(">> El modelo detecta debilidad estructural (VENTA).");
        else console.log(">> El modelo está indeciso (Rango/Ruido).");

    } catch (error) {
        console.error("❌ CRITICAL ERROR:", error);
    }
}

auditBrain();
