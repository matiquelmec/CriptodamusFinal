import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { TradingConfig } from '../core/config/tradingConfig';

// ESM Polyfill for loading .env if needed (though usually loaded at app start)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

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

interface BinanceDepthPayload {
    s: string; // Symbol
    b: [string, string][]; // Bids [Price, Qty]
    a: [string, string][]; // Asks [Price, Qty]
}

interface StreamMessage {
    e: string; // Event type
    o?: BinanceLiquidationPayload; // For forceOrder
    s?: string; // Symbol (for aggTrade)
    p?: string; // Price
    q?: string; // Qty
    m?: boolean; // Buyer Maker
    T?: number; // Time
    b?: [string, string][]; // For depthUpdate (Snapshot in this case)
    a?: [string, string][];
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
    symbol?: string; // Added optional symbol for events
}

export interface OrderBookState {
    bids: { price: number; qty: number; total: number }[];
    asks: { price: number; qty: number; total: number }[];
    lastUpdate: number;
}

type SubscriberCallback = (event: { type: string; data: any }) => void;

/**
 * Binance Stream Service (TypeScript Edition)
 * Manages real-time connections to Binance Futures
 * UPGRADE: Now supports Depth (Order Book) for God Mode Lite
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
    private depthState: Record<string, OrderBookState>; // RAM Cache for Order Books

    // Real Data Accumulator (Supabase Integration)
    private supabase: any = null;
    private liquidationBuffer: LiquidationEvent[] = [];
    private flushInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.baseUrl = 'wss://fstream.binance.com/ws';
        this.streams = new Set<string>();
        this.ws = null;
        this.subscribers = new Set();
        this.reconnectTimer = null;
        this.isAlive = false;

        this.recentLiquidations = [];
        this.cvdState = {};
        this.depthState = {};

        // 1. Core Streams: Liquidations
        this.addStream('!forceOrder@arr');

        // 2. Dynamic Subscription: Elite 9 Assets (Depth & AggTrade)
        const eliteAssets = TradingConfig.assets.tournament_list; // e.g. ['BTCUSDT', 'ETHUSDT'...]

        console.log(`[BinanceStream] Configuring streams for ${eliteAssets.length} Elite Assets...`);

        eliteAssets.forEach(symbol => {
            const s = symbol.toLowerCase();
            this.addStream(`${s}@aggTrade`);          // For CVD
            this.addStream(`${s}@depth20@100ms`);     // For God Mode (Order Book Walls)
        });

        // Init Database Connection
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_KEY = process.env.SUPABASE_KEY;
        if (SUPABASE_URL && SUPABASE_KEY) {
            this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
            this.startFlushing();
        } else {
            console.warn('⚠️ [BinanceStream] No Supabase credentials. Real Data Accumulator disabled.');
        }
    }

    private startFlushing() {
        // Flush every 10 seconds
        this.flushInterval = setInterval(() => this.flushLiquidations(), 10 * 1000);
    }

    private async flushLiquidations() {
        if (!this.supabase) {
            return;
        }
        if (this.liquidationBuffer.length === 0) return;

        const batchSize = this.liquidationBuffer.length;
        const batch = [...this.liquidationBuffer];
        this.liquidationBuffer = []; // Clear buffer immediately

        try {
            const { error } = await this.supabase
                .from('liquidation_heatmap')
                .insert(batch.map(l => ({
                    symbol: l.symbol,
                    price: l.price,
                    volume: l.usdValue,
                    side: l.side === 'SELL' ? 'LONG_LIQ' : 'SHORT_LIQ',
                    timestamp: l.time
                })));

            if (error) {
                console.error('❌ [BinanceStream] Error flushing liquidations:', error.message);
            } else {
                console.log(`💾 [BinanceStream] Successfully flushed ${batchSize} liquidations to Supabase.`);
            }
        } catch (e) {
            console.error('❌ [BinanceStream] Flush exception:', e);
        }
    }

    public addStream(streamName: string): void {
        const stream = streamName;
        if (!this.streams.has(stream)) {
            this.streams.add(stream);
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.sendSubscribe([stream]);
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
            console.log('✅ [BinanceStream] Connected to Binance Futures WebSocket.');
            this.isAlive = true;
            this.heartbeat();

            // Re-subscribe to all (in case we only connected with a subset or none)
            if (this.streams.size > 0) {
                console.log(`📡 [BinanceStream] Subscribing to ${this.streams.size} streams...`);
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

            // Keep last 50 liquidations (RAM cache for immediate UI)
            this.recentLiquidations.unshift(liq);
            if (this.recentLiquidations.length > 50) this.recentLiquidations.pop();

            // Add to Persistent Buffer (DB)
            if (this.supabase) {
                this.liquidationBuffer.push(liq);
            }

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

            const deltaChange = isBuyerMaker ? -qty : qty;
            this.cvdState[symbol].delta += deltaChange;
            this.cvdState[symbol].volume += qty;
            this.cvdState[symbol].price = price;

            this.notifySubscribers({ type: 'cvd_update', data: { symbol, ...this.cvdState[symbol] } });
        }

        // 3. Depth Update (Order Book Walls) - GOD MODE LITE
        else if (msg.e === 'depthUpdate' && msg.s && msg.b && msg.a) {
            const symbol = msg.s;
            // Process Depth Snapshot (Simple replacement for depth20)
            // In depth20 stream, 'b' and 'a' are the full top 20 levels.

            const bids = msg.b.map(level => {
                const p = parseFloat(level[0]);
                const q = parseFloat(level[1]);
                return { price: p, qty: q, total: p * q };
            });

            const asks = msg.a.map(level => {
                const p = parseFloat(level[0]);
                const q = parseFloat(level[1]);
                return { price: p, qty: q, total: p * q };
            });

            this.depthState[symbol] = {
                bids,
                asks,
                lastUpdate: Date.now()
            };

            // Retransmit to UI (Heatmap)
            this.notifySubscribers({ type: 'depth_update', data: { symbol, bids, asks } });
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
            cvd: this.cvdState,
            // Don't send full depth here to avoid massive payload, client should wait for stream
        };
    }

    // --- GOD MODE UTILS ---

    public getDepth(symbol: string) {
        return this.depthState[symbol] || null;
    }

    /**
     * Get the "Wall Strength" for a symbol.
     * Returns the volume ratio of Bid Walls vs Ask Walls.
     * > 1.0 = Bullish Support Wall
     * < 1.0 = Bearish Resistance Wall
     */
    public getWallStrength(symbol: string): number {
        const book = this.depthState[symbol];
        if (!book) return 1.0; // Neutral

        // Sum top 10 levels volume
        const bidVol = book.bids.slice(0, 10).reduce((acc, b) => acc + b.total, 0);
        const askVol = book.asks.slice(0, 10).reduce((acc, a) => acc + a.total, 0);

        if (askVol === 0) return 2.0; // Max Bullish (No sellers)
        return bidVol / askVol;
    }
}

// Singleton Instance
export const binanceStream = new BinanceStreamService();
