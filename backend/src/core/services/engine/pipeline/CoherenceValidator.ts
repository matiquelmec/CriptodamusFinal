/**
 * COHERENCE VALIDATOR - Sistema de Validación Lógica Automática
 * 
 * Auto-detecta contradicciones en el scoring y reasoning de señales.
 * Aplica auto-fix inteligente para mantener coherencia lógica 100%.
 */

export interface Contradiction {
    type: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    action: 'DISCARD' | 'FIX_AUTO' | 'REDUCE_CONFIDENCE' | 'WARN';
    scoreAdjustment?: number;
    reasoningFilter?: (text: string) => boolean;
}

export interface CoherenceResult {
    isCoherent: boolean;
    contradictions: Contradiction[];
    fixedScore: number;
    fixedReasoning: string[];
    shouldDiscard: boolean;
}

export class CoherenceValidator {

    /**
     * Validate signal coherence and auto-fix contradictions
     */
    static validate(
        signal: {
            side: 'LONG' | 'SHORT';
            strategy?: string;
            globalSentiment?: { score: number };
        },
        indicators: any,
        volumeExpert: any,
        totalScore: number,
        reasoning: string[]
    ): CoherenceResult {
        const contradictions: Contradiction[] = [];
        let fixedScore = totalScore;
        let fixedReasoning = [...reasoning];

        // =============================================
        // CHECK 1: CVD Trend vs Divergence
        // =============================================
        const hasTrend = volumeExpert?.cvd?.trend && volumeExpert.cvd.trend !== 'NEUTRAL';
        const hasDivergence = indicators.cvdDivergence && indicators.cvdDivergence !== 'NONE';
        const hasCVDTrendReasoning = reasoning.some(r => r.includes('CVD: Aggressive'));

        if (hasTrend && hasDivergence && hasCVDTrendReasoning) {
            contradictions.push({
                type: 'CVD_TREND_DIVERGENCE_CONFLICT',
                severity: 'HIGH',
                description: 'CVD Trend scoring aplicado cuando divergence ya detectada',
                action: 'FIX_AUTO',
                scoreAdjustment: -10, // Remove trend score
                reasoningFilter: (r) => r.includes('CVD: Aggressive')
            });
        }

        // =============================================
        // CHECK 2: OrderBook Wall Support vs Fake Wall
        // =============================================
        const hasWallSupport = reasoning.some(r =>
            r.includes('Muro Confirmado') || r.includes('Wall Stability Verified')
        );
        const hasFakeWall = reasoning.some(r => r.includes('FAKE WALL DETECTED'));

        if (hasWallSupport && hasFakeWall) {
            contradictions.push({
                type: 'ORDERBOOK_WALL_CONFLICT',
                severity: 'CRITICAL',
                description: 'Wall support confirmado PERO fake wall detectado simultáneamente',
                action: 'DISCARD', // Señal inválida - no podemos confiar
                scoreAdjustment: -100
            });
        }

        // =============================================
        // CHECK 3: Deep Bid Pressure vs Liquidity Trap
        // =============================================
        const hasDeepPressure = reasoning.some(r => r.includes('DEEP BID PRESSURE') || r.includes('DEEP ASK PRESSURE'));
        const hasTrap = reasoning.some(r => r.includes('LIQUIDITY TRAP'));

        if (hasDeepPressure && hasTrap) {
            contradictions.push({
                type: 'DEPTH_DIVERGENCE_CONFLICT',
                severity: 'HIGH',
                description: 'Deep pressure institucional PERO trap detectado (surface/deep divergence)',
                action: 'FIX_AUTO',
                scoreAdjustment: -30, // Cancel deep pressure boost
                reasoningFilter: (r) => r.includes('DEEP BID') || r.includes('DEEP ASK')
            });
        }

        // =============================================
        // CHECK 4: Sentiment vs Momentum Strategy
        // =============================================
        const isPanicSentiment = signal.globalSentiment && signal.globalSentiment.score < -0.5;
        const isMomentumStrategy = signal.strategy?.includes('MOMENTUM') || signal.strategy?.includes('BREAKOUT');
        const isLong = signal.side === 'LONG';

        if (isPanicSentiment && isMomentumStrategy && isLong) {
            contradictions.push({
                type: 'SENTIMENT_STRATEGY_CONFLICT',
                severity: 'MEDIUM',
                description: 'Momentum LONG en pánico del mercado (sentiment < -0.5)',
                action: 'REDUCE_CONFIDENCE',
                scoreAdjustment: -15
            });
        }

        // =============================================
        // CHECK 5: Euphoria Sentiment vs Short Position
        // =============================================
        const isEuphoria = signal.globalSentiment && signal.globalSentiment.score > 0.5;
        const isShort = signal.side === 'SHORT';
        const hasFOMOWarning = reasoning.some(r => r.includes('FOMO Risk'));

        if (isEuphoria && !isShort && !hasFOMOWarning) {
            // Debería haber warning pero no lo hay
            contradictions.push({
                type: 'EUPHORIA_WARNING_MISSING',
                severity: 'LOW',
                description: 'Long en euphoria sin warning de FOMO',
                action: 'WARN',
                scoreAdjustment: 0
            });
        }

        // =============================================
        // CHECK 6: Absorption Score vs No Wall Detected
        // =============================================
        const hasAbsorption = reasoning.some(r => r.includes('WALL ABSORBED'));
        const hasWallSupport2 = reasoning.some(r => r.includes('Muro Confirmado'));

        if (hasAbsorption && !hasWallSupport2 && !hasFakeWall) {
            // Absorbed wall pero no hay wall detected? Contradicción
            contradictions.push({
                type: 'ABSORPTION_WITHOUT_WALL',
                severity: 'MEDIUM',
                description: 'Wall absorbed detectado pero no hay muro confirmado',
                action: 'REDUCE_CONFIDENCE',
                scoreAdjustment: -10
            });
        }

        // =============================================
        // APPLY FIXES
        // =============================================
        contradictions.forEach(c => {
            if (c.action === 'FIX_AUTO' || c.action === 'REDUCE_CONFIDENCE') {
                if (c.scoreAdjustment) {
                    fixedScore += c.scoreAdjustment;
                }
                if (c.reasoningFilter) {
                    fixedReasoning = fixedReasoning.filter(r => !c.reasoningFilter!(r));
                }
            }
        });

        // Add explanation for fixes
        if (contradictions.length > 0) {
            const criticalCount = contradictions.filter(c => c.severity === 'CRITICAL').length;
            const highCount = contradictions.filter(c => c.severity === 'HIGH').length;

            if (criticalCount > 0) {
                fixedReasoning.push(`🚨 COHERENCE: ${criticalCount} critical contradictions detected`);
            } else if (highCount > 0) {
                fixedReasoning.push(`⚠️ COHERENCE: ${highCount} logical issues auto-fixed`);
            }
        }

        // Final cap
        fixedScore = Math.max(0, Math.min(100, fixedScore));

        const shouldDiscard = contradictions.some(c => c.action === 'DISCARD');

        return {
            isCoherent: contradictions.length === 0,
            contradictions,
            fixedScore,
            fixedReasoning,
            shouldDiscard
        };
    }
}
