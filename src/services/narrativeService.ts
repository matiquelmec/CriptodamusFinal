
import { TechnicalIndicators } from "../types";
import { MarketRegime } from "../types/types-advanced";

/**
 * NARRATIVE SERVICE (Algorithmic Edition)
 * Provides institutional-grade analysis using deterministic logic.
 * 100% Robust. 0% Hallucinations. No API Key required.
 */

export interface NarrativeContext {
    symbol: string;
    price: number;
    technicalIndicators: TechnicalIndicators;
    marketRegime: MarketRegime;
    sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
    confidenceScore: number;
    news?: {
        sentiment: string;
        score: number;
        summary: string;
        headlineCount: number;
    };
}

// ----------------------------------------------------------------------------
// THESIS GENERATION ENGINE
// ----------------------------------------------------------------------------

export const generateInvestmentThesis = async (context: NarrativeContext, brainNote: string = ""): Promise<string> => {
    // 1. Analyze Core Market Structure
    const regime = context.marketRegime.regime; // 'TRENDING' | 'RANGING' | 'VOLATILE'
    const sentiment = context.sentiment;
    const rsi = context.technicalIndicators.rsi;
    const adx = context.technicalIndicators.adx;

    // 2. Analyze Institutional Footprint (if available)
    let institutionalNote = "";
    if (context.technicalIndicators.volumeExpert) {
        const { fundingRate } = context.technicalIndicators.volumeExpert.derivatives;
        const premiumSignal = context.technicalIndicators.volumeExpert.coinbasePremium.signal; // 'INSTITUTIONAL_BUY' | ...

        if (premiumSignal === 'INSTITUTIONAL_BUY') {
            institutionalNote = " Detectamos acumulación institucional agresiva via Coinbase Premium.";
        } else if (premiumSignal === 'INSTITUTIONAL_SELL') {
            institutionalNote = " Cuidado: Institucionales distribuyendo en Coinbase Spot.";
        }

        if (fundingRate > 0.015) {
            institutionalNote += " El mercado de futuros está sobre-apalancado (Funding Alto). Riesgo de corrección.";
        }
    }

    // 2.5 News Sentiment Integration
    let newsNote = "";
    if (context.news && context.news.headlineCount > 0) {
        const sentimentMap: Record<string, string> = {
            'BULLISH': 'optimista',
            'BEARISH': 'pesimista',
            'NEUTRAL': 'cauteloso'
        };
        const mood = sentimentMap[context.news.sentiment] || 'neutral';
        newsNote = ` El flujo de noticias es predominantemente ${mood} (${context.news.summary}).`;
    }

    // 3. Assemble Thesis based on Scenarios

    // SCENARIO A: STRONG UPTREND (Bullish + High ADX)
    if (sentiment === "BULLISH" && regime === "TRENDING") {
        if (adx > 25) {
            return `Estructura alcista sólida confirmada por momentum. El precio muestra fortaleza sobre medias móviles clave.${institutionalNote}${newsNote} Buscamos continuidad en la tendencia, priorizando entradas en retrocesos (buy the dip).${brainNote}`;
        } else {
            return `Tendencia alcista presente pero perdiendo fuerza momentum (ADX bajo).${institutionalNote}${newsNote} Precaución con falsos rompimientos; esperar confirmación de volumen antes de añadir posiciones.${brainNote}`;
        }
    }

    // SCENARIO B: STRONG DOWNTREND (Bearish + High ADX)
    if (sentiment === "BEARISH" && regime === "TRENDING") {
        if (rsi < 30) {
            return `Tendencia bajista extendida, pero RSI en sobreventa sugiere un posible rebote técnico a corto plazo (Dead Cat Bounce).${institutionalNote}${newsNote} No es momento de shortear agresivamente, esperar pullbacks a resistencia.${brainNote}`;
        }
        return `Dominio total de la oferta. Estructura de máximos y mínimos decrecientes intacta.${institutionalNote}${newsNote} El camino de menor resistencia es a la baja; vender en rebotes a la EMA200.${brainNote}`;
    }

    // SCENARIO C: RANGE / CHOP (Ranging)
    if (regime === "RANGING" || sentiment === "NEUTRAL") {
        if (rsi > 70) {
            return `El activo se encuentra en la parte alta de un rango lateral.${institutionalNote}${newsNote} Probabilidad alta de rechazo en resistencia. Estrategia de reversión a la media (Mean Reversion) favorecida.${brainNote}`;
        } else if (rsi < 30) {
            return `El precio testea el soporte inferior del rango actual.${institutionalNote}${newsNote} Oportunidad de compra de bajo riesgo con stop ajustado bajo el mínimo previo.${brainNote}`;
        }
        return `Fase de consolidación e indecisión. El precio oscila sin dirección clara entre zonas de liquidez.${institutionalNote}${newsNote} Mantenerse al margen o scalpear los extremos del rango.${brainNote}`;
    }

    // SCENARIO D: VOLATILE / UNCERTAIN
    return `Condiciones de alta volatilidad detectadas. El mercado busca definir su próxima dirección macro.${institutionalNote} Se recomienda reducir el tamaño de posición y ampliar los stops para evitar ruido ("wicks").${brainNote}`;
};

// ----------------------------------------------------------------------------
// EXECUTION PLAN ENGINE
// ----------------------------------------------------------------------------

export const generateExecutionPlanNarrative = async (context: NarrativeContext, side: 'LONG' | 'SHORT'): Promise<string> => {
    const atr = context.technicalIndicators.atr;
    const volatility = atr / context.price; // Percentage volatility roughly

    // 1. High Volatility Strategy
    if (volatility > 0.04) { // >4% daily ATR implies huge moves
        return side === 'LONG'
            ? "MERCADO VOLÁTIL: Evitar entradas a mercado. Usar órdenes limit en soportes profundos y aplicar DCA amplio (3-4 zonas) para promediar ante mechas violentas."
            : "MERCADO VOLÁTIL: No perseguir el precio. Colocar órdenes de venta (Limit) escalonadas en resistencias clave. Stop loss holgado requerido.";
    }

    // 2. Low Volatility / Trending Strategy (Sniper)
    if (context.technicalIndicators.adx > 30) {
        return side === 'LONG'
            ? "MOMENTUM ACTIVADO: Entrada tipo 'Sniper' o Breakout. El mercado tiene fuerza; se puede entrar con stop loss ajustado bajo la EMA de corto plazo (EMA20)."
            : "MOMENTUM BAJISTA: Entrada agresiva en ruptura de soportes o re-test inmediato. Mantener stop ajustado para proteger capital rápido.";
    }

    // 3. Default / Range Strategy (Standard DCA)
    return side === 'LONG'
        ? "ESTRATEGIA ESTÁNDAR: Ejecución por zonas de liquidez. Dividir capital en 2 entradas: 40% al precio actual/soporte inmediato y 60% en el siguiente nivel estructural (DCA defensivo)."
        : "ESTRATEGIA ESTÁNDAR: Venta táctica en resistencia. Si el precio rompe en contra con volumen, cortar pérdidas rápido. Tomar ganancias parciales en el soporte medio.";
}
