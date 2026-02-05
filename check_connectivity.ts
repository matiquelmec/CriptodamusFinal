import dns from 'dns';
import https from 'https';
import http from 'http';

const checkDomain = (domain: string): Promise<string> => {
    return new Promise((resolve) => {
        dns.lookup(domain, (err, address) => {
            if (err) resolve(`❌ DNS FAILED (${err.code})`);
            else resolve(`✅ DNS OK (${address})`);
        });
    });
};

const checkHttp = (url: string): Promise<string> => {
    return new Promise((resolve) => {
        const req = (url.startsWith('https') ? https : http).get(url, { timeout: 5000 }, (res) => {
            if (res.statusCode && res.statusCode < 400) resolve(`✅ HTTP ${res.statusCode} (OK)`);
            else resolve(`⚠️ HTTP ${res.statusCode} (Blocked/Error)`);
        });

        req.on('error', (e) => resolve(`❌ HTTP FAIL (${e.message})`));
        req.on('timeout', () => { req.destroy(); resolve(`❌ TIMEOUT`); });
    });
};

const runAudit = async () => {
    console.log("\n🕵️ NETWORK DIAGNOSTIC TOOL (Criptodamus)\n========================================");

    const targets = [
        { name: "Google (Control)", domain: "google.com", url: "https://www.google.com" },
        { name: "CoinCap API (Backup)", domain: "api.coincap.io", url: "https://api.coincap.io/v2/assets" },
        { name: "Binance Proxy (Bifrost)", domain: "bifrost-proxy.onrender.com", url: "https://bifrost-proxy.onrender.com" }
    ];

    for (const target of targets) {
        console.log(`\nTesting: ${target.name}`);
        console.log(`  DNS:  ${await checkDomain(target.domain)}`);
        console.log(`  HTTP: ${await checkHttp(target.url)}`);
    }
    console.log("\n========================================\n");
};

runAudit();
