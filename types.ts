
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

// Nueva interfaz robusta para señales de IA
export interface AIOpportunity {
    id: string;
    symbol: string;
    timestamp: number;
    strategy: string; // "Scalp", "Swing", etc.
    side: 'LONG' | 'SHORT';
    confidenceScore: number; // 0-100
    
    // Gestión de Entrada
    entryZone: {
        min: number;
        max: number;
    };
    dcaLevel?: number; // Nivel sugerido para promediar (Entry 2)
    
    // Gestión de Salida
    stopLoss: number;
    takeProfits: {
        tp1: number;
        tp2: number;
        tp3: number; // Moonbag
    };
    
    technicalReasoning: string;
    invalidated: boolean; // Si el precio ya tocó SL o TP
}

export enum TabView {
  DASHBOARD = 'DASHBOARD',
  CALENDAR = 'CALENDAR',
  OPPORTUNITIES = 'OPPORTUNITIES',
  SETTINGS = 'SETTINGS'
}

export type TradingStyle = 'SCALP_AGRESSIVE' | 'SWING_INSTITUTIONAL' | 'BREAKOUT_MOMENTUM' | 'ICHIMOKU_CLOUD';
