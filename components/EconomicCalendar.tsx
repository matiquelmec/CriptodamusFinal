
import React, { useEffect, useRef, memo } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

const EconomicCalendar: React.FC = () => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (container.current) {
        container.current.innerHTML = '';
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
    script.type = "text/javascript";
    script.async = true;

    script.innerHTML = JSON.stringify({
      "colorTheme": "dark",
      "isTransparent": false, // False ensures we control the background via CSS properly or let widget enforce its own
      "width": "100%",
      "height": "100%",
      "locale": "es",
      "currencyFilter": "USD,EUR,GBP", // Focus on major currencies affecting crypto
      "container_id": "tradingview_calendar"
    });

    if (container.current) {
        container.current.appendChild(script);
    }
  }, []);

  return (
    <div className="h-full flex flex-col gap-4">
        {/* Volatility Warning Banner */}
        <div className="bg-surface border border-warning/20 rounded-xl p-4 flex items-start gap-3 shadow-sm">
            <div className="p-2 bg-warning/10 rounded-full text-warning flex-shrink-0">
                <AlertTriangle size={20} />
            </div>
            <div>
                <h3 className="text-sm font-mono font-bold text-primary mb-1">Monitor de Volatilidad Macro</h3>
                <p className="text-xs text-secondary leading-relaxed">
                    Las noticias de <span className="text-warning font-bold">3 Estrellas (Alta Importancia)</span> como el IPC (CPI), Tasas de Interés (FED) o NFP pueden invalidar el análisis técnico momentáneamente.
                    <br />
                    <span className="text-accent mt-1 block font-mono">
                        Regla del Sistema: NO abrir nuevas operaciones 30 minutos antes ni después de noticias de alto impacto.
                    </span>
                </p>
            </div>
        </div>

        {/* Widget Container - Using specific hex color #131722 to match TradingView native dark theme for best contrast */}
        <div className="flex-1 bg-[#131722] border border-border rounded-xl overflow-hidden shadow-sm relative">
            <div className="tradingview-widget-container h-full w-full" ref={container}>
                <div className="tradingview-widget-container__widget h-full w-full"></div>
            </div>
        </div>
    </div>
  );
};

export default memo(EconomicCalendar);
