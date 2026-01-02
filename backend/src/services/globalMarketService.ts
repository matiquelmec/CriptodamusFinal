
import fetch from 'node-fetch';

export interface GlobalMarketData {
    btcDominance: number;
    usdtDominance: number;
    goldPrice: number; // PAXGUSDT proxy
    dxyIndex: number; // Synthetic or fetched
    timestamp: number;
}

let cache: GlobalMarketData | null = null;
let lastFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const fetchGlobalMarketData = async (): Promise<GlobalMarketData> => {
    const now = Date.now();
    if (cache && (now - lastFetch) < CACHE_DURATION) {
        return cache;
    }

    try {
        // 1. Fetch Dominance from CoinGecko (No Key Required, strict rate limits but ok for server cache 5m)
        // Global Endpoint: https://api.coingecko.com/api/v3/global
        let btcD = 55.0; // Fallback
        let usdtD = 5.0; // Fallback

        try {
            const cgRes = await fetch('https://api.coingecko.com/api/v3/global');
            if (cgRes.ok) {
                const cgData: any = await cgRes.json();
                if (cgData.data && cgData.data.market_cap_percentage) {
                    btcD = cgData.data.market_cap_percentage.btc || 55.0;
                    usdtD = cgData.data.market_cap_percentage.usdt || 5.0;
                }
            } else {
                console.warn('[GlobalService] CoinGecko API error:', cgRes.status);
            }
        } catch (e) {
            console.warn('[GlobalService] CoinGecko fetch failed:', e);
        }

        // 2. Fetch Gold Price (PAXG/USDT from Binance API) - Proxy for XAU
        let goldPrice = 2000;
        try {
            // Use binance.vision (easier for server-side)
            const binanceRes = await fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=PAXGUSDT', {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (binanceRes.ok) {
                const bData: any = await binanceRes.json();
                goldPrice = parseFloat(bData.price);
            }
        } catch (e) {
            console.warn('[GlobalService] Binance Gold Proxy fetch failed:', e);
        }

        // 3. Synthetic DXY (Dollar Strength)
        // Real DXY API is paid. We verify "Dollar Strength" inversely via EUR/USDT direction and USDT.D strength.
        // For this version, we will return a "Derived DXY" based on USDT.D which correlates highly.
        // Formula approx: DXY ~= USDT.D * 20 (Rough heuristic for correlation logic) or just return 0 to indicate "use synthetic logic"
        // Better approach: Get EURUSDT from Binance and invert.
        let eurUsdt = 1.1;
        try {
            const eurRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT');
            if (eurRes.ok) {
                const eurData: any = await eurRes.json();
                eurUsdt = parseFloat(eurData.price);
            }
        } catch (e) { }

        // Inverse EUR is a crude DXY proxy directionally
        const dxyProxy = 1 / eurUsdt * 100; // Not exact DXY value but directionally identical

        cache = {
            btcDominance: btcD,
            usdtDominance: usdtD,
            goldPrice,
            dxyIndex: dxyProxy,
            timestamp: now
        };
        lastFetch = now;

        return cache;

    } catch (error) {
        console.error('[GlobalService] Critical Error fetching global data:', error);
        // Return stale cache if available, else static failover
        if (cache) return cache;
        return {
            btcDominance: 55,
            usdtDominance: 5,
            goldPrice: 2000,
            dxyIndex: 100,
            timestamp: now
        };
    }
};
