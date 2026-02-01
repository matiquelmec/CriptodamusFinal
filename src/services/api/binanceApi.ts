import { MarketData, FearAndGreedData } from '../../types';
import { SmartCache } from './caching/smartCache'; // NEW: Smart Caching Service

// PRIMARY: Backend Proxy (Shielded from CORS & Geo-Blocks)
const API_URL = import.meta.env.PROD
    ? 'https://criptodamusfinal.onrender.com'
    : 'http://localhost:3001';

const BINANCE_API_BASE = `${API_URL}/api/proxy/binance/api/v3`;
// Fallback / WebSocket base
const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/stream?streams=';

// FALLBACK: CoinCap (Very reliable for frontend)
const COINCAP_API_BASE = 'https://api.coincap.io/v2';

// List of known major memes to filter for the "Meme" view
const MEME_SYMBOLS = [
    'DOGE', 'SHIB', 'PEPE', 'WIF', 'FLOKI', 'BONK', 'BOME', 'MEME', 'PEOPLE',
    'DOGS', 'TURBO', 'MYRO', 'NEIRO', '1000SATS', 'ORDI', 'BABYDOGE', 'MOODENG',
    'PNUT', 'ACT', 'POPCAT', 'SLERF', 'BRETT', 'GOAT', 'MOG', 'SPX', 'HIPPO', 'LADYS',
    'CHILLGUY', 'LUCE', 'PENGU'
];

// UTILITY: Fetch with Timeout to prevent blocking UI
export const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 8000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

export const checkBinanceHealth = async (): Promise<boolean> => {
    try {
        const res = await fetchWithTimeout(`${BINANCE_API_BASE}/ping`, {}, 2000);
        return res.ok;
    } catch (e) {
        return false;
    }
};

