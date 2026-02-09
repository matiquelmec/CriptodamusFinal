/**
 * OrderBook Analyzer - Institutional Grade Analysis
 * 
 * This module provides professional-level orderbook analysis including:
 * 1. Fake Wall Detection (Anti-Manipulation)
 * 2. Absorption Analysis (Tape Reading)
 * 3. Deep Imbalance Analysis (Smart Money Detection)
 * 4. Spread Volatility (Panic Indicator)
 * 5. Iceberg Detection (Hidden Liquidity)
 */

import {
    WallTracker,
    IcebergZone,
    SpreadAnalysis,
    DepthImbalance,
    WallStability,
    FakeWallRisk,
    OrderBookAdvanced,
    OrderLevel
} from '../../../types/orderbook-advanced';

export class OrderBookAnalyzer {

    /**
     * 1. FAKE WALL DETECTION
     * Detects whale manipulation (spoofing) by tracking wall lifecycle
     */
    static detectFakeWalls(
        wallHistory: WallTracker[],
        currentWall: { price: number; volume: number; side: 'BID' | 'ASK' }
    ): { risk: FakeWallRisk; stability: WallStability } {

        if (!wallHistory || wallHistory.length === 0) {
            return { risk: 'LOW', stability: 'UNKNOWN' };
        }

        // Find matching wall in history (±0.1% price tolerance)
        const priceThreshold = currentWall.price * 0.001;
        const matchingWalls = wallHistory.filter(w =>
            Math.abs(w.price - currentWall.price) < priceThreshold &&
            w.side === currentWall.side
        );

        if (matchingWalls.length === 0) {
            return { risk: 'LOW', stability: 'UNKNOWN' };
        }

        // Analyze the most recent matching wall
        const recentWall = matchingWalls[matchingWalls.length - 1];

        // FAKE WALL INDICATORS:
        // 1. High cancel count (>2 cancellations)
        // 2. Short lifespan (<5 minutes = 300000ms)
        // 3. Recent cancellation (<10 minutes ago)

        const hasFakeSigns = recentWall.cancelCount > 2 && recentWall.lifespan < 300000;
        const wasRecentlyCancelled = (Date.now() - recentWall.lastSeen) < 600000; // 10 min

        if (hasFakeSigns && wasRecentlyCancelled) {
            return { risk: 'HIGH', stability: 'FAKE' };
        } else if (hasFakeSigns || wasRecentlyCancelled) {
            return { risk: 'MEDIUM', stability: 'UNKNOWN' };
        } else if (recentWall.lifespan > 900000) { // >15 min stable
            return { risk: 'LOW', stability: 'STABLE' };
        }

        return { risk: 'LOW', stability: 'UNKNOWN' };
    }

    /**
     * 2. ABSORPTION ANALYSIS
     * Determines if a wall can absorb volume (real support/resistance)
     */
    static analyzeAbsorption(
        wallPrice: number,
        currentPrice: number,
        wallVolume: number,
        recentVolume: number, // Volume executed near wall in last 1 min
        priceHeld: boolean     // Did price bounce or break through?
    ): { absorbed: boolean; score: number } {

        // If price never touched wall, no absorption test
        if (Math.abs(currentPrice - wallPrice) > wallPrice * 0.005) { // >0.5% away
            return { absorbed: false, score: 0 };
        }

        // Calculate absorption ratio
        const absorptionRatio = recentVolume / wallVolume;

        // SCORING LOGIC:
        // - If price held after volume hit: ABSORBED (strong wall)
        // - If price broke through: FAILED (weak/fake wall)

        if (priceHeld) {
            // Price held = wall absorbed the volume
            if (absorptionRatio > 0.8) {
                // Absorbed >80% of wall volume and still held = WHALE WALL
                return { absorbed: true, score: 100 };
            } else if (absorptionRatio > 0.5) {
                return { absorbed: true, score: 85 };
            } else {
                return { absorbed: true, score: 70 };
            }
        } else {
            // Price broke = wall failed
            return { absorbed: false, score: 20 };
        }
    }

