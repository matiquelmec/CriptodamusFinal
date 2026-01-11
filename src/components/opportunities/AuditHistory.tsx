import React, { useState, useEffect } from 'react';
import { History, TrendingUp, TrendingDown, Clock, ExternalLink, ShieldCheck, XCircle, AlertCircle, Activity, HelpCircle } from 'lucide-react';
import axios from 'axios';

interface HistoricalSignal {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    status: 'WIN' | 'LOSS' | 'EXPIRED' | 'OPEN';
    strategy: string;
    entry_price: number;
    final_price: number;
    pnl_percent: number;
    created_at: number;
    closed_at: number;
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
                const url = `${getBaseUrl()}/api/performance/history?limit=10`;
                const response = await axios.get(url);
                if (Array.isArray(response.data)) {
                    setHistory(response.data);
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
    }, []);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'WIN': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'LOSS': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            case 'EXPIRED': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'OPEN': return 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'WIN': return <ShieldCheck size={14} />;
            case 'LOSS': return <XCircle size={14} />;
            case 'EXPIRED': return <Clock size={14} />;
            case 'OPEN': return <Activity size={14} />;
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
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Log de Auditoría (Últimos 10)</h3>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {history.map((sig) => (
                    <div key={sig.id} className="group bg-[#11141a]/40 backdrop-blur-sm border border-white/5 rounded-xl p-3 flex items-center justify-between hover:bg-[#11141a]/60 transition-all duration-300">
                        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                            {/* Symbol & Side */}
                            <div className="flex flex-col min-w-[50px]">
                                <span className="text-[10px] sm:text-xs font-bold text-white tracking-tight">{sig.symbol}</span>
                                <span className={`text-[8px] font-black uppercase ${sig.side === 'LONG' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {sig.side}
                                </span>
                            </div>

                            {/* Strategy & Time (Always visible but compact) */}
                            <div className="flex flex-col border-l border-white/5 pl-2 sm:pl-4 min-w-0">
                                <span className="text-[8px] sm:text-[10px] text-slate-400 font-mono uppercase truncate max-w-[60px] sm:max-w-[80px]">
                                    {sig.strategy.split('_')[0]}
                                </span>
                                <span className="text-[7px] sm:text-[9px] text-slate-500 flex items-center gap-1">
                                    {sig.status === 'OPEN' ? 'D:' : 'C:'}
                                    {new Date(Number(sig.status === 'OPEN' ? sig.created_at : sig.closed_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    <span className="hidden xs:inline opacity-40">•</span>
                                    <span className="hidden xs:inline opacity-60">
                                        {Math.floor((Date.now() - Number(sig.status === 'OPEN' ? sig.created_at : sig.closed_at)) / (60000))}m
                                    </span>
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-6 ml-2">
                            {/* PnL */}
                            <div className="text-right flex flex-col min-w-[55px] sm:min-w-[80px]">
                                {sig.status === 'OPEN' ? (
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs sm:text-sm font-bold font-mono text-blue-400 animate-pulse truncate">
                                            ${sig.entry_price > 100 ? Math.round(sig.entry_price) : sig.entry_price.toFixed(2)}
                                        </span>
                                        <span className="text-[7px] sm:text-[9px] text-slate-500 uppercase tracking-tighter">ENTRY</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-end">
                                        <span className={`text-xs sm:text-sm font-bold font-mono ${sig.pnl_percent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {sig.pnl_percent >= 0 ? '+' : ''}{sig.pnl_percent.toFixed(1)}%
                                        </span>
                                        <span className="text-[7px] sm:text-[9px] text-slate-500 uppercase tracking-tighter">PNL</span>
                                    </div>
                                )}
                            </div>

                            {/* Status Badge */}
                            <div className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border text-[7px] sm:text-[9px] font-bold flex items-center gap-1 uppercase ${getStatusStyle(sig.status)}`}>
                                {getStatusIcon(sig.status)}
                                <span className="hidden xs:inline">{sig.status}</span>
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
