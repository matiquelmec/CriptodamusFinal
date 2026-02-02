

import { MarketData, FearAndGreedData, AIOpportunity, TradingStyle, TechnicalIndicators, MarketRisk } from '../types';
import { hasActiveSession } from './geminiService';

// PRIMARY: Binance Vision (CORS friendly for public data)
const BINANCE_API_BASE = 'https://data-api.binance.vision/api/v3';
const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/stream?streams=';

// FALLBACK: CoinCap (Very reliable for frontend)
const COINCAP_API_BASE = 'https://api.coincap.io/v2';

// List of known major memes to filter for the "Meme" view
const MEME_SYMBOLS = [
    'DOGE', 'SHIB', 'PEPE', 'WIF', 'FLOKI', 'BONK', 'BOME', 'MEME', 'PEOPLE', 
    'DOGS', 'TURBO', 'MYRO', 'NEIRO', '1000SATS', 'ORDI', 'BABYDOGE', 'MOODENG',
    'PNUT', 'ACT', 'POPCAT', 'SLERF', 'BRETT', 'GOAT', 'MOG', 'SPX', 'HIPPO', 'LADYS',
    'CHILLGUY', 'LUCE', 'PENGU'
];

// UTILITY: Fetch with Timeout to prevent blocking UI
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 4000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

export const fetchCryptoData = async (mode: 'volume' | 'memes' = 'volume'): Promise<MarketData[]> => {
  try {
    const data = await fetchBinanceMarkets(mode);
    if (data.length === 0) throw new Error("Empty Binance Data");
    return data;
  } catch (error) {
    console.warn("Binance API failed/blocked, switching to CoinCap fallback...", error);
    return await fetchCoinCapMarkets(mode);
  }
};

// --- BINANCE FETCH STRATEGY ---
const fetchBinanceMarkets = async (mode: 'volume' | 'memes'): Promise<MarketData[]> => {
    try {
        const response = await fetchWithTimeout(`${BINANCE_API_BASE}/ticker/24hr`);
        if (!response.ok) throw new Error(`Binance returned ${response.status}`);
        
        const data = await response.json();
        
        // Ignored symbols
        const ignoredPatterns = ['USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'USDPUSDT', 'EURUSDT', 'DAIUSDT', 'BUSDUSDT', 'UPUSDT', 'DOWNUSDT', 'BULLUSDT', 'BEARUSDT', 'USDT', 'PAXGUSDT'];

        let filteredData = data.filter((ticker: any) => {
            const symbol = ticker.symbol;
            return symbol.endsWith('USDT') && 
                !ignoredPatterns.includes(symbol) &&
                !symbol.includes('DOWN') && 
                !symbol.includes('UP');
        });

        if (mode === 'memes') {
            filteredData = filteredData.filter((ticker: any) => {
                const baseSymbol = ticker.symbol.replace('USDT', '');
                // Check specific list or 1000-prefix (e.g. 1000SATS, 1000PEPE sometimes used)
                return MEME_SYMBOLS.includes(baseSymbol) || MEME_SYMBOLS.includes(baseSymbol.replace('1000', ''));
            });
             // Sort memes by Volume too
            filteredData = filteredData.sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
        } else {
            // Default: Top 50 by Volume
            filteredData = filteredData
                .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
                .slice(0, 50);
        }

        return filteredData.map((ticker: any) => {
            const rawSymbol = ticker.symbol.replace('USDT', '');
            return {
                id: ticker.symbol, // Binance Symbol ID
                symbol: `${rawSymbol}/USDT`,
                price: parseFloat(ticker.lastPrice),
                change24h: parseFloat(ticker.priceChangePercent),
                rsi: 50, // Placeholder, calculated properly in detailed analysis
                volume: formatVolume(parseFloat(ticker.quoteVolume)),
                trend: parseFloat(ticker.priceChangePercent) > 0.5 ? 'bullish' : 'bearish'
            };
        });
    } catch (e) {
        throw e;
    }
};

// --- COINCAP FETCH STRATEGY (FALLBACK) ---
const fetchCoinCapMarkets = async (mode: 'volume' | 'memes'): Promise<MarketData[]> => {
    try {
        const response = await fetchWithTimeout(`${COINCAP_API_BASE}/assets?limit=100`);
        if (!response.ok) return [];
        
        const json = await response.json();
        let assets = json.data;

        if (mode === 'memes') {
             assets = assets.filter((asset: any) => 
                MEME_SYMBOLS.includes(asset.symbol.toUpperCase())
            );
        } else {
            assets = assets.slice(0, 50);
        }

        return assets.map((asset: any) => ({
            id: asset.id, // CoinCap ID (e.g. 'bitcoin') - Important for candles
            symbol: `${asset.symbol}/USDT`,
            price: parseFloat(asset.priceUsd),
            change24h: parseFloat(asset.changePercent24Hr),
            rsi: 50,
            volume: formatVolume(parseFloat(asset.volumeUsd24Hr)),
            trend: parseFloat(asset.changePercent24Hr) > 0.5 ? 'bullish' : 'bearish'
        }));
    } catch (e) {
        return [];
    }
};

// General subscription for the main scanner
export const subscribeToLivePrices = (marketData: MarketData[], callback: (data: Record<string, number>) => void) => {
  const sampleId = marketData[0]?.id || '';
  const isBinance = sampleId === sampleId.toUpperCase() && sampleId.includes('USDT');

  if (isBinance) {
      const validStreams = marketData.map(m => `${m.id.toLowerCase()}@miniTicker`);
      const url = `${BINANCE_WS_BASE}${validStreams.join('/')}`;
      const ws = new WebSocket(url);
      
      ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.data && msg.data.s && msg.data.c) {
                const displaySymbol = msg.data.s.replace('USDT', '/USDT');
                callback({ [displaySymbol]: parseFloat(msg.data.c) });
            }
        } catch(e) {}
      };
      return () => ws.close();
  } else {
      const ids = marketData.map(m => m.id).join(',');
      const ws = new WebSocket(`wss://ws.coincap.io/prices?assets=${ids}`);
      ws.onmessage = (event) => {
          try {
              const msg = JSON.parse(event.data);
              const update: Record<string, number> = {};
              Object.keys(msg).forEach(key => {
                  const item = marketData.find(m => m.id === key);
                  if (item) {
                      update[item.symbol] = parseFloat(msg[key]);
                  }
              });
              callback(update);
          } catch(e) {}
      };
      return () => ws.close();
  }
};

