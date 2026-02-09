
import React, { useEffect, useState, useRef } from 'react';
import { ArrowDown, ArrowUp, Activity, Layers } from 'lucide-react';
import { API_CONFIG } from '../services/config';

interface OrderLevel {
    price: number;
    qty: number;
    total: number;
}

interface DepthUpdate {
    symbol: string;
    bids: OrderLevel[];
    asks: OrderLevel[];
}

interface OrderBookHeatmapProps {
    symbol: string;
}

const OrderBookHeatmap: React.FC<OrderBookHeatmapProps> = ({ symbol }) => {
    const [bids, setBids] = useState<OrderLevel[]>([]);
    const [asks, setAsks] = useState<OrderLevel[]>([]);
    const [maxVol, setMaxVol] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(true);
    const wsRef = useRef<WebSocket | null>(null);

    // Initial Load
    useEffect(() => {
        setLoading(true);
        // Fetch snapshot
        // Note: Production logic would fetch /api/market/depth/:symbol
        // keeping it simple with WS waiting for now or mock data initial state

        const fetchSnapshot = async () => {
            try {
                // Use centralized config
                const res = await fetch(`${API_CONFIG.BASE_URL}/api/market/depth/${symbol}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.bids) {
                        processDepth(data);
                        setLoading(false);
                    }
                }
            } catch (e) {
                console.warn("Failed to load depth snapshot", e);
            }
        };

        fetchSnapshot();

        // WebSocket Subscription would be handled by a global context usually,
        // but for this isolated component we can listen if we have access to the global socket
        // OR we just poll/wait for the global event dispatch if receiving via window/context.
        // Assuming global socket dispatch custom events for standard usage:

        const handleDepthUpdate = (e: CustomEvent<DepthUpdate>) => {
            if (e.detail.symbol.toUpperCase() === symbol.toUpperCase()) {
                processDepth(e.detail);
                setLoading(false);
            }
        };

        window.addEventListener('depth_update', handleDepthUpdate as EventListener);

        return () => {
            window.removeEventListener('depth_update', handleDepthUpdate as EventListener);
        };
    }, [symbol]);

    const processDepth = (data: { bids: any[], asks: any[] }) => {
        // Normalize data
        const newBids = data.bids.slice(0, 15).map((l: any) => ({ price: l.price || l[0], qty: l.qty || l[1], total: (l.price || l[0]) * (l.qty || l[1]) }));
        const newAsks = data.asks.slice(0, 15).map((l: any) => ({ price: l.price || l[0], qty: l.qty || l[1], total: (l.price || l[0]) * (l.qty || l[1]) }));

        // Find max volume for relative bars
        const maxB = Math.max(...newBids.map(b => b.total));
        const maxA = Math.max(...newAsks.map(a => a.total));
        setMaxVol(Math.max(maxB, maxA, 1)); // Ensure no div by zero

        setBids(newBids);
        setAsks(newAsks.reverse()); // Asks usually displayed ascending from bottom up or top down?
        // Standard: Asks on top (descending price?), Bids on bottom.
        // List:
        // Ask High
        // Ask Low
        // --- Spread ---
        // Bid High
        // Bid Low
    };

    if (loading && bids.length === 0) {
        return (
            <div className="bg-slate-900/50 rounded-xl p-4 h-full flex items-center justify-center animate-pulse">
                <div className="text-gray-500 flex gap-2"><Layers size={18} /> Loading Order Book...</div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden flex flex-col h-full shadow-lg">
            {/* Header */}
            <div className="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                <div className="flex items-center gap-2">
                    <Layers className="text-blue-400" size={18} />
                    <span className="font-bold text-slate-100 text-sm">Order Book (Depth)</span>
                </div>
                <div className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">Live</div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto font-mono text-xs relative">

                {/* Asks (Sell Walls) - Red */}
                <div className="flex flex-col-reverse">
                    {/* Render in reverse so lowest Ask is at bottom, just above Bids */}
                    {asks.map((ask, i) => (
                        <div key={`ask-${i}`} className="flex justify-between items-center px-2 py-0.5 relative group">
                            {/* Volume Bar Background */}
                            <div
                                className="absolute right-0 top-0 bottom-0 bg-red-500/10 transition-all duration-300"
                                style={{ width: `${(ask.total / maxVol) * 100}%` }}
                            />
                            {/* High Volume Highlight */}
                            {ask.total > maxVol * 0.7 && (
                                <div className="absolute inset-0 border-r-2 border-red-500 opacity-50"></div>
                            )}

                            <span className="text-red-400 z-10">{ask.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <span className="text-slate-400 z-10">{formatCompactNumber(ask.total)}</span>
                        </div>
                    ))}
                </div>

                {/* Spread / Current Price Indicator */}
                <div className="bg-slate-800 py-1 text-center text-xs text-slate-500 font-semibold border-y border-slate-700/50 my-1">
                    SPREAD
                </div>

                {/* Bids (Buy Walls) - Green */}
                <div className="flex flex-col">
                    {bids.map((bid, i) => (
                        <div key={`bid-${i}`} className="flex justify-between items-center px-2 py-0.5 relative group">
                            {/* Volume Bar Background */}
                            <div
                                className="absolute right-0 top-0 bottom-0 bg-green-500/10 transition-all duration-300"
                                style={{ width: `${(bid.total / maxVol) * 100}%` }}
                            />
                            {/* High Volume Highlight */}
                            {bid.total > maxVol * 0.7 && (
                                <div className="absolute inset-0 border-r-2 border-green-500 opacity-50"></div>
                            )}

                            <span className="text-green-400 z-10">{bid.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <span className="text-slate-400 z-10">{formatCompactNumber(bid.total)}</span>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
};

// Helper
function formatCompactNumber(number: number) {
    return Intl.NumberFormat('en-US', {
        notation: "compact",
        maximumFractionDigits: 1
    }).format(number);
}

export default OrderBookHeatmap;
