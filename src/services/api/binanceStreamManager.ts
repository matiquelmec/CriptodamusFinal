import { MarketData } from '../../types';

type PriceUpdateCallback = (data: Record<string, number>) => void;

export class BinanceStreamManager {
    private static instance: BinanceStreamManager;
    private ws: WebSocket | null = null;
    private subscribers: Set<PriceUpdateCallback> = new Set();
    private activeSymbols: Set<string> = new Set();
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private isConnecting: boolean = false;
    private connectionDebounceTimer: NodeJS.Timeout | null = null;

    private readonly BASE_URL = 'wss://stream.binance.com:9443/stream?streams=';
    private readonly MAX_STREAMS = 15; // Increased safety limit

    // Singleton Accessor
    public static getInstance(): BinanceStreamManager {
        if (!BinanceStreamManager.instance) {
            BinanceStreamManager.instance = new BinanceStreamManager();
        }
        return BinanceStreamManager.instance;
    }

    private constructor() {
        // Private constructor
    }

    /**
     * Main entry point for components to subscribe.
     * Manages reference counting indirectly via the subscriber set.
     */
    public subscribe(marketData: MarketData[], callback: PriceUpdateCallback): () => void {
        this.subscribers.add(callback);

        // Extract symbols to track
        let needsReconnection = false;
        marketData.forEach(item => {
            if (!this.activeSymbols.has(item.id)) {
                this.activeSymbols.add(item.id);
                needsReconnection = true;
            }
        });

        // Trigger connection logic
        if (needsReconnection || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.debouncedConnect();
        }

        // Return unsubscribe function
        return () => {
            this.subscribers.delete(callback);
            // If no listeners left, we COULD disconnect, but looking at user's issue,
            // better to keep it alive for a bit or just keep it open.
            // For now, let's keep it open to prevent the "rapid close" error on navigation.
        };
    }

    private debouncedConnect() {
        if (this.connectionDebounceTimer) clearTimeout(this.connectionDebounceTimer);

        // Wait 500ms before connecting to gather all symbols or avoid rapid navigation issues
        this.connectionDebounceTimer = setTimeout(() => {
            this.connect();
        }, 500);
    }

    private connect() {
        if (this.isConnecting) return;

        // Close existing if we are reconnecting with new symbols
        if (this.ws) {
            this.ws.onclose = null; // Prevent triggers during manual close
            this.ws.close();
        }

        this.isConnecting = true;

        // 1. Filter Safe Symbols (Top Assets only to prevent 400 errors)
        const SAFE_SYMBOLS = [
            'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
            'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'LINKUSDT',
            'TRXUSDT', 'MATICUSDT', 'LTCUSDT', 'UNIUSDT', 'ATOMUSDT',
            'SUIUSDT', 'NEARUSDT', 'APTUSDT', 'PEPEUSDT', 'SHIBUSDT', 'WIFUSDT'
        ];

        // Convert active set to array and filter
        const streams = Array.from(this.activeSymbols)
            .filter(sym => SAFE_SYMBOLS.includes(sym))
            .slice(0, this.MAX_STREAMS)
            .map(sym => `${sym.toLowerCase()}@miniTicker`);

        if (streams.length === 0) {
            this.isConnecting = false;
            return;
        }

        const url = `${this.BASE_URL}${streams.join('/')}`;
        console.log(`🔌 [BinanceManager] Connecting to ${streams.length} streams...`);

        try {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                console.log('✅ [BinanceManager] Stream Connected');
                this.isConnecting = false;
            };

            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.data && msg.data.s && msg.data.c) {
                        const displaySymbol = msg.data.s.replace('USDT', '/USDT');
                        const price = parseFloat(msg.data.c);

                        // Broadcast to all subscribers
                        this.subscribers.forEach(cb => cb({ [displaySymbol]: price }));
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            };

            this.ws.onclose = () => {
                console.log('⚠️ [BinanceManager] Stream Closed');
                this.isConnecting = false;
                // Auto-reconnect if we still have subscribers
                if (this.subscribers.size > 0) {
                    this.scheduleReconnect();
                }
            };

            this.ws.onerror = (err) => {
                console.warn('❌ [BinanceManager] Error:', err);
                this.ws?.close();
            };

        } catch (e) {
            console.error('Fatal WS Error:', e);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
    }
}
