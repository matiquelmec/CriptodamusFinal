import { MarketData, FearAndGreedData } from '../../types';
import { SmartCache } from './caching/smartCache'; // NEW: Smart Caching Service
import { CEXConnector } from './CEXConnector'; // NEW: Professional Source

// --- INTERFACES TO REMOVE 'ANY' RISKS ---
interface BinanceTicker {
    symbol: string;
    lastPrice: string;
    priceChangePercent: string;
    quoteVolume: string;
}

interface CoinCapAsset {
    id: string;
    symbol: string;
    priceUsd: string;
    changePercent24Hr: string;
    volumeUsd24Hr: string;
}

// NEW: CoinGecko Interface
interface CoinGeckoAsset {
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    price_change_percentage_24h: number;
    total_volume: number;
}

// NEW: CryptoCompare Interface
interface CryptoCompareTicker {
    USD: {
        PRICE: number;
        CHANGEPCT24HOUR: number;
        VOLUME24HOURTO: number; // Quote Volume in USD
    }
}

interface BinanceKline {
    // [0, "4.10", "4.20", "4.08", "4.15", "1000.00", ...]
    0: number; // Open Time
    1: string; // Open
    2: string; // High
    3: string; // Low
    4: string; // Close
    5: string; // Volume
}

// PRIMARY: Binance Vision (CORS friendly for public data)
const BINANCE_API_BASE = 'https://data-api.binance.vision/api/v3';
// Fallback / WebSocket base
const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/stream?streams=';

// FALLBACK 1: CoinCap (Very reliable for frontend)
const COINCAP_API_BASE = 'https://api.coincap.io/v2';

// FALLBACK 2: CoinGecko (Proven to work when others blocked)
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

// FALLBACK 3: CryptoCompare (Robust backup)
const CRYPTOCOMPARE_API_BASE = 'https://min-api.cryptocompare.com/data';

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

// --- MAIN ORCHESTRATOR ---
export const fetchCryptoData = async (mode: 'volume' | 'memes' = 'volume'): Promise<MarketData[]> => {
    // 1. Try Binance (Primary)
    try {
        const data = await fetchBinanceMarkets(mode);
        if (data.length === 0) throw new Error("Empty Binance Data");
        return data;
    } catch (error) {
        console.warn("[API] Binance failed, trying CoinCap...", error);
    }

    // 2. Try CoinCap (Fallback 1)
    try {
        const data = await fetchCoinCapMarkets(mode);
        if (data.length === 0) throw new Error("Empty CoinCap Data");
        console.log("[API] Recovered with CoinCap data.");
        return data;
    } catch (error) {
        console.warn("[API] CoinCap failed (DNS/Block?), trying CoinGecko...", error);
    }

    // 3. Try CoinGecko (Fallback 2 - The Savior)
    try {
        const data = await fetchCoinGeckoMarkets(mode);
        if (data.length === 0) throw new Error("Empty CoinGecko Data");
        console.log("[API] Recovered with CoinGecko data (Robust Mode).");
        return data;
    } catch (error) {
        console.warn("[API] CoinGecko failed, trying CryptoCompare...", error);
    }

    // 4. Try CryptoCompare (Fallback 3 - Last Resort)
    try {
        const data = await fetchCryptoCompareMarkets(mode);
        if (data.length === 0) throw new Error("Empty CryptoCompare Data");
        console.log("[API] Recovered with CryptoCompare data (Last Resort).");
        return data;
    } catch (error) {
        console.error("[API] CRITICAL: All data providers failed.");
        throw error; // Propagate failure if everything fails
    }
};

// --- HELPER TO IMPORT CONFIG (Lazy Import to avoid cycle if config uses api) ---
// Actually, config is safe.
import { TradingConfig } from '../../config/tradingConfig';

