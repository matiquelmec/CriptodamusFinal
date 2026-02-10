
import { fetchTicker, fetchCandles } from '../core/services/api/binanceApi';
import { CEXConnector } from '../core/services/api/CEXConnector';

async function main() {
    console.log("🔍 Verifying Binance API Functions...");
    const symbol = 'BTCUSDT';

    try {
        console.log(`\n--- Test 1: fetchTicker('${symbol}') ---`);
        const start = Date.now();
        const ticker = await fetchTicker(symbol);
        const duration = Date.now() - start;

        if (ticker) {
            console.log(`✅ Success (${duration}ms):`, ticker);
        } else {
            console.error("❌ Failed to fetch ticker (returned null)");
        }

    } catch (e) {
        console.error("❌ Exception in fetchTicker:", e);
    }

    try {
        console.log(`\n--- Test 2: CEXConnector.getTicker('${symbol}') ---`);
        const { data, integrity } = await CEXConnector.getTicker(symbol);
        console.log(`Integrity: ${integrity}`);
        console.log(`Data:`, data);
    } catch (e) {
        console.error("❌ Exception in CEXConnector:", e);
    }

    process.exit(0);
}

main();
