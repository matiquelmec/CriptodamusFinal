import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkTakerVolPublic() {
    const proxyUrl = process.env.BIFROST_URL;
    // Trying the EXACT params found in search
    const testTarget = 'https://fapi.binance.com/futures/data/takerBuySellVol?pair=BTCUSDT&contractType=ALL&period=5m&limit=1';
    const tunnelUrl = `${proxyUrl}/api?target=${encodeURIComponent(testTarget)}`;

    console.log(`📡 Testing Public Taker Volume Path...`);

    try {
        const response = await axios.get(tunnelUrl, { timeout: 10000 });
        console.log(`✅ SUCCESS:`, JSON.stringify(response.data).substring(0, 200));
        if (Array.isArray(response.data) && response.data.length > 0) {
            console.log("💎 Institutional Data Found!");
        }
    } catch (e: any) {
        if (e.response) {
            console.error(`❌ FAILED: ${e.response.status} ${JSON.stringify(e.response.data)}`);
        } else {
            console.error(`❌ Request Error: ${e.message}`);
        }
    }
}

checkTakerVolPublic();
