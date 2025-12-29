
import React, { useState } from 'react';
import { LayoutDashboard, Settings, BarChart, CalendarDays, Zap } from 'lucide-react';
import Scanner from './components/Scanner';
import AIChat from './components/AIChat';
import TradingViewWidget from './components/TradingViewWidget';
import MacroStrip from './components/MacroStrip';
import MacroIndicators from './components/MacroIndicators';
import EconomicCalendar from './components/EconomicCalendar';
import OpportunityFinder from './components/OpportunityFinder';

import { TabView } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabView>(TabView.DASHBOARD);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("BTC");

  const handleSelectOpportunity = (symbol: string) => {
    setSelectedSymbol(symbol);
    setActiveTab(TabView.DASHBOARD);
  };

  const renderContent = () => {
    switch (activeTab) {
      case TabView.DASHBOARD:
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
                <Scanner onSelectSymbol={setSelectedSymbol} selectedSymbol={selectedSymbol} />
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
      case TabView.OPPORTUNITIES:
        return <div className="h-full min-h-[600px] mb-24 lg:mb-0"><OpportunityFinder onSelectOpportunity={handleSelectOpportunity} /></div>;
      case TabView.CALENDAR:
        return <div className="h-full min-h-[600px] mb-24 lg:mb-0"><EconomicCalendar /></div>;

      default:
        return <div className="flex items-center justify-center h-full text-secondary font-mono">Vista en desarrollo</div>;
    }
  };

  return (
    // Use 100dvh for better mobile browser support (address bar handling)
    <div className="h-[100dvh] bg-background text-primary font-sans selection:bg-accent/30 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md flex-shrink-0 z-50 sticky top-0">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab(TabView.DASHBOARD)}>
            {/* Criptodamus Logo - Creative Integration */}
            <div className="relative h-12 w-48 flex items-center justify-start transition-all duration-300 group-hover:scale-105 group-hover:brightness-110">
              {/* Glow effect behind the logo */}
              <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <img
                src="/logo.png"
                alt="Criptodamus"
                className="w-full h-full object-contain object-left relative z-10 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]"
              />
            </div>
          </div>

          {/* Macro Indicators - Desktop only */}
          <div className="hidden lg:block">
            <MacroIndicators />
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 p-1 bg-surface border border-border rounded-lg">
            <button
              onClick={() => setActiveTab(TabView.DASHBOARD)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all ${activeTab === TabView.DASHBOARD ? 'bg-border text-white shadow-sm' : 'text-secondary hover:text-primary'}`}
            >
              <LayoutDashboard size={14} /> Terminal
            </button>
            <button
              onClick={() => setActiveTab(TabView.OPPORTUNITIES)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all ${activeTab === TabView.OPPORTUNITIES ? 'bg-border text-white shadow-sm' : 'text-secondary hover:text-primary'}`}
            >
              <Zap size={14} /> Oportunidades
            </button>
            <button
              onClick={() => setActiveTab(TabView.CALENDAR)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all ${activeTab === TabView.CALENDAR ? 'bg-border text-white shadow-sm' : 'text-secondary hover:text-primary'}`}
            >
              <CalendarDays size={14} /> Eventos
            </button>
          </nav>


        </div>
      </header>

      {/* Main Content Area */}
      {/* 
         On Mobile: overflow-y-auto allows the whole page content (Scanner + Chart + Chat) to scroll properly.
         pb-48 (192px) ensures extra space at the bottom so the last element (Chat) isn't hidden behind the fixed bottom nav.
         On Desktop (lg): overflow-hidden keeps the layout rigid/dashboard-like.
      */}
      <main className="flex-1 overflow-y-auto lg:overflow-hidden p-4 container mx-auto pb-48 lg:pb-4">
        {renderContent()}
      </main>

      {/* Macro Strip Footer - Hidden on mobile to save space, visible on desktop */}
      <div className="hidden lg:block">
        <MacroStrip />
      </div>

      {/* Mobile Nav - Fixed Bottom */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur border-t border-border flex justify-around p-3 pb-safe z-50 shadow-2xl">
        <button onClick={() => setActiveTab(TabView.DASHBOARD)} className={`flex flex-col items-center gap-1 ${activeTab === TabView.DASHBOARD ? 'text-accent' : 'text-secondary'}`}>
          <BarChart size={20} />
          <span className="text-[10px] font-medium">Trade</span>
        </button>
        <button onClick={() => setActiveTab(TabView.OPPORTUNITIES)} className={`flex flex-col items-center gap-1 ${activeTab === TabView.OPPORTUNITIES ? 'text-accent' : 'text-secondary'}`}>
          <Zap size={20} />
          <span className="text-[10px] font-medium">Radar</span>
        </button>
        <button onClick={() => setActiveTab(TabView.CALENDAR)} className={`flex flex-col items-center gap-1 ${activeTab === TabView.CALENDAR ? 'text-accent' : 'text-secondary'}`}>
          <CalendarDays size={20} />
          <span className="text-[10px] font-medium">Eventos</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
