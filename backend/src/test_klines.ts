import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkKlines() {
    const proxyUrl = process.env.BIFROST_URL;
    const testTarget = 'https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=5m&limit=1';
    const tunnelUrl = `${proxyUrl}/api?target=${encodeURIComponent(testTarget)}`;

    console.log(`🌐 Testing Klines through Proxy...`);

    try {
        const response = await axios.get(tunnelUrl, { timeout: 10000 });
        console.log("✅ Klines Response:", JSON.stringify(response.data).substring(0, 100));
    } catch (e: any) {
        console.error(`❌ Klines FAILED: ${e.response?.status}`);
    }
}

checkKlines();
