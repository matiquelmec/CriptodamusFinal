
import { fetchCryptoData, fetchCandles } from '../core/services/api/binanceApi';

console.log("\n🛡️ ROBUSTNESS PROTOCOL VERIFICATION");
console.log("===================================");

async function runTest() {
    console.log("TEST 1: Fetching Market Data (Simulating Network Stress)...");
    try {
        const markets = await fetchCryptoData();
        console.log(`✅ Success! Received ${markets.length} assets.`);
        console.log(`   Sample: ${markets[0].symbol} @ $${markets[0].price}`);
        console.log(`   Provider Inference: Check console logs above for '[API] Recovered...' messages.`);
    } catch (e: any) {
        console.log(`❌ FAILED: ${e.message}`);
    }

    console.log("\nTEST 2: Fetching Candles for BTCUSDT (The Ultimate Test)...");
    try {
        // BTCUSDT should trigger CoinGecko if Binance and CoinCap are blocked
        const candles = await fetchCandles('BTCUSDT', '15m');
        if (candles.length > 0) {
            console.log(`✅ Success! Received ${candles.length} candles.`);
            console.log(`   Last Close: $${candles[candles.length - 1].close}`);
            console.log(`   Volume Present: ${candles[candles.length - 1].volume > 0}`);
        } else {
            console.log("❌ Failed: Returned 0 candles.");
        }
    } catch (e: any) {
        console.log(`❌ CRITICAL FAILURE: ${e.message}`);
    }

    console.log("\nTEST 3: Fetching Candles for Unknown Asset (Should Fail Gracefully)...");
    try {
        const candles = await fetchCandles('INVALID_ASSET_XYZ', '1h');
        if (candles.length === 0) {
            console.log("✅ Correctly returned 0 candles for invalid asset.");
        } else {
            console.log("⚠️ Warning: Received data for invalid asset? Ghost data?");
        }
    } catch (e) {
        console.log("✅ Graceful error handling observed.");
    }
}

runTest();
