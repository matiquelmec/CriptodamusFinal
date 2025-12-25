/**
 * GLOSARIO DE TÉRMINOS TÉCNICOS
 * Definiciones para tooltips educativos
 */

export const GLOSSARY = {
    // Indicadores Técnicos
    RSI: "Relative Strength Index: Mide el momentum del precio en una escala de 0-100. Valores \u003c30 indican sobreventa (posible rebote), valores \u003e70 indican sobrecompra (posible corrección).",

    RVOL: "Relative Volume: Compara el volumen actual con el promedio de las últimas 20 velas. RVOL \u003e 1.5x indica interés real del mercado, no solo movimiento de precio artificial.",

    ATR: "Average True Range: Mide la volatilidad promedio del activo. Se usa para calcular Stop Loss dinámicos (SL = Precio - 1.5*ATR) que se adaptan a la volatilidad real.",

    ADX: "Average Directional Index: Mide la fuerza de la tendencia (no la dirección). ADX \u003e 25 = tendencia fuerte, ADX \u003c 20 = mercado en rango (lateral).",

    VWAP: "Volume Weighted Average Price: Precio promedio ponderado por volumen. Los traders institucionales lo usan como referencia de 'precio justo' del día.",

    MACD: "Moving Average Convergence Divergence: Indicador de momentum que muestra la relación entre dos medias móviles. Histograma \u003e 0 = momentum alcista.",

    "Stoch RSI": "Stochastic RSI: Versión más sensible del RSI. Detecta cambios de momentum antes que el RSI tradicional. Útil para timing de entradas.",

    // Estrategias y Conceptos
    DCA: "Dollar Cost Averaging: Estrategia de entradas escalonadas en diferentes niveles de precio. Reduce riesgo al no 'all-in' en un solo punto. Ejemplo: 40% en Entry 1, 30% en Entry 2, 30% en Entry 3.",

    "Stop Loss": "Nivel de precio donde se cierra automáticamente la posición para limitar pérdidas. Es el punto de 'invalidación' de la tesis de trading. Nunca operar sin SL.",

    "Take Profit": "Niveles de precio donde se toman ganancias parciales. TP1 (40%), TP2 (30%), TP3/Moonbag (30%). Asegura ganancias mientras deja correr parte de la posición.",

    "Entry Zone": "Rango de precios óptimo para entrar al trade. No es un punto exacto, sino una zona de confluencia técnica (Fibonacci + EMA + Order Blocks).",

    SMC: "Smart Money Concepts: Metodología de trading que analiza cómo operan las instituciones (market makers, hedge funds). Busca Order Blocks, Fair Value Gaps y barridos de liquidez.",

    "Order Block": "Zona de precio donde instituciones colocaron órdenes grandes. Actúa como soporte/resistencia fuerte porque hay 'órdenes pendientes' institucionales.",

    "Fair Value Gap": "Desequilibrio de precio (gap) causado por movimiento rápido. El mercado tiende a 'rellenar' estos gaps, creando oportunidades de entrada.",

    Confluence: "Confluencia: Cuando múltiples factores técnicos coinciden en el mismo nivel de precio (Ej: Fibonacci 0.618 + EMA200 + Order Block). Mayor confluencia = mayor probabilidad.",

    // Niveles Técnicos
    "Golden Pocket": "Zona entre Fibonacci 0.618 y 0.65. Estadísticamente, es el nivel de retroceso más común antes de que el precio continúe la tendencia. Zona de entrada premium.",

    "EMA 200": "Media Móvil Exponencial de 200 períodos. El nivel más respetado por traders institucionales. Precio \u003e EMA200 = tendencia alcista, Precio \u003c EMA200 = tendencia bajista.",

    "Pivot Points": "Niveles de soporte/resistencia calculados matemáticamente del día anterior. Los traders institucionales los usan como referencia para entradas/salidas.",

    // Régimen de Mercado
    TRENDING: "Mercado en Tendencia: Movimiento direccional claro (alcista o bajista). ADX \u003e 25. Estrategias óptimas: Ichimoku, Breakout, seguimiento de tendencia.",

    RANGING: "Mercado en Rango: Precio oscila entre soporte y resistencia sin dirección clara. ADX \u003c 20. Estrategias óptimas: Mean Reversion, vender resistencia/comprar soporte.",

    VOLATILE: "Mercado Volátil: Alta volatilidad y expansión de rango. ATR alto + Bollinger Bands anchas. Estrategias óptimas: Breakout, Momentum, Meme Hunter.",

    EXTREME: "Condición Extrema: Sobreventa (RSI \u003c 25) o sobrecompra (RSI \u003e 75) extrema. Posible reversión inminente. Estrategias óptimas: Divergencias, rebotes técnicos.",

    // Otros
    "Confidence Score": "Puntuación de confianza (0-100%) calculada por el algoritmo autónomo. Combina múltiples factores: confluencia técnica, volumen, alineación de timeframes, condiciones macro. Score \u003e 70% = alta probabilidad.",

    "R:R": "Risk/Reward Ratio: Relación entre riesgo y recompensa. R:R 1:3 significa que arriesgas $1 para ganar $3. Mínimo recomendado: 1:2. Ideal: 1:3 o superior.",

    WAP: "Weighted Average Price: Precio promedio ponderado de las entradas DCA. Se usa para calcular el Stop Loss y Take Profits ajustados a tu precio de entrada real.",
} as const;

export type GlossaryTerm = keyof typeof GLOSSARY;
