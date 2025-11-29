import React, { useEffect, useState, memo } from 'react';
import { getMacroContext, type MacroContext } from '../services/macroService';

const MacroStrip: React.FC = () => {
  const [macro, setMacro] = useState<MacroContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch inicial
    const fetchMacro = async () => {
      try {
        const context = await getMacroContext();
        setMacro(context);
        setLoading(false);
      } catch (error) {
        console.error('[MacroStrip] Error fetching macro context:', error);
        setLoading(false);
      }
    };

    fetchMacro();

    // Refresh cada 5 minutos
    const interval = setInterval(fetchMacro, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="w-full h-12 bg-[#09090b] border-t border-border flex items-center justify-center">
        <div className="text-xs text-gray-500">Cargando datos macro...</div>
      </div>
    );
  }

  if (!macro) {
    return (
      <div className="w-full h-12 bg-[#09090b] border-t border-border flex items-center justify-center">
        <div className="text-xs text-gray-500">Datos macro no disponibles</div>
      </div>
    );
  }

  // Colores según régimen
  const regimeConfig = {
    BULL: {
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      icon: '📈',
      label: 'BULL'
    },
    BEAR: {
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      icon: '📉',
      label: 'BEAR'
    },
    RANGE: {
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      icon: '↔️',
      label: 'RANGE'
    }
  };

  // Colores según dominancia
  const domConfig = {
    RISING: {
      color: 'text-orange-400',
      icon: '↗️',
      label: 'Subiendo'
    },
    FALLING: {
      color: 'text-blue-400',
      icon: '↘️',
      label: 'Bajando'
    },
    STABLE: {
      color: 'text-gray-400',
      icon: '→',
      label: 'Estable'
    }
  };

  const regime = regimeConfig[macro.btcRegime.regime];
  const domTrend = domConfig[macro.btcDominance.trend];

  return (
    <div className="w-full h-12 bg-[#09090b] border-t border-border flex items-center px-4 gap-6 overflow-x-auto">
      {/* Título */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-400">MERCADO:</span>
      </div>

      {/* Régimen BTC */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className={`px-2 py-1 rounded ${regime.bg} flex items-center gap-1.5`}>
          <span className="text-sm">{regime.icon}</span>
          <span className={`text-xs font-bold ${regime.color}`}>
            BTC {regime.label}
          </span>
          <span className="text-xs text-gray-500">
            ({macro.btcRegime.strength}%)
          </span>
        </div>
      </div>

      {/* Separador */}
      <div className="h-6 w-px bg-border flex-shrink-0"></div>

      {/* BTC Dominance */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-gray-400">BTC.D:</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold ${domTrend.color}`}>
            {macro.btcDominance.current.toFixed(1)}%
          </span>
          <span className="text-xs">{domTrend.icon}</span>
          <span className={`text-xs ${domTrend.color}`}>
            {domTrend.label}
          </span>
        </div>
      </div>

      {/* Separador */}
      <div className="h-6 w-px bg-border flex-shrink-0"></div>

      {/* Precio BTC */}
      {macro.btcRegime.currentPrice > 0 && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400">BTC:</span>
          <span className="text-xs font-semibold text-white">
            ${macro.btcRegime.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}

      {/* Separador */}
      {macro.btcRegime.currentPrice > 0 && (
        <div className="h-6 w-px bg-border flex-shrink-0"></div>
      )}

      {/* EMAs */}
      <div className="flex items-center gap-3 flex-shrink-0 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-gray-500">EMA50:</span>
          <span className="text-gray-300 font-mono">
            ${macro.btcRegime.ema50.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">EMA200:</span>
          <span className="text-gray-300 font-mono">
            ${macro.btcRegime.ema200.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Indicador de frescura */}
      {macro.isStale && (
        <>
          <div className="h-6 w-px bg-border flex-shrink-0"></div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xs text-yellow-500">⚠️ Datos antiguos</span>
          </div>
        </>
      )}

      {/* Tooltip con razonamiento */}
      <div className="ml-auto flex-shrink-0">
        <div className="group relative">
          <button className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            ℹ️
          </button>
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
            <div className="text-xs text-gray-300">
              <div className="font-semibold mb-1">Análisis:</div>
              <div className="text-gray-400">{macro.btcRegime.reasoning}</div>
              <div className="mt-2 pt-2 border-t border-gray-700 text-[10px] text-gray-500">
                Actualizado: {new Date(macro.timestamp).toLocaleTimeString('es-ES')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(MacroStrip);