import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkCVDFromKlines() {
    const proxyUrl = process.env.BIFROST_URL;
    const testTarget = 'https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=5m&limit=1';
    const tunnelUrl = `${proxyUrl}/api?target=${encodeURIComponent(testTarget)}`;

    console.log(`🌐 Fetching Klines for CVD extraction...`);

    try {
        const response = await axios.get(tunnelUrl, { timeout: 10000 });
        const kline = response.data[0];

        const totalVol = parseFloat(kline[5]);
        const takerBuyVol = parseFloat(kline[9]);
        const takerSellVol = totalVol - takerBuyVol;
        const cvdDelta = (takerBuyVol - takerSellVol) / totalVol;

        console.log("-----------------------------------------");
        console.log(`📊 Symbol: BTCUSDT (5m)`);
        console.log(`📈 Total Volume: ${totalVol.toFixed(2)}`);
        console.log(`🟢 Taker Buy: ${takerBuyVol.toFixed(2)}`);
        console.log(`🔴 Taker Sell: ${takerSellVol.toFixed(2)}`);
        console.log(`💎 CVD Delta (%): ${(cvdDelta * 100).toFixed(2)}%`);
        console.log("-----------------------------------------");
        console.log("✅ SUCCESS: Real CVD extracted from standard Klines!");
    } catch (e: any) {
        console.error(`❌ CVD extraction FAILED: ${e.message}`);
    }
}

checkCVDFromKlines();
