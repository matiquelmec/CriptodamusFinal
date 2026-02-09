import { LiquidationCluster, OrderBookAnalysis } from '../../core/types/types-advanced';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM Config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

/**
 * 0. REAL DATA: Liquidation Heatmap from Database
 * Queries the "Blood Collector" table to find actual recent Rekt Zones.
 */
export async function getRealLiquidationClusters(symbol: string): Promise<LiquidationCluster[]> {
    if (!supabase) return [];

    try {
        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);

        // Fetch raw liquidations for the symbol in last 24h
        const { data, error } = await supabase
            .from('liquidation_heatmap')
            .select('price, volume, side')
            .eq('symbol', symbol)
            .gt('timestamp', twentyFourHoursAgo);

        if (error || !data || data.length === 0) return [];

        // Aggregate into buckets (Clusters)
        // Simple clustering: round to nearest 0.5% price point? Or dynamic?
        // Let's use a bucket size proportional to price (0.2%)
        const clusters: LiquidationCluster[] = [];
        const bucketMap = new Map<string, LiquidationCluster>();

        // Estimate price for bucket size calc from first entry or just use logic
        const avgPrice = data[0].price;
        const bucketSize = avgPrice * 0.002; // 0.2%

        data.forEach(liq => {
            const bucketKey = Math.floor(liq.price / bucketSize);
            const key = `${liq.side}-${bucketKey}`;

            if (!bucketMap.has(key)) {
                bucketMap.set(key, {
                    priceMin: Number.MAX_VALUE,
                    priceMax: Number.MIN_VALUE,
                    totalVolume: 0,
                    strength: 0, // Will map volume to strength
                    type: liq.side // Already mapped in binanceStream as LONG_LIQ or SHORT_LIQ
                });
            }

            const cluster = bucketMap.get(key)!;
            cluster.priceMin = Math.min(cluster.priceMin, liq.price);
            cluster.priceMax = Math.max(cluster.priceMax, liq.price);
            cluster.totalVolume += liq.volume;
        });

        // Convert Map to Array and Normalize Strength
        let maxVol = 0;
        bucketMap.forEach(c => {
            if (c.totalVolume > maxVol) maxVol = c.totalVolume;
        });

        bucketMap.forEach(c => {
            // Strength 0-100 based on volume relative to biggest cluster
            c.strength = Math.round((c.totalVolume / maxVol) * 100);
            clusters.push(c);
        });

        // Return Top 5 Big Clusters
        return clusters.sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 5);

    } catch (e) {
        console.error("❌ Error fetching real liquidations:", e);
        return [];
    }
}

/**
 * 1. Hyblock Capital Style Liquidation Estimation (FALLBACK)
 * Logic: Pivot Highs/Lows act as anchor points for high leverage stops.
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
