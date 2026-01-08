
import { SmartFetch } from '../core/services/SmartFetch';

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
        // 1. Fetch Dominance from CoinGecko using SmartFetch
        let btcD = 0;
        let usdtD = 0;

        try {
            const cgData = await SmartFetch.get<any>('https://api.coingecko.com/api/v3/global');
            if (cgData.data && cgData.data.market_cap_percentage) {
                btcD = cgData.data.market_cap_percentage.btc || 0;
                usdtD = cgData.data.market_cap_percentage.usdt || 0;
            }
        } catch (e) {
            console.warn('[GlobalService] CoinGecko fetch failed (handled by SmartFetch):', e instanceof Error ? e.message : e);
        }

        // 2. Fetch Gold Price (PAXG/USDT) - Real Price or 0 (No fake default)
        let goldPrice = 0;
        try {
            const bData = await SmartFetch.get<any>('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
            goldPrice = parseFloat(bData.price);
        } catch (e) {
            console.warn('[GlobalService] Gold Proxy fetch failed');
        }

        // 3. Synthetic DXY (Inverted Euro 2026 Adjusted)
        // Baseline: DXY ~106 when EURUSD ~1.05 -> Scalar ~111.3
        let eurUsdt = 1.1;
        try {
            const eurData = await SmartFetch.get<any>('https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT');
            eurUsdt = parseFloat(eurData.price);
        } catch (e) { }

        // Formula: 111.3 / Price (Inverse relationship)
        const dxyProxy = 111.3 / eurUsdt;

        cache = {
            btcDominance: btcD,
            usdtDominance: usdtD,
            goldPrice,
            dxyIndex: dxyProxy,
            timestamp: now
        };
        lastFetch = now;
        return cache;

    } catch (error: any) {
        console.error('[GlobalService] Critical Error:', error.message || error);
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
