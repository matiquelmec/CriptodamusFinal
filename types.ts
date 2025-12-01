
export interface MarketData {
  id: string; // ID for WebSocket subscription (e.g., 'bitcoin')
  symbol: string;
  price: number;
  change24h: number;
  rsi: number;
  volume: string;
  trend: 'bullish' | 'bearish' | 'neutral';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isThinking?: boolean;
}

export interface TradeSetup {
  symbol: string;
  type: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  confidence: 'High' | 'Medium' | 'Low';
  reasoning: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  riskProfile: 'Conservador' | 'Moderado' | 'Agresivo';
  timeframe: string;
  systemInstruction: string;
  details: {
    riskManagement: string;
    entryCriteria: string;
    psychology: string;
  }
}

export interface FearAndGreedData {
  value: string;
  value_classification: string;
  timestamp: string;
}

export interface MacroData {
  btcDominance: number;
  goldPrice: number;
}

export interface MarketRisk {
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  note: string;
  riskType?: 'VOLATILITY' | 'MANIPULATION' | 'NORMAL';
}

// --- ICHIMOKU INTERFACES (Moved from Strategy) ---
export interface IchimokuCloud {
  tenkan: number;      // Conversion Line (9)
  kijun: number;       // Base Line (26)
  senkouA: number;     // Leading Span A (Future)
  senkouB: number;     // Leading Span B (Future)
  chikou: number;      // Lagging Span (Past)
  currentPrice: number;
  // New fields for advanced validation
  chikouSpanFree: boolean; // Is Chikou free of obstacles (price/cloud)?
  chikouDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; // Direction relative to past price
  futureCloud: 'BULLISH' | 'BEARISH'; // The cloud 26 periods ahead
  cloudThickness: number; // Volatility/Strength of the cloud
  priceVsKijun: number; // % Distance
  tkSeparation: number; // % Distance between Tenkan and Kijun (for C-Clamp)
}

export interface IchimokuSignal {
  score: number;
  side: 'LONG' | 'SHORT' | 'NEUTRAL';
  strength: 'STRONG' | 'NEUTRAL' | 'WEAK'; // Signal quality
  reason: string;
  trigger: string;
  stopLoss: number; // Suggested Stop Loss
  takeProfit?: number; // Suggested Take Profit
  metrics: {
    tkCross: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    cloudStatus: 'ABOVE' | 'BELOW' | 'INSIDE';
    chikouStatus: 'VALID' | 'INVALID';
    futureCloud: 'BULLISH' | 'BEARISH';
    cloudThickness: string;
  };
}

export interface TechnicalIndicators {
  symbol: string;
  price: number;
  rsi: number;
  stochRsi: {
    k: number;
    d: number;
  };
  adx: number;
  atr: number;
  rvol: number;
  vwap: number;
  ema20: number;
  ema50: number;
  ema100: number;
  ema200: number;
  macd: {
    line: number;
    signal: number;
    histogram: number;
  };
  bollinger: {
    upper: number;
    lower: number;
    middle: number;
    bandwidth: number; // percentage
  };
  pivots: {
    p: number;
    r1: number;
    s1: number;
    r2: number;
    s2: number;
  };
  fibonacci: {
    level0: number;
    level0_236: number;
    level0_382: number;
    level0_5: number;
    level0_618: number;
    level0_786: number;
    tp1: number;
    tp2: number;
    tp3: number; // Moonbag
  };

  technicalReasoning: string;
  invalidated: boolean; // Si el precio ya tocó SL o TP

  // NEW: Detailed metrics for educational modal
  metrics?: {
    rvol: number;
    rsi: number;
    vwapDist: number; // Distance to VWAP %
    structure: string; // e.g. "Above EMA200"
    specificTrigger: string; // e.g. "Bollinger Bandwidth < 3%"
  };

  trendStatus: {
    emaAlignment: 'BULLISH' | 'BEARISH' | 'CHAOTIC';
    goldenCross: boolean;
    deathCross: boolean;
  };
  ichimokuData?: IchimokuCloud;

  // Advanced Market Structure (Optional)
  volumeProfile?: import('./types-advanced').VolumeProfileData;
  orderBlocks?: {
    bullish: import('./types-advanced').OrderBlockData[];
    bearish: import('./types-advanced').OrderBlockData[];
  };
  fairValueGaps?: {
    bullish: import('./types-advanced').FairValueGapData[];
    bearish: import('./types-advanced').FairValueGapData[];
  };
  confluenceAnalysis?: import('./types-advanced').ConfluenceData;
}

export enum TabView {
  DASHBOARD = 'DASHBOARD',
  CALENDAR = 'CALENDAR',
  OPPORTUNITIES = 'OPPORTUNITIES',
  SETTINGS = 'SETTINGS'
}

export type TradingStyle = 'SCALP_AGRESSIVE' | 'SWING_INSTITUTIONAL' | 'BREAKOUT_MOMENTUM' | 'ICHIMOKU_CLOUD' | 'MEME_SCALP';

export interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

// --- DCA (Dollar Cost Averaging) INTERFACES ---
export interface DCAEntry {
  level: number; // 1, 2, 3
  price: number;
  positionSize: number; // % del total (40, 30, 30)
  confluenceScore: number;
  factors: string[];
  distanceFromCurrent: number; // % de descuento
}

export interface DCAPlan {
  entries: DCAEntry[];
  averageEntry: number; // Precio promedio ponderado (WAP)
  totalRisk: number; // % de cuenta en riesgo
  stopLoss: number; // SL ajustado al WAP
  takeProfits: {
    tp1: { price: number; exitSize: number }; // 40%
    tp2: { price: number; exitSize: number }; // 30%
    tp3: { price: number; exitSize: number }; // 30%
  };
}

export interface AIOpportunity {
  id: string;
  symbol: string;
  timestamp: number;
  signalTimestamp?: number; // NEW: Timestamp de la vela de confirmación
  strategy: string;
  side: 'LONG' | 'SHORT';
  confidenceScore: number;
  entryZone: {
    min: number;
    max: number;
    aggressive?: number; // NEW: Entrada agresiva (precio actual)
    signalPrice?: number; // NEW: Precio de la señal (vela cerrada)
    currentPrice?: number; // NEW: Precio actual (última vela)
    priceMove?: number; // NEW: % de movimiento desde señal
  };
  dcaLevel?: number;
  stopLoss: number;
  takeProfits: {
    tp1: number;
    tp2: number;
    tp3: number;
  };
  technicalReasoning: string;
  invalidated: boolean;
  metrics?: {
    rvol: number;
    rsi: number;
    vwapDist: number;
    structure: string;
    specificTrigger: string;
  };
}