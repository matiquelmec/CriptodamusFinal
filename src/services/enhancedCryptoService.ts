/**
 * Enhanced Crypto Service - Wrapper Pattern
 * NO MODIFICA el servicio original, solo lo extiende con nuevas capacidades
 */

import {
  fetchCryptoData as originalFetchCryptoData,
  fetchDetailedMarketData as originalFetchDetailedMarketData,
  scanMarketOpportunities as originalScanMarketOpportunities,
  subscribeToSymbol as originalSubscribeToSymbol
} from './cryptoService';
import { MarketData, AIOpportunity, TradingStyle } from '../types';
import { API_CONFIG, getApiUrl, isFeatureEnabled } from './config';

// Cache simple en memoria (luego será Redis)
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Metrics collector (para analytics)
const metrics = {
  apiCalls: 0,
  cacheHits: 0,
  cacheMisses: 0,
  errors: 0,
};

/**
 * Enhanced fetchCryptoData con cache y fallback mejorado
 */
export const fetchCryptoData = async (mode: 'volume' | 'memes' = 'volume'): Promise<MarketData[]> => {
  const cacheKey = `crypto:${mode}`;

  try {
    // 1. Check memory cache first
    const cached = memoryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      metrics.cacheHits++;
      console.log(`[Cache HIT] ${cacheKey}`);
      return cached.data;
    }
    metrics.cacheMisses++;

    // 2. Si tenemos backend propio, usarlo
    if (API_CONFIG.USE_PROXY && API_CONFIG.BASE_URL) {
      try {
        const response = await fetch(getApiUrl(`/api/v1/market/${mode}`), {
          headers: {
            'X-Client-Version': '2.0.0',
            'X-Request-ID': crypto.randomUUID(),
          }
        });

        if (response.ok) {
          const result = await response.json();
          memoryCache.set(cacheKey, { data: result.data, timestamp: Date.now() });
          return result.data;
        }
      } catch (backendError) {
        console.warn('Backend unavailable, falling back to direct API');
      }
    }

    // 3. Fallback: usar función original
    metrics.apiCalls++;
    const data = await originalFetchCryptoData(mode);

    // Cache the result
    memoryCache.set(cacheKey, { data, timestamp: Date.now() });

    return data;

  } catch (error) {
    metrics.errors++;
    console.error('[Enhanced] Crypto fetch error:', error);

    // Try to return stale cache if available
    const staleCache = memoryCache.get(cacheKey);
    if (staleCache) {
      console.warn('Returning stale cache due to error');
      return staleCache.data;
    }

    throw error;
  }
};

/**
 * Enhanced scanMarketOpportunities con rate limiting inteligente
 */
export const scanMarketOpportunities = async (style: TradingStyle): Promise<AIOpportunity[]> => {
  const cacheKey = `opportunities:${style}`;

  // Check user limits (cuando tengamos auth)
  const userPlan = 'FREE'; // Por ahora hardcodeado
  const limits = API_CONFIG.PLANS[userPlan];

  // Simple rate limiting
  const lastScan = localStorage.getItem('lastScanTime');
  const scanCount = parseInt(localStorage.getItem('scanCount') || '0');

  if (lastScan) {
    const timeSinceLastScan = Date.now() - parseInt(lastScan);
    const isToday = new Date(parseInt(lastScan)).toDateString() === new Date().toDateString();

    if (isToday && scanCount >= limits.scansPerDay && limits.scansPerDay > 0) {
      throw new Error(`Límite diario alcanzado (${limits.scansPerDay} escaneos). Actualiza tu plan para más.`);
    }

    // Cooldown para evitar spam
    if (timeSinceLastScan < 10000) { // 10 segundos mínimo entre scans
      const remaining = Math.ceil((10000 - timeSinceLastScan) / 1000);
      throw new Error(`Espera ${remaining} segundos antes del próximo escaneo`);
    }
  }

  try {
    // Check cache
    const cached = memoryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < 60000) { // 1 min cache for opportunities
      console.log(`[Cache HIT] ${cacheKey}`);
      return cached.data;
    }

    // Get opportunities
    const opportunities = await originalScanMarketOpportunities(style);

    // Apply plan-based filtering
    let filteredOpportunities = opportunities;
    if (userPlan === 'FREE') {
      // Free users only see top 3 signals with delay
      filteredOpportunities = opportunities.slice(0, 3).map(opp => ({
        ...opp,
        // Reduce precision for free users
        entryZone: {
          min: Math.round(opp.entryZone.min * 100) / 100,
          max: Math.round(opp.entryZone.max * 100) / 100,
        },
        // Hide some advanced metrics
        metrics: undefined,
      }));
    }

    // Update scan counter
    localStorage.setItem('lastScanTime', Date.now().toString());
    localStorage.setItem('scanCount', (scanCount + 1).toString());

    // Cache result
    memoryCache.set(cacheKey, { data: filteredOpportunities, timestamp: Date.now() });

    return filteredOpportunities;

  } catch (error) {
    console.error('[Enhanced] Scan error:', error);
    throw error;
  }
};

