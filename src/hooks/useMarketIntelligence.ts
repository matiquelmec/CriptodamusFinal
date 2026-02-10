import { useState, useEffect } from 'react';

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
            const response = await fetch('/api/advanced/market-intelligence');
            const data = await response.json();

            if (data.success) {
                setIntelligence(data.data);
                setError(null);
            } else {
                setError(data.error || 'Failed to load market intelligence');
            }
        } catch (err) {
            console.error('Market Intelligence fetch error:', err);
            setError('Network error');
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
