
const https = require('https');

// Check XAG, Silver alternatives, and the requested cryptos
const TARGETS = [
    'PAXGUSDT', // Gold
    'XAGUSDT',  // Silver (Raw)
    'SLVUSDT',  // Silver (Tokenized?)
    'NEARUSDT',
    'SUIUSDT',
    'BTCUSDT',
    'ETHUSDT',
    'SOLUSDT',
    'XRPUSDT',
    'DOGEUSDT'
];

function checkSymbol(symbol) {
    const url = `https://data-api.binance.vision/api/v3/ticker/price?symbol=${symbol}`;
    https.get(url, (res) => {
        console.log(`${symbol}: ${res.statusCode === 200 ? 'EXISTS' : 'MISSING'}`);
    }).on('error', (e) => console.log(`${symbol}: ERROR`));
}

console.log("--- CHECKING ASSETS ---");
TARGETS.forEach(checkSymbol);
