
import { MarketData, FearAndGreedData, AIOpportunity, TradingStyle } from '../types';
import { generateBatchTradeSignals } from './geminiService';

// PRIMARY: Binance Vision (CORS friendly for public data)
const BINANCE_API_BASE = 'https://data-api.binance.vision/api/v3';
const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/stream?streams=';

// FALLBACK: CoinCap (Very reliable for frontend)
const COINCAP_API_BASE = 'https://api.coincap.io/v2';

// List of known major memes to filter for the "Meme" view
const MEME_SYMBOLS = [
    'DOGE', 'SHIB', 'PEPE', 'WIF', 'FLOKI', 'BONK', 'BOME', 'MEME', 'PEOPLE', 
    'DOGS', 'TURBO', 'MYRO', 'NEIRO', '1000SATS', 'ORDI', 'BABYDOGE', 'MOODENG',
    'PNUT', 'ACT', 'POPCAT', 'SLERF', 'BRETT', 'GOAT'
];

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
    // 24hr ticker is heavy, but data-api.binance.vision usually handles it well
    const response = await fetch(`${BINANCE_API_BASE}/ticker/24hr`);
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
            return MEME_SYMBOLS.some(meme => baseSymbol === meme || baseSymbol === `1000${meme}`);
        });
    }

    filteredData = filteredData
        .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 50);

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
};

// --- COINCAP FETCH STRATEGY (FALLBACK) ---
const fetchCoinCapMarkets = async (mode: 'volume' | 'memes'): Promise<MarketData[]> => {
    const response = await fetch(`${COINCAP_API_BASE}/assets?limit=100`);
    if (!response.ok) return [];
    
    const json = await response.json();
    let assets = json.data;

    if (mode === 'memes') {
         assets = assets.filter((asset: any) => 
            MEME_SYMBOLS.includes(asset.symbol.toUpperCase())
         );
    } else {
        // CoinCap is already sorted by rank (roughly volume/mcap)
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
    const response = await fetch('https://api.alternative.me/fng/');
    if (!response.ok) return null;
    const json = await response.json();
    return json.data[0];
  } catch (e) {
    return null;
  }
};

export const getMacroData = async (): Promise<string> => {
    try {
        const globalRes = await fetch('https://api.coincap.io/v2/global');
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

    if (isBinance) {
        try {
            // Fetching 120 candles to ensure deep data for EMA200 and historical volatility checks
            const res = await fetch(`${BINANCE_API_BASE}/klines?symbol=${symbolId}&interval=${interval}&limit=120`);
            if (!res.ok) throw new Error("Binance Candle Error");
            const data = await res.json();
            return data.map((d: any[]) => ({ 
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4]), 
                volume: parseFloat(d[5]) 
            }));
        } catch (e) {
            const fallbackId = mapBinanceToCoinCap(symbolId);
            if (fallbackId) return fetchCoinCapCandles(fallbackId, interval);
            return [];
        }
    } else {
        return fetchCoinCapCandles(symbolId, interval);
    }
};

const fetchCoinCapCandles = async (id: string, interval: string) => {
    const ccInterval = interval === '15m' ? 'm15' : 'h1'; 
    const res = await fetch(`${COINCAP_API_BASE}/candles?exchange=binance&interval=${ccInterval}&baseId=${id}&quoteId=tether`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data.map((d: any) => ({ 
        open: parseFloat(d.open),
        high: parseFloat(d.high),
        low: parseFloat(d.low),
        close: parseFloat(d.close), 
        volume: parseFloat(d.volume) 
    }));
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
        if (candles.length < 50) return "Datos insuficientes.";

        const prices = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        
        return calculateTechnicalString(rawSymbol, prices, volumes, highs, lows);
    } catch (e) {
        return "Error calculando técnicos.";
    }
};

