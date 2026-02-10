import React, { useState } from 'react';
import { useMarketIntelligence } from '../hooks/useMarketIntelligence';
import './MarketIntelligencePanel.css';

export function MarketIntelligencePanel() {
    const { intelligence, loading, error } = useMarketIntelligence(60000);
    const [isCollapsed, setIsCollapsed] = useState(false);

    if (loading && !intelligence) {
        return (
            <div className="market-intelligence-panel loading">
                <div className="panel-header">
                    <span>📊 MARKET INTELLIGENCE</span>
                    <span className="loading-spinner">⟳</span>
                </div>
            </div>
        );
    }

    if (error || !intelligence) {
        return null; // Fail silently
    }

    const getStateIcon = (state: string) => {
        switch (state) {
            case 'rotation_active': return '🔥';
            case 'systemic_risk': return '⚠️';
            case 'pre_signal': return '🟡';
            case 'lateral': return '📉';
            default: return '✅';
        }
    };

    const getStateLabel = (state: string) => {
        switch (state) {
            case 'rotation_active': return 'ROTACIONES ACTIVAS';
            case 'systemic_risk': return 'RIESGO SISTÉMICO';
            case 'pre_signal': return 'ROTACIÓN EMERGIENDO';
            case 'lateral': return 'MERCADO LATERAL';
            default: return 'MERCADO SALUDABLE';
        }
    };

    return (
        <div className={`market-intelligence-panel ${intelligence.state} ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="panel-header" onClick={() => setIsCollapsed(!isCollapsed)}>
                <div className="header-left">
                    <span className="state-icon">{getStateIcon(intelligence.state)}</span>
                    <span className="state-label">{getStateLabel(intelligence.state)}</span>
                    {intelligence.rotations.length > 0 && !isCollapsed && (
                        <span className="rotation-count">
                            • {intelligence.rotations.slice(0, 3).map(r => r.asset.replace('USDT', '')).join(' • ')}
                        </span>
                    )}
                </div>
                <div className="header-right">
                    <span className="timestamp">
                        hace {Math.round((Date.now() - intelligence.timestamp) / 60000)}min
                    </span>
                    <button className="collapse-btn" aria-label={isCollapsed ? 'Expand' : 'Collapse'}>
                        {isCollapsed ? '▼' : '▲'}
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <div className="panel-content">
                    {/* Resumen Ejecutivo */}
                    <div className="summary-section">
                        <p className="summary-text">{intelligence.summary}</p>
                    </div>

                    {/* Rotaciones Detectadas */}
                    {intelligence.rotations.length > 0 && (
                        <div className="rotations-section">
                            <h4>Rotaciones Detectadas:</h4>
                            <div className="rotation-list">
                                {intelligence.rotations.map((rot, idx) => (
                                    <div key={idx} className={`rotation-item ${rot.strength.toLowerCase()}`}>
                                        <span className="asset-name">{rot.asset.replace('USDT', '')}</span>
                                        <span className="correlation">corr: {rot.correlation.toFixed(2)}</span>
                                        <span className={`strength-badge ${rot.strength.toLowerCase()}`}>
                                            {rot.strength}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Alertas */}
                    {intelligence.alerts.length > 0 && (
                        <div className="alerts-section">
                            {intelligence.alerts.map((alert, idx) => (
                                <div key={idx} className="alert-item">
                                    {alert}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Recomendación */}
                    <div className="recommendation-section">
                        <p className="recommendation-icon">💡</p>
                        <p className="recommendation-text">{intelligence.recommendation}</p>
                    </div>

                    {/* Métricas Rápidas */}
                    <div className="metrics-section">
                        <div className="metric">
                            <span className="metric-label">Pares Alta Corr:</span>
                            <span className="metric-value">
                                {intelligence.metrics.highCorrPairs}/{intelligence.metrics.totalPairs}
                            </span>
                        </div>
                        <div className="metric">
                            <span className="metric-label">Corr. Promedio:</span>
                            <span className="metric-value">
                                {(intelligence.metrics.avgCorrelation * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
