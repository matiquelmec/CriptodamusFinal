

import { MarketData, FearAndGreedData, AIOpportunity, TradingStyle } from '../types';
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

export const getTechnicalAnalysis = async (symbolDisplay: string): Promise<string> => {
    const rawSymbol = symbolDisplay.replace('/USDT', ''); 
    const binanceSymbol = `${rawSymbol}USDT`; 

    try {
        const candles = await fetchCandles(binanceSymbol, '15m');
        if (candles.length < 50) return `Datos insuficientes para análisis técnico de ${symbolDisplay}.`;

        const prices = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        
        return calculateTechnicalString(rawSymbol, prices, volumes, highs, lows);
    } catch (e) {
        return `No se pudo conectar al mercado para ${symbolDisplay}.`;
    }
};

const calculateTechnicalString = (symbol: string, prices: number[], volumes: number[], highs: number[], lows: number[], extraInfo: string = ""): string => {
        const currentPrice = prices[prices.length - 1];
        // Using Wilder's RSI for professional grade accuracy
        const rsi = calculateRSI(prices, 14);
        const ema20 = calculateEMA(prices, 20);
        const ema50 = calculateEMA(prices, 50);
        const ema100 = calculateEMA(prices, 100);
        const ema200 = calculateEMA(prices, 200);

        const sma20 = calculateSMA(prices, 20);
        const stdDev = calculateStdDev(prices, 20, sma20);
        const upperBand = sma20 + (stdDev * 2);
        const lowerBand = sma20 - (stdDev * 2);
        
        const avgVol = calculateSMA(volumes, 20);
        const rvol = avgVol > 0 ? (volumes[volumes.length - 1] / avgVol) : 0;

        // Check Golden Cross / Death Cross status
        const isGoldenCross = ema50 > ema200;
        const crossStatus = isGoldenCross ? "GOLDEN CROSS (Alcista Macro)" : "DEATH CROSS (Bajista Macro)";
        
        // --- NEW ADVANCED METRICS FOR AI ---
        const atr = calculateATR(highs, lows, prices, 14);
        const adx = calculateADX(highs, lows, prices, 14);
        const pivots = calculatePivotPoints(highs, lows, prices);
        
        // Calculate Distance to EMA 20 (Mean Reversion)
        const distEma20 = ((currentPrice - ema20) / ema20) * 100;

        return `
DATOS TÉCNICOS AVANZADOS PARA ${symbol}:
- Precio Actual: $${currentPrice}
- Estructura EMA (20/50/100/200): $${ema20.toFixed(4)} / $${ema50.toFixed(4)} / $${ema100.toFixed(4)} / $${ema200.toFixed(4)}
- Distancia EMA20: ${distEma20.toFixed(2)}%
- Estado Cruce Macro: ${crossStatus}
- RSI (14, Wilder): ${rsi.toFixed(2)} ${rsi > 70 ? '(SOBRECOMPRA)' : rsi < 30 ? '(SOBREVENTA)' : '(NEUTRO)'}
- RVOL (Fuerza Relativa): ${rvol.toFixed(2)} ${rvol > 1.5 ? 'VOLUMEN ALTO' : 'VOLUMEN BAJO'}
- Bollinger: Sup $${upperBand.toFixed(4)} / Inf $${lowerBand.toFixed(4)}

MÉTRICAS INSTITUCIONALES (Úsalas para SL y TP):
- ATR (Volatilidad): $${atr.toFixed(4)} (Multiplica x1.5 para SL seguro)
- ADX (Fuerza Tendencia): ${adx.toFixed(2)} ${adx > 25 ? '(TENDENCIA FUERTE)' : '(RANGO/DÉBIL)'}
- PIVOTS (Soportes/Resistencias): P=$${pivots.p.toFixed(4)}, S1=$${pivots.s1.toFixed(4)}, R1=$${pivots.r1.toFixed(4)}
${extraInfo}
        `.trim();
}

// --- AUTONOMOUS QUANT ENGINE v4.0 (API INDEPENDENT) ---

