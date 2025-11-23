import React, { useState } from 'react';
import { LayoutDashboard, Settings, BarChart, CalendarDays, Zap } from 'lucide-react';
import Scanner from './components/Scanner';
import AIChat from './components/AIChat';
import TradingViewWidget from './components/TradingViewWidget';
import MacroStrip from './components/MacroStrip';
import EconomicCalendar from './components/EconomicCalendar';
import OpportunityFinder from './components/OpportunityFinder';
import SettingsPanel from './components/SettingsPanel';
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
          <div className="flex flex-col lg:flex-row gap-4 h-full">
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
               <div className="h-[400px] lg:flex-[3] w-full lg:min-h-0">
                  <TradingViewWidget symbol={selectedSymbol} />
               </div>
               {/* Bottom: AI */}
               <div className="h-[500px] lg:flex-[2] w-full lg:min-h-0 pb-4 lg:pb-0">
                  <AIChat selectedSymbol={selectedSymbol} />
               </div>
            </div>
          </div>
        );
      case TabView.OPPORTUNITIES:
          return <div className="h-full min-h-[600px]"><OpportunityFinder onSelectOpportunity={handleSelectOpportunity} /></div>;
      case TabView.CALENDAR:
        return <div className="h-full min-h-[600px]"><EconomicCalendar /></div>;
      case TabView.SETTINGS:
        return <div className="h-full min-h-[600px]"><SettingsPanel onClose={() => setActiveTab(TabView.DASHBOARD)} /></div>;
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
            {/* Criptodamus Custom Vector Logo */}
            <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center drop-shadow-lg transition-transform group-hover:scale-105 duration-300">
               <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="hoodGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1e3a8a" />
                      <stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  <path d="M50 5 C 20 5 10 40 10 65 C 10 85 25 95 50 95 C 75 95 90 85 90 65 C 90 40 80 5 50 5 Z" fill="url(#hoodGradient)" />
                  <path d="M50 15 C 30 15 20 45 20 65 C 20 80 35 85 50 85 C 65 85 80 80 80 65 C 80 45 70 15 50 15 Z" fill="#020617" opacity="0.8" />
                  <path d="M35 55 Q 42 50 45 58" stroke="#06b6d4" strokeWidth="3" fill="none" filter="url(#glow)" className="animate-pulse" />
                  <path d="M65 55 Q 58 50 55 58" stroke="#06b6d4" strokeWidth="3" fill="none" filter="url(#glow)" className="animate-pulse" />
                  <circle cx="40" cy="58" r="2.5" fill="#22d3ee" filter="url(#glow)" />
                  <circle cx="60" cy="58" r="2.5" fill="#22d3ee" filter="url(#glow)" />
               </svg>
            </div>
            
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-white leading-none font-mono tracking-tighter">CRIPTODAMUS</h1>
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

          <button 
             onClick={() => setActiveTab(TabView.SETTINGS)}
             className={`w-8 h-8 rounded border flex items-center justify-center transition-all ${activeTab === TabView.SETTINGS ? 'bg-accent text-white border-accent' : 'bg-surface border-border text-secondary hover:text-primary hover:bg-white/5'}`}
          >
             <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {/* 
         On Mobile: overflow-y-auto allows the whole page content (Scanner + Chart + Chat) to scroll properly.
         pb-24 ensures the content isn't hidden behind the fixed bottom nav.
         On Desktop (lg): overflow-hidden keeps the layout rigid/dashboard-like.
      */}
      <main className="flex-1 overflow-y-auto lg:overflow-hidden p-4 container mx-auto pb-24 lg:pb-4">
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