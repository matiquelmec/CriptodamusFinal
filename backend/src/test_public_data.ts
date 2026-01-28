import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkPublicDataThroughProxy() {
    const proxyUrl = process.env.BIFROST_URL;
    // Test Taker Buy/Sell Volume as a PUBLIC endpoint
    const testTarget = 'https://fapi.binance.com/fapi/v1/takerBuySellVolume?symbol=BTCUSDT&period=5m&limit=1';
    const tunnelUrl = `${proxyUrl}/api?target=${encodeURIComponent(testTarget)}`;

    console.log(`🌐 Testing Public Binance Data through Proxy...`);

    try {
        const response = await axios.get(tunnelUrl, { timeout: 10000 });
        console.log("✅ Public Data Response:", JSON.stringify(response.data));
        if (Array.isArray(response.data) && response.data.length > 0) {
            console.log("💎 Institutional Data is ACCESSIBLE publicly through proxy!");
        }
    } catch (e: any) {
        if (e.response) {
            console.error(`❌ Public Data FAILED: ${e.response.status}`);
            console.log("📄 Response Data Snippet:", String(e.response.data).substring(0, 200));
        } else {
            console.error(`❌ Request Error: ${e.message}`);
        }
    }
}

checkPublicDataThroughProxy();
