
import 'dotenv/config'; // Load env vars immediately before any other imports

import { signalAuditService } from './services/signalAuditService';
import { binanceStream } from './services/binanceStream';
import { AIOpportunity } from './core/types';

async function runAudit() {
    console.log("🕵️ INICIANDO AUDITORÍA PROFUNDA DEL SISTEMA DE OPORTUNIDADES");

    // 1. Mock de una Oportunidad Generada por el Scanner
    const mockOpportunity: AIOpportunity = {
        id: `audit_test_${Date.now()}`,
        symbol: 'BTCUSDT',
        side: 'LONG',
        strategy: 'AUDIT_TEST_STRATEGY',
        timeframe: '15m',
        session: 'LONDON',
        riskRewardRatio: 2.0,
        timestamp: Date.now(),
        confidenceScore: 85,
        entryZone: {
            min: 50000,
            max: 51000,
            currentPrice: 50500
        },
        takeProfits: {
            tp1: 52000,
            tp2: 53000,
            tp3: 54000
        },
        stopLoss: 49000,
        technicalReasoning: "Test Audit Signal",
        invalidated: false
    } as any; // Cast as any to avoid strict type checks for missing optional fields in mock

    console.log("1️⃣ Oportunidad Mock creada:", mockOpportunity.id);

    // 2. Verificar Registro en signalAuditService
    console.log("\n2️⃣ Registrando señal en el servicio de auditoría...");
    try {
        await signalAuditService.registerSignals([mockOpportunity]);
        console.log("✅ Señal enviada a registerSignals.");
    } catch (e) {
        console.error("❌ Error al registrar señal:", e);
        return;
    }

    // 3. Verificar ACTIVACIÓN INMEDIATA (Smart Execution)
    console.log("\n3️⃣ Verificando lógica de Activación Inmediata...");

    // Iniciar el servicio para configurar listeners
    await signalAuditService.start();

    // Como el currentPrice (50500) del mock está dentro de entryZone (50000-51000),
    // la señal debería haberse activado INSTANTÁNEAMENTE al registrarse.
    const statsImmediate = await signalAuditService.getPerformanceStats();
    console.log("   -> Estadísticas Inmediatas (Post-Registro):", statsImmediate);

    if (statsImmediate.open > 0 || statsImmediate.total > 0) {
        console.log("⚡ ÉXITO: La señal se activó inmediatamente (Market Entry).");
    } else {
        console.warn("⚠️ ALERTA: La señal sigue en limbo. ¿Falló la Smart Execution?");
    }

    // 4. Simular solo el Take Profit (Ya no hace falta tick de entrada)
    const tpPriceTick = {
        type: 'cvd_update',
        data: { symbol: 'BTCUSDT', price: 52500, volume: 100, delta: 10 }
    };
    console.log("\n4️⃣ Enviando tick de TAKE PROFIT (52500)...");
    // @ts-ignore
    binanceStream.notifySubscribers(tpPriceTick);

    await new Promise(r => setTimeout(r, 2000));

    // 5. Verificar Cierre
    const statsFinal = await signalAuditService.getPerformanceStats();
    console.log("   -> Estadísticas Finales:", statsFinal);

    if (statsFinal.wins > 0 || statsFinal.closed > 0) {
        console.log("✅ ÉXITO: La señal completó el ciclo (ENTRY -> WIN).");
    } else {
        console.log("❌ FALLO: La señal NO completó el ciclo.");
    }

    console.log("\n🏁 AUDITORÍA COMPLETADA.");
    process.exit(0);
}

runAudit().catch(e => {
    console.error(e);
    process.exit(1);
});
