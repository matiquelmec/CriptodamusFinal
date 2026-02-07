
// verify_connectivity.ts
console.log("Testing Global Fetch...");

(async () => {
    try {
        const url = 'https://data-api.binance.vision/api/v3/ticker/24hr';
        console.log('Fetching', url);
        const res = await fetch(url);
        console.log('Status:', res.status);
        if (res.ok) {
            const json = await res.json();
            console.log('Data length:', (json as any[]).length);
            console.log('Sample:', (json as any[])[0]);
        } else {
            console.error('Response not ok', await res.text());
        }
    } catch (e) {
        console.error('Fetch failed:', e);
    }
})();
