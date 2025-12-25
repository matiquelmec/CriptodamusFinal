import { MarketRisk, FundamentalTier } from '../../types';
import { fetchCandles } from '../api/binanceApi'; // Import from new API module

// NEW: FUNDAMENTAL TIER CALCULATOR
// Approximates tier based on Symbol (Hardcoded Elite) or Volume/Memes
export const calculateFundamentalTier = (symbol: string, isMeme: boolean): FundamentalTier => {
    // S TIER: The Kings (Store of Value / L1 Std)
    const S_TIER = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
    if (S_TIER.includes(symbol)) return 'S';

    // C TIER: Memes & Low Cap Speculation
    if (isMeme) return 'C';
    const C_TIER_PATTERNS = ['PEPE', 'DOGE', 'SHIB', 'BONK', 'WIF', 'FLOKI', '1000SATS', 'ORDI'];
    if (C_TIER_PATTERNS.some(p => symbol.includes(p))) return 'C';

    // A TIER: Established Blue Chips (Defi/L1/L2 High Vol)
    const A_TIER = ['XRPUSDT', 'ADAUSDT', 'LINKUSDT', 'AVAXUSDT', 'DOTUSDT', 'TRXUSDT', 'TONUSDT', 'SUIUSDT', 'APTUSDT'];
    if (A_TIER.includes(symbol)) return 'A';

    // B TIER: The rest (Mid Caps)
    return 'B';
};

// NEW: Market Risk Detector (Volatility & Manipulation Proxy)
export const getMarketRisk = async (): Promise<MarketRisk> => {
    try {
        // Use BTCUSDT as proxy for general market volatility AND volume manipulation
        const candles = await fetchCandles('BTCUSDT', '1h');
        if (candles.length < 24) return { level: 'LOW', note: 'Normal', riskType: 'NORMAL' };

        const currentCandle = candles[candles.length - 1]; // Latest open candle
        const prevCandles = candles.slice(candles.length - 25, candles.length - 1);

        // 1. VOLATILITY CHECK
        const ranges = prevCandles.map(c => (c.high - c.low) / c.open);
        const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
        const currentRange = (currentCandle.high - currentCandle.low) / currentCandle.open;

        // 2. MANIPULATION CHECK (Volume Anomaly)
        const volumes = prevCandles.map(c => c.volume);
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const currentVolume = currentCandle.volume;
        const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;

        // --- RISK LOGIC ---

        // Case A: Whale Manipulation (Massive Volume + Potential Churn)
        // If volume is > 3.5x average, someone is aggressively entering/exiting BTC
        if (volumeRatio > 3.5) {
            return {
                level: 'HIGH',
                note: `🐋 BALLENAS DETECTADAS: Volumen BTC anormal (x${volumeRatio.toFixed(1)}). Posible manipulación.`,
                riskType: 'MANIPULATION'
            };
        }

        // Case B: High Volatility (News Impact)
        // If volatility is 3x avg or > 2.5% absolute in 1h
        if (currentRange > avgRange * 3 || currentRange > 0.025) {
            return {
                level: 'HIGH',
                note: '🚨 NOTICIAS/VOLATILIDAD: BTC moviéndose agresivamente. Mercado inestable.',
                riskType: 'VOLATILITY'
            };
        }

        // Case C: Medium Caution
        if (currentRange > avgRange * 1.8) {
            return { level: 'MEDIUM', note: '⚠️ Volatilidad superior al promedio.', riskType: 'VOLATILITY' };
        }

        if (volumeRatio > 2.0) {
            return { level: 'MEDIUM', note: '⚠️ Volumen BTC elevado. Precaución.', riskType: 'MANIPULATION' };
        }

        return { level: 'LOW', note: 'Condiciones estables.', riskType: 'NORMAL' };
    } catch (e) {
        return { level: 'LOW', note: 'Riesgo desconocido', riskType: 'NORMAL' };
    }
};