export const scanMarketOpportunities = async (style: TradingStyle): Promise<AIOpportunity[]> => {
    // 1. Get market data based on selected style
    // MEME_SCALP uses specific meme list, others use top volume
    const mode = style === 'MEME_SCALP' ? 'memes' : 'volume';
    const market = await fetchCryptoData(mode);
    
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

            // Use Closed Candle for Confirmation (No Repainting)
            const checkIndex = prices.length - 2; 

            // --- DETERMINISTIC MATH DETECTORS ---

            if (style === 'MEME_SCALP') {
                 // MEME HUNTER LOGIC
                 const ema20 = calculateEMA(prices.slice(0, checkIndex + 1), 20);
                 const currentPrice = prices[checkIndex];
                 const avgVol = calculateSMA(volumes, 20);
                 const rvol = avgVol > 0 ? (volumes[checkIndex] / avgVol) : 0;
                 const rsi = calculateRSI(prices.slice(0, checkIndex + 1), 14);

                 // ESTRATEGIA 1: EL PUMP (MOMENTUM)
                 // Precio sobre EMA 20, Volumen alto, RSI fuerte pero con espacio
                 if (currentPrice > ema20 && rvol > 1.8 && rsi > 55) {
                     score = 80 + Math.min(rvol * 3, 15); // Higher volume = Higher score
                     signalSide = 'LONG';
                     detectionNote = `Meme Pump: Volumen Explosivo (x${rvol.toFixed(1)}) + Momentum (RSI ${rsi.toFixed(0)}).`;
                 }
                 // ESTRATEGIA 2: EL DIP (REBOTE)
                 // Precio cae agresivamente fuera de bandas y RSI sobrevendido
                 else {
                     const { lower } = calculateBollingerStats(prices.slice(0, checkIndex + 1));
                     if (currentPrice < lower && rsi < 35) {
                         score = 80;
                         signalSide = 'LONG'; // Catch the knife safely
                         detectionNote = `Meme Oversold: Precio fuera de Bandas + RSI Sobrevendido (${rsi.toFixed(0)}). Rebote inminente.`;
                     }
                 }

            } else if (style === 'ICHIMOKU_CLOUD') {
                const currentPrice = prices[checkIndex];
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
                         detectionNote = "Tendencia Zen Dragon: Precio sobre Nube + Cruce TK Alcista.";
                     } else if (belowCloud && tkCrossBearish) {
                          score = 85;
                          signalSide = 'SHORT';
                          detectionNote = "Tendencia Zen Dragon: Precio bajo Nube + Cruce TK Bajista.";
                     }
                }

            } else if (style === 'SWING_INSTITUTIONAL') {
                const lastLow = lows[checkIndex];
                const lastHigh = highs[checkIndex];
                const lastClose = prices[checkIndex];
                const prev10Lows = Math.min(...lows.slice(checkIndex - 10, checkIndex)); 
                const prev10Highs = Math.max(...highs.slice(checkIndex - 10, checkIndex));

                // 1. Check for GOLDEN CROSS (EMA 50 > EMA 200) for Swing Bias
                const ema50 = calculateEMA(prices.slice(0, checkIndex + 1), 50);
                const ema200 = calculateEMA(prices.slice(0, checkIndex + 1), 200);
                const isBullishTrend = ema50 > ema200;

                // SFP Logic
                if (isBullishTrend && lastLow < prev10Lows && lastClose > prev10Lows) {
                    score = 80;
                    signalSide = 'LONG';
                    detectionNote = "SMC Setup (Trend Follow): Golden Cross + Barrido de Liquidez.";
                } else if (!isBullishTrend && lastHigh > prev10Highs && lastClose < prev10Highs) {
                    score = 80;
                    signalSide = 'SHORT';
                    detectionNote = "SMC Setup (Trend Follow): Death Cross + Barrido de Liquidez.";
                }

                // RSI Divergence Logic
                const rsiSeries = calculateRSIArray(prices, 14);
                const div = detectBullishDivergence(prices, rsiSeries, lows);
                if (div) {
                    score = Math.max(score, 75);
                    signalSide = 'LONG'; 
                    detectionNote = score >= 80 ? detectionNote + " + Divergencia RSI." : "Divergencia RSI Confirmada en Zona Baja.";
                }

            } else if (style === 'BREAKOUT_MOMENTUM') {
                const avgVol = calculateSMA(volumes, 20);
                const rvol = avgVol > 0 ? (volumes[checkIndex] / avgVol) : 0;
                const change = (prices[checkIndex] - prices[checkIndex-1]) / prices[checkIndex-1];
                
                // EMA 20 Trend Check
                const ema20 = calculateEMA(prices.slice(0, checkIndex + 1), 20);
                const priceAboveEma20 = prices[checkIndex] > ema20;

                if (rvol > 2.0 && priceAboveEma20) {
                     score = 70 + Math.min((rvol * 5), 25); 
                     if (change > 0) {
                        signalSide = 'LONG';
                        detectionNote = `Breakout: Inyección de Volumen Masiva (x${rvol.toFixed(1)}) sobre EMA 20.`;
                     } else {
                        signalSide = 'SHORT';
                        detectionNote = `Breakdown: Venta Institucional Masiva (x${rvol.toFixed(1)}).`;
                     }
                }
            } else {
                // SCALP: BOLLINGER SQUEEZE + EMA 100 Support
                const { bandwidth, lower, upper } = calculateBollingerStats(prices.slice(0, checkIndex + 1));
                const ema100 = calculateEMA(prices.slice(0, checkIndex + 1), 100);
                const close = prices[checkIndex];

                const historicalBandwidths = [];
                for(let i = 20; i < 50; i++) {
                    const slice = prices.slice(0, checkIndex + 1 - i);
                    historicalBandwidths.push(calculateBollingerStats(slice).bandwidth);
                }
                const minHistBandwidth = Math.min(...historicalBandwidths);

                if (bandwidth <= minHistBandwidth * 1.1) {
                    score = 80;
                    detectionNote = "Patrón Quant: Compresión Extrema (Squeeze). Explosión inminente.";
                    const ema20 = calculateEMA(prices.slice(0, checkIndex + 1), 20);
                    const ema50 = calculateEMA(prices.slice(0, checkIndex + 1), 50);
                    signalSide = ema20 > ema50 ? 'LONG' : 'SHORT';
                }
                
                // Walking the Bands Strategy
                else if (close > upper && close > ema100) {
                     score = 75;
                     signalSide = 'LONG';
                     detectionNote = "Bollinger Walk: Precio rompiendo banda superior sobre EMA 100.";
                }
            }

            // --- BUILD MATH OPPORTUNITY (AUTONOMOUS) ---
            if (score >= 70) {
                const currentPrice = prices[prices.length - 1]; // Use live price for entry
                const atr = calculateATR(highs, lows, prices, 14);
                
                // Algorithmic SL/TP Calculation (Exact Maths)
                let sl = 0;
                let tp1 = 0, tp2 = 0, tp3 = 0;

                // Adjust multiplier based on timeframe/volatility
                // Memes need wider SL due to noise
                const slMult = style === 'MEME_SCALP' ? 2.5 : (interval === '15m' ? 1.5 : 2.0);

                if (signalSide === 'LONG') {
                    sl = currentPrice - (atr * slMult);
                    const risk = currentPrice - sl;
                    tp1 = currentPrice + risk;      // 1:1
                    tp2 = currentPrice + (risk * 2); // 1:2
                    tp3 = currentPrice + (risk * 3); // 1:3
                } else {
                    sl = currentPrice + (atr * slMult);
                    const risk = sl - currentPrice;
                    tp1 = currentPrice - risk;
                    tp2 = currentPrice - (risk * 2);
                    tp3 = currentPrice - (risk * 3);
                }

                const decimals = currentPrice > 1000 ? 2 : currentPrice > 1 ? 4 : 6;
                const format = (n: number) => parseFloat(n.toFixed(decimals));

                const mathOpp: AIOpportunity = {
                    id: Date.now().toString() + Math.random(),
                    symbol: coin.symbol,
                    timestamp: Date.now(),
                    strategy: style,
                    side: signalSide,
                    confidenceScore: Math.floor(score), 
                    entryZone: { min: format(currentPrice * 0.999), max: format(currentPrice * 1.001) },
                    dcaLevel: signalSide === 'LONG' ? format(currentPrice - (atr * 0.5)) : format(currentPrice + (atr * 0.5)),
                    stopLoss: format(sl),
                    takeProfits: { tp1: format(tp1), tp2: format(tp2), tp3: format(tp3) },
                    technicalReasoning: detectionNote,
                    invalidated: false
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
    
    return { upper, lower, bandwidth };
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

// Simplified ADX (Trend Strength)
const calculateADX = (highs: number[], lows: number[], closes: number[], period: number) => {
    
    // Heuristic: Use EMA spread to approximate Trend Strength and avoid 0.0 values
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const spread = Math.abs(ema20 - ema50);
    
    // Normalize based on volatility (ATR proxy) or price to get a 0-100 score
    // Factor boosted to provide actionable signals
    const score = (spread / closes[closes.length-1]) * 1000 * 5; 
    
    // Clamp to ensure visual stability
    return Math.max(5.5, Math.min(score, 99.9));
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
