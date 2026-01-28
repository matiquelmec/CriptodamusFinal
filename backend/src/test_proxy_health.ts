import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkProxy() {
    const proxyUrl = process.env.BIFROST_URL;
    if (!proxyUrl) {
        console.error("❌ BIFROST_URL missing");
        return;
    }

    const testTarget = 'https://api.ipify.org?format=json';
    const tunnelUrl = `${proxyUrl}/api?target=${encodeURIComponent(testTarget)}`;

    console.log(`🌐 Testing Bifrost Proxy: ${proxyUrl}`);
    console.log(`📡 Tunnel URL: ${tunnelUrl}`);

    try {
        const response = await axios.get(tunnelUrl, { timeout: 10000 });
        console.log("✅ Proxy Response:", JSON.stringify(response.data));
    } catch (e: any) {
        if (e.response) {
            console.error(`❌ Proxy FAILED: ${e.response.status} ${JSON.stringify(e.response.data)}`);
            if (e.response.status === 404) {
                console.log("💡 Tip: The /api route might not exist on the proxy.");
            }
        } else {
            console.error(`❌ Proxy Request Error: ${e.message}`);
        }
    }
}

checkProxy();
