
import { SmartFetch } from '../core/services/SmartFetch';
import dotenv from 'dotenv';
dotenv.config();

console.log("🔍 TESTING AUTHENTICATED PROXY ROUTING");
console.log("========================================");
console.log(`BIFROST_URL: ${process.env.BIFROST_URL}`);

async function testAuthProxy() {
    SmartFetch.resetCircuitBreaker(); // Force Fresh State
    const url = 'https://fapi.binance.com/fapi/v1/time';

    console.log(`\n1. Target URL: ${url}`);

    try {
        // Mocking an authenticated call (SmartFetch handles the routing logic inside)
        // We expect this to either SUCCEED (via Proxy) or FAIL (451 if direct)
        // The DEBUG log we added to SmartFetch will reveal the decision.
        const res = await SmartFetch.get(url, {
            headers: {
                'X-MBX-APIKEY': 'dummy_key_for_routing_test'
            }
        });
        console.log("✅ SUCCESS: Request completed!");
        console.log(res);
    } catch (e: any) {
        console.log(`❌ FAILED: ${e.message}`);
        if (e.response) {
            console.log(`   Status: ${e.response.status}`);
            console.log(`   Data: ${JSON.stringify(e.response.data)}`);
        }
    }
}

testAuthProxy();