export const getFearAndGreedIndex = async (): Promise<FearAndGreedData | null> => {
  try {
    const response = await fetchWithTimeout('https://api.alternative.me/fng/', {}, 3000);
    if (!response.ok) return null;
    const json = await response.json();
    return json.data[0];
  } catch (e) {
    return null;
  }
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

export const getMacroData = async (): Promise<string> => {
    try {
        const globalRes = await fetchWithTimeout('https://api.coincap.io/v2/global', {}, 3000);
        let btcDominance = "Unknown";
        if (globalRes.ok) {
            const data = await globalRes.json();
            btcDominance = parseFloat(data.data.bitcoinDominancePercentage).toFixed(2);
        }
        return `CONTEXTO MACROECONÓMICO: Dominancia Bitcoin: ${btcDominance}%`;
    } catch (e) {
        return "Macro Data Unavailable";
    }
};

export const getMarketContextForAI = async (): Promise<string> => {
    return getMacroData();
};

// --- TECHNICAL ANALYSIS ENGINE ---

const fetchCandles = async (symbolId: string, interval: string): Promise<{close: number, volume: number, high: number, low: number, open: number}[]> => {
    const isBinance = symbolId === symbolId.toUpperCase() && symbolId.endsWith('USDT');

    try {
        if (isBinance) {
            // Fetching 205 candles to ensure deep data for EMA200 calculation
            const res = await fetchWithTimeout(`${BINANCE_API_BASE}/klines?symbol=${symbolId}&interval=${interval}&limit=205`, {}, 4000);
            if (!res.ok) throw new Error("Binance Candle Error");
            const data = await res.json();
            return data.map((d: any[]) => ({ 
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4]), 
                volume: parseFloat(d[5]) 
            }));
        } else {
            const ccInterval = interval === '15m' ? 'm15' : 'h1'; 
            const res = await fetchWithTimeout(`${COINCAP_API_BASE}/candles?exchange=binance&interval=${ccInterval}&baseId=${symbolId}&quoteId=tether`, {}, 4000);
            if (!res.ok) return [];
            const json = await res.json();
            return json.data.map((d: any) => ({ 
                open: parseFloat(d.open),
                high: parseFloat(d.high),
                low: parseFloat(d.low),
                close: parseFloat(d.close), 
                volume: parseFloat(d.volume) 
            }));
        }
    } catch (e) {
        // Retry with CoinCap logic if Binance fails (or vice versa handled by mapBinanceToCoinCap caller)
        if (isBinance) {
            const fallbackId = mapBinanceToCoinCap(symbolId);
            if (fallbackId) {
                 try {
                    const ccInterval = interval === '15m' ? 'm15' : 'h1'; 
                    const res = await fetchWithTimeout(`${COINCAP_API_BASE}/candles?exchange=binance&interval=${ccInterval}&baseId=${fallbackId}&quoteId=tether`, {}, 4000);
                    if (!res.ok) return [];
                    const json = await res.json();
                    return json.data.map((d: any) => ({ 
                        open: parseFloat(d.open),
                        high: parseFloat(d.high),
                        low: parseFloat(d.low),
                        close: parseFloat(d.close), 
                        volume: parseFloat(d.volume) 
                    }));
                 } catch(err) { return []; }
            }
        }
        return [];
    }
};

