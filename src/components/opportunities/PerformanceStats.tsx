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
    const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed like ActiveTradesPanel

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
        <div className="mb-6 mx-4 p-[1px] rounded-3xl bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-purple-500/20 shadow-2xl">
            <div className="bg-[#0a0c10]/95 backdrop-blur-2xl rounded-[23px] overflow-hidden border border-emerald-500/10">

                {/* Header - Clickable */}
                <div
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/2 cursor-pointer hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                            <BarChart2 size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                Performance Monitor
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">LIVE</span>
                            </h2>
                            <p className="text-[10px] text-slate-400">Métricas en Tiempo Real</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Quick Stats Preview when collapsed */}
                        {isCollapsed && (
                            <div className="flex items-center gap-4 text-[10px] font-mono">
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-500">WR:</span>
                                    <span className={winRateColor}>{stats.winRate.toFixed(1)}%</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-500">PF:</span>
                                    <span className={profitFactorColor}>{stats.profitFactor}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-500">Open:</span>
                                    <span className="text-amber-400">{stats.open}</span>
                                </div>
                            </div>
                        )}
                        <button className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                            {isCollapsed ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronUp size={16} className="text-slate-400" />}
                        </button>
                    </div>
                </div>

                {/* Collapsible Content */}
                {!isCollapsed && (
                    <>
                        <div className="p-6">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-8 items-center">

                                {/* Win Rate Item */}
                                <div className="flex flex-col items-center md:items-start md:flex-row gap-2 md:gap-4 group text-center md:text-left">
                                    <div className="p-2 md:p-3.5 rounded-xl md:rounded-2xl bg-emerald-500/10 border border-emerald-500/20 transition-all duration-300 group-hover:bg-emerald-500/20 group-hover:scale-105">
                                        <Target className="text-emerald-400" size={20} />
                                    </div>
                                    <div>
                                        <div className="text-[9px] md:text-[11px] uppercase tracking-wider font-bold text-slate-400/80 mb-1">Win Rate</div>
                                        <div className={`text-xl md:text-3xl font-black tracking-tight ${winRateColor}`}>
                                            {(stats?.winRate || 0).toFixed(1)}%
                                        </div>
                                    </div>
                                </div>

                                {/* Profit Factor Item */}
                                <div className="flex flex-col items-center md:items-start md:flex-row gap-2 md:gap-4 group text-center md:text-left border-l border-white/5 md:border-0">
                                    <div className="p-2 md:p-3.5 rounded-xl md:rounded-2xl bg-blue-500/10 border border-blue-500/20 transition-all duration-300 group-hover:bg-blue-500/20 group-hover:scale-105">
                                        <TrendingUp className="text-blue-400" size={20} />
                                    </div>
                                    <div>
                                        <div className="text-[9px] md:text-[11px] uppercase tracking-wider font-bold text-slate-400/80 mb-1">Profit Factor</div>
                                        <div className={`text-xl md:text-2xl font-bold flex items-baseline justify-center md:justify-start gap-1 ${profitFactorColor}`}>
                                            {stats.profitFactor} <span className="hidden md:inline text-[9px] font-black text-slate-500 uppercase tracking-tighter">Gold</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Active Item */}
                                <div className="flex flex-col items-center md:items-start md:flex-row gap-2 md:gap-4 group text-center md:text-left border-t md:border-t-0 border-white/5 pt-4 md:pt-0">
                                    <div className="p-2 md:p-3.5 rounded-xl md:rounded-2xl bg-amber-500/10 border border-amber-500/20 transition-all duration-300 group-hover:bg-amber-500/20 group-hover:scale-105">
                                        <Activity className="text-amber-400" size={20} />
                                    </div>
                                    <div>
                                        <div className="text-[9px] md:text-[11px] uppercase tracking-wider font-bold text-slate-400/80 mb-1">En Vigilancia</div>
                                        <div className="text-xl md:text-2xl font-bold text-white">
                                            {stats.open} <span className="text-[8px] md:text-[10px] uppercase font-bold text-slate-500 ml-1">Vivas</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Brain Health (ML) Item */}
                                <div className="flex flex-col items-center md:items-start md:flex-row gap-2 md:gap-4 group text-center md:text-left border-t md:border-t-0 border-white/5 pt-4 md:pt-0 border-l border-white/5 pl-0 md:pl-4">
                                    <div className={`p-2 md:p-3.5 rounded-xl md:rounded-2xl border transition-all duration-300 group-hover:scale-105 ${mlStats?.isDriftDetected ? 'bg-rose-500/10 border-rose-500/20' : 'bg-purple-500/10 border-purple-500/20'}`}>
                                        {mlStats?.isDriftDetected ? <Zap className="text-rose-400" size={20} /> : <Brain className="text-purple-400" size={20} />}
                                    </div>
                                    <div className="relative">
                                        <div className="text-[9px] md:text-[11px] uppercase tracking-wider font-bold text-slate-400/80 mb-1 flex items-center gap-1.5">
                                            Brain Health
                                            {mlStats?.isDriftDetected && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />}
                                        </div>
                                        <div className={`text-xl md:text-2xl font-black tracking-tight ${mlStats?.isDriftDetected ? 'text-rose-400' : 'text-purple-400'}`}>
                                            {mlStats ? `${mlStats.globalWinRate.toFixed(1)}%` : '---'}
                                        </div>
                                    </div>
                                </div>

                                {/* Audit Toggle & Help Buttons */}
                                <div className="flex flex-col md:flex-row justify-center md:justify-end items-center gap-2 md:gap-3 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 border-l ml-0">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowEducation(true); }}
                                            className="p-2 md:p-2.5 rounded-full bg-slate-900/50 border border-white/10 text-slate-400 hover:text-blue-400 transition-all active:scale-95"
                                            title="Guía"
                                        >
                                            <HelpCircle size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowHistory(!showHistory); }}
                                            className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full border transition-all duration-300 group/btn shadow-inner
                                                ${showHistory
                                                    ? 'bg-blue-500/20 border-blue-400/40 text-blue-400'
                                                    : 'bg-slate-900/50 border-white/10 text-slate-400 hover:border-slate-400/50'
                                                }`}
                                        >
                                            <span className="text-[9px] md:text-[10px] uppercase font-black tracking-widest">{showHistory ? 'Ocultar' : 'Log'}</span>
                                        </button>
                                    </div>
                                </div>

                            </div>

                            {/* Educational View Toggle Overlay */}
                            {showEducation && <AuditEducational onClose={() => setShowEducation(false)} />}

                            {/* Historical Audit View */}
                            {showHistory && <AuditHistory onShowEducation={() => setShowEducation(true)} />}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PerformanceStats;
