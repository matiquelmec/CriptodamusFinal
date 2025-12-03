
const https = require('https');

const urls = [
    'https://api.coincap.io/v2/global',
    'https://api.coingecko.com/api/v3/global'
];

urls.forEach(url => {
    console.log(`Testing ${url}...`);
    const req = https.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    }, (res) => {
        console.log(`${url} STATUS: ${res.statusCode}`);
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log(`${url} DATA SAMPLE: ${data.substring(0, 100)}...`);
        });
    });

    req.on('error', (e) => {
        console.error(`${url} ERROR: ${e.message}`);
    });
});
