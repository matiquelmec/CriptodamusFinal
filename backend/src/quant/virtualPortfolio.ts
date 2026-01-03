export interface Position {
    symbol: string;
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    sizeUSD: number;
    amountCoin: number;
    timestamp: number;
    stopLoss?: number;
    takeProfits?: { price: number; percentage: number }[]; // Future: Scale outs
}

export interface TradeResult {
    symbol: string;
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice: number;
    entryTime: number;
    exitTime: number;
    sizeUSD: number;
    pnlUSD: number;
    pnlPercent: number;
    feeUSD: number;
    reason: string; // 'TP', 'SL', 'SIGNAL_FLIP', 'MANUAL'
}

export class VirtualPortfolio {
    public balance: number;
    public initialBalance: number;
    public positions: Map<string, Position> = new Map();
    public tradeHistory: TradeResult[] = [];

    // Config
    private feeRate = 0.001; // 0.1% Binance Standard
    private slippage = 0.0005; // 0.05% Simulated Slippage

    constructor(initialCapital: number = 1000) {
        this.balance = initialCapital;
        this.initialBalance = initialCapital;
    }

    /**
     * Open a new position
     */
    public openPosition(symbol: string, side: 'LONG' | 'SHORT', price: number, sizeUSD: number, sl?: number, tp?: number) {
        if (this.positions.has(symbol)) return; // Already in trade
        if (this.balance < sizeUSD) sizeUSD = this.balance; // All in fallback

        // Fee Deduction
        const fee = sizeUSD * this.feeRate;

        // Simulating Slippage (Worse entry)
        const effectivePrice = side === 'LONG' ? price * (1 + this.slippage) : price * (1 - this.slippage);
        const amountCoin = (sizeUSD - fee) / effectivePrice;

        this.positions.set(symbol, {
            symbol,
            side,
            entryPrice: effectivePrice,
            sizeUSD, // Gross size
            amountCoin,
            timestamp: Date.now(), // In backtest this should be injected time, but simplifies for now
            stopLoss: sl
        });

        // Deduct balance (Margin lock)
        this.balance -= sizeUSD;
    }

    /**
     * Check if current price hits SL or TP for open positions
     */
    public checkStops(symbol: string, currentPrice: number, currentTime: number): TradeResult | null {
        const position = this.positions.get(symbol);
        if (!position) return null;

        let triggered = false;
        let exitReason = '';

        // Check SL
        if (position.stopLoss) {
            if (position.side === 'LONG' && currentPrice <= position.stopLoss) {
                triggered = true;
                exitReason = 'SL';
            } else if (position.side === 'SHORT' && currentPrice >= position.stopLoss) {
                triggered = true;
                exitReason = 'SL';
            }
        }

        if (triggered) {
            return this.closePosition(symbol, currentPrice, exitReason, currentTime);
        }

        return null;
    }

    /**
     * Close a position
     */
    public closePosition(symbol: string, price: number, reason: string = 'MANUAL', currentTime: number = Date.now()): TradeResult {
        const position = this.positions.get(symbol);
        if (!position) throw new Error("Position not found");

        const isWin = position.side === 'LONG' ? price > position.entryPrice : price < position.entryPrice;

        // Calculate Exit Value
        // Long: Amount * Price
        // Short: Borrowed Value + (Entry - Exit) * Amount ... simplified as PnL addition

        // Robust PnL calc
        let rawPnlPercent = 0;
        if (position.side === 'LONG') {
            rawPnlPercent = (price - position.entryPrice) / position.entryPrice;
        } else {
            rawPnlPercent = (position.entryPrice - price) / position.entryPrice;
        }

        const positionValue = position.sizeUSD * (1 + rawPnlPercent);
        const exitFee = positionValue * this.feeRate;
        const netReturn = positionValue - exitFee;

        // Update Balance
        this.balance += netReturn;

        const pnlUSD = netReturn - position.sizeUSD;
        const totalFee = (position.sizeUSD * this.feeRate) + exitFee;

        const result: TradeResult = {
            symbol,
            side: position.side,
            entryPrice: position.entryPrice,
            exitPrice: price,
            entryTime: position.timestamp,
            exitTime: currentTime,
            sizeUSD: position.sizeUSD,
            pnlUSD,
            pnlPercent: (pnlUSD / position.sizeUSD) * 100,
            feeUSD: totalFee,
            reason
        };

        this.tradeHistory.push(result);
        this.positions.delete(symbol);

        return result;
    }

    public getStats() {
        const wins = this.tradeHistory.filter(t => t.pnlUSD > 0);
        const losses = this.tradeHistory.filter(t => t.pnlUSD <= 0);

        const totalTrades = this.tradeHistory.length;
        const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;

        const totalProfit = wins.reduce((sum, t) => sum + t.pnlUSD, 0);
        const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnlUSD, 0));

        const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

        // Max Drawdown Logic
        let maxPeak = this.initialBalance;
        let maxDrawdown = 0;
        let runningBalance = this.initialBalance;

        // Reconstruct equity curve
        const curve = [this.initialBalance];
        this.tradeHistory.forEach(t => {
            runningBalance += t.pnlUSD;
            if (runningBalance > maxPeak) maxPeak = runningBalance;
            const draw = (maxPeak - runningBalance) / maxPeak;
            if (draw > maxDrawdown) maxDrawdown = draw;
            curve.push(runningBalance);
        });

        return {
            finalBalance: this.balance,
            roi: ((this.balance - this.initialBalance) / this.initialBalance) * 100,
            totalTrades,
            winRate,
            profitFactor,
            maxDrawdown: maxDrawdown * 100, // %
            equityCurve: curve
        };
    }

    /**
     * CALCULATE PNL IN LAST 24H
     */
    public getDailyPnL(): number {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const recentTrades = this.tradeHistory.filter(t => t.exitTime >= oneDayAgo);

        const realizedPnL = recentTrades.reduce((sum, t) => sum + t.pnlUSD, 0);

        // Return as % of current balance
        return realizedPnL / (this.balance + this.initialBalance * 0.1); // Avoid div by zero
    }

    /**
     * CIRCUIT BREAKER Check
     */
    public isCircuitBreakerActive(limit: number): boolean {
        const dailyPnL = this.getDailyPnL();
        return dailyPnL <= -limit;
    }
}
