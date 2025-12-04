// Temporary file to define the correct fractalAnalysis type
// This should be copied into types.ts

fractalAnalysis ?: {
    trend_1h: 'BULLISH' | 'BEARISH';
    ema200_1h: number;
    price_1h: number;
    structure: 'ALIGNED' | 'DIVERGENT';
    // 4H
    trend_4h?: 'BULLISH' | 'BEARISH';
    ema200_4h?: number;
    price_4h?: number;
    // 1D
    trend_1d?: 'BULLISH' | 'BEARISH';
    ema200_1d?: number;
    price_1d?: number;
};
