import React, { useMemo } from 'react';
import { useSocket, RealTimeLiquidation } from '../hooks/useSocket';
import { Shield, Zap, Activity, Droplets } from 'lucide-react';

export const LiquidationFeed: React.FC = () => {
    const { isConnected, liquidations } = useSocket();

    // Memoize formatted liquidations to avoid unnecessary re-renders
    const formattedLiquidations = useMemo(() => {
        return liquidations.map((liq, index) => {
            const isShortLiq = liq.side === 'BUY'; // Short cover = BUY
            const colorClass = isShortLiq ? 'text-green-400' : 'text-red-400';
            const valueFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(liq.usdValue);

            return (
                <div key={`${liq.symbol}-${liq.time}-${index}`} className="flex items-center space-x-2 text-xs mr-6 whitespace-nowrap animate-in fade-in slide-in-from-right-4 duration-500">
                    <span className={`font-bold ${colorClass}`}>
                        {isShortLiq ? '🚀 SHORT REKT' : '🩸 LONG REKT'}
                    </span>
                    <span className="text-gray-300 font-mono">{liq.symbol}</span>
                    <span className="text-gray-400">@ {liq.price}</span>
                    <span className={`font-bold ${colorClass}`}>{valueFormatted}</span>
                </div>
            );
        });
    }, [liquidations]);

    if (!isConnected) return null; // Or show connecting state? Better hide if offline to valid "Live" feel

    return (
        <div className="w-full bg-black/60 border-y border-white/5 backdrop-blur-sm h-10 flex items-center px-4 overflow-hidden relative">
            {/* Status Indicator */}
            <div className="flex items-center mr-4 z-10 bg-black/60 pr-2">
                <div className="relative flex h-2 w-2 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </div>
                <span className="text-[10px] font-bold tracking-wider text-green-500 uppercase">BINANCE LIVE FEED</span>
            </div>

            {/* Scrolling Ticker Mask */}
            <div className="flex-1 overflow-hidden relative">
                <div className="flex absolute animate-marquee hover:pause">
                    {formattedLiquidations}
                    {/* Duplicate for infinite loop effect if needed, but for now live stream is enough */}
                </div>
            </div>

            {/* Gradient Masks */}
            <div className="absolute left-[140px] top-0 bottom-0 w-8 bg-gradient-to-r from-black/60 to-transparent z-10 pointer-events-none"></div>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/60 to-transparent z-10 pointer-events-none"></div>
        </div>
    );
};
