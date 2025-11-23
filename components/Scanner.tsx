import React, { useEffect, useState, useRef, memo } from 'react';
import { Activity, RefreshCw, WifiOff, Radio, Clock, Zap, BarChart3, HelpCircle } from 'lucide-react';
import { MarketData } from '../types';
import { fetchCryptoData, subscribeToLivePrices } from '../services/cryptoService';

interface ScannerProps {
  onSelectSymbol: (symbol: string) => void;
  selectedSymbol: string;
}

// Sub-component to handle individual price updates
const PriceCell = memo(({ price }: { price: number }) => {
  const prevPriceRef = useRef(price);
  const [colorClass, setColorClass] = useState('text-primary');

  useEffect(() => {
    if (price > prevPriceRef.current) {
      setColorClass('text-success font-bold');
      const timer = setTimeout(() => setColorClass('text-primary transition-colors duration-500'), 600);
      return () => clearTimeout(timer);
    } else if (price < prevPriceRef.current) {
      setColorClass('text-danger font-bold');
      const timer = setTimeout(() => setColorClass('text-primary transition-colors duration-500'), 600);
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = price;
  }, [price]);

  return (
    <span className={`font-mono text-sm tracking-tight ${colorClass}`}>
      ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
    </span>
  );
});

const Scanner: React.FC<ScannerProps> = ({ onSelectSymbol, selectedSymbol }) => {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastTickTime, setLastTickTime] = useState<Date | null>(null);
  
  // New State: Scanner Mode
  const [mode, setMode] = useState<'volume' | 'memes'>('volume');

  const loadInitialData = async () => {
    setLoading(true);
    // Pass mode to service
    const data = await fetchCryptoData(mode);
    if (data.length > 0) {
      setMarketData(data);
      setError(false);
      // Optional: Auto-select first only if nothing is selected or if switching modes drastically
      // But preserving user selection is usually better UX unless invalid
    } else {
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadInitialData();
  }, [mode]); // Reload when mode changes

  // WebSocket Logic
  useEffect(() => {
    if (marketData.length === 0 || error) return;

    // Fixed: subscribeToLivePrices expects MarketData[], not string[]
    const unsubscribe = subscribeToLivePrices(marketData, (liveData) => {
      setWsConnected(true);
      setLastTickTime(new Date());
      
      setMarketData(currentData => {
        let hasChanges = false;
        const newData = currentData.map(item => {
          if (liveData[item.symbol]) {
            const newPrice = liveData[item.symbol];
            if (newPrice !== item.price) {
              hasChanges = true;
              return { ...item, price: newPrice };
            }
          }
          return item;
        });
        return hasChanges ? newData : currentData;
      });
    });

    return () => {
      unsubscribe();
      setWsConnected(false);
    };
  }, [marketData.length, error]); 

  return (
    <div className="h-full overflow-hidden bg-surface border border-border rounded-xl shadow-sm flex flex-col">
      {/* Enhanced Header with Toggles */}
      <div className="p-3 border-b border-border flex flex-col gap-3 bg-background/50 backdrop-blur-sm">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Activity size={16} className={mode === 'memes' ? 'text-pink-500' : 'text-accent'} />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wide">
                    {mode === 'memes' ? 'Meme Hunter' : 'Volumen Pro'}
                </h2>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                    {wsConnected ? (
                        <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                        </span>
                    ) : (
                        <span className="h-2 w-2 rounded-full bg-danger"></span>
                    )}
                    <span className="text-[10px] font-mono text-secondary uppercase">LIVE</span>
                </div>
            </div>
        </div>

        {/* Toggle Buttons */}
        <div className="flex p-1 bg-background border border-border rounded-lg">
            <button 
                onClick={() => setMode('volume')}
                title="Top 50 monedas por volumen 24h"
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] font-mono uppercase rounded transition-all ${
                    mode === 'volume' 
                    ? 'bg-accent/10 text-accent font-bold shadow-sm' 
                    : 'text-secondary hover:text-primary'
                }`}
            >
                <BarChart3 size={12} /> Top Vol
            </button>
            <div className="w-px bg-border mx-1 my-1"></div>
            <button 
                onClick={() => setMode('memes')}
                title="Top Memes seleccionados ordenados por volumen"
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] font-mono uppercase rounded transition-all ${
                    mode === 'memes' 
                    ? 'bg-pink-500/10 text-pink-500 font-bold shadow-sm' 
                    : 'text-secondary hover:text-primary'
                }`}
            >
                <Zap size={12} /> Memes
            </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 relative custom-scrollbar">
        {loading && marketData.length === 0 ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center text-secondary gap-2">
              <RefreshCw className="animate-spin" />
              <span className="text-xs font-mono">Cargando {mode}...</span>
           </div>
        ) : error && marketData.length === 0 ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center text-secondary gap-4 p-4 text-center">
              <WifiOff size={24} className="text-danger opacity-50" />
              <p className="text-xs font-mono text-danger">Sin datos</p>
              <button onClick={loadInitialData} className="px-3 py-1 bg-border rounded text-xs font-mono">Reintentar</button>
           </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-background sticky top-0 z-10 shadow-sm text-[10px] uppercase font-mono text-secondary">
              <tr>
                <th className="p-2 font-medium">Activo</th>
                <th className="p-2 text-right font-medium">Precio</th>
                <th className="p-2 text-right font-medium">24h</th>
              </tr>
            </thead>
            <tbody>
              {marketData.map((item) => {
                const rawSymbol = item.symbol.split('/')[0];
                const isSelected = selectedSymbol === rawSymbol;
                
                return (
                  <tr 
                    key={item.id} 
                    onClick={() => onSelectSymbol(rawSymbol)}
                    className={`border-b border-border/40 transition-colors cursor-pointer group ${
                        isSelected 
                            ? mode === 'memes' ? 'bg-pink-500/10' : 'bg-accent/10' 
                            : 'hover:bg-white/5'
                    }`}
                  >
                    <td className="p-2 pl-3">
                      <div className="flex flex-col">
                          <span className={`font-mono font-bold text-xs ${
                              isSelected 
                                ? mode === 'memes' ? 'text-pink-500' : 'text-accent' 
                                : 'text-primary'
                          }`}>
                              {rawSymbol}
                          </span>
                          <span className="text-[9px] text-secondary">USDT</span>
                      </div>
                    </td>
                    <td className="p-2 text-right">
                       <PriceCell price={item.price} />
                    </td>
                    <td className={`p-2 text-right font-mono text-xs ${item.change24h >= 0 ? 'text-success' : 'text-danger'}`}>
                      {item.change24h > 0 ? '+' : ''}{item.change24h.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Scanner;