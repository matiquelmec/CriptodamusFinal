
import { fetchGlobalMarketData } from './services/globalMarketService';

async function verify() {
    console.log("--- INICIANDO VERIFICACIÓN DE DATOS GLOBALES ---");
    console.log("Intentando conectar a CoinGecko y Binance (Proxy)...");

    try {
        const data = await fetchGlobalMarketData();
        console.log("\n✅ DATOS RECIBIDOS:");
        console.log(JSON.stringify(data, null, 2));

        console.log("\n--- VALIDACIÓN ---");

        // Validation Logic
        const isDominanceFake = data.btcDominance === 55.0 && data.usdtDominance === 5.0;
        const isGoldFake = data.goldPrice === 2000;

        if (isDominanceFake) {
            console.warn("⚠️ ALERTA: La Dominancia parece ser el FALLBACK (Datos Falsos). CoinGecko falló?");
        } else {
            console.log("✅ Dominancia: REAL (Diferente al default 55.0)");
        }

        if (isGoldFake) {
            console.warn("⚠️ ALERTA: El Precio del Oro parece ser el FALLBACK (2000). Binance Proxy falló?");
        } else {
            console.log(`✅ Oro (PAXG): REAL ($${data.goldPrice})`);
        }

        if (data.dxyIndex !== 100) {
            console.log(`✅ DXY (Sintético): REAL (${data.dxyIndex.toFixed(2)})`);
        }

    } catch (error) {
        console.error("❌ ERROR CRÍTICO durante la verificación:", error);
    }
}

verify();