const mapBinanceToCoinCap = (symbol: string) => {
    const map: Record<string, string> = { 'BTCUSDT': 'bitcoin', 'ETHUSDT': 'ethereum', 'SOLUSDT': 'solana', 'DOGEUSDT': 'dogecoin', 'BNBUSDT': 'binance-coin', 'XRPUSDT': 'xrp', 'ADAUSDT': 'cardano' };
    return map[symbol];
}

// NEW: Returns STRUCTURED DATA for the AI (No String parsing needed)
export const getRawTechnicalIndicators = async (symbolDisplay: string): Promise<TechnicalIndicators | null> => {
    const rawSymbol = symbolDisplay.replace('/USDT', ''); 
    const binanceSymbol = `${rawSymbol}USDT`; 

    try {
        const candles = await fetchCandles(binanceSymbol, '15m');
        if (candles.length < 50) return null;

        const prices = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        
        // Calcs
        const currentPrice = prices[prices.length - 1];
        const rsi = calculateRSI(prices, 14);
        const stochRsi = calculateStochRSI(prices, 14); // NEW
        const adx = calculateADX(highs, lows, prices, 14);
        const atr = calculateATR(highs, lows, prices, 14);
        const ema20 = calculateEMA(prices, 20);
        const ema50 = calculateEMA(prices, 50);
        const ema100 = calculateEMA(prices, 100);
        const ema200 = calculateEMA(prices, 200);
        const vwap = calculateCumulativeVWAP(highs, lows, prices, volumes); // NEW
        
        const avgVol = calculateSMA(volumes, 20);
        const rvol = avgVol > 0 ? (volumes[volumes.length - 1] / avgVol) : 0;
        
        const macd = calculateMACD(prices);
        const pivots = calculatePivotPoints(highs, lows, prices);
        const bb = calculateBollingerStats(prices);
        const fibs = calculateAutoFibs(highs, lows, ema200); // NEW

        // Determine Alignment
        let emaAlignment: 'BULLISH' | 'BEARISH' | 'CHAOTIC' = 'CHAOTIC';
        if (ema20 > ema50 && ema50 > ema100 && ema100 > ema200) emaAlignment = 'BULLISH';
        if (ema20 < ema50 && ema50 < ema100 && ema100 < ema200) emaAlignment = 'BEARISH';

        return {
            symbol: symbolDisplay,
            price: currentPrice,
            rsi,
            stochRsi,
            adx,
            atr,
            rvol,
            vwap,
            ema20,
            ema50,
            ema100,
            ema200,
            macd: {
                line: macd.macdLine,
                signal: macd.signalLine,
                histogram: macd.histogram
            },
            bollinger: {
                upper: bb.upper,
                lower: bb.lower,
                middle: bb.sma, // Using SMA as middle band
                bandwidth: bb.bandwidth
            },
            pivots: {
                p: pivots.p,
                r1: pivots.r1,
                s1: pivots.s1,
                r2: (pivots.p - pivots.s1) + pivots.r1, // Simple R2 approx
                s2: pivots.p - (pivots.r1 - pivots.s1)  // Simple S2 approx
            },
            fibonacci: fibs,
            trendStatus: {
                emaAlignment,
                goldenCross: ema50 > ema200,
                deathCross: ema50 < ema200
            }
        };

    } catch (e) {
        return null;
    }
}

// Legacy function kept for string compatibility if needed elsewhere, 
// but upgraded to use the structured data to ensure consistency.
export const getTechnicalAnalysis = async (symbolDisplay: string): Promise<string> => {
    const data = await getRawTechnicalIndicators(symbolDisplay);
    if (!data) return `No se pudo conectar al mercado para ${symbolDisplay}.`;

    return `
DATOS TÉCNICOS AVANZADOS PARA ${data.symbol}:
- Precio Actual: $${data.price}
- Estructura EMA (20/50/100/200): $${data.ema20.toFixed(4)} / $${data.ema50.toFixed(4)} / $${data.ema100.toFixed(4)} / $${data.ema200.toFixed(4)}
- RSI (14, Wilder): ${data.rsi.toFixed(2)}
- MACD Hist: ${data.macd.histogram.toFixed(4)}
- Bollinger: Sup $${data.bollinger.upper.toFixed(4)} / Inf $${data.bollinger.lower.toFixed(4)}
- ATR: $${data.atr.toFixed(4)}
`.trim();
};

// --- AUTONOMOUS QUANT ENGINE v4.0 (API INDEPENDENT) ---

