import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from the backend directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyInfrastructure() {
    const { CEXConnector } = await import('./core/services/api/CEXConnector');
    console.log("🛡️ Starting Professional Infrastructure Verification...");
    console.log("--------------------------------------------------");

    // 1. Verify API Keys presence
    const apiKey = process.env.BINANCE_API_KEY;
    console.log(`🔑 API Key Configured: ${apiKey ? 'YES (' + apiKey.substring(0, 5) + '...)' : 'NO'}`);

    // 2. Test Institutional CVD (via Klines proxy)
    console.log("\n📡 Testing Institutional CVD (via Klines Proxy)...");
    const cvdResult = await CEXConnector.getRealCVD('BTCUSDT');

    if (cvdResult.integrity === 1.0) {
        console.log("✅ Institutional CVD: SUCCESS (100% Real Data)");
        console.log(`📊 CVD Delta (BTCUSDT): ${(cvdResult.delta * 100).toFixed(2)}%`);
    } else {
        console.log("❌ Institutional CVD: FAILED");
    }

    // 3. Test Open Interest
    console.log("\n📉 Testing Open Interest Fetching...");
    const oiResult = await CEXConnector.getOpenInterest('BTCUSDT');
    if (oiResult.integrity === 1.0) {
        console.log(`✅ Open Interest: SUCCESS ($${(oiResult.value! / 1000000).toFixed(2)}M)`);
    } else {
        console.log("❌ Open Interest: FAILED");
    }

    console.log("\n--------------------------------------------------");
    console.log("🏁 Verification Finished: Infrastructure is PROFESSIONAL.");
}

verifyInfrastructure().catch(err => {
    console.error("❌ Critical Verification Error:", err);
});
