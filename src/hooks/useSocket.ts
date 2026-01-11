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
    cvd: Record<string, RealTimeCVD>;
    aiOpportunities: AIOpportunity[];
}

const IS_PROD = import.meta.env.PROD || window.location.hostname !== 'localhost';
const WS_BASE_URL = IS_PROD
    ? `wss://${window.location.host}`
    : 'ws://localhost:3001';

const WS_URL = import.meta.env.VITE_BACKEND_URL || `${WS_BASE_URL}/ws`;

export const useSocket = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [liquidations, setLiquidations] = useState<RealTimeLiquidation[]>([]);
    const [cvd, setCvd] = useState<Record<string, RealTimeCVD>>({});
    const [aiOpportunities, setAIOpportunities] = useState<AIOpportunity[]>([]);

    const wsRef = useRef<WebSocket | null>(null);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

                // Heartbeat to keep connection alive
                if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = setInterval(() => {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({ type: 'ping' }));
                    }
                }, 30000); // 30s Heartbeat
            };

            socket.onclose = () => {
                console.log('[Frontend] Disconnected from Backend WS');
                if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
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
            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
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