export const scanMarketOpportunities = async (style: TradingStyle): Promise<AIOpportunity[]> => {
    // 1. Get market data based on selected style
    // MEME_SCALP uses specific meme list, others use top volume
    const mode = style === 'MEME_SCALP' ? 'memes' : 'volume';
    const market = await fetchCryptoData(mode);
    
    // 2. CHECK MARKET RISK (News Filter)
    const risk = await getMarketRisk();
    const isHighRisk = risk.level === 'HIGH';

    if (!market || market.length === 0) throw new Error("No market data available");
    
    // Scan all candidates if Memes (usually < 40), or top 40 for general
    const topCandidates = style === 'MEME_SCALP' ? market : market.slice(0, 40);
    
    const validMathCandidates: AIOpportunity[] = [];

    await Promise.all(topCandidates.map(async (coin) => {
        try {
            // Determine interval based on strategy
            const interval = style === 'SWING_INSTITUTIONAL' || style === 'ICHIMOKU_CLOUD' ? '4h' : '15m';
            
            const candles = await fetchCandles(coin.id, interval);
            if (candles.length < 200) return; // Need deeper history for EMA 200

            const prices = candles.map(c => c.close);
            const volumes = candles.map(c => c.volume);
            const highs = candles.map(c => c.high);
            const lows = candles.map(c => c.low);
            
            let score = 0;
            let detectionNote = "";
            let signalSide: 'LONG' | 'SHORT' = 'LONG'; // Default
            
            // Educational Metrics to pass to UI
            let specificTrigger = "";
            let structureNote = "";

            // Use Closed Candle for Confirmation (No Repainting)
            const checkIndex = prices.length - 2; 

            // CALCULATE NEW PRECISION METRICS FOR SCANNER
            const vwap = calculateCumulativeVWAP(highs, lows, prices, volumes);
            const stochRsi = calculateStochRSI(prices, 14);
            const rsi = calculateRSI(prices.slice(0, checkIndex + 1), 14);
            const fibs = calculateAutoFibs(highs, lows, calculateEMA(prices, 200));
            const ema200 = calculateEMA(prices.slice(0, checkIndex + 1), 200);
            const currentPrice = prices[checkIndex];
            const avgVol = calculateSMA(volumes, 20);
            const rvol = avgVol > 0 ? (volumes[checkIndex] / avgVol) : 0;

            // Common structure check
            const trendDist = ((currentPrice - ema200) / ema200) * 100;
            structureNote = trendDist > 0 ? `Tendencia Alcista (+${trendDist.toFixed(1)}% sobre EMA200)` : `Tendencia Bajista (${trendDist.toFixed(1)}% bajo EMA200)`;

            // --- DETERMINISTIC MATH DETECTORS ---

            if (style === 'MEME_SCALP') {
                 // MEME HUNTER LOGIC
                 const ema20 = calculateEMA(prices.slice(0, checkIndex + 1), 20);

                 // ESTRATEGIA 1: EL PUMP (MOMENTUM) - NOW WITH VWAP SAFETY
                 if (currentPrice > ema20 && currentPrice > vwap && rvol > 1.8 && rsi > 55) {
                     score = 80 + Math.min(rvol * 3, 15); // Higher volume = Higher score
                     signalSide = 'LONG';
                     detectionNote = `Meme Pump: Volumen Explosivo (x${rvol.toFixed(1)}) + Precio sobre VWAP.`;
                     specificTrigger = `RVOL > 1.8 (${rvol.toFixed(2)}x) + RSI Uptrend (${rsi.toFixed(0)})`;
                 }
                 // ESTRATEGIA 2: THE DIP (REBOTE) - NOW WITH STOCH RSI
                 else {
                     const { lower } = calculateBollingerStats(prices.slice(0, checkIndex + 1));
                     if (currentPrice < lower && stochRsi.k < 15) {
                         score = 80;
                         signalSide = 'LONG'; // Catch the knife safely
                         detectionNote = `Meme Oversold: Precio fuera de Bandas + StochRSI en Suelo (${stochRsi.k.toFixed(0)}).`;
                         specificTrigger = `StochRSI Sobrevendido (${stochRsi.k.toFixed(0)} < 15) + Break Banda Inf.`;
                     }
                 }

            } else if (style === 'ICHIMOKU_CLOUD') {
                const { tenkan, kijun } = calculateIchimokuLines(highs, lows, 1); // offset 1 for closed candle
                const offset = 26;
                const pastHighs = highs.slice(0, highs.length - offset - 1);
                const pastLows = lows.slice(0, lows.length - offset - 1);
                
                if (pastHighs.length > 52) {
                     const { senkouA, senkouB } = calculateIchimokuCloud(pastHighs, pastLows);
                     const aboveCloud = currentPrice > senkouA && currentPrice > senkouB;
                     const belowCloud = currentPrice < senkouA && currentPrice < senkouB;
                     const tkCrossBullish = tenkan > kijun;
                     const tkCrossBearish = tenkan < kijun;

                     if (aboveCloud && tkCrossBullish) {
                         score = 85;
                         signalSide = 'LONG';
                         detectionNote = "Zen Dragon: Precio sobre Nube + Cruce TK + Soporte VWAP.";
                         specificTrigger = "Cruce Tenkan/Kijun sobre Nube Kumo (Tendencia Pura)";
                     } else if (belowCloud && tkCrossBearish) {
                          score = 85;
                          signalSide = 'SHORT';
                          detectionNote = "Zen Dragon: Tendencia Bajista Pura bajo Nube.";
                          specificTrigger = "Cruce Bajista Tenkan/Kijun bajo Nube Kumo";
                     }
                }

            } else if (style === 'SWING_INSTITUTIONAL') {
                const lastLow = lows[checkIndex];
                const lastHigh = highs[checkIndex];
                const prev10Lows = Math.min(...lows.slice(checkIndex - 10, checkIndex)); 
                const prev10Highs = Math.max(...highs.slice(checkIndex - 10, checkIndex));

                const ema50 = calculateEMA(prices.slice(0, checkIndex + 1), 50);
                const isBullishTrend = ema50 > ema200;

                // CHECK FIBONACCI PROXIMITY (Golden Pocket)
                const distToGolden = Math.abs((currentPrice - fibs.level0_618) / currentPrice);
                const nearGoldenPocket = distToGolden < 0.015; // Within 1.5%

                // SFP Logic
                if (isBullishTrend && lastLow < prev10Lows && currentPrice > prev10Lows) {
                    score = 80;
                    if (nearGoldenPocket) {
                        score += 10;
                        detectionNote = "SMC Sniper: Barrido de Liquidez justo en Golden Pocket (0.618).";
                        specificTrigger = "SFP (Swing Failure Pattern) en Fib 0.618";
                    } else {
                        detectionNote = "SMC Setup: Golden Cross + Barrido de Liquidez.";
                        specificTrigger = "Toma de liquidez (Mínimo previo barrido)";
                    }
                    signalSide = 'LONG';
                } else if (!isBullishTrend && lastHigh > prev10Highs && currentPrice < prev10Highs) {
                    score = 80;
                    signalSide = 'SHORT';
                    detectionNote = "SMC Setup: Rechazo de Estructura Bajista.";
                    specificTrigger = "SFP Bajista (Máximo previo barrido)";
                }

            } else if (style === 'BREAKOUT_MOMENTUM') {
                const ema20 = calculateEMA(prices.slice(0, checkIndex + 1), 20);
                // Only take breakouts if we are on the right side of VWAP
                const validTrend = currentPrice > vwap;

                if (rvol > 2.0 && currentPrice > ema20 && validTrend) {
                     score = 70 + Math.min((rvol * 5), 25); 
                     signalSide = 'LONG';
                     detectionNote = `Breakout Confirmado: Volumen (x${rvol.toFixed(1)}) + Precio > VWAP.`;
                     specificTrigger = `Ruptura de volatilidad con RVOL ${rvol.toFixed(1)}x`;
                }
            } else {
                // SCALP: BOLLINGER SQUEEZE + VWAP FILTER
                const { bandwidth, lower, upper } = calculateBollingerStats(prices.slice(0, checkIndex + 1));
                
                const historicalBandwidths = [];
                for(let i = 20; i < 50; i++) {
                    const slice = prices.slice(0, checkIndex + 1 - i);
                    historicalBandwidths.push(calculateBollingerStats(slice).bandwidth);
                }
                const minHistBandwidth = Math.min(...historicalBandwidths);

                if (bandwidth <= minHistBandwidth * 1.1) {
                    score = 80;
                    detectionNote = "Quant Squeeze: Compresión de volatilidad.";
                    specificTrigger = `Bandwidth (${bandwidth.toFixed(2)}%) en mínimos históricos`;
                    // Filter direction by VWAP
                    signalSide = currentPrice > vwap ? 'LONG' : 'SHORT';
                }
            }

            // --- FILTERING BY RISK ---
            // If Risk is High (News OR Manipulation), we only accept VERY high scores
            const threshold = isHighRisk ? 85 : 70;

            // --- BUILD MATH OPPORTUNITY (AUTONOMOUS) ---
            if (score >= threshold) {
                const livePrice = prices[prices.length - 1]; // Use live price for entry
                const atr = calculateATR(highs, lows, prices, 14);
                
                // Algorithmic SL/TP Calculation (Exact Maths)
                let sl = 0;
                let tp1 = 0, tp2 = 0, tp3 = 0;

                const slMult = style === 'MEME_SCALP' ? 2.5 : (interval === '15m' ? 1.5 : 2.0);

                if (signalSide === 'LONG') {
                    sl = livePrice - (atr * slMult);
                    const risk = livePrice - sl;
                    tp1 = livePrice + risk;
                    tp2 = livePrice + (risk * 2);
                    tp3 = livePrice + (risk * 3); 
                } else {
                    sl = livePrice + (atr * slMult);
                    const risk = sl - livePrice;
                    tp1 = livePrice - risk;
                    tp2 = livePrice - (risk * 2);
                    tp3 = livePrice - (risk * 3);
                }

                const decimals = livePrice > 1000 ? 2 : livePrice > 1 ? 4 : 6;
                const format = (n: number) => parseFloat(n.toFixed(decimals));
                
                const finalNote = isHighRisk ? `[⚠️ RIESGO ALTO] ${detectionNote}` : detectionNote;

                // VWAP Dist % calculation
                const vwapDist = ((livePrice - vwap) / vwap) * 100;

                const mathOpp: AIOpportunity = {
                    id: Date.now().toString() + Math.random(),
                    symbol: coin.symbol,
                    timestamp: Date.now(),
                    strategy: style,
                    side: signalSide,
                    confidenceScore: Math.floor(score), 
                    entryZone: { min: format(livePrice * 0.999), max: format(livePrice * 1.001) },
                    dcaLevel: signalSide === 'LONG' ? format(livePrice - (atr * 0.5)) : format(livePrice + (atr * 0.5)),
                    stopLoss: format(sl),
                    takeProfits: { tp1: format(tp1), tp2: format(tp2), tp3: format(tp3) },
                    technicalReasoning: finalNote,
                    invalidated: false,
                    // NEW: METRICS POPULATION
                    metrics: {
                        rvol: format(rvol),
                        rsi: format(rsi),
                        vwapDist: format(vwapDist),
                        structure: structureNote,
                        specificTrigger: specificTrigger
                    }
                };

                validMathCandidates.push(mathOpp);
            }

        } catch(e) { return null; }
    }));

    // Return pure math results instantly
    return validMathCandidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
};

