
import { fetchCandles } from '../api/binanceApi';
import { TradingConfig } from '../../../config/tradingConfig';

interface MatrixData {
    matrix: Record<string, Record<string, number>>;
    timestamp: number;
    alerts: string[];
}

// Cache interno para no recalcular en cada request si no ha pasado tiempo suficiente
let cachedMatrix: MatrixData | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutos (alineado con velas)

export class CorrelationMatrixService {

    /**
     * Genera la matriz de correlación de Pearson para los activos del Torneo.
     * Utiliza datos de velas de 4H para capturar la tendencia macro/swing.
     */
    public async generateMatrix(): Promise<MatrixData> {
        // 1. Check Cache
        if (cachedMatrix && (Date.now() - cachedMatrix.timestamp < CACHE_TTL)) {
            return cachedMatrix;
        }

        const assets = TradingConfig.assets.tournament_list;
        const prices: Record<string, number[]> = {};
        const alerts: string[] = [];

        // 2. Fetch Data (Parallel)
        // Usamos 4h para correlación estructural, no ruido de 15m.
        console.log("🧩 [CorrelationMatrix] Regenerando matriz de correlación (4H)...");

        const promises = assets.map(async (asset) => {
            try {
                // Pedimos 50 velas para tener significancia estadística (~8 días)
                const candles = await fetchCandles(asset, '4h');
                if (candles && candles.length >= 20) {
                    // Tomamos solo los cierres
                    prices[asset] = candles.map(c => c.close).slice(-50);
                }
            } catch (e) {
                console.warn(`⚠️ [Correlation] Fallo al obtener datos para ${asset}`);
            }
        });

        await Promise.all(promises);

        // 3. Normalizar longitud de arrays (Intersection)
        // Necesitamos que todos tengan la misma longitud para Pearson
        const validAssets = Object.keys(prices);
        if (validAssets.length < 2) {
            return { matrix: {}, timestamp: Date.now(), alerts: ["Datos insuficientes para correlación"] };
        }

        const minLength = Math.min(...validAssets.map(a => prices[a].length));
        const normalizedPrices: Record<string, number[]> = {};

        validAssets.forEach(asset => {
            // Tomamos los últimos N elementos para alinear por el final (más reciente)
            normalizedPrices[asset] = prices[asset].slice(-minLength);
        });

        // 4. Calcular Matriz Pearson NxN
        const matrix: Record<string, Record<string, number>> = {};

        for (const assetA of validAssets) {
            matrix[assetA] = {};
            for (const assetB of validAssets) {
                if (assetA === assetB) {
                    matrix[assetA][assetB] = 1;
                } else {
                    // Optimización: Si ya calculamos B vs A, usamos ese valor
                    if (matrix[assetB] && matrix[assetB][assetA] !== undefined) {
                        matrix[assetA][assetB] = matrix[assetB][assetA];
                    } else {
                        const corr = this.calculatePearsonCorrelation(normalizedPrices[assetA], normalizedPrices[assetB]);
                        matrix[assetA][assetB] = corr;
                    }
                }
            }
        }

        // 5. Análisis Preliminar de Alertas
        // Detectar desacople de BTC
        if (matrix['BTCUSDT']) {
            validAssets.forEach(asset => {
                if (asset !== 'BTCUSDT') {
                    const corrBtc = matrix['BTCUSDT'][asset];
                    if (corrBtc < 0.3) {
                        alerts.push(`📉 DESACOPLE: ${asset} vs BTC (${corrBtc.toFixed(2)}) - Posible movimiento idiosincrático.`);
                    }
                    if (corrBtc < -0.5) {
                        alerts.push(`🔄 CORRELACIÓN INVERSA: ${asset} vs BTC (${corrBtc.toFixed(2)}) - Hedge potencial.`);
                    }
                }
            });
        }

        const result: MatrixData = {
            matrix,
            timestamp: Date.now(),
            alerts
        };

        cachedMatrix = result;
        console.log(`🧩 [CorrelationMatrix] Matriz regenerada. ${alerts.length} alertas.`);
        return result;
    }

    /**
     * Fórmula estándar de Correlación de Pearson
     */
    private calculatePearsonCorrelation(x: number[], y: number[]): number {
        const n = x.length;
        if (n !== y.length || n === 0) return 0;

        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

        for (let i = 0; i < n; i++) {
            sumX += x[i];
            sumY += y[i];
            sumXY += x[i] * y[i];
            sumX2 += x[i] * x[i];
            sumY2 += y[i] * y[i];
        }

        const numerator = (n * sumXY) - (sumX * sumY);
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

        if (denominator === 0) return 0;
        return numerator / denominator;
    }

    public getLastUpdate(): number {
        return cachedMatrix ? cachedMatrix.timestamp : 0;
    }

    public getTrackedAssets(): string[] {
        return TradingConfig.assets.tournament_list;
    }
}

// Singleton Export
export const correlationMatrix = new CorrelationMatrixService();
