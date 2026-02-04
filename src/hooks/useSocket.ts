import { useEffect, useState, useCallback } from 'react';
import { AIOpportunity } from '../types';
import { API_CONFIG } from '../services/config';

// --- TYPES ---
export interface RealTimeLiquidation {
    symbol: string;
    side: 'SELL' | 'BUY';
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
    activeTrades: any[];
    systemStatus: any;
}

// --- SINGLETON SOCKET MANAGER ---
// This ensures only ONE WebSocket connection exists for the entire app.
class SocketManager {
    private socket: WebSocket | null = null;
    private listeners: Set<(state: SocketState) => void> = new Set();
    private pingInterval: NodeJS.Timeout | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    // Global State Store
    private state: SocketState = {
        isConnected: false,
        liquidations: [],
        cvd: {},
        aiOpportunities: [],
        activeTrades: [],
        systemStatus: null
    };

    private static instance: SocketManager;

    private constructor() {
        this.connect();
    }

    public static getInstance(): SocketManager {
        if (!SocketManager.instance) {
            SocketManager.instance = new SocketManager();
        }
        return SocketManager.instance;
    }

    // Subscribe a React Component to updates
    public subscribe(listener: (state: SocketState) => void) {
        this.listeners.add(listener);
        listener(this.state); // Immediate initial update
        return () => {
            this.listeners.delete(listener);
        };
    }

    // Robust URL Detection
    private getWsUrl() {
        if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
        let base = (import.meta.env.VITE_BACKEND_URL || API_CONFIG.BASE_URL).replace('http', 'ws');
        if (base.endsWith('/ws')) return base;
        if (base.endsWith('/ws/')) return base.slice(0, -1);
        return `${base.endsWith('/') ? base.slice(0, -1) : base}/ws`;
    }

    private connect = () => {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return; // Already connecting or connected
        }

        const url = this.getWsUrl();
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            console.log('🔌 [SocketManager] Connected to Backend WS');
            this.updateState({ isConnected: true });

            // Heartbeat
            if (this.pingInterval) clearInterval(this.pingInterval);
            this.pingInterval = setInterval(() => {
                if (this.socket?.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({ type: 'ping' }));
                }
            }, 30000);
        };

        this.socket.onclose = () => {
            console.log('🔌 [SocketManager] Disconnected. Reconnecting in 3s...');
            this.updateState({ isConnected: false });
            if (this.pingInterval) clearInterval(this.pingInterval);

            if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = setTimeout(this.connect, 3000);
        };

        this.socket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.handleMessage(msg);
            } catch (e) {
                console.error('WS Parse Error', e);
            }
        };
    }

    private handleMessage(msg: any) {
        switch (msg.type) {
            case 'snapshot':
                this.updateState({
                    liquidations: msg.data.liquidations ? [...msg.data.liquidations, ...this.state.liquidations].slice(0, 50) : this.state.liquidations,
                    cvd: msg.data.cvd || this.state.cvd,
                    aiOpportunities: msg.data.ai_opportunities || this.state.aiOpportunities
                });
                break;
            case 'liquidation':
                const newLiqs = Array.isArray(msg.data) ? msg.data : [msg.data];
                this.updateState({
                    liquidations: [...newLiqs, ...this.state.liquidations].slice(0, 50)
                });
                break;
            case 'cvd_update':
                this.updateState({
                    cvd: {
                        ...this.state.cvd,
                        [msg.data.symbol]: {
                            delta: msg.data.delta,
                            volume: msg.data.volume,
                            price: msg.data.price
                        }
                    }
                });
                break;
            case 'ai_opportunities':
                if (Array.isArray(msg.data)) this.updateState({ aiOpportunities: msg.data });
                break;
            case 'golden_ticket_alert':
                // Usually replaces opportunities or adds to them
                this.updateState({ aiOpportunities: msg.data });
                break;
            case 'active_trades':
                if (Array.isArray(msg.data)) this.updateState({ activeTrades: msg.data });
                break;
            case 'system_status':
                // Avoid spamming logs if status hasn't changed
                if (JSON.stringify(this.state.systemStatus) !== JSON.stringify(msg.data)) {
                    console.log('🔌 [SocketManager] System Status:', msg.data);
                    this.updateState({ systemStatus: msg.data });
                }
                break;
        }
    }

    private updateState(partial: Partial<SocketState>) {
        this.state = { ...this.state, ...partial };
        this.notify();
    }

    private notify() {
        this.listeners.forEach(l => l(this.state));
    }

    public send(msg: any) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(msg));
        }
    }
}

// --- CONSUMER HOOK ---
// Now useSocket is just a cheap subscriber to the Singleton Manager
export const useSocket = () => {
    const manager = SocketManager.getInstance();
    const [state, setState] = useState<SocketState>(manager['state']); // Access initial state safely

    useEffect(() => {
        const unsubscribe = manager.subscribe(setState);
        return unsubscribe;
    }, []);

    const subscribe = useCallback((symbols: string[]) => {
        manager.send({ type: 'subscribe', symbols });
    }, []);

    return { ...state, subscribe };
};