const formatVolume = (vol: number): string => {
    if (vol >= 1_000_000_000) return `$${(vol / 1_000_000_000).toFixed(2)}B`;
    if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(2)}M`;
    if (vol >= 1_000) return `$${(vol / 1_000).toFixed(2)}K`;
    return `$${vol.toFixed(2)}`;
};

export const fetchCryptoData = async (mode: 'volume' | 'memes' = 'volume'): Promise<MarketData[]> => {
    try {
        const data = await fetchBinanceMarkets(mode);
        if (data.length === 0) throw new Error("Empty Binance Data");
        return data;
    } catch (error) {
        console.warn("Binance API failed/blocked, switching to CoinCap fallback...", error);
        return await fetchCoinCapMarkets(mode);
    }
};

// --- BINANCE FETCH STRATEGY ---
const fetchBinanceMarkets = async (mode: 'volume' | 'memes'): Promise<MarketData[]> => {
    try {
        const response = await fetchWithTimeout(`${BINANCE_API_BASE}/ticker/24hr`);
        if (!response.ok) throw new Error(`Binance returned ${response.status}`);

        const data = await response.json();

        // Ignored symbols (Stablecoins, Leverage tokens, Non-tradable)
        const ignoredPatterns = [
            'USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'USDPUSDT', 'EURUSDT', 'DAIUSDT', 'BUSDUSDT',
            'UPUSDT', 'DOWNUSDT', 'BULLUSDT', 'BEARUSDT', 'USDT',
            'USDEUSDT', 'USD1USDT', 'BFUSDUSDT', 'AEURUSDT' // Added problematic symbols causing 400
        ];

        let filteredData = data.filter((ticker: any) => {
            const symbol = ticker.symbol;
            return symbol.endsWith('USDT') &&
                !ignoredPatterns.includes(symbol) &&
                !symbol.includes('DOWN') &&
                !symbol.includes('UP');
        });

        if (mode === 'memes') {
            filteredData = filteredData.filter((ticker: any) => {
                const baseSymbol = ticker.symbol.replace('USDT', '');
                // Check specific list or 1000-prefix (e.g. 1000SATS, 1000PEPE sometimes used)
                return MEME_SYMBOLS.includes(baseSymbol) || MEME_SYMBOLS.includes(baseSymbol.replace('1000', ''));
            });
            // Sort memes by Volume too
            filteredData = filteredData.sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
        } else {
            // Default: Top 50 by Volume, PLUS PAXGUSDT (Gold)
            const goldTicker = filteredData.find((t: any) => t.symbol === 'PAXGUSDT');

            filteredData = filteredData
                .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
                .slice(0, 50);

            // Re-inject Gold if it was cutoff by volume slice
            if (goldTicker && !filteredData.find((t: any) => t.symbol === 'PAXGUSDT')) {
                filteredData.push(goldTicker);
            }
        }

        return filteredData.map((ticker: any) => {
            const rawSymbol = ticker.symbol.replace('USDT', '');
            return {
                id: ticker.symbol, // Binance Symbol ID
                symbol: `${rawSymbol}/USDT`,
                price: parseFloat(ticker.lastPrice),
                change24h: parseFloat(ticker.priceChangePercent),
                rsi: 50, // Placeholder, calculated properly in detailed analysis
                volume: formatVolume(parseFloat(ticker.quoteVolume)),
                trend: parseFloat(ticker.priceChangePercent) > 0.5 ? 'bullish' : 'bearish'
            };
        });
    } catch (e) {
        throw e;
    }
};

// --- COINCAP FETCH STRATEGY (FALLBACK) ---
const fetchCoinCapMarkets = async (mode: 'volume' | 'memes'): Promise<MarketData[]> => {
    try {
        const response = await fetchWithTimeout(`${COINCAP_API_BASE}/assets?limit=100`);
        if (!response.ok) return [];

        const json = await response.json();
        let assets = json.data;

        if (mode === 'memes') {
            assets = assets.filter((asset: any) =>
                MEME_SYMBOLS.includes(asset.symbol.toUpperCase())
            );
        } else {
            assets = assets.slice(0, 50);
        }

        return assets.map((asset: any) => ({
            id: asset.id, // CoinCap ID (e.g. 'bitcoin') - Important for candles
            symbol: `${asset.symbol}/USDT`,
            price: parseFloat(asset.priceUsd),
            change24h: parseFloat(asset.changePercent24Hr),
            rsi: 50,
            volume: formatVolume(parseFloat(asset.volumeUsd24Hr)),
            trend: parseFloat(asset.changePercent24Hr) > 0.5 ? 'bullish' : 'bearish'
        }));
    } catch (e) {
        return [];
    }
};

// General subscription for the main scanner
export const subscribeToLivePrices = (marketData: MarketData[], callback: (data: Record<string, number>) => void) => {
    const sampleId = marketData[0]?.id || '';
    const isBinance = sampleId === sampleId.toUpperCase() && sampleId.includes('USDT');

    if (isBinance) {
        // "Safe Mode" WebSocket:
        // 1. Strict Filter: Only connect to Top liquid assets to prevent "Invalid Symbol" disconnects
        // 2. Stream Cap: Max 10 streams to prevent URL overflow (Binance Limit)
        const MAX_STREAMS = 10;
        const SAFE_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'LINKUSDT', 'TRXUSDT', 'MATICUSDT', 'LTCUSDT', 'UNIUSDT', 'ATOMUSDT', 'SUIUSDT', 'NEARUSDT', 'APTUSDT'];

        const validStreams = marketData
            .map(m => m.id)
            .filter(id => SAFE_SYMBOLS.includes(id))
            .slice(0, MAX_STREAMS)
            .map(id => id.toLowerCase() + '@miniTicker');

        // Use Binance Mainnet endpoint (more robust)
        const MAIN_WS = 'wss://stream.binance.com:9443/stream?streams=';
        const url = `${MAIN_WS}${validStreams.join('/')}`;
        const ws = new WebSocket(url);

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.data && msg.data.s && msg.data.c) {
                    const displaySymbol = msg.data.s.replace('USDT', '/USDT');
                    callback({ [displaySymbol]: parseFloat(msg.data.c) });
                }
            } catch (e) { }
        };
        return () => ws.close();
    } else {
        const ids = marketData.map(m => m.id).join(',');
        const ws = new WebSocket(`wss://ws.coincap.io/prices?assets=${ids}`);
        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                const update: Record<string, number> = {};
                Object.keys(msg).forEach(key => {
                    const item = marketData.find(m => m.id === key);
                    if (item) {
                        update[item.symbol] = parseFloat(msg[key]);
                    }
                });
                callback(update);
            } catch (e) { }
        };
        return () => ws.close();
    }
};

export const getFearAndGreedIndex = async (): Promise<FearAndGreedData | null> => {
    try {
        const response = await fetchWithTimeout('https://api.alternative.me/fng/', {}, 3000);
        if (!response.ok) return null;
        const json = await response.json();
        return json.data[0];
    } catch (e) {
        return null;
    }
};

// --- HELPER FUNCTIONS ---

export const mapBinanceToCoinCap = (symbol: string) => {
    const map: Record<string, string> = { 'BTCUSDT': 'bitcoin', 'ETHUSDT': 'ethereum', 'SOLUSDT': 'solana', 'DOGEUSDT': 'dogecoin', 'BNBUSDT': 'binance-coin', 'XRPUSDT': 'xrp', 'ADAUSDT': 'cardano' };
    return map[symbol];
}

