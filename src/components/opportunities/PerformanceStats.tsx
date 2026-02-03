import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, BarChart2, Activity, HelpCircle, Cpu, Brain, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';
import { MLPerformanceStats } from '../../types/types-advanced';

import AuditHistory from './AuditHistory';
import AuditEducational from './AuditEducational';

interface Stats {
    total: number;
    closed: number;
    wins: number;
    winRate: number;
    open: number;
    profitFactor: number;
}

const PerformanceStats: React.FC = () => {
    const [stats, setStats] = useState<Stats | null>(null);
    const [mlStats, setMLStats] = useState<MLPerformanceStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [showEducation, setShowEducation] = useState(false);

    const getBaseUrl = () => {
        const IS_PROD = import.meta.env.PROD || window.location.hostname !== 'localhost';
        return IS_PROD ? 'https://criptodamusfinal.onrender.com' : 'http://localhost:3001';
    };

    const fetchStats = async () => {
        try {
            const baseUrl = getBaseUrl();
            const [perfRes, mlRes] = await Promise.all([
                axios.get(`${baseUrl}/api/performance/stats`),
                axios.get(`${baseUrl}/api/ml/stats`).catch(() => null)
            ]);

            setStats(perfRes.data);
            if (mlRes) setMLStats(mlRes.data);
        } catch (error) {
            console.error("Error fetching performance stats:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 60000); // 1m
        return () => clearInterval(interval);
    }, []);

    if (loading || !stats) return null;

    const winRateColor = stats.winRate >= 60 ? 'text-emerald-400' : stats.winRate >= 40 ? 'text-amber-400' : 'text-rose-400';
    const profitFactorColor = stats.profitFactor >= 2 ? 'text-emerald-400' : stats.profitFactor >= 1 ? 'text-blue-400' : 'text-rose-400';

    return (
        <div className="mb-4 md:mb-6 mx-2 md:mx-4 p-[1px] rounded-2xl md:rounded-3xl bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-purple-500/20 shadow-2xl">
            <div className="bg-[#0a0c10]/95 backdrop-blur-2xl rounded-[15px] md:rounded-[23px] overflow-hidden border border-emerald-500/10">

                {/* Header with Full Stats - Always Visible */}
                <div
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 md:px-6 py-3 md:py-4 border-b border-white/5 bg-white/2 cursor-pointer hover:bg-white/5 transition-colors gap-3"
                >
                    <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto">
                        <div className="p-1.5 md:p-2 bg-emerald-500/10 rounded-lg md:rounded-xl text-emerald-400">
                            <BarChart2 size={16} className="md:w-5 md:h-5" />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-1">
                            {/* Win Rate */}
                            <div className="flex items-center gap-1.5 md:gap-2">
                                <Target className="text-emerald-400" size={14} />
                                <div>
                                    <div className="text-[7px] md:text-[8px] uppercase tracking-wider font-bold text-slate-500">Win Rate</div>
                                    <div className={`text-sm md:text-lg font-black ${winRateColor}`}>
                                        {stats.winRate.toFixed(1)}%
                                    </div>
                                </div>
                            </div>

                            {/* Profit Factor */}
                            <div className="flex items-center gap-1.5 md:gap-2">
                                <TrendingUp className="text-blue-400" size={14} />
                                <div>
                                    <div className="text-[7px] md:text-[8px] uppercase tracking-wider font-bold text-slate-500">Profit Factor</div>
                                    <div className={`text-sm md:text-lg font-bold ${profitFactorColor}`}>
                                        {stats.profitFactor} <span className="text-[7px] md:text-[8px] text-slate-600">Gold</span>
                                    </div>
                                </div>
                            </div>

                            {/* En Vigilancia */}
                            <div className="flex items-center gap-1.5 md:gap-2">
                                <Activity className="text-amber-400" size={14} />
                                <div>
                                    <div className="text-[7px] md:text-[8px] uppercase tracking-wider font-bold text-slate-500">En Vigilancia</div>
                                    <div className="text-sm md:text-lg font-bold text-white">
                                        {stats.open} <span className="text-[7px] md:text-[8px] text-slate-600">Vivas</span>
                                    </div>
                                </div>
                            </div>

                            {/* Brain Health */}
                            <div className="flex items-center gap-2">
                                {mlStats?.isDriftDetected ? <Zap className="text-rose-400" size={16} /> : <Brain className="text-purple-400" size={16} />}
                                <div>
                                    <div className="text-[8px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1">
                                        Brain Health
                                        {mlStats?.isDriftDetected && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />}
                                    </div>
                                    <div className={`text-lg font-black ${mlStats?.isDriftDetected ? 'text-rose-400' : 'text-purple-400'}`}>
                                        {mlStats ? `${mlStats.globalWinRate.toFixed(1)}%` : '---'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Help Button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowEducation(true); }}
                            className="p-2 rounded-full bg-slate-900/50 border border-white/10 text-slate-400 hover:text-blue-400 transition-all active:scale-95"
                            title="Guía"
                        >
                            <HelpCircle size={16} />
                        </button>

                        {/* Log Toggle */}
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] uppercase font-black tracking-widest ${showHistory ? 'text-blue-400' : 'text-slate-500'}`}>
                                {showHistory ? 'Ocultar Log' : 'Ver Log'}
                            </span>
                            <button className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                                {showHistory ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Collapsible Content - Only Logs */}
                {showHistory && (
                    <div className="p-6 border-t border-white/5">
                        <AuditHistory onShowEducation={() => setShowEducation(true)} />
                    </div>
                )}

                {/* Educational Modal */}
                {showEducation && <AuditEducational onClose={() => setShowEducation(false)} />}
            </div>
        </div>
    );
};

export default PerformanceStats;
