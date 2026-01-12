
import { signalAuditService } from '../services/signalAuditService';
import { binanceStream } from '../services/binanceStream';
import { AIOpportunity } from '../core/types';

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
            min: 50000, // Precios arbitrarios para prueba, se ajustarán a mercado real abajo
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
    };

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

    // 3. Verificar Estado Inicial (Debería ser PENDING)
    // Nota: Necesitamos acceder al estado interno o consultar la BD. 
    // Como activeSignals es privado, usaremos una función pública si existe o inferencia.
    // Para esta prueba, vamos a simular el flujo de precio.

    console.log("\n3️⃣ Simulando flujo de precios (Binance Stream Mock)...");
    
    // Simular precio de entrada (dentro del rango)
    const entryPriceTick = {
        type: 'cvd_update', 
        data: { symbol: 'BTCUSDT', price: 50500, volume: 100, delta: 10 }
    };

    console.log("   -> Enviando tick de PRECIO DE ENTRADA (50500)...");
    // Hack: Emitir evento directamente al stream para ver si el listener reacciona
    // (Esto asume que signalAuditService está suscrito a binanceStream)
    // Primero iniciamos el servicio para asegurar suscripciones
    await signalAuditService.start();
    
    // Forzamos la emisión del evento como si viniera del socket
    // @ts-ignore
    binanceStream.notifySubscribers(entryPriceTick);

    // Esperar un momento para procesamiento
    await new Promise(r => setTimeout(r, 1000));

    // 4. Verificar si pasó a ACTIVE
    // Consultamos estadísticas
    const statsAfterEntry = await signalAuditService.getPerformanceStats();
    console.log("   -> Estadísticas tras Entry:", statsAfterEntry);

    if (statsAfterEntry.open > 0) {
         console.log("✅ La señal fue detectada como OPEN/ACTIVE/PENDING en estadísticas.");
    } else {
         console.log("⚠️ La señal NO aparece en estadísticas. ¿Falló la inserción en BD?");
    }

    // 5. Simular Take Profit
    const tpPriceTick = {
        type: 'cvd_update',
        data: { symbol: 'BTCUSDT', price: 52500, volume: 100, delta: 10 }
    };
    console.log("\n4️⃣ Enviando tick de TAKE PROFIT (52500)...");
    // @ts-ignore
    binanceStream.notifySubscribers(tpPriceTick);

    await new Promise(r => setTimeout(r, 1000));

    // 6. Verificar Resultado Final
    const statsFinal = await signalAuditService.getPerformanceStats();
    console.log("   -> Estadísticas Finales:", statsFinal);

    console.log("\n🏁 AUDITORÍA COMPLETADA.");
}

runAudit().catch(console.error);
