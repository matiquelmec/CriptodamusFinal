/**
 * Configuration Layer - NO ROMPE NADA
 * Si existe backend propio, lo usa. Si no, usa APIs públicas como siempre.
 */

const IS_PROD = import.meta.env.PROD || window.location.hostname !== 'localhost';
const BACKEND_BASE_URL = IS_PROD
  ? `${window.location.protocol}//${window.location.host}`
  : 'http://localhost:3001';

export const API_CONFIG = {
  // Backend URL - Solo se activa si existe la variable de entorno
  BASE_URL: import.meta.env.VITE_API_URL || BACKEND_BASE_URL,

  // Feature flags - Activan funcionalidades premium gradualmente
  USE_PROXY: !!import.meta.env.VITE_API_URL || true, // Enable proxy if we have a backend
  USE_CACHE: !!import.meta.env.VITE_API_URL || true,
  USE_WEBSOCKET: !!import.meta.env.VITE_WS_URL || true,

  // WebSocket config
  WS_URL: import.meta.env.VITE_WS_URL || null,

  // Timeouts
  DEFAULT_TIMEOUT: 4000,
  CACHE_TIMEOUT: 5000,

  // Feature availability (se activan progresivamente)
  FEATURES: {
    AUTH_ENABLED: false, // Activar cuando esté listo
    PAYMENT_ENABLED: false, // Activar cuando Stripe esté configurado
    BACKTESTING_ENABLED: false, // Activar cuando el engine esté listo
    REALTIME_ENABLED: !!import.meta.env.VITE_WS_URL,
    ADVANCED_METRICS: false,
  },

  // API Endpoints (cuando tengamos backend)
  ENDPOINTS: {
    MARKET: '/api/v1/market',
    TRADING: '/api/v1/trading',
    AUTH: '/api/v1/auth',
    USER: '/api/v1/user',
    SIGNALS: '/api/v1/signals',
    BACKTEST: '/api/v1/backtest',
  },

  // Plans - Monetización simplificada chilena
  PLANS: {
    FREE: {
      scansPerDay: -1, // Ilimitado para DONATIONWARE
      strategies: ['SCALP_AGRESSIVE', 'SWING_INSTITUTIONAL'], // 2 estrategias
      delay: 60000, // 1 min delay
      backtesting: '24h', // Solo últimas 24 horas
      apiAccess: false,
      tradingBot: false,
      ads: true
    },
    TRIAL: {
      scansPerDay: -1, // TODO desbloqueado
      strategies: 'ALL',
      delay: 0,
      backtesting: '30d',
      apiAccess: true,
      tradingBot: true,
      ads: false,
      duration: 7 // días
    },
    PRO: {
      scansPerDay: -1, // Ilimitado
      strategies: 'ALL',
      delay: 0, // Tiempo real
      backtesting: '30d', // 30 días históricos
      apiAccess: true,
      tradingBot: true,
      ads: false,
      price: 9990, // CLP
      priceUSD: 11 // USD aproximado
    },
    // Donación levels
    DONATIONS: {
      COFFEE: { amount: 2000, badge: 'Supporter', perks: ['Nombre en créditos'] },
      PIZZA: { amount: 5000, badge: 'Gold Supporter', perks: ['Badge especial'] },
      ROCKET: { amount: 10000, badge: 'Rocket Supporter', perks: ['Discord VIP'] },
      DIAMOND: { amount: 25000, badge: 'Diamond Supporter', perks: ['Call 1-1'] }
    }
  }
};

// Helper functions
export const getApiUrl = (endpoint: string): string => {
  if (API_CONFIG.USE_PROXY && API_CONFIG.BASE_URL) {
    return `${API_CONFIG.BASE_URL}${endpoint}`;
  }
  return endpoint; // Fallback to original URL
};

export const isFeatureEnabled = (feature: keyof typeof API_CONFIG.FEATURES): boolean => {
  return API_CONFIG.FEATURES[feature] || false;
};

export const getUserPlan = (): string => {
  // Por ahora siempre FREE, luego se conectará con auth
  return 'FREE';
};