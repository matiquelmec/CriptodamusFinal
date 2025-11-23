import React, { useEffect, useRef, memo } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
}

const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({ symbol }) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Clean up previous script if it exists to prevent duplicates on re-render
    if (container.current) {
        container.current.innerHTML = '';
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;

    // Map common symbols to Binance USDT pairs
    // Input format from scanner is usually "BTC" or "ETH"
    const formattedSymbol = `BINANCE:${symbol.replace('/USDT', '')}USDT`;

    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": formattedSymbol,
      "interval": "15", // Default to 15m as per PDF strategy
      "timezone": "Etc/UTC",
      "theme": "dark",
      "style": "1", // Candles
      "locale": "es", // Spanish for consistency
      "enable_publishing": false,
      "backgroundColor": "rgba(9, 9, 11, 1)", // Match app background #09090b
      "gridColor": "rgba(39, 39, 42, 0.5)",
      "hide_top_toolbar": false,
      "hide_legend": false,
      "save_image": false,
      "calendar": false,
      "hide_volume": false,
      "studies": [
        "BB@tv-basicstudies",     // Bandas de Bollinger (Volatilidad)
        "RSI@tv-basicstudies",    // RSI (Momento)
        "MACD@tv-basicstudies",   // MACD (Tendencia)
        // Agregamos 4 EMAs explícitas para que el usuario las configure (20, 50, 100, 200)
        "MAExp@tv-basicstudies",
        "MAExp@tv-basicstudies",
        "MAExp@tv-basicstudies",
        "MAExp@tv-basicstudies"
      ],
      "support_host": "https://www.tradingview.com"
    });

    if (container.current) {
        container.current.appendChild(script);
    }
  }, [symbol]);

  return (
    <div className="h-full w-full bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex flex-col">
      <div className="tradingview-widget-container h-full w-full" ref={container}>
        <div className="tradingview-widget-container__widget h-[calc(100%_-_32px)] w-full"></div>
      </div>
    </div>
  );
};

export default memo(TradingViewWidget);