import { correlationMatrix } from './CorrelationMatrix';
import { TradingConfig } from '../../config/tradingConfig';

export type MarketState = 'rotation_active' | 'systemic_risk' | 'lateral' | 'normal' | 'pre_signal';

export interface Rotation {
    asset: string;
    correlation: number;
    strength: 'WEAK' | 'MODERATE' | 'STRONG' | 'EXTREME';
    duration?: string;
    priceChange24h?: number;
}

export interface NearSignal {
    symbol: string;
    currentScore: number;
    threshold: number;
    missing: string;
}

export interface MarketIntelligence {
    state: MarketState;
    timestamp: number;

    // Rotaciones detectadas
    rotations: Rotation[];

    // Alertas importantes
    alerts: string[];

    // Señales cercanas al threshold
    nearSignals: NearSignal[];

    // Resumen ejecutivo
    summary: string;

    // Recomendación accionable
    recommendation: string;

    // Métricas clave
    metrics: {
        btcPrice?: number;
        btcChange24h?: number;
        avgCorrelation: number;
        highCorrPairs: number;
        totalPairs: number;
    };
}

export class CorrelationAnalyzer {

    /**
     * Analiza el estado actual del mercado y genera insights
     */
    analyze(opportunities: any[], btcData?: any): MarketIntelligence {
        const matrixData = correlationMatrix.generateMatrix();
        const assets = [...TradingConfig.assets.tournament_list];

        // 1. Detectar rotaciones activas
        const rotations = this.detectRotations(matrixData.matrix, assets);

        // 2. Calcular métricas del mercado
        const metrics = this.calculateMetrics(matrixData.matrix, assets, btcData);

        // 3. Identificar señales cercanas
        const nearSignals = this.identifyNearSignals(opportunities);

        // 4. Determinar estado del mercado
        const state = this.determineMarketState(rotations, metrics, opportunities.length);

        // 5. Generar alertas
        const alerts = this.generateAlerts(state, rotations, metrics, matrixData.alerts);

        // 6. Crear resumen y recomendación
        const { summary, recommendation } = this.generateInsights(
            state,
            rotations,
            nearSignals,
            metrics,
            opportunities.length
        );

        return {
            state,
            timestamp: Date.now(),
            rotations,
            alerts,
            nearSignals,
            summary,
            recommendation,
            metrics
        };
    }

    /**
     * Detecta rotaciones de capital activas
     */
    private detectRotations(matrix: Record<string, Record<string, number>>, assets: string[]): Rotation[] {
        const rotations: Rotation[] = [];

        for (const asset of assets) {
            if (asset === 'BTCUSDT') continue;

            const btcCorr = matrix['BTCUSDT']?.[asset] || 0;

            // Rotación detectada si correlación < 0.5
            if (btcCorr < 0.5 && btcCorr > 0) {
                rotations.push({
                    asset,
                    correlation: btcCorr,
                    strength: this.classifyRotationStrength(btcCorr)
                });
            }
        }

        // Ordenar por fuerza (menor correlación = rotación más fuerte)
        return rotations.sort((a, b) => a.correlation - b.correlation);
    }

    /**
     * Clasifica la fuerza de una rotación
     */
    private classifyRotationStrength(correlation: number): 'WEAK' | 'MODERATE' | 'STRONG' | 'EXTREME' {
        if (correlation < 0.2) return 'EXTREME';
        if (correlation < 0.35) return 'STRONG';
        if (correlation < 0.45) return 'MODERATE';
        return 'WEAK';
    }

    /**
     * Calcula métricas clave del mercado
     */
    private calculateMetrics(
        matrix: Record<string, Record<string, number>>,
        assets: string[],
        btcData?: any
    ) {
        let totalCorr = 0;
        let pairCount = 0;
        let highCorrPairs = 0;

        for (const asset1 of assets) {
            for (const asset2 of assets) {
                if (asset1 < asset2) {
                    const corr = matrix[asset1]?.[asset2] || 0;
                    totalCorr += Math.abs(corr);
                    pairCount++;

                    if (Math.abs(corr) > 0.9) {
                        highCorrPairs++;
                    }
                }
            }
        }

        return {
            btcPrice: btcData?.price,
            btcChange24h: btcData?.change24h,
            avgCorrelation: pairCount > 0 ? totalCorr / pairCount : 0,
            highCorrPairs,
            totalPairs: pairCount
        };
    }

