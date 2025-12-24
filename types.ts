
export interface MarketData {
  id: string; // ID for WebSocket subscription (e.g., 'bitcoin')
  symbol: string;
  price: number;
  change24h: number;
  rsi: number;
  volume: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  tier?: FundamentalTier; // NEW: Fundamental Classification
}

export type FundamentalTier = 'S' | 'A' | 'B' | 'C';

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
  zScore: number; // NEW: Reversion to Mean (StdDevs from EMA200)
  emaSlope: number; // NEW: Trend Momentum
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
    level0_65: number;   // NEW
    level0_786: number;
    level0_886: number;  // NEW
    level1: number;
    tp1: number;
    tp2: number;
    tp3: number;
    tp4: number;
    tp5: number;

  };

  // NEW: EXPERT METRICS
  macdDivergence?: import('./services/divergenceDetector').Divergence;
  rsiDivergence?: import('./services/divergenceDetector').Divergence | null; // NEW
  isSqueeze?: boolean;
  rsiExpert?: {
    range: string;
    target: number | null;
    targetType: 'POSITIVE' | 'NEGATIVE' | null;
  };

  harmonicPatterns?: import('./types-advanced').HarmonicPattern[];

  // NEW: Expert Volume & Derivatives
  volumeExpert?: import('./types-advanced').VolumeExpertAnalysis;

  technicalReasoning: string;
  invalidated: boolean; // Si el precio ya tocó SL o TP

  // NEW: Detailed metrics for educational modal
  metrics?: {
    rvol: number;
    rsi: number;
    vwapDist: number; // Distance to VWAP %
    structure: string; // e.g. "Above EMA200"
    specificTrigger: string; // e.g. "Bollinger Bandwidth < 3%"
    zScore?: number;
    emaSlope?: number;
    isSqueeze?: boolean;
    macdDivergence?: string;
    rsiExpert?: {
      range: string;
      target: number | null;
    };
  };

  trendStatus: {
    emaAlignment: 'BULLISH' | 'BEARISH' | 'CHAOTIC';
    goldenCross: boolean;
    deathCross: boolean;
  };
  // NEW: Multi-Timeframe Fractal Analysis (1H, 4H, 1D)
  fractalAnalysis?: {
    trend_1h: 'BULLISH' | 'BEARISH';
    ema200_1h: number;
    price_1h: number;
    structure: 'ALIGNED' | 'DIVERGENT';
    trend_4h?: 'BULLISH' | 'BEARISH';
    ema200_4h?: number;
    price_4h?: number;
    trend_1d?: 'BULLISH' | 'BEARISH';
    ema200_1d?: number;
    price_1d?: number;
    trend_1d_structure?: string;
    // NEW: Weekly Cycle Analysis
    trend_1w?: 'BULLISH' | 'BEARISH';
    ema50_1w?: number;
    price_1w?: number;
    rsi_1w?: number; // Momentum Semanal
  };

  ichimokuData?: IchimokuCloud;

  // NEW: Session Expert Analysis
  sessionAnalysis?: import('./services/sessionExpert').SessionAnalysis;

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

  // Market Regime Detection (Autonomous Strategy Selection)
  marketRegime?: import('./types-advanced').MarketRegime;

  tier?: FundamentalTier; // NEW: Propagate Tier
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

  // NEW: Institutional Metadata
  timeframe: string; // e.g. "15m"
  session: string; // e.g. "ASIA"
  riskRewardRatio: number; // e.g. 2.5

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
    vwapDist: number; // Distance to VWAP %
    structure: string; // e.g. "Above EMA200"
    specificTrigger: string; // e.g. "Bollinger Bandwidth < 3%"
    zScore?: number; // NEW
    emaSlope?: number; // NEW
    rsiExpert?: {
      range: string;
      target: number | null;
    };
    isSqueeze?: boolean; // NEW
    macdDivergence?: string; // NEW: Description or Type
    rsiDivergence?: string; // NEW: Description or Type
    volumeExpert?: import('./types-advanced').VolumeExpertAnalysis; // NEW: Institutional Data for UI
  };
  dcaPlan?: DCAPlan; // NEW: Plan completo de DCA para UI
  harmonicPatterns?: import('./types-advanced').HarmonicPattern[]; // NEW: Patrones para UI
  tier?: FundamentalTier; // NEW: Tier Badge for UI
}