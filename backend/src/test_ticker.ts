import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkTicker() {
    const proxyUrl = process.env.BIFROST_URL;
    const testTarget = 'https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT';
    const tunnelUrl = `${proxyUrl}/api?target=${encodeURIComponent(testTarget)}`;

    console.log(`🌐 Testing Ticker 24hr through Proxy...`);

    try {
        const response = await axios.get(tunnelUrl, { timeout: 10000 });
        console.log("✅ Ticker Response:", JSON.stringify(response.data).substring(0, 100));
    } catch (e: any) {
        console.error(`❌ Ticker FAILED: ${e.response?.status}`);
    }
}

checkTicker();
