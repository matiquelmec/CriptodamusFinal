
import { binanceStream, OrderBookState } from './binanceStream';

export interface LiquidityWall {
    price: number;
    volume: number;
    type: 'BID' | 'ASK';
    strength: 'NORMAL' | 'STRONG' | 'WHALE'; // >500k, >1M, >5M
}

class OrderBookService {
    private walls: Record<string, LiquidityWall[]> = {};

    // Config thresholds (USD Value)
    private readonly WALL_THRESHOLDS = {
        STRONG: 500000, // $500k
        WHALE: 2000000  // $2M
    };

    constructor() {
        this.startListening();
    }

    private startListening() {
        binanceStream.subscribe((event) => {
            if (event.type === 'depth_update') {
                this.analyzeWalls(event.data.symbol, event.data.bids, event.data.asks);
            }
        });
    }

    private analyzeWalls(symbol: string, bids: { price: number; total: number }[], asks: { price: number; total: number }[]) {
        const newWalls: LiquidityWall[] = [];

        // Analyze Bids (Support)
        bids.forEach(level => {
            if (level.total > this.WALL_THRESHOLDS.STRONG) {
                newWalls.push({
                    price: level.price,
                    volume: level.total,
                    type: 'BID',
                    strength: level.total > this.WALL_THRESHOLDS.WHALE ? 'WHALE' : 'STRONG'
                });
            }
        });

        // Analyze Asks (Resistance)
        asks.forEach(level => {
            if (level.total > this.WALL_THRESHOLDS.STRONG) {
                newWalls.push({
                    price: level.price,
                    volume: level.total,
                    type: 'ASK',
                    strength: level.total > this.WALL_THRESHOLDS.WHALE ? 'WHALE' : 'STRONG'
                });
            }
        });

        this.walls[symbol] = newWalls;

        // Broadcast specific Wall Alerts if needed?
        // For now, we just maintain state for the Strategy Engine to query.
    }

    /**
     * API for Strategy Engine:
     * Check if there's a supporting wall near the current price.
     */
    public hasSupportWall(symbol: string, currentPrice: number, withinPercent: number = 0.5): boolean {
        const symbolWalls = this.walls[symbol] || [];
        const supports = symbolWalls.filter(w => w.type === 'BID');

        return supports.some(w => {
            const distance = Math.abs((currentPrice - w.price) / currentPrice) * 100;
            return distance <= withinPercent;
        });
    }

    /**
     * API for Strategy Engine:
     * Check if there's a resistance wall blocking the trade.
     */
    public hasResistanceWall(symbol: string, currentPrice: number, withinPercent: number = 0.5): boolean {
        const symbolWalls = this.walls[symbol] || [];
        const resistance = symbolWalls.filter(w => w.type === 'ASK');

        return resistance.some(w => {
            const distance = Math.abs((currentPrice - w.price) / currentPrice) * 100;
            // Resistance is usually ABOVE current price for Longs
            return distance <= withinPercent;
        });
    }

    public getWalls(symbol: string) {
        return this.walls[symbol] || [];
    }
}

export const orderBookService = new OrderBookService();
