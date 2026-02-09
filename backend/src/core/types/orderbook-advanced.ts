/**
 * Advanced OrderBook Analysis Types
 * Professional-grade interfaces for institutional trading
 */

/**
 * Wall Tracker - Historical tracking of orderbook walls
 * Used to detect fake walls and spoofing
 */
export interface WallTracker {
    symbol: string;
    price: number;
    volume: number;
    side: 'BID' | 'ASK';
    firstSeen: number; // timestamp
    lastSeen: number;  // timestamp
    cancelCount: number; // How many times it disappeared
    lifespan: number;   // milliseconds
}

/**
 * Iceberg Zone - Hidden liquidity detection
 * Detects institutional orders that are hidden (iceberg orders)
 */
export interface IcebergZone {
    price: number;
    bounceCount: number;
    totalVolume: number; // Volume executed at this level without visible wall
    confidence: number;  // 0-100
    lastBounce: number;  // timestamp
}

/**
 * Spread Analysis - Market volatility indicator
 */
export interface SpreadAnalysis {
    currentSpread: number;     // percentage
    normalSpread: number;      // baseline
    isWidening: boolean;       // spread increasing
    isPanic: boolean;          // >3x normal (fear)
    isTight: boolean;          // <0.5x normal (confidence)
    spreadHistory: number[];   // last 20 spreads
}

/**
 * Depth Imbalance - Liquidity distribution analysis
 */
export interface DepthImbalance {
    surface: number;    // Top 5 levels bid/ask ratio
    deep: number;       // Levels 6-20 bid/ask ratio
    totalRatio: number; // All 20 levels
    divergence: boolean; // Surface vs deep mismatch (trap detector)
}

/**
 * Wall Stability Classification
 */
export type WallStability = 'STABLE' | 'FAKE' | 'UNKNOWN';

/**
 * Fake Wall Risk Level
 */
export type FakeWallRisk = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Advanced OrderBook Analysis Result
 * This is the enriched data structure returned by OrderBookAnalyzer
 */
export interface OrderBookAdvanced {
    // Fake Wall Detection
    fakeWallRisk: FakeWallRisk;
    wallStability: WallStability;

    // Absorption Analysis
    absorptionScore: number; // 0-100 (higher = wall held strong)
    wasAbsorbed: boolean;

    // Deep Imbalance
    depthImbalance: DepthImbalance;

    // Spread Volatility
    spreadAnalysis: SpreadAnalysis;

    // Iceberg Detection
    icebergZones: IcebergZone[];

    // Metadata
    timestamp: number;
    confidence: number; // Overall confidence in analysis (0-100)
}

/**
 * Order Level (Basic building block)
 */
export interface OrderLevel {
    price: number;
    qty: number;
    total: number; // price * qty
}
