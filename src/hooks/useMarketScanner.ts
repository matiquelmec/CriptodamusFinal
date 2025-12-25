import { useState, useCallback, useRef, useEffect } from 'react';
import { AIOpportunity, TradingStyle, MarketRisk } from '../types';
import { getMarketRisk } from '../services/cryptoService';

export const useMarketScanner = () => {
    const [opportunities, setOpportunities] = useState<AIOpportunity[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [marketRisk, setMarketRisk] = useState<MarketRisk | null>(null);

    // Use a ref to hold the worker instance
    const workerRef = useRef<Worker | null>(null);

    // Initialize the worker on mount
    useEffect(() => {
        // Correct path to the worker file location in the src folder relative to this hook
        try {
            // In Vite/Webpack usage, we often need to ensure the worker is treated as a module or separate entry
            workerRef.current = new Worker(new URL('../workers/scanner.worker.ts', import.meta.url), { type: 'module' });

            workerRef.current.onmessage = (e: MessageEvent) => {
                const { type, payload } = e.data;
                if (type === 'SCAN_COMPLETE') {
                    setOpportunities(payload);
                    setIsScanning(false);
                } else if (type === 'SCAN_ERROR') {
                    console.error("Worker Scan Error:", payload);
                    setError(payload);
                    setIsScanning(false);
                }
            };

            workerRef.current.onerror = (err) => {
                console.error("Worker Error Event:", err);
                setError("Worker initialization failed");
                setIsScanning(false);
            };
        } catch (e) {
            console.error("Worker Creation Failed:", e);
        }

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    const scan = useCallback(async (style: TradingStyle = 'SCALP_AGRESSIVE') => {
        setIsScanning(true);
        setError(null);
        try {
            // Fetch risk in main thread (lightweight)
            const riskData = await getMarketRisk();
            setMarketRisk(riskData);

            // Offload heavy scanning to worker
            if (workerRef.current) {
                // console.log("Sending START_SCAN to worker...");
                workerRef.current.postMessage({ type: 'START_SCAN', style });
            } else {
                setError("Scanner worker not initialized");
                setIsScanning(false);
            }

        } catch (err: any) {
            console.error("Scanner Main Thread Error:", err);
            setError(err.message || "Error al escanear el mercado");
            setIsScanning(false);
        }
    }, []);

    return {
        opportunities,
        isScanning,
        error,
        marketRisk,
        scan,
    };
};
