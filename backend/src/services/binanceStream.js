import WebSocket from 'ws';

/**
 * Binance Stream Service
 * Manages real-time connections to Binance Futures
 */
class BinanceStreamService {
    constructor() {
        this.baseUrl = 'wss://fstream.binance.com/ws';
        this.streams = new Set();
        this.ws = null;
        this.subscribers = new Set(); // Callbacks to notify
        this.reconnectTimer = null;
        this.isAlive = false;

        // Data Buffers (In-Memory "Hot" Storage)
        this.recentLiquidations = [];
        this.cvdState = {}; // { BTCUSDT: { volume: 0, delta: 0 } }

        // Initial streams: Global Liquidations + BTC AggTrade (Benchmark)
        this.addStream('!forceOrder@arr');
        this.addStream('btcusdt@aggTrade');
    }

    addStream(streamName) {
        if (!this.streams.has(streamName)) {
            this.streams.add(streamName);
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Dynamic subscribe if already connected
                this.sendSubscribe([streamName]);
            }
        }
    }

    start() {
        if (this.ws) return;

        const combinedStreams = Array.from(this.streams).join('/');
        const url = `${this.baseUrl}/${combinedStreams}`;

        console.log(`[BinanceStream] Connecting to ${url}...`);
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            console.log('[BinanceStream] Connected to Binance Futures.');
            this.isAlive = true;
            this.heartbeat();
        });

        this.ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data);
                this.handleMessage(msg);
            } catch (e) {
                console.error('[BinanceStream] Parse error:', e);
            }
        });

        this.ws.on('close', () => {
            console.warn('[BinanceStream] Connection closed. Reconnecting in 5s...');
            this.isAlive = false;
            this.ws = null;
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.start(), 5000);
        });

        this.ws.on('error', (err) => {
            console.error('[BinanceStream] Error:', err.message);
        });

        this.ws.on('ping', () => {
            this.heartbeat();
            this.ws.pong();
        });
    }

    heartbeat() {
        this.isAlive = true;
    }

    sendSubscribe(streams) {
        if (!this.ws) return;
        const msg = {
            method: "SUBSCRIBE",
            params: streams,
            id: Date.now()
        };
        this.ws.send(JSON.stringify(msg));
    }

    handleMessage(msg) {
        // 1. Force Order (Liquidation)
        if (msg.e === 'forceOrder') {
            const liq = {
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
        else if (msg.e === 'aggTrade') {
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

            // Broadcast throttled updates? Or raw? 
            // For high freq, we might want to throttle, but for now sending raw is "Real Time"
            this.notifySubscribers({ type: 'cvd_update', data: { symbol, ...this.cvdState[symbol] } });
        }
    }

    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    notifySubscribers(payload) {
        this.subscribers.forEach(cb => cb(payload));
    }

    // API to get current state (for new connections)
    getSnapshot() {
        return {
            liquidations: this.recentLiquidations,
            cvd: this.cvdState
        };
    }
}

// Singleton Instance
export const binanceStream = new BinanceStreamService();
