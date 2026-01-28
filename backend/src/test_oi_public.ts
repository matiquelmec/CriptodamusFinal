import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkOpenInterest() {
    const proxyUrl = process.env.BIFROST_URL;
    const testTarget = 'https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT';
    const tunnelUrl = `${proxyUrl}/api?target=${encodeURIComponent(testTarget)}`;

    console.log(`🌐 Testing Open Interest through Proxy...`);

    try {
        const response = await axios.get(tunnelUrl, { timeout: 10000 });
        console.log("✅ Open Interest Response:", JSON.stringify(response.data));
    } catch (e: any) {
        if (e.response) {
            console.error(`❌ Open Interest FAILED: ${e.response.status}`);
        } else {
            console.error(`❌ Request Error: ${e.message}`);
        }
    }
}

checkOpenInterest();