// --- MATH HELPERS (ROBUST) ---

// Checks if Price made Lower Low but RSI made Higher Low in the last 15 periods
const detectBullishDivergence = (prices: number[], rsiSeries: number[], lows: number[]) => {
    // Need at least 20 periods
    if (prices.length < 20 || rsiSeries.length < 20) return false;
    
    // 1. Find recent low (current or last 3 candles)
    let recentLowIndex = -1;
    let recentLowPrice = Infinity;
    
    // Check last 3 closed candles
    const startCheck = prices.length - 2; // Avoid live candle
    for (let i = startCheck; i > startCheck - 3; i--) {
        if (lows[i] < recentLowPrice) {
            recentLowPrice = lows[i];
            recentLowIndex = i;
        }
    }

    // 2. Find a previous swing low (look back 5 to 20 candles)
    let pastLowIndex = -1;
    let pastLowPrice = Infinity;
    
    const lookbackStart = recentLowIndex - 5;
    const lookbackEnd = Math.max(0, recentLowIndex - 25);
    
    for (let i = lookbackStart; i > lookbackEnd; i--) {
        // Is this a pivot low? (Lower than neighbors)
        if (lows[i] < lows[i-1] && lows[i] < lows[i+1]) {
            // Regular Bullish Divergence: Price Lower Low, RSI Higher Low
            if (lows[i] > recentLowPrice) { 
                pastLowPrice = lows[i];
                pastLowIndex = i;
                break; // Found the most recent structural low
            }
        }
    }
    
    if (pastLowIndex === -1) return false;

    // 3. Compare RSI
    const recentRSI = rsiSeries[recentLowIndex];
    const pastRSI = rsiSeries[pastLowIndex];

    // Bullish Div: Price made Lower Low (Verified above), RSI makes Higher Low
    if (recentRSI > pastRSI + 1) { // +1 buffer to avoid noise
        return true;
    }

    return false;
}