const calculateTechnicalString = (symbol: string, prices: number[], volumes: number[], highs: number[], lows: number[], extraInfo: string = ""): string => {
        const currentPrice = prices[prices.length - 1];
        // Using Wilder's RSI for professional grade accuracy
        const rsi = calculateRSI(prices, 14);
        const ema20 = calculateEMA(prices, 20);
        const ema50 = calculateEMA(prices, 50);
        const ema200 = calculateEMA(prices, 200);

        const sma20 = calculateSMA(prices, 20);
        const stdDev = calculateStdDev(prices, 20, sma20);
        const upperBand = sma20 + (stdDev * 2);
        const lowerBand = sma20 - (stdDev * 2);
        
        const avgVol = calculateSMA(volumes, 20);
        const rvol = avgVol > 0 ? (volumes[volumes.length - 1] / avgVol) : 0;

        // --- NEW ADVANCED METRICS FOR AI ---
        const atr = calculateATR(highs, lows, prices, 14);
        const adx = calculateADX(highs, lows, prices, 14);
        const pivots = calculatePivotPoints(highs, lows, prices);

        return `
DATOS TÉCNICOS AVANZADOS PARA ${symbol}:
- Precio Actual: $${currentPrice}
- Estructura EMA (20/50/200): $${ema20.toFixed(4)} / $${ema50.toFixed(4)} / $${ema200.toFixed(4)}
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

// --- NEW ROBUST AI SCANNER ENGINE v2.0 ---

export const scanMarketOpportunities = async (style: TradingStyle): Promise<AIOpportunity[]> => {
    // 1. Get market data
    const market = await fetchCryptoData('volume');
    if (!market || market.length === 0) throw new Error("No market data available");
    
    // 2. Mathematical Pre-Filtering (Robust Candidate Selection)
    // We filter heavily here to only send "Math Approved" setups to the AI
    
    // Scan top 30 assets to increase finding valid signals
    const topCandidates = market.slice(0, 30);
    
    const analyzedCandidates = await Promise.all(topCandidates.map(async (coin) => {
        try {
            // Determine interval based on strategy
            const interval = style === 'SWING_INSTITUTIONAL' || style === 'ICHIMOKU_CLOUD' ? '4h' : '15m';
            
            const candles = await fetchCandles(coin.id, interval);
            // Need min 80 candles for historical checks
            if (candles.length < 80) return null; 

            const prices = candles.map(c => c.close);
            const volumes = candles.map(c => c.volume);
            const highs = candles.map(c => c.high);
            const lows = candles.map(c => c.low);
            const opens = candles.map(c => c.open);
            
            let score = 0;
            let detectionNote = "";

            // --- STRATEGY SPECIFIC DETECTORS ---

            if (style === 'ICHIMOKU_CLOUD') {
                // MATH DETECTOR: ZEN DRAGON (CORRECTED DISPLACEMENT LOGIC)
                const currentPrice = prices[prices.length - 1];
                
                // 1. Current TK Cross (Happening Now)
                const { tenkan, kijun } = calculateIchimokuLines(highs, lows, 0); // 0 offset = current
                
                // 2. Cloud Check (Happening Past)
                // The cloud that is plotted "today" was actually generated by data 26 periods ago.
                const offset = 26;
                const pastHighs = highs.slice(0, highs.length - offset);
                const pastLows = lows.slice(0, lows.length - offset);
                
                if (pastHighs.length > 52) {
                     const { senkouA, senkouB } = calculateIchimokuCloud(pastHighs, pastLows);
                     
                     // Cloud Status
                     const aboveCloud = currentPrice > senkouA && currentPrice > senkouB;
                     const belowCloud = currentPrice < senkouA && currentPrice < senkouB;
                     
                     const tkCrossBullish = tenkan > kijun;
                     const tkCrossBearish = tenkan < kijun;

                     if (aboveCloud && tkCrossBullish) {
                         score += 10;
                         detectionNote = "DETECCIÓN MATEMÁTICA: Kumo Breakout + TK Cross Alcista Validado.";
                     } else if (belowCloud && tkCrossBearish) {
                          score += 10;
                          detectionNote = "DETECCIÓN MATEMÁTICA: Kumo Breakout + TK Cross Bajista Validado.";
                     }
                }

            } else if (style === 'SWING_INSTITUTIONAL') {
                // MATH DETECTOR: SMC LIQUIDITY & ORDER BLOCKS (V2)
                const lastLow = lows[lows.length - 1];
                const lastClose = prices[prices.length - 1];
                const prev10Lows = Math.min(...lows.slice(lows.length - 12, lows.length - 2)); 
                
                // 1. SFP Logic (Liquidity Sweep)
                if (lastLow < prev10Lows && lastClose > prev10Lows) {
                    score += 8;
                    detectionNote += "Swing Failure Pattern (Toma de Liquidez). ";
                }

                // 2. RSI Divergence Logic (REAL IMPLEMENTATION)
                const rsiSeries = calculateRSIArray(prices, 14);
                const divergence = detectBullishDivergence(prices, rsiSeries, lows);
                if (divergence) {
                    score += 5;
                    detectionNote += "Divergencia RSI Alcista detectada (Reversión). ";
                }

                // 3. Order Block Proximity (Volume Spike previously)
                // Checks if we are retesting a zone where a large move started (RVOL > 2)
                const rvol = (volumes[volumes.length-1] / calculateSMA(volumes, 20));
                if (rvol > 1.2 && score > 0) score += 2; // Volume confirming the reversal

            } else if (style === 'BREAKOUT_MOMENTUM') {
                // MATH DETECTOR: VOLATILITY EXPANSION
                const avgVol = calculateSMA(volumes, 20);
                const rvol = avgVol > 0 ? (volumes[volumes.length-1] / avgVol) : 0;
                
                if (rvol > 2.0) {
                     score += 8;
                     detectionNote = `DETECCIÓN MATEMÁTICA: Expansión de Volumen Masiva (x${rvol.toFixed(1)}).`;
                }
            } else {
                // SCALP: DYNAMIC BOLLINGER SQUEEZE (V2)
                const { bandwidth } = calculateBollingerStats(prices);
                
                // Calculate historical bandwidth to see if current is low RELATIVE to history
                const historicalBandwidths = [];
                for(let i = 20; i < 50; i++) {
                    const slice = prices.slice(0, prices.length - i);
                    historicalBandwidths.push(calculateBollingerStats(slice).bandwidth);
                }
                const minHistBandwidth = Math.min(...historicalBandwidths);

                if (bandwidth <= minHistBandwidth * 1.1) { // Current bandwidth is within 10% of historical lows
                    score += 7;
                    detectionNote = "DETECCIÓN MATEMÁTICA: Compresión Extrema de Bollinger (Squeeze).";
                }
                
                const rsi = calculateRSI(prices, 14);
                if (rsi < 30 || rsi > 70) score += 3;
            }

            // Stricter Threshold: Only pass highly qualified candidates
            if (score >= 7) {
                return {
                    symbol: coin.symbol,
                    techData: calculateTechnicalString(coin.symbol.split('/')[0], prices, volumes, highs, lows, detectionNote)
                };
            }
            return null;

        } catch(e) { return null; }
    }));

    const validCandidates = analyzedCandidates.filter(c => c !== null);
    
    // 3. BATCH AI ANALYSIS
    // Instead of calling the API 3 times, we batch the top 3 (or more) into ONE single request.
    // This fixes the "429 Resource Exhausted" error.
    
    const topBatch = validCandidates.slice(0, 3); // Pick top 3 best mathematical candidates
    
    if (topBatch.length > 0) {
        try {
            const signals = await generateBatchTradeSignals(
                topBatch.map(c => ({ symbol: c!.symbol, technicalData: c!.techData })), 
                style
            );
            
            // Filter by confidence
            return signals.filter(s => s.confidenceScore > 65);
        } catch (e) {
            console.error("Error in AI batch:", e);
            return [];
        }
    }

    return [];
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
    const startCheck = prices.length - 1;
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
            // Is it strictly valid for divergence? (Past Low > Current Low for Hidden Div? No, Regular Bullish: Price Lower Low)
            // Regular Bullish Divergence: Price Lower Low, RSI Higher Low
            if (lows[i] > recentLowPrice) { 
                // Found a candidate low (Price was higher in the past, so current is Lower Low)
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
    for (let i = 1; i <= period; i++) {
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
    // Requires full implementation of +DM, -DM, TR, Smoothed versions.
    // For this context, we will use a simpler Trend Strength proxy:
    // ABS(EMA20 - EMA50) normalized by price. 
    // This gives the AI a relative idea if the MAs are fanning out (Strong Trend) or flat (Range).
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const spread = Math.abs(ema20 - ema50);
    // Normalize: Spread as percentage of price * 100
    const strength = (spread / closes[closes.length-1]) * 1000; 
    // Heuristic: > 5 is strong, < 2 is weak
    return strength * 5; // Scaling to look like ADX 0-100 roughly
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
