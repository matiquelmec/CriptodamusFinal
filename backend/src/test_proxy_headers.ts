import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkHeaderForwarding() {
    const proxyUrl = process.env.BIFROST_URL;
    const testTarget = 'https://httpbin.org/headers';
    const tunnelUrl = `${proxyUrl}/api?target=${encodeURIComponent(testTarget)}`;

    console.log(`🌐 Testing Header Forwarding through Proxy...`);

    try {
        const response = await axios.get(tunnelUrl, {
            headers: {
                'X-Test-Header': 'Criptodamus-Verify',
                'X-MBX-APIKEY': 'Test-Key-123'
            },
            timeout: 10000
        });

        console.log("✅ Proxy Response Headers (as seen by httpbin):");
        console.log(JSON.stringify(response.data.headers, null, 2));

        if (response.data.headers['X-MBX-APIKEY'] || response.data.headers['X-Test-Header']) {
            console.log("🎯 Headers are being forwarded successfully!");
        } else {
            console.warn("⚠️ Headers are NOT being forwarded. The proxy is stripping them.");
        }
    } catch (e: any) {
        console.error(`❌ Request Error: ${e.message}`);
    }
}

checkHeaderForwarding();
