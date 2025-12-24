// Advanced Market Structure Types for Maximum Potential System

export interface Candle {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface VolumeProfileData {
    poc: number;
    valueAreaHigh: number;
    valueAreaLow: number;
}

export interface OrderBlockData {
    price: number;
    strength: number;
    mitigated: boolean;
}

export interface FairValueGapData {
    midpoint: number;
    size: number;
    filled: boolean;
}

export interface POIData {
    price: number;
    score: number;
    factors: string[];
}

export interface ConfluenceData {
    topSupports: POIData[];
    topResistances: POIData[];
}

// Extended Technical Indicators with Advanced Market Structure
export interface AdvancedTechnicalIndicators {
    volumeProfile?: VolumeProfileData;
    orderBlocks?: {
        bullish: OrderBlockData[];
        bearish: OrderBlockData[];
    };
    fairValueGaps?: {
        bullish: FairValueGapData[];
        bearish: FairValueGapData[];
    };
    confluenceAnalysis?: ConfluenceData;
    harmonicPatterns?: HarmonicPattern[];
}

export interface HarmonicPattern {
    type: 'GARTLEY' | 'BAT' | 'BUTTERFLY' | 'CRAB';
    direction: 'BULLISH' | 'BEARISH';
    startIndex: number;
    endIndex: number;
    points: { X: number; A: number; B: number; C: number; D: number };
    prz: number; // Potential Reversal Zone
    stopLoss: number;
    takeProfits: [number, number];
    confidence: number;
}

export interface AutoFibsResult {
    trend: 'UP' | 'DOWN';
    level0: number;
    level0_236: number;
    level0_382: number;
    level0_5: number;
    level0_618: number;
    level0_65: number;   // NEW: Golden Pocket Low
    level0_786: number;
    level0_886: number;  // NEW: Deep retracement
    level1: number;
    tp1: number;
    tp2: number;
    tp3: number;
    tp4: number; // 1.618 / 2.618
    tp5: number; // 2.618 / 4.236
}

// --- MARKET REGIME DETECTION ---

export type MarketRegimeType = 'TRENDING' | 'RANGING' | 'VOLATILE' | 'EXTREME';
export type TrendDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type ExtremeCondition = 'OVERSOLD' | 'OVERBOUGHT' | 'BULLISH_DIVERGENCE' | 'BEARISH_DIVERGENCE';

export interface RegimeMetrics {
    adx: number;                    // Trend strength (0-100)
    atr: number;                    // Volatility
    atrPercent: number;             // ATR as % of price
    bbBandwidth: number;            // Bollinger Bandwidth (%)
    emaAlignment: TrendDirection;   // EMA ribbon alignment
    rsi: number;                    // RSI value
    rvol: number;                   // Relative Volume
    zScore: number;                 // NEW: Distance from EMA200 (StdDevs)
    emaSlope: number;               // NEW: Slope of EMA200 (Angle/Strength)
    extremeCondition?: ExtremeCondition;
}

export interface MarketRegime {
    regime: MarketRegimeType;
    confidence: number;              // 0-100
    metrics: RegimeMetrics;
    recommendedStrategies: string[]; // Strategy IDs
    reasoning: string;               // Human-readable explanation
}

// --- STRATEGY SELECTION ---

export interface StrategyWeight {
    id: string;                      // Strategy ID
    name: string;                    // Strategy name
    weight: number;                  // 0-1 (percentage as decimal)
    reason: string;                  // Why this strategy was selected
}

export interface StrategySelection {
    activeStrategies: StrategyWeight[];
    disabledStrategies: string[];
    regimeJustification: string;
    totalWeight: number;             // Should always be 1.0
}

// --- DIVERGENCE DETECTION ---

export type DivergenceType =
    | 'BULLISH'           // Price lower low, RSI higher low (reversal up)
    | 'BEARISH'           // Price higher high, RSI lower high (reversal down)
    | 'HIDDEN_BULLISH'    // Price higher low, RSI lower low (continuation up)
    | 'HIDDEN_BEARISH';   // Price lower high, RSI higher high (continuation down)

export interface DivergenceSignal {
    type: DivergenceType | null;
    strength: number;                // 0-10
    pricePoints: [number, number];   // [first price, second price]
    rsiPoints: [number, number];     // [first RSI, second RSI]
    timestamps: [number, number];    // [first timestamp, second timestamp]
    expectedMove: number;            // Expected % move
    confidence: number;              // 0-100
}

// --- EXPERT VOLUME ANALYSIS (NEW) ---

export interface DerivativesData {
    openInterest: number;           // En Moneda (ej: BTC)
    openInterestValue: number;      // En USD
    fundingRate: number;            // Funding Rate actual (0.01% = 0.0001)
    fundingRateDaily: number;       // Annualized approximation or Daily
    buySellRatio: number;           // Long/Short Ratio accounts
}

export interface CVDData {
    current: number;                // Cumulative Volume Delta actual
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    divergence: 'BULLISH_ABSORPTION' | 'BEARISH_EXHAUSTION' | 'NONE';
    candleDelta: number;            // Delta de la vela actual
}

export interface VolumeExpertAnalysis {
    derivatives: DerivativesData;
    cvd: CVDData;
    coinbasePremium: {
        index: number;              // Gap: (CoinbasePrice - BinancePrice)
        gapPercent: number;         // Gap en %
        signal: 'INSTITUTIONAL_BUY' | 'INSTITUTIONAL_SELL' | 'NEUTRAL';
    };
    liquidity: {
        bidAskSpread: number;
        marketDepthScore: number;   // 0-100 score de liquidez
    };
}
