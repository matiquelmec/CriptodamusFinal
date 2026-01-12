import WebSocket from 'ws';

/**
 * Types & Interfaces for Strict Typing
 */
interface BinanceLiquidationPayload {
    s: string; // Symbol
    S: string; // Side (BUY/SELL)
    ap: string; // Average Price
    q: string; // Quantity
    T: number; // Time
}

interface BinanceAggTradePayload {
    s: string; // Symbol
    p: string; // Price
    q: string; // Quantity
    m: boolean; // Is Buyer Maker (true = Sell Order, false = Buy Order)
    T: number; // Timestamp
}

interface StreamMessage {
    e: string; // Event type
    o?: BinanceLiquidationPayload; // For forceOrder
    s?: string; // Symbol (for aggTrade)
    p?: string; // Price
    q?: string; // Qty
    m?: boolean; // Buyer Maker
    T?: number; // Time
}

export interface LiquidationEvent {
    symbol: string;
    side: string;
    price: number;
    qty: number;
    time: number;
    usdValue: number;
}

export interface CVDState {
    volume: number;
    delta: number;
    price: number;
}

interface CVDPayload {
    symbol: string;
    volume: number;
    delta: number;
    price: number;
}

type SubscriberCallback = (event: { type: string; data: any }) => void;

/**
 * Binance Stream Service (TypeScript Edition)
 * Manages real-time connections to Binance Futures
 */
class BinanceStreamService {
    private baseUrl: string;
    private streams: Set<string>;
    private ws: WebSocket | null;
    private subscribers: Set<SubscriberCallback>;
    private reconnectTimer: NodeJS.Timeout | null;
    public isAlive: boolean;

    // Data Buffers
    private recentLiquidations: LiquidationEvent[];
    private cvdState: Record<string, CVDState>;

    constructor() {
        this.baseUrl = 'wss://fstream.binance.com/ws';
        this.streams = new Set<string>();
        this.ws = null;
        this.subscribers = new Set();
        this.reconnectTimer = null;
        this.isAlive = false;

        this.recentLiquidations = [];
        this.cvdState = {};

        // Initial streams: Global Liquidations + BTC AggTrade (Benchmark)
        this.addStream('!forceOrder@arr');
        this.addStream('btcusdt@aggTrade');
    }

    public addStream(streamName: string): void {
        const lowerStream = streamName.toLowerCase();
        if (!this.streams.has(lowerStream)) {
            this.streams.add(lowerStream);
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.sendSubscribe([lowerStream]);
            }
        }
    }

    public start(): void {
        if (this.ws) return;

        // Simplified: Always connect to Base URL and use SUBSCRIBE for everything.
        const url = this.baseUrl;

        console.log(`[BinanceStream] Connecting to Futures Stream (${url})...`);
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            console.log('[BinanceStream] Connected to Binance Futures.');
            this.isAlive = true;
            this.heartbeat();

            // Re-subscribe to all (in case we only connected with a subset or none)
            if (this.streams.size > 0) {
                this.sendSubscribe(Array.from(this.streams));
            }
        });

        this.ws.on('message', (data: WebSocket.RawData) => {
            try {
                const msg = JSON.parse(data.toString()) as StreamMessage;
                this.handleMessage(msg);
            } catch (e) {
                console.error('[BinanceStream] Parse error:', e);
            }
        });

        this.ws.on('close', () => {
            console.warn('[BinanceStream] Connection closed. Reconnecting in 5s...');
            this.isAlive = false;
            this.ws = null;
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.start(), 5000);
        });

        this.ws.on('error', (err) => {
            console.error('[BinanceStream] Error:', err.message);
        });

        this.ws.on('ping', () => {
            this.heartbeat();
            if (this.ws) this.ws.pong();
        });
    }

    private heartbeat(): void {
        this.isAlive = true;
    }

    private sendSubscribe(streams: string[]): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        // Split into chunks of 10 to avoid payload limits
        const chunkSize = 10;
        for (let i = 0; i < streams.length; i += chunkSize) {
            const chunk = streams.slice(i, i + chunkSize);
            const msg = {
                method: "SUBSCRIBE",
                params: chunk,
                id: Date.now() + i
            };
            this.ws.send(JSON.stringify(msg));
        }
    }

    private handleMessage(msg: StreamMessage): void {
        // DEBUG: Active
        // console.log('RAW MSG:', msg.e);
        if (!msg.e) {
            console.log('🔍 [BinanceStream] System Msg:', JSON.stringify(msg));
        } else {
            // console.log('📨 [BinanceStream] Event:', msg.e);
        }

        // 1. Force Order (Liquidation)
        if (msg.e === 'forceOrder' && msg.o) {
            const liq: LiquidationEvent = {
                symbol: msg.o.s,
                side: msg.o.S, // SELL = Long Liquidated, BUY = Short Liquidated
                price: parseFloat(msg.o.ap),
                qty: parseFloat(msg.o.q),
                time: msg.o.T,
                usdValue: parseFloat(msg.o.ap) * parseFloat(msg.o.q)
            };

            // Keep last 50 liquidations
            this.recentLiquidations.unshift(liq);
            if (this.recentLiquidations.length > 50) this.recentLiquidations.pop();

            this.notifySubscribers({ type: 'liquidation', data: liq });
        }

        // 2. AggTrade (CVD Calculation)
        else if (msg.e === 'aggTrade' && msg.s && msg.p && msg.q && msg.m !== undefined) {
            const symbol = msg.s;
            const price = parseFloat(msg.p);
            const qty = parseFloat(msg.q);
            const isBuyerMaker = msg.m; // true = Sell Order (Market Sell into Bid), false = Buy Order (Market Buy into Ask)

            // Initialize state if needed
            if (!this.cvdState[symbol]) {
                this.cvdState[symbol] = { delta: 0, volume: 0, price };
            }

            // Delta Logic: BuyerMaker means the aggressor was a SELLER. 
            // So if m=true, Delta decreases. If m=false, Delta increases.
            const deltaChange = isBuyerMaker ? -qty : qty;

            this.cvdState[symbol].delta += deltaChange;
            this.cvdState[symbol].volume += qty;
            this.cvdState[symbol].price = price;

            this.notifySubscribers({ type: 'cvd_update', data: { symbol, ...this.cvdState[symbol] } });
        }
    }

    public subscribe(callback: SubscriberCallback): () => void {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    private notifySubscribers(payload: { type: string; data: any }): void {
        this.subscribers.forEach(cb => cb(payload));
    }

    // API to get current state (for new connections)
    public getSnapshot() {
        return {
            liquidations: this.recentLiquidations,
            cvd: this.cvdState
        };
    }
}

// Singleton Instance
export const binanceStream = new BinanceStreamService();