// --- BINANCE FETCH STRATEGY ---
const fetchBinanceMarkets = async (mode: 'volume' | 'memes'): Promise<MarketData[]> => {
    try {
        const { data, integrity } = await CEXConnector.getTickers();
        if (!data || !Array.isArray(data)) throw new Error("Binance Authenticated Ticker failed");

        // [STRICT] TOURNAMENT MODE ASSET FILTER (Source Level)
        let allowedSymbols: string[] = [];
        if (TradingConfig.TOURNAMENT_MODE) {
            allowedSymbols = [...TradingConfig.assets.tournament_list]; // Copy readonly to mutable
            // console.log(`[BinanceAPI] 🏆 Tournament Mode: Filtering for ${allowedSymbols.length} Elite Assets only.`);
        }

        // Ignored symbols (Stablecoins, Leverage tokens, Non-tradable)
        const ignoredPatterns = [
            'USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'USDPUSDT', 'EURUSDT', 'DAIUSDT', 'BUSDUSDT',
            'UPUSDT', 'DOWNUSDT', 'BULLUSDT', 'BEARUSDT', 'USDT',
            'USDEUSDT', 'USD1USDT', 'BFUSDUSDT', 'AEURUSDT'
        ];

        let filteredData = data.filter((ticker: any) => {
            const symbol = ticker.symbol;

            // 0. TOURNAMENT WHITELIST CHECK
            if (TradingConfig.TOURNAMENT_MODE) {
                // Exact match check (symbol usually comes as 'BTCUSDT' from binance)
                if (!allowedSymbols.includes(symbol)) return false;
            }

            return symbol.endsWith('USDT') &&
                !ignoredPatterns.includes(symbol) &&
                !symbol.includes('DOWN') &&
                !symbol.includes('UP');
        });

        if (mode === 'memes') {
            filteredData = filteredData.filter((ticker: any) => {
                const baseSymbol = ticker.symbol.replace('USDT', '');
                return MEME_SYMBOLS.includes(baseSymbol) || MEME_SYMBOLS.includes(baseSymbol.replace('1000', ''));
            });
            filteredData = filteredData.sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
        } else {
            // Default: Top 50 by Volume
            filteredData = filteredData
                .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
                .slice(0, 50);
        }

        return filteredData.map((ticker: any) => {
            const rawSymbol = ticker.symbol.replace('USDT', '');
            return {
                id: ticker.symbol,
                symbol: `${rawSymbol}/USDT`,
                price: parseFloat(ticker.lastPrice),
                change24h: parseFloat(ticker.priceChangePercent),
                rsi: 50,
                volume: formatVolume(parseFloat(ticker.quoteVolume)),
                rawVolume: parseFloat(ticker.quoteVolume),
                trend: (parseFloat(ticker.priceChangePercent) > 0.5 ? 'bullish' : 'bearish') as 'bullish' | 'bearish'
            };
        });
    } catch (e) {
        throw e;
    }
};

// --- COINCAP FETCH STRATEGY (FALLBACK 1) ---
const fetchCoinCapMarkets = async (mode: 'volume' | 'memes'): Promise<MarketData[]> => {
    try {
        const response = await fetchWithTimeout(`${COINCAP_API_BASE}/assets?limit=100`);
        if (!response.ok) return [];

        const json = await response.json();
        let assets: CoinCapAsset[] = json.data;

        if (mode === 'memes') {
            assets = assets.filter((asset: CoinCapAsset) =>
                MEME_SYMBOLS.includes(asset.symbol.toUpperCase())
            );
        } else {
            assets = assets.slice(0, 50);
        }

        return assets.map((asset: CoinCapAsset) => ({
            id: asset.id, // CoinCap ID (e.g. 'bitcoin')
            symbol: `${asset.symbol}/USDT`,
            price: parseFloat(asset.priceUsd),
            change24h: parseFloat(asset.changePercent24Hr),
            rsi: 50,
            volume: formatVolume(parseFloat(asset.volumeUsd24Hr)),
            rawVolume: parseFloat(asset.volumeUsd24Hr),
            trend: (parseFloat(asset.changePercent24Hr) > 0.5 ? 'bullish' : 'bearish') as 'bullish' | 'bearish'
        }));
    } catch (e) {
        throw e;
    }
};

// --- COINGECKO FETCH STRATEGY (FALLBACK 2) ---
const fetchCoinGeckoMarkets = async (mode: 'volume' | 'memes'): Promise<MarketData[]> => {
    try {
        // Fetch top 50 by market cap
        const response = await fetchWithTimeout(`${COINGECKO_API_BASE}/coins/markets?vs_currency=usd&order=volume_desc&per_page=50&page=1&sparkline=false`, {}, 6000);
        if (!response.ok) return [];

        const assets: CoinGeckoAsset[] = await response.json();
        let filtered = assets;

        // TOURNAMENT MODE FILTER
        if (TradingConfig.TOURNAMENT_MODE) {
            const allowedSymbols = TradingConfig.assets.tournament_list.map(s => s.replace('USDT', ''));
            filtered = filtered.filter(a => allowedSymbols.includes(a.symbol.toUpperCase()));
        }

        if (mode === 'memes') {
            filtered = filtered.filter(a => MEME_SYMBOLS.includes(a.symbol.toUpperCase()));
        }

        return filtered.map(asset => ({
            id: asset.id, // CoinGecko ID (e.g. 'bitcoin')
            symbol: `${asset.symbol.toUpperCase()}/USDT`,
            price: asset.current_price,
            change24h: asset.price_change_percentage_24h,
            rsi: 50,
            volume: formatVolume(asset.total_volume),
            rawVolume: asset.total_volume,
            trend: (asset.price_change_percentage_24h > 0.5 ? 'bullish' : 'bearish') as 'bullish' | 'bearish'
        }));
    } catch (e) {
        throw e;
    }
};

