
import axios from 'axios';

async function probeAPI() {
    console.log("📡 Probing API for stale data...");

    // Try common ports
    const ports = [3001, 3000, 8080, 5000];

    for (const port of ports) {
        try {
            const url = `http://localhost:${port}/api/ml/stats`;
            console.log(`   Trying ${url}...`);
            const res = await axios.get(url, { timeout: 2000 });
            console.log(`✅ SUCCESS on Port ${port}!`);
            console.log("   Response Data:", JSON.stringify(res.data, null, 2));

            if (res.data.globalWinRate > 0) {
                console.log("\n⚠️ FINDING: API IS STALE. It returns data despite DB being empty.");
            } else {
                console.log("\n✅ FINDING: API IS FRESH (0%).");
            }
            return;
        } catch (e: any) {
            // console.log(`   Failed on ${port}: ${e.message}`);
        }
    }
    console.log("❌ Could not connect to any common local API port.");
}

probeAPI();
