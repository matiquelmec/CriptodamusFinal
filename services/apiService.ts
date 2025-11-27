/**
 * API Service - Capa de abstracción para todas las llamadas HTTP
 * Incluye retry logic, caché y fallback chains
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { cacheService, CacheTTL } from './cacheService';

interface ApiConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

class ApiService {
  private axiosInstance: AxiosInstance;
  private readonly DEFAULT_TIMEOUT = 5000;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;

  constructor(config?: ApiConfig) {
    this.axiosInstance = axios.create({
      timeout: config?.timeout || this.DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Agregar timestamp para tracking
        config.metadata = { startTime: new Date() };
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Log response time
        const endTime = new Date();
        const startTime = response.config.metadata?.startTime;
        if (startTime) {
          const duration = endTime.getTime() - startTime.getTime();
          console.debug(`API call took ${duration}ms: ${response.config.url}`);
        }
        return response;
      },
      async (error: AxiosError) => {
        const config = error.config;

        // Retry logic
        if (config && !config.retry) {
          config.retry = 0;
        }

        if (config && config.retry < this.MAX_RETRIES) {
          config.retry++;

          // Exponential backoff
          const delay = this.RETRY_DELAY * Math.pow(2, config.retry - 1);
          await new Promise(resolve => setTimeout(resolve, delay));

          console.warn(`Retrying request (${config.retry}/${this.MAX_RETRIES}):`, config.url);
          return this.axiosInstance(config);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * GET request con caché
   */
  async get<T>(url: string, options?: {
    params?: any;
    ttl?: number;
    useCache?: boolean;
    cacheKey?: string;
  }): Promise<T> {
    const cacheKey = options?.cacheKey || `GET:${url}:${JSON.stringify(options?.params || {})}`;

    // Si useCache es false, no usar caché
    if (options?.useCache === false) {
      const response = await this.axiosInstance.get<T>(url, { params: options?.params });
      return response.data;
    }

    // Usar caché por defecto
    return cacheService.withCache(
      cacheKey,
      async () => {
        const response = await this.axiosInstance.get<T>(url, { params: options?.params });
        return response.data;
      },
      options?.ttl || CacheTTL.MARKET_DATA
    );
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: any, options?: { ttl?: number }): Promise<T> {
    const response = await this.axiosInstance.post<T>(url, data);

    // Invalidar caché relacionado
    cacheService.invalidatePattern(url);

    return response.data;
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.axiosInstance.put<T>(url, data);

    // Invalidar caché relacionado
    cacheService.invalidatePattern(url);

    return response.data;
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string): Promise<T> {
    const response = await this.axiosInstance.delete<T>(url);

    // Invalidar caché relacionado
    cacheService.invalidatePattern(url);

    return response.data;
  }
}

// Instancias específicas para diferentes APIs
export const cryptoApi = new ApiService({
  timeout: 10000
});

// Funciones helper para APIs de crypto con fallback chain
export async function fetchCryptoPrice(symbol: string): Promise<number> {
  const cacheKey = `price:${symbol}`;

  return cacheService.withCache(
    cacheKey,
    async () => {
      // Intentar Binance primero
      try {
        const response = await cryptoApi.get<{ price: string }>(
          `https://api.binance.com/api/v3/ticker/price`,
          {
            params: { symbol: `${symbol}USDT` },
            ttl: CacheTTL.PRICE_DATA,
            useCache: false // No usar caché interno de axios para este
          }
        );
        return parseFloat(response.price);
      } catch (error) {
        console.warn('Binance API failed, trying CoinCap...');
      }

      // Fallback a CoinCap
      try {
        const response = await cryptoApi.get<{ data: { priceUsd: string } }>(
          `https://api.coincap.io/v2/assets/${symbol.toLowerCase()}`,
          {
            ttl: CacheTTL.PRICE_DATA,
            useCache: false
          }
        );
        return parseFloat(response.data.priceUsd);
      } catch (error) {
        console.warn('CoinCap API failed, trying CoinGecko...');
      }

      // Último fallback a CoinGecko (más lento pero confiable)
      try {
        const response = await cryptoApi.get<{ [key: string]: { usd: number } }>(
          `https://api.coingecko.com/api/v3/simple/price`,
          {
            params: {
              ids: symbol.toLowerCase(),
              vs_currencies: 'usd'
            },
            ttl: CacheTTL.PRICE_DATA,
            useCache: false
          }
        );
        return response[symbol.toLowerCase()].usd;
      } catch (error) {
        console.error('All price APIs failed');
        throw new Error(`Unable to fetch price for ${symbol}`);
      }
    },
    CacheTTL.PRICE_DATA
  );
}

export async function fetchMarketData(symbols: string[]): Promise<any[]> {
  const promises = symbols.map(async (symbol) => {
    try {
      const price = await fetchCryptoPrice(symbol);

      // Intentar obtener datos adicionales
      let change24h = 0;
      let volume24h = 0;

      try {
        const stats = await cryptoApi.get<any>(
          `https://api.binance.com/api/v3/ticker/24hr`,
          {
            params: { symbol: `${symbol}USDT` },
            ttl: CacheTTL.MARKET_DATA
          }
        );
        change24h = parseFloat(stats.priceChangePercent);
        volume24h = parseFloat(stats.volume);
      } catch {
        // Ignorar si no se pueden obtener stats
      }

      return {
        symbol,
        price,
        change24h,
        volume24h,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Failed to fetch data for ${symbol}:`, error);
      return {
        symbol,
        price: 0,
        change24h: 0,
        volume24h: 0,
        error: true,
        timestamp: Date.now()
      };
    }
  });

  return Promise.all(promises);
}

export default cryptoApi;