export const fetchCandles = async (symbolId: string, interval: string): Promise<{ timestamp: number, close: number, volume: number, high: number, low: number, open: number }[]> => {
    const isBinance = symbolId === symbolId.toUpperCase() && symbolId.endsWith('USDT');

    // --- SMART CACHING LAYER ---
    const cacheKey = `candles_${symbolId}_${interval}`;
    const cachedData = SmartCache.get<any[]>(cacheKey);

    if (cachedData) {
        // console.log(`[SmartCache] Hit for ${symbolId} (${interval})`); 
        return cachedData;
    }

    try {
        if (isBinance) {
            // Fetching 1000 candles to ensure deep data for EMA200 calculation (Institutional Precision)
            const res = await fetchWithTimeout(`${BINANCE_API_BASE}/klines?symbol=${symbolId}&interval=${interval}&limit=1000`, {}, 8000);
            if (!res.ok) throw new Error("Binance Candle Error");
            const data = await res.json();
            const parsedData = data.map((d: any[]) => ({
                timestamp: d[0],
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4]),
                volume: parseFloat(d[5])
            }));

            // Determine TTL based on Interval (Hybrid Freshness)
            let ttl = SmartCache.TTL.MICRO; // Default 30s
            if (interval === '1h') ttl = SmartCache.TTL.SHORT;
            if (interval === '4h') ttl = SmartCache.TTL.MEDIUM;
            if (interval === '1d' || interval === '1w') ttl = SmartCache.TTL.LONG;

            // Save to Cache
            SmartCache.set(cacheKey, parsedData, ttl);

            return parsedData;
        } else {
            const intervalMap: Record<string, string> = {
                '15m': 'm15',
                '1h': 'h1',
                '4h': 'h4',
                '1d': 'd1',
                '1w': 'w1'
            };
            const ccInterval = intervalMap[interval] || 'h1'; // Default to h1 if unknown
            const res = await fetchWithTimeout(`${COINCAP_API_BASE}/candles?exchange=binance&interval=${ccInterval}&baseId=${symbolId}&quoteId=tether`, {}, 4000);
            if (!res.ok) return [];
            const json = await res.json();
            const parsedData = json.data.map((d: any) => ({
                timestamp: d.period,
                open: parseFloat(d.open),
                high: parseFloat(d.high),
                low: parseFloat(d.low),
                close: parseFloat(d.close),
                volume: parseFloat(d.volume)
            }));

            // Determine TTL based on Interval (Hybrid Freshness)
            let ttl = SmartCache.TTL.MICRO; // Default 30s
            if (interval === '1h') ttl = SmartCache.TTL.SHORT;
            if (interval === '4h') ttl = SmartCache.TTL.MEDIUM;
            if (interval === '1d' || interval === '1w') ttl = SmartCache.TTL.LONG;

            // Save to Cache
            SmartCache.set(cacheKey, parsedData, ttl);

            return parsedData;
        }
    } catch (e) {
        // Retry with CoinCap logic if Binance fails (or vice versa handled by mapBinanceToCoinCap caller)
        if (isBinance) {
            const fallbackId = mapBinanceToCoinCap(symbolId);
            if (fallbackId) {
                try {
                    const intervalMap: Record<string, string> = {
                        '15m': 'm15',
                        '1h': 'h1',
                        '4h': 'h4',
                        '1d': 'd1',
                        '1w': 'w1'
                    };
                    const ccInterval = intervalMap[interval] || 'h1';
                    const res = await fetchWithTimeout(`${COINCAP_API_BASE}/candles?exchange=binance&interval=${ccInterval}&baseId=${fallbackId}&quoteId=tether`, {}, 4000);
                    if (!res.ok) return [];
                    const json = await res.json();
                    const parsedData = json.data.map((d: any) => ({
                        timestamp: d.period,
                        open: parseFloat(d.open),
                        high: parseFloat(d.high),
                        low: parseFloat(d.low),
                        close: parseFloat(d.close),
                        volume: parseFloat(d.volume)
                    }));

                    // Determine TTL based on Interval (Hybrid Freshness)
                    let ttl = SmartCache.TTL.MICRO; // Default 30s
                    if (interval === '1h') ttl = SmartCache.TTL.SHORT;
                    if (interval === '4h') ttl = SmartCache.TTL.MEDIUM;
                    if (interval === '1d' || interval === '1w') ttl = SmartCache.TTL.LONG;

                    // Save to Cache
                    SmartCache.set(cacheKey, parsedData, ttl);

                    return parsedData;
                } catch (err) { return []; }
            }
        }
        return [];
    }
};

export const fetchOrderBook = async (symbol: string, limit: number = 50): Promise<{ bids: [string, string][], asks: [string, string][] } | null> => {
    try {
        const res = await fetchWithTimeout(`${BINANCE_API_BASE}/depth?symbol=${symbol}&limit=${limit}`, {}, 3000);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
};

export const subscribeToSymbol = (symbol: string, onUpdate: (data: any) => void, onError: (error: any) => void) => {
    // Implementación básica de suscripción para un solo símbolo
    // Reutiliza la lógica de subscribeToLivePrices pero filtrando
    const dummyMarketData: MarketData[] = [{ id: symbol, symbol: symbol, price: 0, change24h: 0, rsi: 0, volume: '0', trend: 'neutral' }];
    return subscribeToLivePrices(dummyMarketData, (data) => {
        if (data[symbol]) {
            onUpdate({ symbol, price: data[symbol] });
        }
    });
};

export { MEME_SYMBOLS };
