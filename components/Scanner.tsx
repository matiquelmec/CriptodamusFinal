
import React, { useEffect, useState, useRef, memo } from 'react';
import { Activity, RefreshCw, WifiOff, BarChart3, Rocket, Search } from 'lucide-react';
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
  const [scanMode, setScanMode] = useState<'volume' | 'memes'>('volume');
  const [searchQuery, setSearchQuery] = useState('');

  const loadInitialData = async () => {
    setLoading(true);
    setWsConnected(false); // Reset WS status while loading new data
    try {
      const data = await fetchCryptoData(scanMode);
      if (data.length > 0) {
        setMarketData(data);
        setError(false);
      } else {
        setError(true);
      }
    } catch (e) {
      setError(true);
    }
    setLoading(false);
  };

  // Reload when mode changes
  useEffect(() => {
    loadInitialData();
  }, [scanMode]);

  // WebSocket Logic
  useEffect(() => {
    if (marketData.length === 0 || error) return;

    const unsubscribe = subscribeToLivePrices(marketData, (liveData) => {
      setWsConnected(true);

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
  }, [marketData.length, error]); // Re-connect when data (mode) changes

  const filteredData = marketData.filter(item =>
    item.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full overflow-hidden bg-surface border border-border rounded-xl shadow-sm flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-border flex flex-col gap-3 bg-background/50 backdrop-blur-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-accent" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wide">
              Scanner
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

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-secondary" size={12} />
          <input
            type="text"
            placeholder="Buscar moneda..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-md pl-7 pr-2 py-1.5 text-xs font-mono text-primary focus:outline-none focus:border-accent placeholder:text-secondary/50"
          />
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-background border border-border rounded-lg p-0.5">
          <button
            onClick={() => setScanMode('volume')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] font-mono uppercase rounded-md transition-all ${scanMode === 'volume' ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'
              }`}
          >
            <BarChart3 size={12} /> Top Vol
          </button>
          <button
            onClick={() => setScanMode('memes')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] font-mono uppercase rounded-md transition-all ${scanMode === 'memes' ? 'bg-surface text-pink-400 shadow-sm' : 'text-secondary hover:text-pink-400'
              }`}
          >
            <Rocket size={12} /> Memes
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 relative custom-scrollbar">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-secondary gap-2 bg-surface/50 backdrop-blur-sm z-10">
            <RefreshCw className="animate-spin" />
            <span className="text-xs font-mono">Cargando {scanMode}...</span>
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
              {filteredData.length > 0 ? (
                filteredData.map((item) => {
                  const rawSymbol = item.symbol.split('/')[0];
                  const isSelected = selectedSymbol === rawSymbol;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => onSelectSymbol(rawSymbol)}
                      className={`border-b border-border/40 transition-colors cursor-pointer group ${isSelected
                          ? 'bg-accent/10'
                          : 'hover:bg-white/5'
                        }`}
                    >
                      <td className="p-2 pl-3">
                        <div className="flex flex-col">
                          <span className={`font-mono font-bold text-xs ${isSelected
                              ? 'text-accent'
                              : scanMode === 'memes' ? 'text-pink-400' : 'text-primary'
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
                })
              ) : (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-xs text-secondary font-mono">
                    No se encontraron resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Scanner;
