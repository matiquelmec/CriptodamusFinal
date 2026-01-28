import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkPremiumIndex() {
    const proxyUrl = process.env.BIFROST_URL;
    const testTarget = 'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT';
    const tunnelUrl = `${proxyUrl}/api?target=${encodeURIComponent(testTarget)}`;

    console.log(`🌐 Testing Premium Index through Proxy...`);

    try {
        const response = await axios.get(tunnelUrl, { timeout: 10000 });
        console.log("✅ Premium Index Response:", JSON.stringify(response.data));
    } catch (e: any) {
        if (e.response) {
            console.error(`❌ Premium Index FAILED: ${e.response.status}`);
            console.log("📄 Response Data Snippet:", String(e.response.data).substring(0, 200));
        } else {
            console.error(`❌ Request Error: ${e.message}`);
        }
    }
}

checkPremiumIndex();
