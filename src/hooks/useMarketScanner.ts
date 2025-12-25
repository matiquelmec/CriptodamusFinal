import { useState, useCallback } from 'react';
import { AIOpportunity, TradingStyle, MarketRisk } from '../types';
import { scanMarketOpportunities, getMarketRisk } from '../services/cryptoService';

export const useMarketScanner = () => {
    const [opportunities, setOpportunities] = useState<AIOpportunity[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [marketRisk, setMarketRisk] = useState<MarketRisk | null>(null);

    const scan = useCallback(async (style: TradingStyle = 'SCALP_AGRESSIVE') => {
        setIsScanning(true);
        setError(null);
        try {
            // Parallel execution for speed
            const [opps, riskData] = await Promise.all([
                scanMarketOpportunities(style),
                getMarketRisk()
            ]);

            setOpportunities(opps);
            setMarketRisk(riskData);
            return { opps, riskData };
        } catch (err: any) {
            console.error("Scanner Error:", err);
            setError(err.message || "Error al escanear el mercado");
            throw err;
        } finally {
            setIsScanning(false);
        }
    }, []);

    // Clear function if needed
    const clearOpportunities = useCallback(() => {
        setOpportunities([]);
    }, []);

    return {
        opportunities,
        isScanning,
        error,
        marketRisk,
        scan,
        clearOpportunities
    };
};