// --- CRYPTOCOMPARE FETCH STRATEGY (FALLBACK 3) ---
const fetchCryptoCompareMarkets = async (mode: 'volume' | 'memes'): Promise<MarketData[]> => {
    // CC requires comma separated list for MultiPrice, MultiFull is better but requires list
    // Use TopList Endpoint
    try {
        const url = `${CRYPTOCOMPARE_API_BASE}/top/mktcapfull?limit=50&tsym=USD`;
        const response = await fetchWithTimeout(url);
        if (!response.ok) return [];

        const json = await response.json();
        const data = json.Data; // Array of objects

        let filtered = data;

        if (TradingConfig.TOURNAMENT_MODE) {
            const allowedSymbols = TradingConfig.assets.tournament_list.map(s => s.replace('USDT', ''));
            filtered = filtered.filter((d: any) => allowedSymbols.includes(d.CoinInfo.Name));
        }

        return filtered.map((d: any) => {
            const raw = d.RAW?.USD;
            if (!raw) return null;

            return {
                id: d.CoinInfo.Name, // Symbol as ID since CC uses symbol
                symbol: `${d.CoinInfo.Name}/USDT`,
                price: raw.PRICE,
                change24h: raw.CHANGEPCT24HOUR,
                rsi: 50,
                volume: formatVolume(raw.VOLUME24HOURTO),
                rawVolume: raw.VOLUME24HOURTO,
                trend: (raw.CHANGEPCT24HOUR > 0.5 ? 'bullish' : 'bearish') as 'bullish' | 'bearish'
            };
        }).filter((x: any) => x !== null);

    } catch (e) {
        throw e;
    }
}

// General subscription for the main scanner
export const subscribeToLivePrices = (marketData: MarketData[], callback: (data: Record<string, number>) => void) => {
    console.warn("subscribeToLivePrices called in backend context - use binanceStream.ts instead");
    return () => { };
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
    const map: Record<string, string> = {
        'BTCUSDT': 'bitcoin',
        'ETHUSDT': 'ethereum',
        'SOLUSDT': 'solana',
        'DOGEUSDT': 'dogecoin',
        'BNBUSDT': 'binance-coin',
        'XRPUSDT': 'xrp',
        'ADAUSDT': 'cardano',
        'PAXGUSDT': 'pax-gold',
        'NEARUSDT': 'near-protocol',
        'SUIUSDT': 'sui',
        'AVAXUSDT': 'avalanche-2', // Updated to correct ID
        'LINKUSDT': 'chainlink',
        'DOTUSDT': 'polkadot',
        'TRXUSDT': 'tron',
        'SHIBUSDT': 'shiba-inu',
        'PEPEUSDT': 'pepe',
        'BONKUSDT': 'bonk',
        'WIFUSDT': 'dogwifhat',
        'FLOKIUSDT': 'floki'
    };
    return map[symbol];
}

// Reuse same map logic for CoinGecko usually works, but safe to verify
export const mapBinanceToCoinGecko = (symbol: string) => {
    const map: Record<string, string> = {
        'BTCUSDT': 'bitcoin',
        'ETHUSDT': 'ethereum',
        'SOLUSDT': 'solana',
        'DOGEUSDT': 'dogecoin',
        'BNBUSDT': 'binancecoin', // Differs from CoinCap (binance-coin)
        'XRPUSDT': 'ripple',      // Differs (xrp vs ripple)
        'ADAUSDT': 'cardano',
        'PAXGUSDT': 'pax-gold',
        'NEARUSDT': 'near',
        'SUIUSDT': 'sui',
        'AVAXUSDT': 'avalanche-2',
        'LINKUSDT': 'chainlink',
        'DOTUSDT': 'polkadot',
        'TRXUSDT': 'tron',
        'SHIBUSDT': 'shiba-inu',
        'PEPEUSDT': 'pepe',
        'BONKUSDT': 'bonk',
        'WIFUSDT': 'dogwifhat',
        'FLOKIUSDT': 'floki'
    };
    return map[symbol];
}


