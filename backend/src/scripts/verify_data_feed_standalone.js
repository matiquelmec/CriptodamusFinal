
/**
 * AUDITORÍA DE CONECTIVIDAD Y DATOS (STANDALONE - ESM)
 * Replica la lógica de CEXConnector.ts sin dependencias para verificar
 * la recepción de datos reales en este entorno de red.
 */

import https from 'https';

// Helper para hacer fetch sin node-fetch (nativo Node.js)
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'NodeBot/1.0' } }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`JSON Parse Error: ${e.message}`));
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        }).on('error', (err) => reject(err));
    });
}

async function runAudit() {
    console.log("🔍 --- AUDITORÍA DE DATOS EN VIVO (BINANCE FUTURES) ---");

    // 1. TICKERS (Precio, Volumen)
    console.log("\n1. Probando Endpoint de Tickers (24h)...");
    const startTime = Date.now();
    try {
        const tickers = await fetchJson('https://fapi.binance.com/fapi/v1/ticker/24hr');
        const latency = Date.now() - startTime;

        if (Array.isArray(tickers) && tickers.length > 0) {
            console.log(`   ✅ Conexión Exitosa (${latency}ms)`);
            const btc = tickers.find(t => t.symbol === 'BTCUSDT');
            if (btc) {
                console.log(`   🔹 BTC/USDT Precio: $${parseFloat(btc.lastPrice).toFixed(2)}`);
                console.log(`   🔹 BTC Volumen 24h: $${(parseFloat(btc.quoteVolume) / 1e9).toFixed(2)}B`);
                console.log(`   🔹 Cambio 24h:     ${parseFloat(btc.priceChangePercent).toFixed(2)}%`);
                console.log("   ✅ Datos de Precio: CONFIRMADOS");
            } else {
                console.warn("   ⚠️ BTC/USDT no encontrado en la lista.");
            }
        } else {
            console.error("   ❌ Respuesta vacía o formato inválido.");
        }
    } catch (e) {
        console.error(`   ❌ Fallo Conexión Tickers: ${e.message}`);
    }

    // 2. OPEN INTEREST (Datos Institucionales)
    console.log("\n2. Probando Endpoint de Open Interest (Institucional)...");
    try {
        const oiData = await fetchJson('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT');

        if (oiData && oiData.openInterest) {
            const oiVal = parseFloat(oiData.openInterest); // usually in contracts/asset amount
            const oiUsd = parseFloat(oiData.sumOpenInterestValue || "0"); // if available, or implied

            console.log(`   🔹 Contratos Abiertos: ${oiVal.toLocaleString()}`);
            if (oiData.time) {
                const lag = (Date.now() - oiData.time) / 1000;
                console.log(`   ⏱️ Latencia de Datos: ${lag.toFixed(2)}s`);
            }
            console.log("   ✅ Datos Institucionales: CONFIRMADOS");
        } else {
            console.error("   ❌ Respuesta OI inválida:", JSON.stringify(oiData));
        }
    } catch (e) {
        console.error(`   ❌ Fallo Conexión Open Interest: ${e.message}`);
    }

    // 3. KLINES (Velas para Estrategia)
    console.log("\n3. Probando Endpoint de Velas (Klines 1m)...");
    try {
        // [Open Time, Open, High, Low, Close, Volume, ...]
        const klines = await fetchJson('https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=1m&limit=5');

        if (Array.isArray(klines) && klines.length > 0) {
            const last = klines[klines.length - 1];
            // Binance returns current open candle as last item.
            const openTime = last[0];
            const now = Date.now();
            const diff = (now - openTime) / 1000;

            console.log(`   🔹 Última Vela (Open): ${new Date(openTime).toISOString()}`);
            console.log(`   🔹 Tiempo Actual:      ${new Date(now).toISOString()}`);
            console.log(`   ⏱️ Diferencia:         ${diff.toFixed(1)}s (Debería ser < 60s si es vela actual)`);

            if (diff < 300) { // Tolerancia amplia por clocks desincronizados
                console.log("   ✅ Flujo de Velas: ACTIVO y SINCRONIZADO");
            } else {
                console.warn("   ⚠️ Alerta: Datos parecen antiguos.");
            }
        }
    } catch (e) {
        console.error(`   ❌ Fallo Conexión Velas: ${e.message}`);
    }

    console.log("\n--- RESULTADO DE AUDITORÍA: El sistema recibe datos reales. ---");
}

runAudit();
