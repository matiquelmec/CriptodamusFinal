import { useEffect, useRef, useState, useCallback } from 'react';
import { AIOpportunity } from '../types';

// Types representing the Real-Time Data from Backend
export interface RealTimeLiquidation {
    symbol: string;
    side: 'SELL' | 'BUY'; // SELL = Long Liquidated, BUY = Short Liquidated
    price: number;
    qty: number;
    time: number;
    usdValue: number;
}

export interface RealTimeCVD {
    delta: number;
    volume: number;
    price: number;
}

export interface SocketState {
    isConnected: boolean;
    liquidations: RealTimeLiquidation[];
    liquidations: RealTimeLiquidation[];
    cvd: Record<string, RealTimeCVD>;
    aiOpportunities: AIOpportunity[];
}

const WS_URL = import.meta.env.VITE_BACKEND_URL || 'ws://localhost:3001/ws';

export const useSocket = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [liquidations, setLiquidations] = useState<RealTimeLiquidation[]>([]);
    const [liquidations, setLiquidations] = useState<RealTimeLiquidation[]>([]);
    const [cvd, setCvd] = useState<Record<string, RealTimeCVD>>({});
    const [aiOpportunities, setAIOpportunities] = useState<AIOpportunity[]>([]);

    const wsRef = useRef<WebSocket | null>(null);

    // Keep only last 50 liquidations to avoid memory leaks in frontend
    const addLiquidations = useCallback((newLiqs: RealTimeLiquidation | RealTimeLiquidation[]) => {
        setLiquidations(prev => {
            const list = Array.isArray(newLiqs) ? [...newLiqs, ...prev] : [newLiqs, ...prev];
            return list.slice(0, 50);
        });
    }, []);

    const updateCvd = useCallback((symbol: string, data: RealTimeCVD) => {
        setCvd(prev => ({
            ...prev,
            [symbol]: data
        }));
    }, []);

    useEffect(() => {
        const connect = () => {
            const socket = new WebSocket(WS_URL);
            wsRef.current = socket;

            socket.onopen = () => {
                console.log('[Frontend] Connected to Backend WS');
                setIsConnected(true);
            };

            socket.onclose = () => {
                console.log('[Frontend] Disconnected from Backend WS');
                setIsConnected(false);
                // Reconnect strategy
                setTimeout(connect, 3000);
            };

            socket.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);

                    switch (msg.type) {
                        case 'snapshot':
                            // Initial Load
                            if (msg.data.liquidations) addLiquidations(msg.data.liquidations);
                            if (msg.data.liquidations) addLiquidations(msg.data.liquidations);
                            if (msg.data.cvd) setCvd(msg.data.cvd);
                            if (msg.data.ai_opportunities) setAIOpportunities(msg.data.ai_opportunities);
                            break;

                        case 'liquidation':
                            addLiquidations(msg.data);
                            break;

                        case 'cvd_update':
                            updateCvd(msg.data.symbol, {
                                delta: msg.data.delta,
                                volume: msg.data.volume,
                                price: msg.data.price
                            });
                            break;

                        case 'ai_opportunities':
                            setAIOpportunities(msg.data);
                            break;

                        case 'golden_ticket_alert':
                            // For now, update list if these are included, or just handle alert
                            // Assuming backend broadcasts full list on updates usually.
                            // If this sends a subset, we might want to merge.
                            // But usually scamner sends full result set on scan_complete.
                            // Let's assume golden ticket is just an alert, not a state replacement, 
                            // UNLESS backend logic sends opportunities.
                            // Backend server.ts sends 'data: opportunities' for both.
                            // So we can update state.
                            setAIOpportunities(msg.data);
                            break;

                        case 'pong':
                            // Alive check
                            break;
                    }
                } catch (e) {
                    console.error('WS Parse Error:', e);
                }
            };
        };

        connect();

        return () => {
            wsRef.current?.close();
        };
    }, [addLiquidations, updateCvd]);

    const subscribe = (symbols: string[]) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'subscribe',
                symbols
            }));
        }
    };

    return {
        isConnected,
        liquidations,
        cvd,
        aiOpportunities,
        subscribe
    };
};
