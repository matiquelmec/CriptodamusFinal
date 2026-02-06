
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Scanner from '../components/Scanner';
import TradingViewWidget from '../components/TradingViewWidget';
import AIChat from '../components/AIChat';
import SystemAlertsBanner from '../components/SystemAlertsBanner';
import OrderBookHeatmap from '../components/OrderBookHeatmap';

const Dashboard: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const selectedSymbol = searchParams.get('symbol') || "BTC";

    // Auto-select BTC in URL if missing
    React.useEffect(() => {
        if (!searchParams.get('symbol')) {
            setSearchParams({ symbol: "BTC" }, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const handleSelectSymbol = (symbol: string) => {
        // Only update if different to avoid redundant history entries
        if (symbol !== selectedSymbol) {
            setSearchParams({ symbol }, { replace: true });
        }
    };

    return (
        <div className="flex flex-col gap-4 w-full h-full pb-20 lg:pb-0">
            <SystemAlertsBanner />
            <div className="flex flex-col lg:flex-row gap-4 lg:h-full">
                {/* 
         MOBILE LAYOUT STRATEGY: 
         On mobile, items stack. We give fixed heights so they don't collapse.
         The user scrolls the main page to see them.
      */}

                {/* Left Column: Scanner */}
                {/* Mobile: Fixed height (350px) to allow scrolling inside the list without taking full screen. Desktop: Full height sidebar */}
                <div className="h-[350px] lg:h-full lg:w-1/4 flex-shrink-0 flex flex-col gap-4">
                    <div className="flex-1 overflow-hidden h-full rounded-xl shadow-sm">
                        <Scanner onSelectSymbol={handleSelectSymbol} selectedSymbol={selectedSymbol} />
                    </div>
                </div>

                {/* Right Column: Chart & AI & Order Book */}
                {/* Mobile: Stacked below scanner. Desktop: Right column */}
                <div className="flex flex-col gap-4 flex-1 lg:h-full lg:w-3/4 min-h-[800px] lg:min-h-0">
                    {/* Top: Chart & Order Book */}
                    <div className="flex flex-col lg:flex-row h-[65vh] min-h-[550px] lg:h-auto lg:flex-[3] w-full lg:min-h-0 gap-4">
                        {/* Chart (75%) */}
                        <div className="flex-[3] h-full rounded-xl overflow-hidden border border-slate-700/50 shadow-sm">
                            <TradingViewWidget symbol={selectedSymbol} />
                        </div>

                        {/* Order Book (25%) - God Mode Lite */}
                        <div className="hidden lg:block lg:flex-1 h-full rounded-xl overflow-hidden shadow-sm">
                            <OrderBookHeatmap symbol={selectedSymbol} />
                        </div>
                    </div>

                    {/* Bottom: AI */}
                    {/* FIX: Added mb-24 on mobile to force scroll space above the fixed bottom nav */}
                    <div className="h-[500px] lg:flex-[2] w-full lg:min-h-0 mb-24 lg:mb-0">
                        <AIChat selectedSymbol={selectedSymbol} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
