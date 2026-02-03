import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Zap, Target, Trophy } from 'lucide-react';
import { useSocket } from '../../hooks/useSocket';
import OpportunityFinder from '../OpportunityFinder';

interface OpportunitySectionProps {
    onSelectOpportunity: (symbol: string) => void;
}

const OpportunitySection: React.FC<OpportunitySectionProps> = ({ onSelectOpportunity }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { isConnected, aiOpportunities } = useSocket();

    const totalSignals = aiOpportunities?.length || 0;

    return (
        <div className="mb-4 md:mb-6 mx-2 md:mx-4 p-[1px] rounded-2xl md:rounded-3xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 shadow-2xl">
            <div className="bg-[#0a0c10]/95 backdrop-blur-2xl rounded-[15px] md:rounded-[23px] overflow-hidden border border-cyan-500/10">

                {/* Header with Signal Summary - Clickable */}
                <div
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 md:px-6 py-3 md:py-4 border-b border-white/5 bg-white/2 cursor-pointer hover:bg-white/5 transition-colors gap-3"
                >
                    <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto">
                        <div className={`p-1.5 md:p-2 rounded-lg md:rounded-xl ${isConnected ? 'bg-cyan-500/10 text-cyan-400' : 'bg-slate-500/10 text-slate-400'}`}>
                            <Zap size={16} className={`md:w-5 md:h-5 ${isConnected ? 'animate-pulse' : ''}`} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-1">
                            {/* Elite 9 Tournament */}
                            <div className="flex items-center gap-1.5 md:gap-2">
                                <Trophy className="text-yellow-400" size={14} />
                                <div>
                                    <div className="text-[7px] md:text-[8px] uppercase tracking-wider font-bold text-slate-500">Elite 9</div>
                                    <div className="text-sm md:text-lg font-black text-yellow-400">
                                        Tournament
                                    </div>
                                </div>
                            </div>

                            {/* Separator - Hidden on mobile */}
                            <div className="hidden sm:block h-8 w-px bg-white/10"></div>

                            {/* Total Signals (75+ Only) */}
                            <div className="flex items-center gap-1.5 md:gap-2">
                                <Target className="text-cyan-400" size={14} />
                                <div>
                                    <div className="text-[7px] md:text-[8px] uppercase tracking-wider font-bold text-slate-500">Señales (75+)</div>
                                    <div className="text-sm md:text-lg font-black text-cyan-400">
                                        {totalSignals}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        {/* Connection Status */}
                        <div className={`px-2 py-1 rounded-full text-[8px] md:text-[9px] font-bold border ${isConnected ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                            {isConnected ? '🟢 LIVE' : '🔴 OFF'}
                        </div>

                        {/* Toggle */}
                        <div className="flex items-center gap-1 md:gap-2">
                            <span className={`text-[9px] md:text-[10px] uppercase font-black tracking-widest ${isCollapsed ? 'text-slate-500' : 'text-cyan-400'}`}>
                                {isCollapsed ? 'Expandir' : 'Colapsar'}
                            </span>
                            <button className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                                {isCollapsed ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Collapsible Content */}
                {!isCollapsed && (
                    <div>
                        <OpportunityFinder onSelectOpportunity={onSelectOpportunity} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default OpportunitySection;
