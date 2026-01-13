
import { getDerivativesData } from '../services/volumeExpert';

async function verify() {
    console.log("🔍 Verifying Real Data Fetch (Binance Futures)...");

    try {
        const data = await getDerivativesData('BTCUSDT');
        console.log("📊 Result for BTCUSDT:");
        console.log(JSON.stringify(data, null, 2));

        if (data.buySellRatio !== 1.0) {
            console.log("✅ SUCCESS: Real Long/Short Ratio detected (" + data.buySellRatio + ")");
        } else {
            console.log("⚠️ WARNING: Ratio is still 1.0 (Could be coincidence or default fallback)");
        }
    } catch (e) {
        console.error("❌ FAILED:", e);
    }
}

verify();
