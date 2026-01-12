import { binanceStream } from '../services/binanceStream';

async function verifyLiveConnection() {
    console.log("🌐 INICIANDO PRUEBA DE CONEXIÓN REAL A BINANCE (FUTURES)...");

    // Usamos la instancia singleton exportada
    // binanceStream ya está instanciado por el módulo
    binanceStream.start(); // EXPLICIT START REQUIRED


    // Promesa que se resuelve cuando llega el primer tick REAL
    const connectionTest = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("TIMEOUT: No se recibieron datos reales en 10 segundos."));
        }, 10000);

        binanceStream.subscribe((data) => {
            if (data.type === 'cvd_update' && data.data.symbol === 'BTCUSDT') {
                console.log(`✅ [LIVE DATA] Dato Recibido: ${data.data.symbol} @ $${data.data.price}`);
                clearTimeout(timeout);
                resolve();
            }
        });
    });

    try {
        // Suscribirse al stream real de BTC
        binanceStream.addStream('btcusdt@aggTrade');
        console.log("📡 Suscrito a btcusdt@aggTrade. Esperando datos...");

        await connectionTest;
        console.log("\n🎉 ÉXITO TOTAL: El sistema está recibiendo datos reales de Binance en tiempo real.");
        process.exit(0);
    } catch (error) {
        console.error("\n❌ ERROR CRÍTICO:", error);
        process.exit(1);
    }
}

verifyLiveConnection();