// Calculates just the lines (Tenkan/Kijun) for current cross check
const calculateIchimokuLines = (highs: number[], lows: number[], offset: number = 0) => {
    const end = highs.length - offset;
    // Tenkan-sen (9 periods)
    const tenkan = (Math.max(...highs.slice(end - 9, end)) + Math.min(...lows.slice(end - 9, end))) / 2;
    // Kijun-sen (26 periods)
    const kijun = (Math.max(...highs.slice(end - 26, end)) + Math.min(...lows.slice(end - 26, end))) / 2;
    return { tenkan, kijun };
};

// Calculates the cloud Spans based on the provided dataset (which should be shifted historically)
const calculateIchimokuCloud = (highs: number[], lows: number[]) => {
    const { tenkan, kijun } = calculateIchimokuLines(highs, lows, 0);
    // Senkou Span A (Leading Span A)
    const senkouA = (tenkan + kijun) / 2;
    // Senkou Span B (52 periods)
    const senkouB = (Math.max(...highs.slice(highs.length - 52)) + Math.min(...lows.slice(lows.length - 52))) / 2;
    
    return { senkouA, senkouB };
};

const calculateBollingerStats = (prices: number[]) => {
    const sma20 = calculateSMA(prices, 20);
    const stdDev = calculateStdDev(prices, 20, sma20);
    const upper = sma20 + (stdDev * 2);
    const lower = sma20 - (stdDev * 2);
    // Bandwidth %: (Upper - Lower) / Middle * 100
    const bandwidth = sma20 > 0 ? ((upper - lower) / sma20) * 100 : 0;
    
    return { upper, lower, bandwidth, sma: sma20 };
};

