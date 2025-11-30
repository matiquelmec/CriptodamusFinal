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
}

export interface AutoFibsResult {
    trend: 'UP' | 'DOWN';
    level0: number;
    level0_236: number;
    level0_382: number;
    level0_5: number;
    level0_618: number;
    level0_786: number;
    level1: number;
}
