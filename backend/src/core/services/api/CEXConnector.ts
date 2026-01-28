import crypto from 'crypto';
import { SmartFetch } from '../SmartFetch';

/**
 * CEX CONNECTOR - Institutional Grade
 * 
 * Manages authenticated connections to Centralized Exchanges.
 * Required for:
 * 1. High-frequency market data (CVD, Order Flow)
 * 2. Higher rate limits (Public APIs are easily throttled)
 * 3. 100% Data Integrity (No simulated fallbacks)
 */
export class CEXConnector {
    // Endpoints
    private static BINANCE_FUTURES_URL = 'https://fapi.binance.com';
    private static BINANCE_SPOT_URL = 'https://api.binance.com';

    private static getAuth() {
        return {
            key: process.env.BINANCE_API_KEY || '',
            secret: process.env.BINANCE_API_SECRET || ''
        };
    }

    /**
     * Executes an authenticated GET request to Binance Futures
     */
    public static async getBinanceFutures<T>(path: string, params: Record<string, any> = {}): Promise<{ data: T | null; integrity: number }> {
        const { key, secret } = this.getAuth();
        if (!key || !secret) {
            console.warn("[CEXConnector] Binance API Keys missing. Falling back to Public (Reduced Integrity).");
            return { data: null, integrity: 0.5 };
        }

        try {
            const timestamp = Date.now();
            const queryParams = { ...params, timestamp };
            const queryString = Object.entries(queryParams)
                .map(([k, val]) => `${k}=${val}`)
                .join('&');

            const signature = crypto
                .createHmac('sha256', secret)
                .update(queryString)
                .digest('hex');

            const url = `${this.BINANCE_FUTURES_URL}${path}?${queryString}&signature=${signature}`;

            const data = await SmartFetch.get<T>(url, {
                headers: {
                    'X-MBX-APIKEY': key
                }
            });

            return { data, integrity: 1.0 };
        } catch (e: any) {
            // Handle Geo-Block explicitly
            if (e.message?.includes('Geo-Block')) {
                console.error(`[CEXConnector] Geo-Block detected. Bifrost tunnel might be required or misconfigured.`);
            }
            console.error(`[CEXConnector] Authenticated Binance request failed: ${path}`, e.message || e);
            return { data: null, integrity: 0 };
        }
    }

    /**
     * Fetch 24h Tickers for all USDT pairs
     */
    public static async getTickers(): Promise<{ data: any[] | null; integrity: number }> {
        // We use the futures tickers as they are more relevant for the trading system
        return this.getBinanceFutures<any[]>('/fapi/v1/ticker/24hr');
    }

    /**
     * Fetch Klines (Candles) for a specific symbol
     */
    public static async getKlines(symbol: string, interval: string, limit: number = 500): Promise<{ data: any[] | null; integrity: number }> {
        const normalizedSymbol = symbol.replace('/', '').toUpperCase();
        return this.getBinanceFutures<any[]>('/fapi/v1/klines', {
            symbol: normalizedSymbol,
            interval,
            limit
        });
    }

    /**
     * Specialized: Fetch REAL Taker Buy/Sell Volume (CVD)
     * High Fidelity: Uses REAL taker volume from klines which works through proxies.
     */
    public static async getRealCVD(symbol: string, interval: string = '5m'): Promise<{ delta: number; integrity: number }> {
        try {
            // Use the internal getKlines which handles auth and proxying
            const { data, integrity } = await this.getKlines(symbol, interval, 1);

            if (data && data.length > 0) {
                const kline = data[0];
                const totalVol = parseFloat(kline[5]);
                const takerBuyVol = parseFloat(kline[9]); // Index 9: Taker Buy Base Asset Volume
                const takerSellVol = totalVol - takerBuyVol;

                // Calculate normalized delta (-1 to 1)
                const delta = totalVol > 0 ? (takerBuyVol - takerSellVol) / totalVol : 0;

                return { delta, integrity };
            }
        } catch (e: any) {
            console.error(`[CEXConnector] Failed to fetch CVD from Klines: ${e.message}`);
        }

        return { delta: 0, integrity: 0 };
    }

    /**
     * Specialized: Fetch Open Interest Dynamics
     * High Fidelity: Uses public API which works through current proxy.
     */
    public static async getOpenInterest(symbol: string): Promise<{ value: number | null; integrity: number }> {
        const normalizedSymbol = symbol.replace('/', '').toUpperCase();

        try {
            const url = `${this.BINANCE_FUTURES_URL}/fapi/v1/openInterest?symbol=${normalizedSymbol}`;
            const data = await SmartFetch.get<any>(url);

            return {
                value: data ? parseFloat(data.openInterest) : null,
                integrity: data ? 1.0 : 0
            };
        } catch (e: any) {
            console.error(`[CEXConnector] Failed to fetch Open Interest: ${e.message}`);
            return { value: null, integrity: 0 };
        }
    }
}
