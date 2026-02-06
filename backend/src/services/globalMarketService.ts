
import { SmartFetch } from '../core/services/SmartFetch';

export interface GlobalMarketData {
    btcDominance: number;
    usdtDominance: number;
    goldPrice: number; // PAXGUSDT proxy
    dxyIndex: number; // Synthetic or fetched
    timestamp: number;
    isDataValid: boolean;
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
            console.warn('[GlobalService] CoinGecko failed, trying CoinPaprika fallback...');
            try {
                const cpData = await SmartFetch.get<any>('https://api.coinpaprika.com/v1/global');
                if (cpData) {
                    btcD = cpData.bitcoin_dominance_percentage || 0;
                    // Note: CoinPaprika doesn't always have USDT dominance in the main global object, 
                    // but we can at least get BTC dominance which is critical.
                    usdtD = 5; // Safe default
                }
            } catch (cpError) {
                console.warn('[GlobalService] CoinPaprika fallback also failed.');
            }
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
        const dxyProxy = eurUsdt !== 0 ? 111.3 / eurUsdt : 100;

        const finalData: GlobalMarketData = {
            btcDominance: isNaN(btcD) ? 0 : btcD,
            usdtDominance: isNaN(usdtD) ? 0 : usdtD,
            goldPrice: isNaN(goldPrice) ? 0 : goldPrice,
            dxyIndex: isNaN(dxyProxy) ? 0 : dxyProxy,
            timestamp: now,
            isDataValid: !isNaN(btcD) && btcD > 0 // BTC Dominance is critical for Macro
        };

        cache = finalData;
        lastFetch = now;
        return finalData;

    } catch (error: any) {
        console.error('[GlobalService] Critical Error:', error.message || error);
        if (cache) return { ...cache, isDataValid: false };
        return {
            btcDominance: 0,
            usdtDominance: 0,
            goldPrice: 0,
            dxyIndex: 0,
            timestamp: now,
            isDataValid: false
        };
    }
};
