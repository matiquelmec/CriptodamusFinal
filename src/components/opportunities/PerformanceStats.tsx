import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, BarChart2, Activity } from 'lucide-react';
import axios from 'axios';

import AuditHistory from './AuditHistory';

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
    const [loading, setLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);

    const fetchStats = async () => {
        try {
            const response = await axios.get('/api/performance/stats');
            setStats(response.data);
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
        <div className="mb-6 mx-4 p-[1px] rounded-3xl bg-gradient-to-r from-emerald-500/20 via-blue-500/10 to-rose-500/20 shadow-2xl">
            <div className="bg-[#0a0c10]/90 backdrop-blur-2xl rounded-[23px] p-6 border border-white/5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-center mb-2">

                    {/* Win Rate Item */}
                    <div className="flex items-center gap-4 group">
                        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 transition-all duration-300 group-hover:bg-emerald-500/20 group-hover:scale-105">
                            <Target className="text-emerald-400" size={28} />
                        </div>
                        <div>
                            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400/80 mb-1">Win Rate Global</div>
                            <div className={`text-3xl font-black tracking-tight ${winRateColor}`}>
                                {(stats?.winRate || 0).toFixed(1)}%
                            </div>
                        </div>
                    </div>

                    {/* Profit Factor Item (Elite Metric) */}
                    <div className="flex items-center gap-4 group">
                        <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 transition-all duration-300 group-hover:bg-blue-500/20 group-hover:scale-105">
                            <TrendingUp className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400/80 mb-1">Profit Factor</div>
                            <div className={`text-2xl font-bold flex items-baseline gap-2 ${profitFactorColor}`}>
                                {stats.profitFactor} <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Gold Ratio</span>
                            </div>
                        </div>
                    </div>

                    {/* Active Item */}
                    <div className="flex items-center gap-4 group">
                        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 transition-all duration-300 group-hover:bg-amber-500/20 group-hover:scale-105">
                            <Activity className="text-amber-400" size={24} />
                        </div>
                        <div>
                            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400/80 mb-1">En Vigilancia</div>
                            <div className="text-2xl font-bold text-white">
                                {stats.open} <span className="text-[10px] uppercase font-bold text-slate-500 ml-1 tracking-tight">Vivas</span>
                            </div>
                        </div>
                    </div>

                    {/* Audit Toggle Button */}
                    <div className="flex justify-start md:justify-end items-center">
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={`flex items-center gap-2.5 px-6 py-2.5 rounded-full border transition-all duration-300 group/btn shadow-inner
                                ${showHistory
                                    ? 'bg-blue-500/20 border-blue-400/40 text-blue-400'
                                    : 'bg-slate-900/50 border-white/10 text-slate-400 hover:border-slate-400/50'
                                }`}
                        >
                            <div className="relative flex h-2 w-2">
                                <div className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${showHistory ? 'bg-blue-400' : 'bg-slate-500'}`}></div>
                                <div className={`relative inline-flex rounded-full h-2 w-2 ${showHistory ? 'bg-blue-500' : 'bg-slate-400'}`}></div>
                            </div>
                            <span className="text-[10px] uppercase font-black tracking-widest">{showHistory ? 'Ocultar Histórico' : 'Ver Audit Log'}</span>
                        </button>
                    </div>

                </div>

                {/* Historical Audit View */}
                {showHistory && <AuditHistory />}
            </div>
        </div>
    );
};

export default PerformanceStats;
