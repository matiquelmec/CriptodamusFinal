import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkAlternativePath() {
    const proxyUrl = process.env.BIFROST_URL;
    // Trying common alternative paths for Taker Buy/Sell
    const paths = [
        '/fapi/v1/takerBuySellVol',
        '/futures/data/takerBuySellVol',
        '/fapi/v1/takerlongshortRatio'
    ];

    for (const p of paths) {
        const testTarget = `https://fapi.binance.com${p}?symbol=BTCUSDT&period=5m&limit=1`;
        const tunnelUrl = `${proxyUrl}/api?target=${encodeURIComponent(testTarget)}`;
        console.log(`📡 Testing Path: ${p}...`);

        try {
            const response = await axios.get(tunnelUrl, { timeout: 10000 });
            console.log(`✅ SUCCESS [${p}]:`, JSON.stringify(response.data).substring(0, 100));
        } catch (e: any) {
            console.log(`❌ FAILED [${p}]: ${e.response?.status || e.message}`);
        }
    }
}

checkAlternativePath();
