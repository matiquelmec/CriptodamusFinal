import React, { useEffect, useState, memo } from 'react';
import { getMacroContext, type MacroContext } from '../services/macroService';

const MacroIndicators: React.FC = () => {
    const [macro, setMacro] = useState<MacroContext | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMacro = async () => {
            try {
                const context = await getMacroContext();
                setMacro(context);
                setLoading(false);
            } catch (error) {
                console.error('[MacroIndicators] Error:', error);
                setLoading(false);
            }
        };

        fetchMacro();
        const interval = setInterval(fetchMacro, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !macro) return null;

    const regimeConfig = {
        BULL: { color: 'text-green-400', bg: 'bg-green-500/10', icon: '📈', label: 'BULL' },
        BEAR: { color: 'text-red-400', bg: 'bg-red-500/10', icon: '📉', label: 'BEAR' },
        RANGE: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: '↔️', label: 'RANGE' }
    };

    const domConfig = {
        RISING: { color: 'text-orange-400', icon: '↗️' },
        FALLING: { color: 'text-blue-400', icon: '↘️' },
        STABLE: { color: 'text-gray-400', icon: '→' }
    };

    const regime = regimeConfig[macro.btcRegime.regime];
    const domTrend = domConfig[macro.btcDominance.trend];

    return (
        <div className="flex items-center gap-3 px-3 py-1.5 bg-surface/50 rounded-lg border border-border/50 text-xs">
            {/* Régimen BTC */}
            <div className={`px-2 py-0.5 rounded ${regime.bg} flex items-center gap-1`}>
                <span className="text-xs">{regime.icon}</span>
                <span className={`font-bold ${regime.color}`}>
                    {regime.label}
                </span>
                <span className="text-gray-500">
                    {macro.btcRegime.strength}%
                </span>
            </div>

            {/* Separador */}
            <div className="h-4 w-px bg-border"></div>

            {/* BTC Dominance */}
            <div className="flex items-center gap-1">
                <span className="text-gray-400">BTC.D:</span>
                <span className={`font-bold ${domTrend.color}`}>
                    {macro.btcDominance.current.toFixed(1)}%
                </span>
                <span className="text-xs">{domTrend.icon}</span>
            </div>

            {/* Tooltip */}
            <div className="group relative ml-auto">
                <button className="text-gray-500 hover:text-gray-300">ℹ️</button>
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-56 p-2 bg-gray-900 border border-gray-700 rounded shadow-xl z-50">
                    <div className="text-[10px] text-gray-400">{macro.btcRegime.reasoning}</div>
                </div>
            </div>
        </div>
    );
};

export default memo(MacroIndicators);
