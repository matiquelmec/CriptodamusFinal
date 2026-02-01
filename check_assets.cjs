
// check_assets.cjs
const https = require('https');

const TARGETS = ['PAXGUSDT', 'XAGUSDT', 'NEARUSDT', 'SUIUSDT'];

function checkSymbol(symbol) {
    return new Promise((resolve) => {
        const url = `https://data-api.binance.vision/api/v3/ticker/price?symbol=${symbol}`;
        https.get(url, (res) => {
            if (res.statusCode === 200) {
                resolve({ symbol, exists: true });
            } else {
                resolve({ symbol, exists: false, code: res.statusCode });
            }
        }).on('error', () => resolve({ symbol, exists: false, error: true }));
    });
}

(async () => {
    console.log("Verifying Asset Availability for Tournament List...");
    const results = await Promise.all(TARGETS.map(checkSymbol));
    console.table(results);
})();