    /**
     * 3. DEEP IMBALANCE ANALYSIS
     * Analyzes full 20-level depth to detect institutional pressure
     */
    static analyzeDepthImbalance(
        bids: OrderLevel[],
        asks: OrderLevel[]
    ): DepthImbalance {

        if (!bids || !asks || bids.length < 20 || asks.length < 20) {
            return {
                surface: 1.0,
                deep: 1.0,
                totalRatio: 1.0,
                divergence: false
            };
        }

        // Calculate surface pressure (top 5 levels)
        const top5BidsVolume = bids.slice(0, 5).reduce((sum, b) => sum + b.total, 0);
        const top5AsksVolume = asks.slice(0, 5).reduce((sum, a) => sum + a.total, 0);
        const surfacePressure = top5AsksVolume > 0 ? top5BidsVolume / top5AsksVolume : 1.0;

        // Calculate deep pressure (levels 6-20)
        const deepBidsVolume = bids.slice(5, 20).reduce((sum, b) => sum + b.total, 0);
        const deepAsksVolume = asks.slice(5, 20).reduce((sum, a) => sum + a.total, 0);
        const deepPressure = deepAsksVolume > 0 ? deepBidsVolume / deepAsksVolume : 1.0;

        // Total ratio (all 20 levels)
        const totalBidsVolume = top5BidsVolume + deepBidsVolume;
        const totalAsksVolume = top5AsksVolume + deepAsksVolume;
        const totalRatio = totalAsksVolume > 0 ? totalBidsVolume / totalAsksVolume : 1.0;

        // Divergence detection (trap indicator)
        // If surface is bullish but deep is bearish = TRAP
        const divergence = (surfacePressure > 1.5 && deepPressure < 0.8) ||
            (surfacePressure < 0.7 && deepPressure > 1.3);

        return {
            surface: surfacePressure,
            deep: deepPressure,
            totalRatio: totalRatio,
            divergence: divergence
        };
    }

    /**
     * 4. SPREAD VOLATILITY ANALYSIS
     * Detects panic (widening) or confidence (tightening)
     */
    static analyzeSpreadVolatility(
        bestBid: number,
        bestAsk: number,
        spreadHistory: number[], // Previous spreads
        normalSpread: number = 0.03 // 0.03% is normal for BTC
    ): SpreadAnalysis {

        const currentSpread = ((bestAsk - bestBid) / bestBid) * 100;

        // Update history (keep last 20)
        const updatedHistory = [...spreadHistory, currentSpread].slice(-20);

        // Check if widening (comparing to recent average)
        const recentAvg = updatedHistory.length > 5
            ? updatedHistory.slice(-5).reduce((a, b) => a + b, 0) / 5
            : currentSpread;
        const isWidening = currentSpread > recentAvg * 1.2;

        // Panic detection (spread >3x normal)
        const isPanic = currentSpread > normalSpread * 3;

        // Tight spread (very liquid, confident market)
        const isTight = currentSpread < normalSpread * 0.5;

        return {
            currentSpread: currentSpread,
            normalSpread: normalSpread,
            isWidening: isWidening,
            isPanic: isPanic,
            isTight: isTight,
            spreadHistory: updatedHistory
        };
    }

