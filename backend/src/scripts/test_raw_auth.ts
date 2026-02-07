import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyRawConnection() {
    console.log("🚀 Starting RAW Verification (Direct to Binance)...");

    const key = process.env.BINANCE_API_KEY;
    const secret = process.env.BINANCE_API_SECRET;

    if (!key || !secret) {
        console.error("❌ Keys missing in .env");
        return;
    }

    const baseUrl = 'https://fapi.binance.com';
    const pathUrl = '/fapi/v1/account';
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto.createHmac('sha256', secret).update(queryString).digest('hex');
    const url = `${baseUrl}${pathUrl}?${queryString}&signature=${signature}`;

    try {
        console.log(`📡 Requesting: ${url.substring(0, 60)}...`);
        const response = await axios.get(url, {
            headers: { 'X-MBX-APIKEY': key },
            timeout: 5000
        });
        console.log("✅ RAW Account Auth: SUCCESS!");
        console.log(`💰 Account Type: ${response.data.canDeposit ? 'FULL' : 'LIMITED'}`);
    } catch (e: any) {
        if (e.response) {
            console.error(`❌ RAW Auth FAILED: ${e.response.status} ${JSON.stringify(e.response.data)}`);
        } else {
            console.error(`❌ RAW Request ERROR: ${e.message}`);
        }
    }
}

verifyRawConnection();