// Update return type
export const fetchCandles = async (symbolId: string, interval: string): Promise<{ timestamp: number, close: number, volume: number, high: number, low: number, open: number, takerBuyBaseVolume: number }[]> => {
    const isBinanceId = symbolId === symbolId.toUpperCase() && symbolId.endsWith('USDT');

    // --- SMART CACHING LAYER ---
    const cacheKey = `candles_${symbolId}_${interval}`;
    const cachedData = SmartCache.get<any[]>(cacheKey);

    if (cachedData) {
        return cachedData;
    }

    // 1. TRY BINANCE (Authenticated/Proxy)
    if (isBinanceId) {
        try {
            const { data, integrity } = await CEXConnector.getKlines(symbolId, interval, 500); // 500 is safer size
            if (data) {
                const parsedData = data.map((d: any) => ({
                    timestamp: Number(d[0]),
                    open: parseFloat(String(d[1])),
                    high: parseFloat(String(d[2])),
                    low: parseFloat(String(d[3])),
                    close: parseFloat(String(d[4])),
                    volume: parseFloat(String(d[5])),
                    takerBuyBaseVolume: parseFloat(String(d[9]))
                }));
                // Save to Cache
                SmartCache.set(cacheKey, parsedData, SmartCache.TTL.SHORT);
                return parsedData;
            }
        } catch (e) { /* Fallthrough */ }
    }

    // 2. TRY COINCAP (Fallback 1)
    try {
        // Resolve ID
        const ccId = isBinanceId ? mapBinanceToCoinCap(symbolId) : symbolId;
        if (!ccId) throw new Error("No CoinCap ID");

        const intervalMap: Record<string, string> = {
            '15m': 'm15', '1h': 'h1', '4h': 'h4', '1d': 'd1', '1w': 'w1'
        };
        const ccInterval = intervalMap[interval] || 'h1';

        const res = await fetchWithTimeout(`${COINCAP_API_BASE}/candles?exchange=binance&interval=${ccInterval}&baseId=${ccId}&quoteId=tether`, {}, 4000);
        if (res.ok) {
            const json = await res.json();
            const parsedData = json.data.map((d: any) => ({
                timestamp: d.period,
                open: parseFloat(d.open),
                high: parseFloat(d.high),
                low: parseFloat(d.low),
                close: parseFloat(d.close),
                volume: parseFloat(d.volume),
                takerBuyBaseVolume: parseFloat(d.volume) * 0.5
            }));
            SmartCache.set(cacheKey, parsedData, SmartCache.TTL.SHORT);
            return parsedData;
        }
    } catch (e) { /* Fallthrough */ }

    // 3. TRY COINGECKO (Fallback 2)
    try {
        const cgId = isBinanceId ? mapBinanceToCoinGecko(symbolId) : symbolId;
        if (!cgId) throw new Error("No CoinGecko ID");

        // Days param: 1 = ~30min candles, 14 = 4h candles
        let days = '1';
        if (interval === '4h' || interval === '1d') days = '30';

        const res = await fetchWithTimeout(`${COINGECKO_API_BASE}/coins/${cgId}/ohlc?vs_currency=usd&days=${days}`, {}, 6000);
        if (res.ok) {
            const json = await res.json();
            const parsedData = json.map((d: any[]) => ({
                timestamp: d[0],
                open: d[1],
                high: d[2],
                low: d[3],
                close: d[4],
                volume: 1000000,
                takerBuyBaseVolume: 500000
            }));
            SmartCache.set(cacheKey, parsedData, SmartCache.TTL.MEDIUM); // Higher TTL to save generic API limit
            return parsedData;
        }
    } catch (e) { /* Fallthrough */ }

    // 4. TRY CRYPTOCOMPARE (Fallback 3)
    try {
        // CC uses symbol (BTC), not ID
        const sym = isBinanceId ? symbolId.replace('USDT', '') : symbolId;
        // CC Histo endpoint
        const url = `${CRYPTOCOMPARE_API_BASE}/${interval === '1d' ? 'histoday' : interval === '1h' || interval === '4h' ? 'histohour' : 'histominute'}?fsym=${sym}&tsym=USD&limit=200`;

        const res = await fetchWithTimeout(url);
        if (res.ok) {
            const json = await res.json();
            if (json.Response === 'Success') {
                const parsedData = json.Data.map((d: any) => ({
                    timestamp: d.time * 1000,
                    open: d.open,
                    high: d.high,
                    low: d.low,
                    close: d.close,
                    volume: d.volumeto,
                    takerBuyBaseVolume: d.volumeto * 0.5
                }));
                SmartCache.set(cacheKey, parsedData, SmartCache.TTL.SHORT);
                return parsedData;
            }
        }
    } catch (e) { /* Fallthrough */ }

    return [];
};

export const fetchOrderBook = async (symbol: string, limit: number = 50): Promise<{ bids: [string, string][], asks: [string, string][] } | null> => {
    try {
        const { data, integrity } = await CEXConnector.getBinanceFutures<any>('/fapi/v1/depth', {
            symbol: symbol,
            limit: limit
        });
        return data;
    } catch (e) {
        return null; // Orderbook hard to fallback securely without premium APIs
    }
};

export const subscribeToSymbol = (symbol: string, onUpdate: (data: any) => void, onError: (error: any) => void) => {
    // Stub
    return subscribeToLivePrices([], () => { });
};

export { MEME_SYMBOLS };
