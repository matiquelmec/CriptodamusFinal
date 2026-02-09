
import { LiquidationCluster, OrderBookAnalysis } from '../../types/types-advanced';

/**
 * 1. Hyblock Capital Style Liquidation Estimation
 * Logic: Pivot Highs/Lows act as anchor points for high leverage stops.
 * Formula:
 * - Short Liq = PivotHigh + (PivotHigh * 1/Leverage)
 * - Long Liq = PivotLow - (PivotLow * 1/Leverage)
 */
export function estimateLiquidationClusters(
    highs: number[],
    lows: number[],
    currentPrice: number
): LiquidationCluster[] {
    const clusters: LiquidationCluster[] = [];
    const leverages = [100, 50, 25]; // Major leverage tiers

    // Find key pivots (Swing Highs/Lows) in last 50 candles
    // Simple 3-bar pivot detection
    const lookback = 50;
    const start = Math.max(0, highs.length - lookback);

    for (let i = start + 2; i < highs.length - 2; i++) {
        const isPivotHigh = highs[i] > highs[i - 1] && highs[i] > highs[i - 2] && highs[i] > highs[i + 1] && highs[i] > highs[i + 2];
        const isPivotLow = lows[i] < lows[i - 1] && lows[i] < lows[i - 2] && lows[i] < lows[i + 1] && lows[i] < lows[i + 2];

        if (isPivotHigh) {
            leverages.forEach(lev => {
                const buffer = 1 / lev; // e.g. 0.01 for 100x
                const liqPrice = highs[i] * (1 + buffer + 0.002); // +0.2% fee/spread margin
                if (liqPrice > currentPrice) { // Only future liquidations
                    clusters.push({
                        priceMin: liqPrice * 0.999,
                        priceMax: liqPrice * 1.001,
                        totalVolume: lev * 1000, // Synthetic weight
                        strength: lev, // Higher leverage = Magnet for wicks, but less volume? No, 100x REKT is juicy.
                        type: 'SHORT_LIQ'
                    });
                }
            });
        }

        if (isPivotLow) {
            leverages.forEach(lev => {
                const buffer = 1 / lev;
                const liqPrice = lows[i] * (1 - buffer - 0.002);
                if (liqPrice < currentPrice) {
                    clusters.push({
                        priceMin: liqPrice * 0.999,
                        priceMax: liqPrice * 1.001,
                        totalVolume: lev * 1000,
                        strength: lev,
                        type: 'LONG_LIQ'
                    });
                }
            });
        }
    }

    // Merge close clusters
    const merged = mergeClusters(clusters);

    // Sort by proximity to current price
    return merged.sort((a, b) =>
        Math.abs(a.priceMin - currentPrice) - Math.abs(b.priceMin - currentPrice)
    ).slice(0, 5); // Return Top 5 Risks/Magnets
}

function mergeClusters(clusters: LiquidationCluster[]): LiquidationCluster[] {
    if (clusters.length === 0) return [];

    // Simple merge: overlap
    const sorted = clusters.sort((a, b) => a.priceMin - b.priceMin);
    const result: LiquidationCluster[] = [];

    let current = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];
        if (next.priceMin <= current.priceMax && next.type === current.type) {
            // Overlap or close enough (0.1%?)
            current.priceMax = Math.max(current.priceMax, next.priceMax);
            current.totalVolume += next.totalVolume;
            current.strength = Math.max(current.strength, next.strength);
        } else {
            result.push(current);
            current = next;
        }
    }
    result.push(current);
    return result;
}

/**
 * 2. Orderbook Wall Detection
 * Analyze Bids/Asks to find imbalances and spoofing.
 */
export function analyzeOrderBook(
    bids: [string, string][],
    asks: [string, string][],
    currentPrice: number
): OrderBookAnalysis {
    let bidVol = 0;
    let askVol = 0;

    // Arrays to number
    const numBids = bids.map(b => ({ p: parseFloat(b[0]), q: parseFloat(b[1]) }));
    const numAsks = asks.map(a => ({ p: parseFloat(a[0]), q: parseFloat(a[1]) }));

    let maxBidBlock = { price: 0, volume: 0, strength: 0 };
    let maxAskBlock = { price: 0, volume: 0, strength: 0 };

    // Sum Volume and Find Walls in top 20 levels
    const depth = Math.min(numBids.length, numAsks.length, 20);

    for (let i = 0; i < depth; i++) {
        bidVol += numBids[i].q;
        askVol += numAsks[i].q;

        if (numBids[i].q > maxBidBlock.volume) {
            maxBidBlock = { price: numBids[i].p, volume: numBids[i].q, strength: 0 };
        }
        if (numAsks[i].q > maxAskBlock.volume) {
            maxAskBlock = { price: numAsks[i].p, volume: numAsks[i].q, strength: 0 };
        }
    }

    const avgVol = (bidVol + askVol) / (depth * 2);

    // Wall Threshold: 3x average volume of the book depth
    if (maxBidBlock.volume > avgVol * 3) maxBidBlock.strength = 100;
    if (maxAskBlock.volume > avgVol * 3) maxAskBlock.strength = 100;

    return {
        bidWall: maxBidBlock.strength > 0 ? { ...maxBidBlock, isPersistent: false } : null,
        askWall: maxAskBlock.strength > 0 ? { ...maxAskBlock, isPersistent: false } : null,
        buyingPressure: askVol > 0 ? bidVol / askVol : 1, // > 1 Bullish, < 1 Bearish
        spoofing: false // Requires history to detect (flickering), unavailable in snapshot
    };
}
