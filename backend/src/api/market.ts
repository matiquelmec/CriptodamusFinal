/**
 * Market API Routes (TypeScript Version)
 * Proxy con caché para APIs de crypto
 */

import express, { Request, Response } from 'express';
import axios from 'axios';
import NodeCache from 'node-cache';
import { SmartFetch } from '../core/services/SmartFetch';

const router = express.Router();
const cache = new NodeCache({ stdTTL: 30 }); // Cache de 30 segundos

// Interfaces
interface MarketPrice {
    symbol: string;
    price: number;
    change24h?: number;
    volume24h?: number;
    high24h?: number;
    low24h?: number;
    marketCap?: number;
    source?: 'binance' | 'coincap';
    error?: boolean;
    message?: string;
}

interface SignalData {
    symbol: string;
    signal: 'BUY' | 'SELL' | 'NEUTRAL';
    strength: number;
    price: number;
    indicators: {
        rsi: number;
        sma20: number;
        sma50: number;
        volume: number;
    };
    timestamp: number;
}

interface TrendingCoin {
    symbol: string;
    price: number;
    change24h: number;
    volume: number;
}

/**
 * GET /api/v1/market/prices
 * Obtiene precios de múltiples criptomonedas
 */
router.get('/prices', async (req: Request, res: Response) => {
    try {
        const symbolsParam = req.query.symbols as string;
        const symbols = symbolsParam?.split(',') || ['BTC', 'ETH', 'SOL'];
        const cacheKey = `prices:${symbols.join(',')}`;

        // Verificar caché
        const cached = cache.get(cacheKey);
        if (cached) {
            return res.json({ data: cached, cached: true });
        }

        // Obtener precios
        const prices = await Promise.all(
            symbols.map(async (symbol) => {
                try {
                    // Intentar Binance
                    const response = await axios.get(
                        `https://api.binance.com/api/v3/ticker/24hr`,
                        {
                            params: { symbol: `${symbol}USDT` },
                            timeout: 3000
                        }
                    );

                    return {
                        symbol,
                        price: parseFloat(response.data.lastPrice),
                        change24h: parseFloat(response.data.priceChangePercent),
                        volume24h: parseFloat(response.data.volume),
                        high24h: parseFloat(response.data.highPrice),
                        low24h: parseFloat(response.data.lowPrice),
                        source: 'binance'
                    } as MarketPrice;
                } catch (error) {
                    // Fallback a CoinCap
                    try {
                        const response = await axios.get(
                            `https://api.coincap.io/v2/assets/${symbol.toLowerCase()}`,
                            { timeout: 3000 }
                        );

                        return {
                            symbol,
                            price: parseFloat(response.data.data.priceUsd),
                            change24h: parseFloat(response.data.data.changePercent24Hr),
                            volume24h: parseFloat(response.data.data.volumeUsd24Hr),
                            marketCap: parseFloat(response.data.data.marketCapUsd),
                            source: 'coincap'
                        } as MarketPrice;
                    } catch {
                        return {
                            symbol,
                            price: 0,
                            error: true,
                            message: 'Unable to fetch price'
                        } as MarketPrice;
                    }
                }
            })
        );

        // Guardar en caché
        cache.set(cacheKey, prices);

        res.json({
            data: prices,
            timestamp: Date.now(),
            cached: false
        });

    } catch (error: any) {
        console.error('Market prices error:', error);
        res.status(500).json({ error: 'Failed to fetch prices' });
    }
});

// ALIGNED: Use the "God Mode" Scanner Service instead of basic logic
import { scannerService } from '../services/scanner';

/**
 * GET /api/v1/market/signals
 * Retrieves the latest institutional-grade opportunities from the autonomous scanner.
 * Normalized to match WebSocket 'ai_opportunities' event.
 */
router.get('/signals', async (req: Request, res: Response) => {
    try {
        const opportunities = scannerService.getLatestOpportunities();
        const status = scannerService.getLastStatus();

        // If scanner is booting or empty, we return a helpful status
        if (opportunities.length === 0) {
            return res.json({
                data: [],
                status: status,
                message: "Scanner is initializing or no high-confluence signals found.",
                timestamp: Date.now()
            });
        }

        res.json({
            data: opportunities,
            count: opportunities.length,
            system_status: status,
            timestamp: Date.now()
        });

    } catch (error: any) {
        console.error('Signals API Error:', error);
        res.status(500).json({ error: 'Failed to retrieve scanner data' });
    }
});

/**
 * GET /api/v1/market/trending
 * Obtiene las criptos trending
 */
router.get('/trending', async (req: Request, res: Response) => {
    try {
        const cached = cache.get('trending');
        if (cached) {
            return res.json({ data: cached, cached: true });
        }

        // Obtener top gainers de Binance
        const binanceData = await SmartFetch.get<any>(
            'https://api.binance.com/api/v3/ticker/24hr'
        );

        const usdtPairs: TrendingCoin[] = binanceData
            .filter((t: any) => t.symbol.endsWith('USDT'))
            .map((t: any) => ({
                symbol: t.symbol.replace('USDT', ''),
                price: parseFloat(t.lastPrice),
                change24h: parseFloat(t.priceChangePercent),
                volume: parseFloat(t.volume)
            }))
            .sort((a: TrendingCoin, b: TrendingCoin) => b.change24h - a.change24h)
            .slice(0, 10);

        cache.set('trending', usdtPairs, 300); // Cache 5 minutos

        res.json({
            data: usdtPairs,
            cached: false,
            timestamp: Date.now()
        });

    } catch (error: any) {
        console.error('Trending error:', error);
        res.status(500).json({ error: 'Failed to fetch trending' });
    }
});

// Función helper para calcular RSI
function calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// --- GOD MODE ENDPOINTS ---

import { binanceStream } from '../services/binanceStream';

/**
 * GET /api/v1/market/depth/:symbol
 * Get Order Book Snapshot (God Mode Lite)
 */
router.get('/depth/:symbol', async (req: Request, res: Response) => {
    try {
        const symbol = req.params.symbol.toLowerCase();
        // @ts-ignore - waiting for binanceStream update
        const depth = binanceStream.getDepth(symbol);
        if (!depth) {
            return res.status(404).json({ error: 'No depth data. Stream might be initializing.' });
        }
        res.json(depth);
    } catch (e) {
        res.status(500).json({ error: 'Depth fetch error' });
    }
});

export default router;
