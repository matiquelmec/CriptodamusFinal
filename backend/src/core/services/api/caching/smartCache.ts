/**
 * SmartCache Service
 * 
 * Implements a lightweight, in-memory caching layer for API responses.
 * 
 * STRATEGY (HYBRID FRESHNESS):
 * - Micro-Tactical (15m candles): 30s TTL (Near Real-Time)
 * - Tactical (1H candles): 5m TTL
 * - Structural (4H candles): 15m TTL
 * - Strategic (1D/1W candles): 60m TTL
 * 
 * Features:
 * - Automatic cache invalidation based on TTL
 * - Memory safe (Auto-pruning could be added, but simple map is fine for < 100 assets)
 * - Transparent Wrapper pattern
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiry: number;
}

export class SmartCache {
    private static storage = new Map<string, CacheEntry<any>>();

    // TTL Configuration (in milliseconds)
    public static TTL = {
        MICRO: 30 * 1000,       // 30 seconds (15m candles)
        SHORT: 5 * 60 * 1000,   // 5 minutes (1H candles)
        MEDIUM: 15 * 60 * 1000, // 15 minutes (4H candles)
        LONG: 60 * 60 * 1000    // 60 minutes (1D/1W candles)
    };

    /**
     * Retrieves data from cache if valid. Returns null if expired or missing.
     */
    static get<T>(key: string): T | null {
        const entry = this.storage.get(key);

        if (!entry) return null;

        if (Date.now() > entry.expiry) {
            this.storage.delete(key); // Lazy cleanup
            return null;
        }

        return entry.data as T;
    }

    /**
     * Saves data to cache with specific TTL
     */
    static set<T>(key: string, data: T, ttlMs: number): void {
        this.storage.set(key, {
            data,
            timestamp: Date.now(),
            expiry: Date.now() + ttlMs
        });
    }

    /**
     * Helper to clear specific keys (e.g. on manual refresh)
     */
    static clear(keyPattern?: string) {
        if (!keyPattern) {
            this.storage.clear();
            return;
        }

        for (const key of this.storage.keys()) {
            if (key.includes(keyPattern)) {
                this.storage.delete(key);
            }
        }
    }

    /**
     * Debug: Returns cache stats
     */
    static getStats() {
        return {
            size: this.storage.size,
            keys: Array.from(this.storage.keys())
        };
    }
}
