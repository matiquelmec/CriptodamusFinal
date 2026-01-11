import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, BarChart2, Activity } from 'lucide-react';
import axios from 'axios';

interface Stats {
    total: number;
    closed: number;
    wins: number;
    winRate: number;
    open: number;
}

const PerformanceStats: React.FC = () => {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="mb-6 mx-4 p-[1px] rounded-3xl bg-gradient-to-r from-emerald-500/20 via-blue-500/10 to-rose-500/20 shadow-2xl">
            <div className="bg-[#0a0c10]/90 backdrop-blur-2xl rounded-[23px] p-6 border border-white/5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-center">

                    {/* Win Rate Item */}
                    <div className="flex items-center gap-4 group">
                        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 transition-all duration-300 group-hover:bg-emerald-500/20 group-hover:scale-105">
                            <Target className="text-emerald-400" size={28} />
                        </div>
                        <div>
                            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400/80 mb-1">Win Rate Global</div>
                            <div className={`text-3xl font-black tracking-tight ${winRateColor}`}>
                                {stats.winRate.toFixed(1)}%
                            </div>
                        </div>
                    </div>

                    {/* Stats Item */}
                    <div className="flex items-center gap-4 group">
                        <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 transition-all duration-300 group-hover:bg-blue-500/20 group-hover:scale-105">
                            <TrendingUp className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400/80 mb-1">Señales Cerradas</div>
                            <div className="text-2xl font-bold text-white flex items-baseline gap-2">
                                {stats.wins} <span className="text-sm font-medium text-slate-500">ganadas de {stats.closed}</span>
                            </div>
                        </div>
                    </div>

                    {/* Active Item */}
                    <div className="flex items-center gap-4 group">
                        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 transition-all duration-300 group-hover:bg-amber-500/20 group-hover:scale-105">
                            <Activity className="text-amber-400" size={24} />
                        </div>
                        <div>
                            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400/80 mb-1">Vigilancia Activa</div>
                            <div className="text-2xl font-bold text-white">
                                {stats.open} <span className="text-xs font-normal text-slate-500 ml-1">señales abiertas</span>
                            </div>
                        </div>
                    </div>

                    {/* Badge / Info */}
                    <div className="flex justify-start md:justify-end items-center">
                        <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-slate-900/50 border border-white/10 shadow-inner">
                            <div className="relative flex h-2 w-2">
                                <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></div>
                                <div className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></div>
                            </div>
                            <span className="text-[10px] uppercase font-black tracking-widest text-blue-400">Auditoría 1:1 Live</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default PerformanceStats;
