import React from 'react';
import './RotationBadge.css';

interface RotationBadgeProps {
    correlation: number;
    strength?: 'WEAK' | 'MODERATE' | 'STRONG' | 'EXTREME';
}

export function RotationBadge({ correlation, strength }: RotationBadgeProps) {
    if (correlation >= 0.5) {
        return null; // No rotation - no badge
    }

    const getStrength = () => {
        if (strength) return strength;
        if (correlation < 0.2) return 'EXTREME';
        if (correlation < 0.35) return 'STRONG';
        if (correlation < 0.45) return 'MODERATE';
        return 'WEAK';
    };

    const strengthLevel = getStrength();

    return (
        <div className={`rotation-badge ${strengthLevel.toLowerCase()}`} title={`Correlación BTC: ${correlation.toFixed(2)} - Capital rotation ${strengthLevel}`}>
            <span className="badge-icon">🔥</span>
            <span className="badge-text">Rotation</span>
            <span className="badge-value">{correlation.toFixed(2)}</span>
        </div>
    );
}
