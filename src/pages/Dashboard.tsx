
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Scanner from '../components/Scanner';
import TradingViewWidget from '../components/TradingViewWidget';
import AIChat from '../components/AIChat';

const Dashboard: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const symbolParam = searchParams.get('symbol');

    // Local state for immediate responsiveness, but synced with URL
    const [selectedSymbol, setSelectedSymbol] = useState<string>(symbolParam || "BTC");

    // Sync state when URL changes
    useEffect(() => {
        if (symbolParam && symbolParam !== selectedSymbol) {
            setSelectedSymbol(symbolParam);
        }
    }, [symbolParam]);

    const handleSelectSymbol = (symbol: string) => {
        setSelectedSymbol(symbol);
        setSearchParams({ symbol });
    };

    return (
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

            {/* Right Column: Chart & AI */}
            {/* Mobile: Stacked below scanner. Desktop: Right column */}
            <div className="flex flex-col gap-4 flex-1 lg:h-full lg:w-3/4 min-h-[800px] lg:min-h-0">
                {/* Top: Chart */}
                <div className="h-[65vh] min-h-[550px] lg:h-auto lg:flex-[3] w-full lg:min-h-0">
                    <TradingViewWidget symbol={selectedSymbol} />
                </div>
                {/* Bottom: AI */}
                {/* FIX: Added mb-24 on mobile to force scroll space above the fixed bottom nav */}
                <div className="h-[500px] lg:flex-[2] w-full lg:min-h-0 mb-24 lg:mb-0">
                    <AIChat selectedSymbol={selectedSymbol} />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
