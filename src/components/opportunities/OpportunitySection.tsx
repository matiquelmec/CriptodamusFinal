import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Zap, Target, Shield, Activity, TrendingUp } from 'lucide-react';
import { useSocket } from '../../hooks/useSocket';
import OpportunityFinder from '../OpportunityFinder';

interface OpportunitySectionProps {
    onSelectOpportunity: (symbol: string) => void;
}

const OpportunitySection: React.FC<OpportunitySectionProps> = ({ onSelectOpportunity }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { isConnected, aiOpportunities } = useSocket();

    const totalSignals = aiOpportunities?.length || 0;
    const validCount = aiOpportunities?.filter(o => o.confidenceScore >= 60).length || 0;
    const goldCount = aiOpportunities?.filter(o => o.strategy === 'pau_perdices_gold').length || 0;

    return (
        <div className="mb-6 mx-4 p-[1px] rounded-3xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 shadow-2xl">
            <div className="bg-[#0a0c10]/95 backdrop-blur-2xl rounded-[23px] overflow-hidden border border-cyan-500/10">

                {/* Header with Signal Summary - Clickable */}
                <div
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/2 cursor-pointer hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl ${isConnected ? 'bg-cyan-500/10 text-cyan-400' : 'bg-slate-500/10 text-slate-400'}`}>
                            <Zap size={20} className={isConnected ? 'animate-pulse' : ''} />
                        </div>
                        <div className="flex items-center gap-6">
                            {/* Tournament Context */}
                            <div className="flex items-center gap-2">
                                <TrendingUp className="text-purple-400" size={16} />
                                <div>
                                    <div className="text-[8px] uppercase tracking-wider font-bold text-slate-500">Elite 9</div>
                                    <div className="text-lg font-black text-purple-400">
                                        Tournament
                                    </div>
                                </div>
                            </div>

                            {/* Total Signals */}
                            <div className="flex items-center gap-2">
                                <Target className="text-cyan-400" size={16} />
                                <div>
                                    <div className="text-[8px] uppercase tracking-wider font-bold text-slate-500">Total</div>
                                    <div className="text-lg font-black text-cyan-400">
                                        {totalSignals}
                                    </div>
                                </div>
                            </div>

                            {/* Valid (60+) */}
                            <div className="flex items-center gap-2">
                                <Shield className="text-emerald-400" size={16} />
                                <div>
                                    <div className="text-[8px] uppercase tracking-wider font-bold text-slate-500">Valid (60+)</div>
                                    <div className="text-lg font-bold text-emerald-400">
                                        {validCount}
                                    </div>
                                </div>
                            </div>

                            {/* Gold Strategy */}
                            <div className="flex items-center gap-2">
                                <Target className="text-yellow-400" size={16} />
                                <div>
                                    <div className="text-[8px] uppercase tracking-wider font-bold text-slate-500">Gold (Pau)</div>
                                    <div className="text-lg font-bold text-yellow-400">
                                        {goldCount}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Connection Status */}
                        <div className={`px-2  py-1 rounded-full text-[9px] font-bold border ${isConnected ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                            {isConnected ? '🟢 LIVE' : '🔴 OFF'}
                        </div>

                        {/* Toggle */}
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] uppercase font-black tracking-widest ${isCollapsed ? 'text-slate-500' : 'text-cyan-400'}`}>
                                {isCollapsed ? 'Expandir' : 'Colapsar'}
                            </span>
                            <button className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                                {isCollapsed ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronUp size={16} className="text-slate-400" />}
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
