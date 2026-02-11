import React, { useState, useEffect } from 'react';
import { History, TrendingUp, TrendingDown, Clock, ExternalLink, ShieldCheck, XCircle, AlertCircle, Activity, HelpCircle } from 'lucide-react';
import axios from 'axios';

interface HistoricalSignal {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    status: 'WIN' | 'LOSS' | 'EXPIRED' | 'ACTIVE' | 'PENDING' | 'OPEN' | 'PARTIAL_WIN';
    strategy: string;
    entry_price: number;
    final_price: number;
    pnl_percent: number;
    created_at: number;
    closed_at: number;
    ml_probability?: number; // NEW
}

interface AuditHistoryProps {
    onShowEducation?: () => void;
}

const AuditHistory: React.FC<AuditHistoryProps> = ({ onShowEducation }) => {
    const [history, setHistory] = useState<HistoricalSignal[]>([]);
    const [loading, setLoading] = useState(true);

    const getBaseUrl = () => {
        const IS_PROD = import.meta.env.PROD || window.location.hostname !== 'localhost';
        return IS_PROD ? 'https://criptodamusfinal.onrender.com' : 'http://localhost:3001';
    };

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const url = `${getBaseUrl()}/api/performance/history?limit=50`;
                const response = await axios.get(url);
                if (Array.isArray(response.data)) {
                    // Safety filter: exclude technical rejections
                    const filtered = response.data.filter((sig: any) => !sig.status?.startsWith('REJECTED_'));
                    setHistory(filtered);
                } else {
                    console.error("Historical data is not an array:", response.data);
                    setHistory([]);
                }
            } catch (error) {
                console.error("Error fetching audit history:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();

        // Auto-Refresh every 5 seconds to show Real-Time PnL/Status updates
        const interval = setInterval(fetchHistory, 5000);
        return () => clearInterval(interval);
    }, []);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'WIN': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'LOSS': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            case 'EXPIRED': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'ACTIVE': return 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse';
            case 'PENDING': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'OPEN': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'WIN': return <ShieldCheck size={14} />;
            case 'LOSS': return <XCircle size={14} />;
            case 'EXPIRED': return <Clock size={14} />;
            case 'ACTIVE': return <Activity size={14} />;
            case 'PENDING': return <Clock size={14} />;
            case 'OPEN': return <AlertCircle size={14} />;
            default: return <AlertCircle size={14} />;
        }
    };

    if (loading) return <div className="p-8 text-center animate-pulse text-slate-500 font-mono text-xs uppercase tracking-widest">Sincronizando Archivo...</div>;

    if (history.length === 0) {
        return (
            <div className="mt-4 p-8 border border-dashed border-white/5 rounded-2xl bg-white/[0.02] text-center animate-in fade-in duration-700">
                <div className="bg-blue-500/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                    <History className="text-blue-400/60" size={24} />
                </div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">Archivo en Generación</h3>
                <p className="text-[10px] text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                    Las señales están siendo auditadas en tiempo real. Los resultados aparecerán aquí automáticamente una vez que alcancen su <span className="text-emerald-400/80">Take Profit</span>, <span className="text-rose-400/80">Stop Loss</span> o expiren.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/50 border border-white/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Monitoreo Activo</span>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-2 mb-4 px-2">
                <History className="text-slate-400" size={16} />
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Log de Auditoría (Últimos 50)</h3>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {history.map((sig) => (
                    <div key={sig.id} className="group bg-[#11141a]/40 backdrop-blur-sm border border-white/5 rounded-xl p-4 flex items-center justify-between hover:bg-[#11141a]/60 transition-all duration-300">
                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                            {/* Symbol & Side */}
                            <div className="flex flex-col min-w-[60px]">
                                <span className="text-xs sm:text-sm font-bold text-white tracking-tight">{sig.symbol}</span>
                                <span className={`text-[9px] sm:text-[10px] font-black uppercase ${sig.side === 'LONG' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {sig.side}
                                </span>
                            </div>

                            {/* Strategy & Time (Always visible but compact) */}
                            <div className="flex flex-col border-l border-white/10 pl-3 sm:pl-4 min-w-0">
                                <span className="text-[9px] sm:text-[10px] text-slate-300 font-mono uppercase truncate max-w-[70px] sm:max-w-[100px]">
                                    {sig.strategy.split('_')[0]}
                                </span>
                                <span className="text-[8px] sm:text-[9px] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <span className="opacity-70">{['WIN', 'LOSS', 'EXPIRED'].includes(sig.status) ? 'C:' : 'D:'}</span>
                                    <span className="text-slate-400">
                                        {new Date(Number(['WIN', 'LOSS', 'EXPIRED'].includes(sig.status) ? sig.closed_at : sig.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="opacity-40">•</span>
                                    <span className="opacity-60">
                                        {Math.floor((Date.now() - Number(['WIN', 'LOSS', 'EXPIRED'].includes(sig.status) ? sig.closed_at : sig.created_at)) / (60000))}m
                                    </span>
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 sm:gap-6 ml-2">
                            {/* PnL & Status Info */}
                            <div className="text-right flex flex-col min-w-[65px] sm:min-w-[90px]">
                                {['WIN', 'LOSS', 'EXPIRED'].includes(sig.status) ? (
                                    <div className="flex flex-col items-end">
                                        <span className={`text-xs sm:text-sm font-bold font-mono ${(sig.pnl_percent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'} drop-shadow-md`}>
                                            {(sig.pnl_percent || 0) >= 0 ? '+' : ''}{(sig.pnl_percent || 0).toFixed(1)}%
                                        </span>
                                        <span className="text-[8px] sm:text-[9px] text-slate-500 uppercase tracking-tighter">PNL FINAL</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-end">
                                        {/* LIVE PNL OR ENTRY ZONE */}
                                        {sig.status === 'ACTIVE' || sig.status === 'PARTIAL_WIN' ? (
                                            <>
                                                <span className={`text-xs sm:text-sm font-bold font-mono ${(sig.pnl_percent || 0) >= 0 ? 'text-emerald-400 animate-pulse' : 'text-rose-400 animate-pulse'} drop-shadow-md`}>
                                                    {(sig.pnl_percent || 0) >= 0 ? '+' : ''}{(sig.pnl_percent || 0).toFixed(2)}%
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[7px] bg-blue-500/20 px-1 rounded text-blue-300">LIVE</span>
                                                    <span className="text-[8px] sm:text-[9px] text-slate-500 uppercase tracking-tighter">
                                                        ${(sig.final_price || sig.entry_price || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-xs sm:text-sm font-bold font-mono text-amber-400 truncate drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">
                                                    ${(sig.entry_price || 0) > 100 ? (sig.entry_price || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }) : (sig.entry_price || 0).toFixed(2)}
                                                </span>
                                                <span className="text-[8px] sm:text-[9px] text-slate-500 uppercase tracking-tighter">ENTRY ZONE</span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ML Confidence Badge */}
                            {(sig.ml_probability !== undefined && sig.ml_probability !== null) && (
                                <div className="hidden xs:flex flex-col items-center px-2 py-1 rounded-lg bg-purple-500/5 border border-purple-500/10">
                                    <span className="text-[7px] text-purple-400 font-black uppercase tracking-tighter">AI Conf</span>
                                    <span className="text-[10px] font-mono font-bold text-purple-300">
                                        {(sig.ml_probability > 1 ? sig.ml_probability : sig.ml_probability * 100).toFixed(0)}%
                                    </span>
                                </div>
                            )}

                            {/* Status Badge */}
                            <div className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-full border text-[8px] sm:text-[9px] font-black flex items-center gap-1.5 uppercase transition-all ${getStatusStyle(sig.status)}`}>
                                {getStatusIcon(sig.status)}
                                <span>{sig.status}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 flex flex-col items-center gap-2">
                <p className="text-[9px] text-slate-600 italic px-4">Cada cierre es auditado 1:1 contra el WebSocket de Binance Pro Data.</p>
                {onShowEducation && (
                    <button
                        onClick={onShowEducation}
                        className="text-[9px] font-black text-blue-400/60 hover:text-blue-400 uppercase tracking-widest flex items-center gap-1.5 transition-colors border-b border-blue-400/20 pb-0.5"
                    >
                        <HelpCircle size={10} />
                        ¿Cómo funciona la auditoría?
                    </button>
                )}
            </div>
        </div>
    );
};

export default AuditHistory;