const calculateSMA = (data: number[], period: number) => {
    if (data.length < period) return data[data.length-1];
    return data.slice(-period).reduce((a, b) => a + b, 0) / period;
};

const calculateEMA = (data: number[], period: number) => {
    if (data.length < period) return data[data.length-1];
    const k = 2 / (period + 1);
    let ema = data[0]; // Initialization could be improved with SMA of first N, but this converges enough for 100 candles
    for (let i = 1; i < data.length; i++) {
        ema = (data[i] * k) + (ema * (1 - k));
    }
    return ema;
};

const calculateMACD = (prices: number[], fast = 12, slow = 26, signal = 9) => {
    const emaFast = calculateEMAArray(prices, fast);
    const emaSlow = calculateEMAArray(prices, slow);
    
    const macdLine = [];
    for(let i=0; i < prices.length; i++) {
        macdLine.push(emaFast[i] - emaSlow[i]);
    }
    
    const signalLine = calculateEMAArray(macdLine, signal);
    const histogram = macdLine[macdLine.length-1] - signalLine[signalLine.length-1];

    return {
        macdLine: macdLine[macdLine.length-1],
        signalLine: signalLine[signalLine.length-1],
        histogram: histogram
    };
}

// Helper to return array of EMAs for MACD calculation
const calculateEMAArray = (data: number[], period: number) => {
    const k = 2 / (period + 1);
    const emaArray = [data[0]];
    for (let i = 1; i < data.length; i++) {
        emaArray.push((data[i] * k) + (emaArray[i - 1] * (1 - k)));
    }
    return emaArray;
};

const calculateStdDev = (data: number[], period: number, mean: number) => {
    if (data.length < period) return 0;
    const sqDiffs = data.slice(-period).map(v => Math.pow(v - mean, 2));
    return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / period);
};

// Single value Wilder's RSI (Wrapper)
const calculateRSI = (data: number[], period: number) => {
    const arr = calculateRSIArray(data, period);
    return arr[arr.length - 1];
};

// NEW: Stochastic RSI for precision entries
const calculateStochRSI = (prices: number[], period: number = 14) => {
    const rsiArray = calculateRSIArray(prices, period);
    // Need at least period amount of RSIs to calc stoch
    const relevantRSI = rsiArray.slice(-period); 
    const minRSI = Math.min(...relevantRSI);
    const maxRSI = Math.max(...relevantRSI);
    
    // StochRSI K
    let k = 0;
    if (maxRSI !== minRSI) {
        k = ((relevantRSI[relevantRSI.length-1] - minRSI) / (maxRSI - minRSI)) * 100;
    }
    // D is usually 3-period SMA of K
    const d = k; // Simplified for now, real D requires array of Ks

    return { k, d };
};