    /**
     * 5. ICEBERG DETECTION
     * Detects hidden institutional orders by tracking bounce patterns
     */
    static detectIcebergOrders(
        symbol: string,
        priceHistory: Array<{ price: number; time: number; volume: number }>,
        visibleWalls: Array<{ price: number; volume: number }>
    ): IcebergZone[] {

        if (!priceHistory || priceHistory.length < 10) {
            return [];
        }

        const icebergs: IcebergZone[] = [];
        const priceThreshold = 0.002; // 0.2% tolerance

        // Group price points into zones
        const zones = new Map<number, { count: number; totalVolume: number; lastTime: number }>();

        priceHistory.forEach(p => {
            // Find if this price matches an existing zone
            let matchedZone: number | null = null;
            for (const [zonePrice] of zones) {
                if (Math.abs(p.price - zonePrice) < zonePrice * priceThreshold) {
                    matchedZone = zonePrice;
                    break;
                }
            }

            if (matchedZone) {
                const zone = zones.get(matchedZone)!;
                zone.count += 1;
                zone.totalVolume += p.volume;
                zone.lastTime = p.time;
            } else {
                zones.set(p.price, { count: 1, totalVolume: p.volume, lastTime: p.time });
            }
        });

        // Identify iceberg zones (>3 bounces, no visible wall)
        for (const [price, data] of zones) {
            if (data.count >= 3) {
                // Check if there's a visible wall at this price
                const hasVisibleWall = visibleWalls.some(w =>
                    Math.abs(w.price - price) < price * priceThreshold
                );

                if (!hasVisibleWall) {
                    // ICEBERG DETECTED
                    const confidence = Math.min(100, data.count * 20); // 20 pts per bounce
                    icebergs.push({
                        price: price,
                        bounceCount: data.count,
                        totalVolume: data.totalVolume,
                        confidence: confidence,
                        lastBounce: data.lastTime
                    });
                }
            }
        }

        // Sort by confidence (highest first)
        return icebergs.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * MAIN ANALYSIS FUNCTION
     * Combines all 5 analyses into a comprehensive result
     */
    static analyzeOrderBook(
        bids: OrderLevel[],
        asks: OrderLevel[],
        wallHistory: WallTracker[],
        spreadHistory: number[],
        priceHistory: Array<{ price: number; time: number; volume: number }>,
        currentPrice: number,
        recentVolume: number
    ): OrderBookAdvanced {

        // Get best bid/ask
        const bestBid = bids[0]?.price || 0;
        const bestAsk = asks[0]?.price || 0;

        // 1. Fake Wall Detection
        const bidWall = bids[0];
        const askWall = asks[0];
        const fakeAnalysisBid = this.detectFakeWalls(wallHistory, {
            price: bidWall.price,
            volume: bidWall.total,
            side: 'BID'
        });
        const fakeAnalysisAsk = this.detectFakeWalls(wallHistory, {
            price: askWall.price,
            volume: askWall.total,
            side: 'ASK'
        });

        // Use worst risk
        const fakeWallRisk = fakeAnalysisBid.risk === 'HIGH' || fakeAnalysisAsk.risk === 'HIGH'
            ? 'HIGH'
            : fakeAnalysisBid.risk === 'MEDIUM' || fakeAnalysisAsk.risk === 'MEDIUM'
                ? 'MEDIUM'
                : 'LOW';

        // 2. Absorption (simplified - full tracking needs real-time data)
        const absorptionResult = this.analyzeAbsorption(
            bestBid,
            currentPrice,
            bidWall.total,
            recentVolume,
            currentPrice >= bestBid // price held if current >= bid
        );

        // 3. Deep Imbalance
        const depthImbalance = this.analyzeDepthImbalance(bids, asks);

        // 4. Spread Volatility
        const spreadAnalysis = this.analyzeSpreadVolatility(
            bestBid,
            bestAsk,
            spreadHistory
        );

        // 5. Iceberg Detection
        const visibleWalls = [
            { price: bidWall.price, volume: bidWall.total },
            { price: askWall.price, volume: askWall.total }
        ];
        const icebergZones = this.detectIcebergOrders('', priceHistory, visibleWalls);

        // Calculate overall confidence
        let confidence = 50; // baseline
        if (fakeWallRisk === 'LOW') confidence += 20;
        if (fakeWallRisk === 'HIGH') confidence -= 30;
        if (absorptionResult.absorbed) confidence += 15;
        if (depthImbalance.divergence) confidence -= 20;
        if (spreadAnalysis.isTight) confidence += 10;
        if (icebergZones.length > 0) confidence += 15;
        confidence = Math.max(0, Math.min(100, confidence));

        return {
            fakeWallRisk: fakeWallRisk,
            wallStability: fakeAnalysisBid.stability,
            absorptionScore: absorptionResult.score,
            wasAbsorbed: absorptionResult.absorbed,
            depthImbalance: depthImbalance,
            spreadAnalysis: spreadAnalysis,
            icebergZones: icebergZones,
            timestamp: Date.now(),
            confidence: confidence
        };
    }
}
