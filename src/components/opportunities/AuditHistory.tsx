import React, { useState, useEffect } from 'react';
import { History, TrendingUp, TrendingDown, Clock, ExternalLink, ShieldCheck, XCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface HistoricalSignal {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    status: 'WIN' | 'LOSS' | 'EXPIRED';
    strategy: string;
    entry_price: number;
    final_price: number;
    pnl_percent: number;
    closed_at: number;
}

const AuditHistory: React.FC = () => {
    const [history, setHistory] = useState<HistoricalSignal[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await axios.get('/api/performance/history?limit=10');
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
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'WIN': return <ShieldCheck size={14} />;
            case 'LOSS': return <XCircle size={14} />;
            case 'EXPIRED': return <Clock size={14} />;
            default: return <AlertCircle size={14} />;
        }
    };

    if (loading) return <div className="p-8 text-center animate-pulse text-slate-500 font-mono text-xs uppercase tracking-widest">Sincronizando Archivo...</div>;

    if (history.length === 0) return null;

    return (
        <div className="mt-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-2 mb-4 px-2">
                <History className="text-slate-400" size={16} />
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Log de Auditoría (Últimos 10)</h3>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {history.map((sig) => (
                    <div key={sig.id} className="group bg-[#11141a]/40 backdrop-blur-sm border border-white/5 rounded-xl p-3 flex items-center justify-between hover:bg-[#11141a]/60 transition-all duration-300">
                        <div className="flex items-center gap-4">
                            {/* Symbol & Side */}
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-white tracking-tight">{sig.symbol}</span>
                                <span className={`text-[9px] font-black uppercase ${sig.side === 'LONG' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {sig.side}
                                </span>
                            </div>

                            {/* Strategy & Time */}
                            <div className="hidden sm:flex flex-col border-l border-white/5 pl-4">
                                <span className="text-[10px] text-slate-400 font-mono uppercase truncate max-w-[80px]">
                                    {sig.strategy.split('_')[0]}
                                </span>
                                <span className="text-[9px] text-slate-500">
                                    {new Date(Number(sig.closed_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            {/* PnL */}
                            <div className="text-right flex flex-col">
                                <span className={`text-sm font-bold font-mono ${sig.pnl_percent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {sig.pnl_percent >= 0 ? '+' : ''}{sig.pnl_percent.toFixed(2)}%
                                </span>
                                <span className="text-[9px] text-slate-500 uppercase tracking-tighter">PNL REAL</span>
                            </div>

                            {/* Status Badge */}
                            <div className={`px-2.5 py-1 rounded-full border text-[9px] font-bold flex items-center gap-1.5 uppercase ${getStatusStyle(sig.status)}`}>
                                {getStatusIcon(sig.status)}
                                {sig.status}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 text-center">
                <p className="text-[9px] text-slate-600 italic">Cada cierre es auditado 1:1 contra el WebSocket de Binance Pro Data.</p>
            </div>
        </div>
    );
};

export default AuditHistory;