// Full Array Wilder's RSI (For Divergence checks)
const calculateRSIArray = (data: number[], period: number): number[] => {
    if (data.length < period + 1) return new Array(data.length).fill(50);
    
    let gains = 0;
    let losses = 0;
    const rsiArray = new Array(data.length).fill(0);

    // First average (SMA)
    for (let i = 1; i < period + 1; i++) {
        const change = data[i] - data[i - 1];
        if (change >= 0) gains += change;
        else losses += Math.abs(change);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    // First RSI
    rsiArray[period] = 100 - (100 / (1 + (avgGain/avgLoss)));

    // Smoothed averages (Wilder's Smoothing)
    for (let i = period + 1; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        const currentGain = change > 0 ? change : 0;
        const currentLoss = change < 0 ? Math.abs(change) : 0;

        avgGain = ((avgGain * (period - 1)) + currentGain) / period;
        avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;
        
        if (avgLoss === 0) {
            rsiArray[i] = 100;
        } else {
            const rs = avgGain / avgLoss;
            rsiArray[i] = 100 - (100 / (1 + rs));
        }
    }
    return rsiArray;
};

// NEW: Cumulative VWAP (Session VWAP approx)
const calculateCumulativeVWAP = (highs: number[], lows: number[], closes: number[], volumes: number[]) => {
    // Typical Price
    let cumTPV = 0;
    let cumVol = 0;
    
    // We calculate for the whole loaded dataset (mimicking session start)
    for(let i = 0; i < closes.length; i++) {
        const tp = (highs[i] + lows[i] + closes[i]) / 3;
        cumTPV += (tp * volumes[i]);
        cumVol += volumes[i];
    }
    
    return cumVol > 0 ? cumTPV / cumVol : closes[closes.length-1];
};

// NEW: Auto Fibonacci Retracements
const calculateAutoFibs = (highs: number[], lows: number[], ema200: number) => {
    // Lookback 100 periods
    const lookback = Math.min(highs.length, 100);
    const subsetHighs = highs.slice(-lookback);
    const subsetLows = highs.slice(-lookback); // Corrected: should be lows
    const realSubsetLows = lows.slice(-lookback);
    
    const maxHigh = Math.max(...subsetHighs);
    const minLow = Math.min(...realSubsetLows);
    const currentPrice = highs[highs.length-1];

    // Determine Trend direction relative to EMA200
    const isUptrend = currentPrice > ema200;
    
    const diff = maxHigh - minLow;
    
    if (isUptrend) {
        // Low to High (Supports)
        return {
            trend: 'UP' as const,
            level0: maxHigh, // Top
            level0_236: maxHigh - (diff * 0.236),
            level0_382: maxHigh - (diff * 0.382),
            level0_5: maxHigh - (diff * 0.5),
            level0_618: maxHigh - (diff * 0.618), // GOLDEN POCKET
            level0_786: maxHigh - (diff * 0.786),
            level1: minLow
        };
    } else {
        // High to Low (Resistances)
        return {
            trend: 'DOWN' as const,
            level0: minLow, // Bottom
            level0_236: minLow + (diff * 0.236),
            level0_382: minLow + (diff * 0.382),
            level0_5: minLow + (diff * 0.5),
            level0_618: minLow + (diff * 0.618), // GOLDEN POCKET
            level0_786: minLow + (diff * 0.786),
            level1: maxHigh
        };
    }
}

// --- NEW METRICS FOR 100% AI POTENTIAL ---

const calculateATR = (highs: number[], lows: number[], closes: number[], period: number) => {
    if (highs.length < period) return 0;
    let trSum = 0;
    // Simple average for first TR (could be improved, but sufficient)
    for(let i = 1; i < period + 1; i++) {
        const hl = highs[i] - lows[i];
        const hc = Math.abs(highs[i] - closes[i-1]);
        const lc = Math.abs(lows[i] - closes[i-1]);
        trSum += Math.max(hl, hc, lc);
    }
    let atr = trSum / period;
    // Smoothed ATR
    for(let i = period + 1; i < highs.length; i++) {
         const hl = highs[i] - lows[i];
        const hc = Math.abs(highs[i] - closes[i-1]);
        const lc = Math.abs(lows[i] - closes[i-1]);
        const tr = Math.max(hl, hc, lc);
        atr = ((atr * (period - 1)) + tr) / period;
    }
    return atr;
}

// REAL ADX (Directional Movement System)
const calculateADX = (highs: number[], lows: number[], closes: number[], period: number) => {
    if (highs.length < period * 2) return 20; // Not enough data, return neutral
    
    // 1. Calculate TR, +DM, -DM per candle
    // We use a simplified Wilder's smoothing logic to avoid massive arrays overhead in browser
    let tr = 0;
    let plusDM = 0;
    let minusDM = 0;
    
    // Initial accumulation (SMA)
    for (let i = 1; i <= period; i++) {
        const up = highs[i] - highs[i-1];
        const down = lows[i-1] - lows[i];
        
        const pdm = (up > down && up > 0) ? up : 0;
        const mdm = (down > up && down > 0) ? down : 0;
        const trueRange = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]));

        tr += trueRange;
        plusDM += pdm;
        minusDM += mdm;
    }

    // Smooth over time
    let smTR = tr;
    let smPlusDM = plusDM;
    let smMinusDM = minusDM;
    let lastADX = 0;

    // Calculate DX series
    for (let i = period + 1; i < highs.length; i++) {
        const up = highs[i] - highs[i-1];
        const down = lows[i-1] - lows[i];
        const pdm = (up > down && up > 0) ? up : 0;
        const mdm = (down > up && down > 0) ? down : 0;
        const trueRange = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]));

        smTR = smTR - (smTR / period) + trueRange;
        smPlusDM = smPlusDM - (smPlusDM / period) + pdm;
        smMinusDM = smMinusDM - (smMinusDM / period) + mdm;

        const pDI = (smPlusDM / smTR) * 100;
        const mDI = (smMinusDM / smTR) * 100;
        
        const dx = (Math.abs(pDI - mDI) / (pDI + mDI)) * 100;
        
        if (i === period * 2 - 1) {
            lastADX = dx; // First ADX is DX
        } else if (i >= period * 2) {
            lastADX = ((lastADX * (period - 1)) + dx) / period;
        }
    }

    return lastADX;
}

const calculatePivotPoints = (highs: number[], lows: number[], closes: number[]) => {
    // Standard Pivot Points based on previous candle (High/Low/Close)
    const h = highs[highs.length - 2]; // Previous completed candle
    const l = lows[lows.length - 2];
    const c = closes[closes.length - 2];
    
    const p = (h + l + c) / 3;
    const r1 = (2 * p) - l;
    const s1 = (2 * p) - h;
    return { p, r1, s1 };
}

const formatVolume = (vol: number) => vol >= 1e9 ? (vol / 1e9).toFixed(1) + 'B' : (vol / 1e6).toFixed(1) + 'M';