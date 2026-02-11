
import { CEXConnector } from '../core/services/api/CEXConnector';
import { fetchCandles, checkBinanceHealth } from '../core/services/api/binanceApi';

async function verifyDataFeed() {
    console.log("🔍 --- AUDITORÍA DE DATOS EN TIEMPO REAL ---");

    // 1. Verificar Salud de Binance
    console.log("\n1. Verificando Conectividad con Binance...");
    const isHealthy = await checkBinanceHealth();
    if (isHealthy) {
        console.log("   ✅ Binance API: ONLINE");
    } else {
        console.error("   ❌ Binance API: OFFLINE o Inaccesible (Posible Geo-bloqueo)");
    }

    // 2. Verificar Datos de Velas (Price Action)
    console.log("\n2. Verificando Frescura de Velas (BTC/USDT - 1m)...");
    const symbol = 'BTCUSDT';

    try {
        const klines = await CEXConnector.getKlines(symbol, '1m', 5);
        if (klines.data && klines.data.length > 0) {
            const lastCandle = klines.data[klines.data.length - 1];
            // Binance Kline Format: [Open Time, Open, High, Low, Close, Volume, ...]
            const candleTime = Number(lastCandle[0]);
            const now = Date.now();
            const delayInSeconds = (now - candleTime) / 1000;

            console.log(`   🔹 Última Vela: ${new Date(candleTime).toISOString()}`);
            console.log(`   🔹 Hora Actual: ${new Date(now).toISOString()}`);
            console.log(`   ⏱️ Latencia: ${delayInSeconds.toFixed(2)} segundos`);

            if (delayInSeconds < 120) { // 1m candle usually closes at :00, so we might be up to 60s+ away
                // Actually, open time is start of candle. Current time should be close to OpenTime + 1m?
                // No, active candle has OpenTime. So Last Closed Candle?
                // Usually API returns latest candles. 
                // If delay is < 300s (5m) it's definitely operational.
                // For 1m candle, the open time should be within last 60-120 seconds.
                console.log("   ✅ DATOS EN VIVO CONFIRMADOS (Latencia Baja)");
            } else {
                console.warn("   ⚠️ DATOS RETRASADOS: Posible problema de sincronización.");
            }

            console.log(`   💲 Precio Cierre: ${lastCandle[4]}`);
        } else {
            console.error("   ❌ Fallo al obtener velas (Data Null)");
        }
    } catch (e: any) {
        console.error(`   ❌ Error Fatal en Klines: ${e.message}`);
    }

    // 3. Verificar Datos Institucionales (Open Interest)
    console.log("\n3. Verificando Datos Institucionales (Order Flow)...");
    try {
        const oi = await CEXConnector.getOpenInterest(symbol);
        if (oi.integrity > 0 && oi.value !== null) {
            console.log(`   ✅ Open Interest: ${oi.value} (Integridad: ${oi.integrity * 100}%)`);
            console.log("   🛡️ Conexión Institucional: ACTIVA");
        } else {
            console.warn("   ⚠️ Open Interest NO DISPONIBLE (Modo Degradado)");
        }
    } catch (e: any) {
        console.error(`   ❌ Error en Open Interest: ${e.message}`);
    }

    console.log("\n--- FIN DE AUDITORÍA DE DATOS ---");
}

verifyDataFeed();
