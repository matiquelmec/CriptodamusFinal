import { useState, useEffect } from 'react';
import { getApiUrl } from '../services/config';

export interface Rotation {
    asset: string;
    correlation: number;
    strength: 'WEAK' | 'MODERATE' | 'STRONG' | 'EXTREME';
    duration?: string;
    priceChange24h?: number;
}

export interface MarketIntelligence {
    state: 'rotation_active' | 'systemic_risk' | 'lateral' | 'normal' | 'pre_signal';
    timestamp: number;
    rotations: Rotation[];
    alerts: string[];
    nearSignals: any[];
    summary: string;
    recommendation: string;
    metrics: {
        avgCorrelation: number;
        highCorrPairs: number;
        totalPairs: number;
    };
}

export function useMarketIntelligence(refreshInterval = 60000) {
    const [intelligence, setIntelligence] = useState<MarketIntelligence | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchIntelligence = async () => {
        try {
            const url = getApiUrl('/api/advanced/market-intelligence');
            const response = await fetch(url);

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.error('Market Intelligence: Expected JSON but got', contentType);
                throw new Error(`API returned ${contentType || 'unknown'} instead of JSON`);
            }

            const data = await response.json();

            if (data.success) {
                setIntelligence(data.data);
                setError(null);
            } else {
                setError(data.error || 'Failed to load market intelligence');
            }
        } catch (err) {
            console.error('Market Intelligence fetch error:', err);
            setError(err instanceof Error ? err.message : 'Network error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIntelligence();

        const interval = setInterval(fetchIntelligence, refreshInterval);

        return () => clearInterval(interval);
    }, [refreshInterval]);

    return { intelligence, loading, error, refresh: fetchIntelligence };
}
