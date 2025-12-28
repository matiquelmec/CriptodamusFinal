/**
 * STRATEGY SELECTOR
 * 
 * Autonomous strategy selection engine that weights and combines
 * multiple strategies based on detected market regime.
 * 
 * This eliminates manual strategy selection and enables true autonomy.
 */

import {
    StrategySelection,
    StrategyWeight,
    MarketRegime,
    MarketRegimeType
} from '../types/types-advanced';
import { STRATEGIES } from './strategyContext';
import { TradingConfig } from '../config/tradingConfig';

/**
 * Select and weight strategies based on market regime
 */
export function selectStrategies(regime: MarketRegime): StrategySelection {
    const weights = getStrategyWeights(regime.regime, regime.metrics.emaAlignment);
    const activeStrategies = buildActiveStrategies(weights, regime);
    const disabledStrategies = getDisabledStrategies(weights);
    const totalWeight = activeStrategies.reduce((sum, s) => sum + s.weight, 0);

    return {
        activeStrategies,
        disabledStrategies,
        regimeJustification: regime.reasoning,
        totalWeight
    };
}

/**
 * Define strategy weights for each regime
 */
function getStrategyWeights(regime: MarketRegimeType, trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'): Record<string, number> {
    // 1. Try to get weights from Central Config
    const configWeights = TradingConfig.strategy_matrix[regime];

    if (configWeights) {
        return configWeights;
    }

    // 2. Fallback: Balanced approach (if regime is undefined/unknown)
    return {
        'smc_liquidity': 0.50,
        'quant_volatility': 0.30,
        'ichimoku_dragon': 0.20,
        'mean_reversion': 0.00,
        'breakout_momentum': 0.00,
        'meme_hunter': 0.00,
        'divergence_hunter': 0.00
    };
}

/**
 * Build active strategies with reasoning
 */
function buildActiveStrategies(
    weights: Record<string, number>,
    regime: MarketRegime
): StrategyWeight[] {
    const active: StrategyWeight[] = [];

    for (const [strategyId, weight] of Object.entries(weights)) {
        if (weight > 0) {
            const strategy = STRATEGIES.find(s => s.id === strategyId);
            if (strategy) {
                active.push({
                    id: strategyId,
                    name: strategy.name,
                    weight,
                    reason: getStrategyReason(strategyId, regime.regime, weight)
                });
            }
        }
    }

    // Sort by weight (highest first)
    return active.sort((a, b) => b.weight - a.weight);
}

/**
 * Get disabled strategies
 */
function getDisabledStrategies(weights: Record<string, number>): string[] {
    return Object.entries(weights)
        .filter(([_, weight]) => weight === 0)
        .map(([id, _]) => id);
}

/**
 * Generate human-readable reason for strategy selection
 */
function getStrategyReason(strategyId: string, regime: MarketRegimeType, weight: number): string {
    const percentage = (weight * 100).toFixed(0);

    const reasons: Record<string, Record<MarketRegimeType, string>> = {
        'ichimoku_dragon': {
            'TRENDING': `${percentage}% - Ichimoku es óptimo para tendencias claras y sostenidas`,
            'RANGING': 'Desactivado - Requiere tendencia direccional',
            'VOLATILE': 'Desactivado - Necesita estabilidad para señales válidas',
            'EXTREME': 'Desactivado - Tendencia poco clara en extremos'
        },
        'breakout_momentum': {
            'TRENDING': `${percentage}% - Captura aceleraciones dentro de la tendencia`,
            'RANGING': 'Desactivado - Alto riesgo de falsos breakouts en rangos',
            'VOLATILE': `${percentage}% - Ideal para capturar expansiones explosivas`,
            'EXTREME': 'Desactivado - Se espera reversión, no continuación'
        },
        'smc_liquidity': {
            'TRENDING': `${percentage}% - Order Blocks marcan niveles institucionales`,
            'RANGING': `${percentage}% - Excelente para detectar zonas de acumulación`,
            'VOLATILE': 'Desactivado - Demasiado caótico para niveles precisos',
            'EXTREME': `${percentage}% - Liquidity sweeps comunes en extremos`
        },
        'quant_volatility': {
            'TRENDING': `${percentage}% - Detecta momentum dentro de la tendencia`,
            'RANGING': `${percentage}% - Identifica compresiones pre-expansión`,
            'VOLATILE': `${percentage}% - Estrategia principal para volatilidad`,
            'EXTREME': 'Desactivado - No es fase de expansión'
        },
        'mean_reversion': {
            'TRENDING': 'Desactivado - Operar contra tendencia es suicida',
            'RANGING': `${percentage}% - Estrategia principal para rangos`,
            'VOLATILE': 'Desactivado - Peligroso en alta volatilidad',
            'EXTREME': `${percentage}% - Rebotes técnicos en sobreventa/sobrecompra`
        },
        'meme_hunter': {
            'TRENDING': 'Desactivado - Requiere pumps explosivos, no tendencias',
            'RANGING': 'Desactivado - Necesita volumen anormal',
            'VOLATILE': `${percentage}% - Memecoins prosperan en volatilidad`,
            'EXTREME': 'Desactivado - Demasiado arriesgado en extremos'
        },
        'divergence_hunter': {
            'TRENDING': 'Desactivado - Busca reversiones, no continuaciones',
            'RANGING': 'Desactivado - Divergencias poco confiables en rangos',
            'VOLATILE': 'Desactivado - Señales poco claras en caos',
            'EXTREME': `${percentage}% - Estrategia principal para reversiones`
        }
    };

    return reasons[strategyId]?.[regime] || `${percentage}% - Activa`;
}

/**
 * Get strategy weight by ID (for external use)
 */
export function getStrategyWeight(strategyId: string, regime: MarketRegime): number {
    const weights = getStrategyWeights(regime.regime, regime.metrics.emaAlignment);
    return weights[strategyId] || 0;
}

/**
 * Check if strategy should be active
 */
export function isStrategyActive(strategyId: string, regime: MarketRegime): boolean {
    return getStrategyWeight(strategyId, regime) > 0;
}
