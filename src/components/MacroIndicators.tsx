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

    const volConfig = {
        LOW: { color: 'text-blue-400', icon: '🌊', label: 'LOW' },
        NORMAL: { color: 'text-gray-400', icon: '☁️', label: 'OK' },
        HIGH: { color: 'text-red-400', icon: '⚡', label: 'HIGH' }
    };

    const regime = regimeConfig[macro.btcRegime.regime];
    const btcDomTrend = domConfig[macro.btcDominance.trend];
    const usdtDomTrend = domConfig[macro.usdtDominance.trend];
    const volatility = volConfig[macro.btcRegime.volatilityStatus];

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

            <div className="h-4 w-px bg-border"></div>

            {/* Volatilidad */}
            <div className="flex items-center gap-1" title={`ATR: ${macro.btcRegime.atr.toFixed(0)} USD`}>
                <span className="text-gray-400">VOL:</span>
                <span className={`font-bold ${volatility.color} flex items-center gap-0.5`}>
                    {volatility.icon} {volatility.label}
                </span>
            </div>

            <div className="h-4 w-px bg-border"></div>

            {/* BTC Dominance */}
            <div className="flex items-center gap-1">
                <span className="text-gray-400">BTC.D:</span>
                <span className={`font-bold ${btcDomTrend.color}`}>
                    {macro.btcDominance.current.toFixed(1)}%
                </span>
                <span className="text-xs">{btcDomTrend.icon}</span>
            </div>

            <div className="h-4 w-px bg-border"></div>

            {/* USDT Dominance */}
            <div className="flex items-center gap-1">
                <span className="text-gray-400">USDT.D:</span>
                <span className={`font-bold ${usdtDomTrend.color}`}>
                    {macro.usdtDominance.current.toFixed(1)}%
                </span>
                <span className="text-xs">{usdtDomTrend.icon}</span>
            </div>

            {/* Tooltip */}
            <div className="group relative ml-auto">
                <button className="text-gray-500 hover:text-gray-300">ℹ️</button>
                <div className="absolute top-full right-0 mt-2 hidden group-hover:block w-64 p-3 bg-gray-900 border border-gray-700 rounded shadow-xl z-50">
                    <div className="space-y-2">
                        <div>
                            <span className="text-xs font-bold text-gray-300">Análisis BTC:</span>
                            <p className="text-[10px] text-gray-400 mt-0.5">{macro.btcRegime.reasoning}</p>
                        </div>
                        <div className="border-t border-gray-800 pt-1">
                            <span className="text-xs font-bold text-gray-300">Contexto Macro:</span>
                            <div className="grid grid-cols-2 gap-1 mt-1">
                                <span className="text-[10px] text-gray-400">Volatilidad: <span className={volatility.color}>{macro.btcRegime.volatilityStatus}</span></span>
                                <span className="text-[10px] text-gray-400">USDT.D: <span className={usdtDomTrend.color}>{macro.usdtDominance.trend}</span></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(MacroIndicators);
