
import { fetchCandles } from './cryptoService';
import { calculateEMA } from './mathUtils';

async function verifyReview() {
    console.log("🔍 Verifying Data Integrity (Deep History Check)...");

    try {
        // Test with BTCUSDT
        const symbol = 'BTCUSDT';
        console.log(`\nFetching 1000 candles for ${symbol}...`);

        const candles = await fetchCandles(symbol, '1h');

        console.log(`✅ Candles Received: ${candles.length}`);

        if (candles.length < 990) {
            console.error(`❌ FAILURE: Expected ~1000 candles, got ${candles.length}. API limit update failed.`);
            return;
        }

        const prices = candles.map(c => c.close);
        const lastPrice = prices[prices.length - 1];

        // Calculate EMA200 with full depth
        console.log("🧮 Calculating EMA200...");
        const ema200 = calculateEMA(prices, 200);

        console.log(`\n------------------------------------------------`);
        console.log(`📊 REPORT FOR ${symbol}`);
        console.log(`------------------------------------------------`);
        console.log(`Price:   $${lastPrice.toFixed(2)}`);
        console.log(`EMA200:  $${ema200.toFixed(2)}`);

        // Validate Math
        if (isNaN(ema200) || ema200 === 0) {
            console.error("❌ FAILURE: EMA200 calculation resulted in NaN or 0.");
        } else {
            console.log("✅ SUCCESS: EMA200 calculated with deep history.");
        }

    } catch (error) {
        console.error("❌ ERROR:", error);
    }
}

// Mocking fetch for test environment if needed, but here we try real call if environment supports it 
// or we assume user runs this with ts-node
verifyReview();