    /**
     * Identifica señales cercanas al threshold
     */
    private identifyNearSignals(opportunities: any[]): NearSignal[] {
        const threshold = 75;
        const nearThreshold = 65; // 10 puntos de margen

        // Aquí podríamos tener acceso a señales que no pasaron el threshold
        // Por ahora retornamos array vacío, esto se puede mejorar
        return [];
    }

    /**
     * Determina el estado general del mercado
     */
    private determineMarketState(
        rotations: Rotation[],
        metrics: any,
        signalCount: number
    ): MarketState {
        const { highCorrPairs, totalPairs } = metrics;
        const sysRiskRatio = totalPairs > 0 ? highCorrPairs / totalPairs : 0;

        // Riesgo sistémico (>70% pares altamente correlacionados)
        if (sysRiskRatio > 0.7) {
            return 'systemic_risk';
        }

        // Rotaciones activas
        if (rotations.length > 0 && signalCount > 0) {
            return 'rotation_active';
        }

        // Pre-señal (rotaciones detectadas pero sin señales confirmadas)
        if (rotations.length > 0 && signalCount === 0) {
            return 'pre_signal';
        }

        // Lateral (sin rotaciones, sin señales, correlación media)
        if (signalCount === 0 && rotations.length === 0 && metrics.avgCorrelation < 0.6) {
            return 'lateral';
        }

        // Normal
        return 'normal';
    }

    /**
     * Genera alertas basadas en el análisis
     */
    private generateAlerts(
        state: MarketState,
        rotations: Rotation[],
        metrics: any,
        matrixAlerts: string[]
    ): string[] {
        const alerts: string[] = [...matrixAlerts];

        if (state === 'systemic_risk') {
            alerts.push(`⚠️ ALTO RIESGO: ${metrics.highCorrPairs}/${metrics.totalPairs} pares correlación >0.9`);
        }

        if (rotations.length >= 3) {
            alerts.push(`🔥 Múltiples rotaciones activas: ${rotations.length} activos desacoplados`);
        }

        for (const rot of rotations) {
            if (rot.strength === 'EXTREME' || rot.strength === 'STRONG') {
                alerts.push(`🚨 ${rot.asset}: Rotación ${rot.strength} (corr: ${rot.correlation.toFixed(2)})`);
            }
        }

        return alerts;
    }

    /**
     * Genera insights automáticos (resumen + recomendación)
     */
    private generateInsights(
        state: MarketState,
        rotations: Rotation[],
        nearSignals: NearSignal[],
        metrics: any,
        signalCount: number
    ): { summary: string; recommendation: string } {

        let summary = '';
        let recommendation = '';

        switch (state) {
            case 'rotation_active':
                summary = `${rotations.length} rotación(es) de capital detectada(s). `;
                summary += `Capital fluyendo de BTC hacia: ${rotations.slice(0, 3).map(r => r.asset.replace('USDT', '')).join(', ')}`;
                recommendation = `Monitorear señales en activos desacoplados. Oportunidad de outperformance vs BTC.`;
                break;

            case 'systemic_risk':
                summary = `Riesgo sistémico alto: ${((metrics.highCorrPairs / metrics.totalPairs) * 100).toFixed(0)}% de pares correlación >0.9. `;
                summary += `Mercado moviéndose en bloque.`;
                recommendation = `Reducir leverage. Esperar divergencia entre activos antes de nuevas posiciones.`;
                break;

            case 'pre_signal':
                summary = `${rotations.length} rotación(es) emergiendo. `;
                summary += `Esperando confirmación técnica para señales.`;
                recommendation = `Monitorear próximas 2-3 velas. Rotación puede generar señales si hay confirmación EMA/RSI.`;
                break;

            case 'lateral':
                const btcInfo = metrics.btcPrice ? `BTC: $${metrics.btcPrice.toLocaleString()}` : 'BTC lateral';
                summary = `Mercado en consolidación. ${btcInfo}. `;
                summary += `Sin movimientos direccionales claros.`;
                recommendation = `Paciencia. Sistema monitoreando cada 15min. Se notificará al detectar breakout o rotación.`;
                break;

            case 'normal':
                summary = `Mercado en condiciones normales. `;
                summary += signalCount > 0
                    ? `${signalCount} señal(es) activa(s).`
                    : `Esperando setup técnico válido.`;
                recommendation = signalCount > 0
                    ? `Revisar señales disponibles y sus reasoning.`
                    : `Sistema activo. Se notificará cuando detecte oportunidades.`;
                break;
        }

        return { summary, recommendation };
    }
}

// Singleton
export const correlationAnalyzer = new CorrelationAnalyzer();
