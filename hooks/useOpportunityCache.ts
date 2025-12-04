import { useEffect, useState } from 'react';
import { AIOpportunity } from '../types';

interface CachedData {
    opportunities: AIOpportunity[];
    timestamp: number;
    regime?: string;
}

const CACHE_KEY = 'criptodamus_opportunities_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useOpportunityCache() {
    const [cachedData, setCachedData] = useState<CachedData | null>(null);

    // Load cache on mount
    useEffect(() => {
        const cached = loadCache();
        if (cached) {
            setCachedData(cached);
        }
    }, []);

    const saveCache = (opportunities: AIOpportunity[], regime?: string) => {
        const data: CachedData = {
            opportunities,
            timestamp: Date.now(),
            regime
        };

        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            setCachedData(data);
        } catch (error) {
            console.warn('[Cache] Failed to save to localStorage:', error);
        }
    };

    const loadCache = (): CachedData | null => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return null;

            const data: CachedData = JSON.parse(cached);

            // Validate structure
            if (!data.opportunities || !Array.isArray(data.opportunities) || !data.timestamp) {
                console.warn('[Cache] Invalid cache structure, clearing...');
                clearCache();
                return null;
            }

            // Check expiration
            if (isStale(data.timestamp)) {
                console.log('[Cache] Cache expired, clearing...');
                clearCache();
                return null;
            }

            return data;
        } catch (error) {
            console.warn('[Cache] Failed to load from localStorage:', error);
            clearCache();
            return null;
        }
    };

    const clearCache = () => {
        try {
            localStorage.removeItem(CACHE_KEY);
            setCachedData(null);
        } catch (error) {
            console.warn('[Cache] Failed to clear localStorage:', error);
        }
    };

    const isStale = (timestamp: number): boolean => {
        return Date.now() - timestamp > CACHE_DURATION;
    };

    const getCacheAge = (): string | null => {
        if (!cachedData) return null;

        const ageMs = Date.now() - cachedData.timestamp;
        const ageMinutes = Math.floor(ageMs / 60000);

        if (ageMinutes < 1) return 'hace menos de 1 min';
        if (ageMinutes === 1) return 'hace 1 min';
        return `hace ${ageMinutes} min`;
    };

    return {
        cachedData,
        saveCache,
        loadCache,
        clearCache,
        isStale: cachedData ? isStale(cachedData.timestamp) : false,
        cacheAge: getCacheAge()
    };
}
