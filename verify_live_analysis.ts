
// Standalone verification script to bypass internal visibility issues
// Replicates cryptoService.ts logic exactly to prove data source validity

const BINANCE_API_BASE = 'https://data-api.binance.vision/api/v3';

// Mock types for Node environment
type RequestInit = any;

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 8000) => {
    // In pure Node scripts (if fetch is global), this works.
    // If running via 'tsx', fetch is available.
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
};

const verifyLiveCandles = async () => {
    console.log("🔍 STARTING LIVE DATA VERIFICATION (Standalone)...\n");
    const symbol = 'BTCUSDT';
    const interval = '1m'; // Use 1m for maximum freshness check
    const url = `${BINANCE_API_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=5`;

    console.log(`📡 Fetching from: ${url}`);

    try {
        const start = Date.now();
        const res = await fetchWithTimeout(url, {}, 5000);
        const latency = Date.now() - start;

        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

        const data = await res.json();

        console.log(`✅ HTTP 200 OK (${latency}ms)`);
        console.log(`📊 Received ${data.length} candles.`);

        if (data.length > 0) {
            // Binance format: [openTime, open, high, low, close, volume, closeTime, ...]
            const lastCandle = data[data.length - 1];
            const candleTime = lastCandle[0];
            const closeTime = lastCandle[6];
            const price = parseFloat(lastCandle[4]);

            const now = Date.now();
            // Allow small drift
            const driftSeconds = (now - closeTime) / 1000;

            console.log("\n--- LIVE DATA PROOF ---");
            console.log(`🆔 Symbol: ${symbol}`);
            console.log(`💲 Price: $${price.toFixed(2)}`);
            console.log(`⏰ Candle Open:  ${new Date(candleTime).toISOString()}`);
            console.log(`⏰ Candle Close: ${new Date(closeTime).toISOString()}`);
            console.log(`🕒 System Time:  ${new Date(now).toISOString()}`);
            console.log(`📉 Latency Drift: ${driftSeconds.toFixed(2)} seconds`);

            if (Math.abs(driftSeconds) < 120) { // 2 mins tolerance for 1m candle (it closes at end of minute)
                console.log("\n✅ VERIFICATION PASSED: Data is LIVE and REAL-TIME.");
            } else {
                console.log("\n⚠️ VERIFICATION WARNING: Data seems old.");
            }
        }
    } catch (err) {
        console.error("❌ FETCH FAILED:", err);
    }
};

verifyLiveCandles();
