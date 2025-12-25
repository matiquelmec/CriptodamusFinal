
// Standalone verification script to avoid complex dependency tree issues
const fetch = globalThis.fetch;

// Copied (and simplified) from cryptoService.ts
const BINANCE_API_BASE = 'https://data-api.binance.vision/api/v3';

async function fetchWithTimeout(url, options = {}, timeout = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function verifyReview() {
    console.log("🔍 Verifying Data Integrity (Deep History Check - Standalone)...");

    try {
        const symbolId = 'BTCUSDT';
        const interval = '1h';
        const url = `${BINANCE_API_BASE}/klines?symbol=${symbolId}&interval=${interval}&limit=1000`; // The Line we changed

        console.log(`\nFetching from: ${url}`);

        const res = await fetchWithTimeout(url);
        if (!res.ok) throw new Error(`Binance API Error: ${res.status}`);

        const data = await res.json();

        console.log(`✅ Data Received. Array Length: ${data.length}`);

        if (data.length === 1000) {
            console.log("✅ SUCCESS: API returned exactly 1000 candles.");

            // Basic math check
            const prices = data.map(d => parseFloat(d[4])); // Close price is index 4
            console.log(`   Last Price: $${prices[prices.length - 1]}`);

        } else {
            console.error(`❌ FAILURE: Expected 1000 candles, got ${data.length}.`);
        }

    } catch (error) {
        console.error("❌ ERROR:", error);
    }
}

verifyReview();
