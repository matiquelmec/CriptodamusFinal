import React from 'react';
import { useSocket } from '../../hooks/useSocket';
import { TrendingUp, TrendingDown, Clock, Shield, Target, DollarSign, Activity, AlertCircle } from 'lucide-react';

const ActiveTradesPanel: React.FC = () => {
    const { activeTrades, isConnected } = useSocket();

    if (!activeTrades || activeTrades.length === 0) {
        // Optional: Show nothing if no trades, or a small "Standby" badge
        return null;
    }

    // Helper: Calculate Time Open
    const getTimeOpen = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${mins}m`;
    };

    return (
        <div className="mb-6 mx-4 p-[1px] rounded-3xl bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="bg-[#0a0c10]/95 backdrop-blur-2xl rounded-[23px] overflow-hidden border border-blue-500/10">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 animate-pulse">
                            <Activity size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                Sala de Control <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">LIVE</span>
                            </h2>
                            <p className="text-[10px] text-slate-400">Seguimiento Institucional en Tiempo Real</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                        <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        {isConnected ? 'FEED STABLE' : 'RECONNECTING'}
                    </div>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-6 gap-4 px-6 py-2 bg-white/2 text-[9px] uppercase tracking-widest font-bold text-slate-500 border-b border-white/5">
                    <div className="col-span-1">Activo / Lado</div>
                    <div className="col-span-1 text-right">Entrada</div>
                    <div className="col-span-1 text-right">Precio Mark</div>
                    <div className="col-span-1 text-center">Riesgo (SL)</div>
                    <div className="col-span-1 text-right">PnL (%)</div>
                    <div className="col-span-1 text-right">Estado</div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-white/5">
                    {activeTrades.map((trade) => {
                        const isLong = trade.side === 'LONG';
                        const pnl = trade.pnl_percent || 0;
                        const isWin = pnl > 0;
                        const pnlColor = isWin ? 'text-emerald-400' : 'text-rose-400';
                        const pnlBg = isWin ? 'bg-emerald-500/5' : 'bg-rose-500/5';
                        const entryPrice = trade.entry || trade.target;
                        const currentPrice = trade.last_price || entryPrice;

                        // Smart Status Label
                        let statusLabel = 'OPEN';
                        let statusIcon = <Clock size={12} />;
                        let statusColor = 'text-slate-400';

                        if (trade.stage === 1) { statusLabel = 'SECURED (TP1)'; statusIcon = <Shield size={12} />; statusColor = 'text-blue-400'; }
                        if (trade.stage === 2) { statusLabel = 'PROFIT (TP2)'; statusIcon = <DollarSign size={12} />; statusColor = 'text-emerald-400'; }
                        if (trade.stage === 3) { statusLabel = 'MOONBAG'; statusIcon = <Target size={12} />; statusColor = 'text-purple-400'; }

                        return (
                            <div key={trade.id} className="grid grid-cols-6 gap-4 px-6 py-4 items-center hover:bg-white/2 transition-colors group">

                                {/* 1. Symbol & Side */}
                                <div className="col-span-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-bold text-sm text-white">{trade.symbol.split('/')[0]}</span>
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${isLong ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                            {trade.side}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                        <Clock size={10} />
                                        {getTimeOpen(trade.created_at)}
                                    </div>
                                </div>

                                {/* 2. Entry */}
                                <div className="col-span-1 text-right font-mono text-xs text-slate-300">
                                    ${entryPrice.toLocaleString()}
                                </div>

                                {/* 3. Mark Price */}
                                <div className="col-span-1 text-right font-mono text-xs text-white font-bold group-hover:text-blue-200 transition-colors">
                                    {/* Using last_price directly from stream context if available */}
                                    ${Number(currentPrice).toLocaleString()}
                                </div>

                                {/* 4. Risk / Stop Loss */}
                                <div className="col-span-1 flex flex-col items-center justify-center">
                                    <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-slate-800/50 px-2 py-1 rounded border border-white/5">
                                        <Shield size={10} className={isWin ? "text-blue-400" : "text-rose-400"} />
                                        {trade.stop_loss ? `$${Number(trade.stop_loss).toLocaleString()}` : '---'}
                                    </div>
                                </div>

                                {/* 5. PnL */}
                                <div className={`col-span-1 text-right font-mono font-black text-sm ${pnlColor}`}>
                                    <span className={`px-2 py-1 rounded ${pnlBg}`}>
                                        {pnl > 0 ? '+' : ''}{pnl.toFixed(2)}%
                                    </span>
                                </div>

                                {/* 6. Status */}
                                <div className="col-span-1 flex justify-end">
                                    <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border border-white/5 bg-slate-900 ${statusColor}`}>
                                        {statusIcon}
                                        {statusLabel}
                                    </div>
                                </div>

                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ActiveTradesPanel;
