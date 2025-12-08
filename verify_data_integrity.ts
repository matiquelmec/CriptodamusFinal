
import { getRawTechnicalIndicators } from './services/cryptoService';

async function verifyData() {
    console.log("🔍 Diagnóstico Profundo: Debugging de Llamada a Velas (K-Lines)...");

    // Test Exact URL
    const url = 'https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=205';

    console.log("📡 Testeando AbortController + Fetch...");
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const resWithOptions = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (resWithOptions.ok) {
            console.log("✅ Fetch con AbortController FUNCIONA. Status:", resWithOptions.status);
            const j = await resWithOptions.json();
            console.log(`📦 Datos Fetch Abortable: ${j.length} items`);
        } else {
            console.error("❌ Fetch con AbortController falló HTTP status:", resWithOptions.status);
        }
    } catch (acError) {
        console.error("❌ ERROR CRÍTICO: Fetch falló al usar AbortSignal (Signal support missing?):", acError);
    }

    console.log("\n🔍 Verificando getRawTechnicalIndicators (Nuevamente)...");
    try {
        const data = await getRawTechnicalIndicators('BTCUSDT');
        if (!data) {
            console.error("❌ getRawTechnicalIndicators sigue devolviendo NULL.");
        } else {
            console.log("✅ getRawTechnicalIndicators FUNCIONÓ esta vez.");
            console.log(`PRECIO: ${data.price}`);
            console.log("1W Trend:", data.fractalAnalysis?.trend_1w);
        }
    } catch (e) {
        console.error("error inside func", e);
    }
}

verifyData();
