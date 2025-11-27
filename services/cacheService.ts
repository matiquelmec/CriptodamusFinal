/**
 * Cache Service - Sistema inteligente de caché local
 * Reduce llamadas a APIs externas y mejora performance
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheService {
  private cache: Map<string, CacheItem<any>> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos
  private readonly MAX_CACHE_SIZE = 100;

  /**
   * Guarda datos en caché
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Limitar tamaño del caché
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL
    });

    // También guardar en localStorage para persistencia
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify({
        data,
        timestamp: Date.now(),
        ttl: ttl || this.DEFAULT_TTL
      }));
    } catch (e) {
      console.warn('Cache localStorage full, clearing old entries');
      this.clearOldLocalStorage();
    }
  }

  /**
   * Obtiene datos del caché si están frescos
   */
  get<T>(key: string): T | null {
    // Primero intentar memoria
    const cached = this.cache.get(key);
    if (cached && this.isFresh(cached)) {
      return cached.data;
    }

    // Si no está en memoria, intentar localStorage
    try {
      const stored = localStorage.getItem(`cache_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored) as CacheItem<T>;
        if (this.isFresh(parsed)) {
          // Restaurar a memoria
          this.cache.set(key, parsed);
          return parsed.data;
        }
      }
    } catch (e) {
      // Ignorar errores de parsing
    }

    return null;
  }

  /**
   * Verifica si un item está fresco
   */
  private isFresh(item: CacheItem<any>): boolean {
    return Date.now() - item.timestamp < item.ttl;
  }

  /**
   * Limpia entradas viejas del localStorage
   */
  private clearOldLocalStorage(): void {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('cache_'));
    const now = Date.now();

    keys.forEach(key => {
      try {
        const item = JSON.parse(localStorage.getItem(key) || '{}') as CacheItem<any>;
        if (!this.isFresh(item)) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Invalida un item específico
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    localStorage.removeItem(`cache_${key}`);
  }

  /**
   * Invalida items por patrón
   */
  invalidatePattern(pattern: string): void {
    // Limpiar memoria
    Array.from(this.cache.keys())
      .filter(key => key.includes(pattern))
      .forEach(key => this.cache.delete(key));

    // Limpiar localStorage
    Object.keys(localStorage)
      .filter(k => k.startsWith('cache_') && k.includes(pattern))
      .forEach(k => localStorage.removeItem(k));
  }

  /**
   * Limpia todo el caché
   */
  clear(): void {
    this.cache.clear();
    Object.keys(localStorage)
      .filter(k => k.startsWith('cache_'))
      .forEach(k => localStorage.removeItem(k));
  }

  /**
   * Wrapper para funciones con caché
   */
  async withCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Intentar obtener del caché primero
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Si no está en caché, ejecutar fetcher
    try {
      const data = await fetcher();
      this.set(key, data, ttl);
      return data;
    } catch (error) {
      // Si hay un error, intentar devolver caché expirado si existe
      const stored = localStorage.getItem(`cache_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored) as CacheItem<T>;
        console.warn('Using stale cache due to fetch error:', error);
        return parsed.data;
      }
      throw error;
    }
  }

  /**
   * Obtiene estadísticas del caché
   */
  getStats(): {
    memorySize: number;
    localStorageSize: number;
    hitRate: number;
  } {
    const localStorageKeys = Object.keys(localStorage).filter(k => k.startsWith('cache_'));
    return {
      memorySize: this.cache.size,
      localStorageSize: localStorageKeys.length,
      hitRate: 0 // TODO: Implementar tracking de hit rate
    };
  }
}

// Singleton
export const cacheService = new CacheService();

// TTL presets para diferentes tipos de datos
export const CacheTTL = {
  MARKET_DATA: 30 * 1000,        // 30 segundos para datos de mercado
  PRICE_DATA: 10 * 1000,          // 10 segundos para precios
  SIGNALS: 60 * 1000,             // 1 minuto para señales
  INDICATORS: 5 * 60 * 1000,      // 5 minutos para indicadores
  NEWS: 30 * 60 * 1000,           // 30 minutos para noticias
  STATIC: 24 * 60 * 60 * 1000    // 24 horas para datos estáticos
};