/**
 * Enhanced WebSocket subscription con reconnection logic
 */
class EnhancedWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscriptions = new Set<string>();
  private messageHandlers = new Map<string, (data: any) => void>();

  connect(url: string) {
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;

        // Re-subscribe to all symbols
        this.subscriptions.forEach(symbol => {
          this.sendMessage('subscribe', { symbol });
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const handler = this.messageHandlers.get(data.symbol);
          if (handler) {
            handler(data);
          }
        } catch (error) {
          console.error('[WS] Message parse error:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected');
        this.attemptReconnect();
      };

    } catch (error) {
      console.error('[WS] Connection error:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`[WS] Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect(this.ws?.url || '');
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30s delay
    }, this.reconnectDelay);
  }

  subscribe(symbol: string, handler: (data: any) => void) {
    this.subscriptions.add(symbol);
    this.messageHandlers.set(symbol, handler);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendMessage('subscribe', { symbol });
    }
  }

  unsubscribe(symbol: string) {
    this.subscriptions.delete(symbol);
    this.messageHandlers.delete(symbol);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendMessage('unsubscribe', { symbol });
    }
  }

  private sendMessage(type: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  }

  disconnect() {
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
    this.ws?.close();
  }
}

// Singleton WebSocket manager
let wsManager: EnhancedWebSocket | null = null;

export const subscribeToSymbol = (
  symbol: string,
  onUpdate: (data: any) => void,
  onError: (error: any) => void
): (() => void) => {

  // If WebSocket is enabled and we have a URL, use enhanced version
  if (isFeatureEnabled('REALTIME_ENABLED') && API_CONFIG.WS_URL) {
    if (!wsManager) {
      wsManager = new EnhancedWebSocket();
      wsManager.connect(API_CONFIG.WS_URL);
    }

    wsManager.subscribe(symbol, onUpdate);

    return () => {
      wsManager?.unsubscribe(symbol);
    };
  }

  // Otherwise, use original subscription
  return originalSubscribeToSymbol(symbol, onUpdate, onError);
};

/**
 * New feature: Get metrics (for PRO users)
 */
export const getServiceMetrics = () => {
  return {
    ...metrics,
    cacheSize: memoryCache.size,
    uptime: 0, // process.uptime() not available in browser
  };
};

/**
 * New feature: Clear cache (admin function)
 */
export const clearCache = () => {
  memoryCache.clear();
  console.log('[Cache] Cleared');
};

/**
 * New feature: Preload critical data
 */
export const preloadCriticalData = async () => {
  console.log('[Preload] Starting...');

  try {
    // Preload top volume cryptos
    await fetchCryptoData('volume');

    // Preload memes if user likes them
    const prefersMemes = localStorage.getItem('prefersMemes') === 'true';
    if (prefersMemes) {
      await fetchCryptoData('memes');
    }

    console.log('[Preload] Complete');
  } catch (error) {
    console.error('[Preload] Error:', error);
  }
};

// Auto-preload on module load (optional)
if (typeof window !== 'undefined') {
  // Wait for page load
  window.addEventListener('load', () => {
    setTimeout(preloadCriticalData, 2000); // 2s delay to not block initial render
  });
}