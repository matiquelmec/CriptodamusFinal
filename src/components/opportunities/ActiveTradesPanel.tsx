import React, { useState, useMemo } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useRealtimeTrades } from '../../hooks/useRealtimeTrades';
import { TrendingUp, TrendingDown, Clock, Shield, Target, DollarSign, Activity, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const ActiveTradesPanel: React.FC = () => {
    const { activeTrades, isConnected } = useSocket();
    const { trades: realtimeUpdates } = useRealtimeTrades();
    const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed

    // HYBRID MERGE: Socket (Fast Price) + RealtimeDB (Reliable State/SL/TP)
    const displayTrades = useMemo(() => {
        if (!activeTrades) return [];
        // Filter out any technical rejections that might have leaked
        const filtered = activeTrades.filter(t => !t.status?.startsWith('REJECTED_'));

        return filtered.map(socketTrade => {
            // Find if we have a fresher DB update for this trade
            const dbUpdate = realtimeUpdates.find(r => r.id === socketTrade.id);
            if (dbUpdate) {
                return {
                    ...socketTrade,
                    ...dbUpdate,
                    // Prefer Socket Price if available (fresher tick), otherwise DB price
                    final_price: socketTrade.last_price || socketTrade.final_price || dbUpdate.final_price
                };
            }
            return socketTrade;
        });
    }, [activeTrades, realtimeUpdates]);

    if (!displayTrades || displayTrades.length === 0) {
        // STANDBY MODE: Show that the system is ready and listening
        return (
            <div className="mb-4 md:mb-6 mx-2 md:mx-4 p-[1px] rounded-2xl md:rounded-3xl bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-white/5 opacity-70 hover:opacity-100 transition-opacity">
                <div className="bg-[#0a0c10]/95 backdrop-blur-sm rounded-[15px] md:rounded-[23px] px-3 md:px-6 py-3 md:py-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-1.5 md:p-2 bg-slate-800 rounded-lg md:rounded-xl text-slate-500">
                            <Activity size={16} className="md:w-5 md:h-5" />
                        </div>
                        <div>
                            <h2 className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider">
                                Sala de Control <span className="text-[9px] md:text-[10px] bg-slate-800 text-slate-500 px-1.5 md:px-2 py-0.5 rounded-full border border-slate-700">STANDBY</span>
                            </h2>
                            <p className="text-[9px] md:text-[10px] text-slate-600">Esperando ejecución profesional...</p>
                        </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-600">
                        <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {isConnected ? 'SYSTEM ONLINE' : 'OFFLINE'}
                    </div>
                </div>
            </div>
        );
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

                {/* Header - Clickable */}
                <div
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/2 cursor-pointer hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 animate-pulse">
                            <Activity size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                Sala de Control <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">LIVE</span>
                                <span className="text-[10px] font-mono text-slate-500">({activeTrades.length} {activeTrades.length === 1 ? 'posición' : 'posiciones'})</span>
                            </h2>
                            <p className="text-[10px] text-slate-400">Seguimiento Institucional en Tiempo Real</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                            {isConnected ? 'FEED STABLE' : 'RECONNECTING'}
                        </div>
                        <button className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                            {isCollapsed ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronUp size={16} className="text-slate-400" />}
                        </button>
                    </div>
                </div>

                {/* Collapsible Content */}
                {!isCollapsed && (
                    <>
                        {/* Table Header */}
                        <div className="grid grid-cols-7 gap-4 px-6 py-2 bg-white/2 text-[9px] uppercase tracking-widest font-bold text-slate-500 border-b border-white/5">
                            <div className="col-span-1">Activo / Lado</div>
                            <div className="col-span-1 text-right">Entrada</div>
                            <div className="col-span-1 text-right">Precio Mark</div>
                            <div className="col-span-1 text-center">Riesgo (Dynamic)</div>
                            <div className="col-span-1 text-center">Objetivo (Dynamic)</div>
                            <div className="col-span-1 text-right">PnL (%)</div>
                            <div className="col-span-1 text-right">Estado</div>
                        </div>

                        {/* Rows */}
                        <div className="divide-y divide-white/5">
                            {displayTrades.map((trade) => {
                                const isLong = trade.side === 'LONG';

                                // --- STATUS LOGIC ROBUSTA ---
                                // Prioridad: STATUS explícito del Backend (PENDING vs ACTIVE)
                                const status = trade.status || 'OPEN'; // Fallback
                                const isPending = status === 'PENDING';
                                const isActive = status === 'ACTIVE' || status === 'OPEN' || status === 'PARTIAL_WIN';

                                // PnL Rendering
                                let pnl = trade.pnl_percent || 0;
                                let showPnl = true;

                                if (isPending) {
                                    pnl = 0;
                                    showPnl = false; // Ocultar PnL si aún no hemos entrado
                                }

                                const isWin = pnl > 0;
                                const pnlColor = isWin ? 'text-emerald-400' : 'text-rose-400';
                                const pnlBg = isWin ? 'bg-emerald-500/5' : 'bg-rose-500/5';

                                // Prices
                                // Entry Price: Si es Pending = Precio Objetivo. Si es Active = Precio de Activación Real.
                                const entryPrice = trade.activation_price || trade.entry_price || 0;
                                const currentPrice = trade.last_price || trade.final_price || entryPrice;

                                // Identify Active Target (TP1, TP2, TP3)
                                const stage = trade.stage || 0;
                                let nextTp = trade.tp1;
                                let tpLabel = "TP1";
                                if (stage === 1) { nextTp = trade.tp2; tpLabel = "TP2"; }
                                if (stage === 2) { nextTp = trade.tp3; tpLabel = "TP3"; }
                                if (stage >= 3) { nextTp = null; tpLabel = "MOON"; }

                                const isAdapted = trade.technical_reasoning?.includes('Updated') || trade.technical_reasoning?.includes('NUCLEAR');

                                // --- BADGE LOGIC ---
                                let statusLabel = 'OPEN';
                                let statusIcon = <Clock size={12} />;
                                let statusColor = 'text-slate-400';
                                let statusBorder = 'border-slate-800';

                                if (isPending) {
                                    statusLabel = 'ESPERANDO';
                                    statusIcon = <Clock size={12} />;
                                    statusColor = 'text-yellow-400';
                                    statusBorder = 'border-yellow-500/30 bg-yellow-500/10';
                                } else if (isActive) {
                                    statusLabel = 'OPERANDO';
                                    statusIcon = <Activity size={12} />;
                                    statusColor = 'text-blue-400';
                                    statusBorder = 'border-blue-500/30 bg-blue-500/10';
                                }

                                // Overrides for Stages
                                if (stage === 1) { statusLabel = 'TP1 SECURED'; statusIcon = <Shield size={12} />; statusColor = 'text-emerald-400'; statusBorder = 'border-emerald-500/30 bg-emerald-500/10'; }
                                if (stage === 2) { statusLabel = 'TP2 PROFIT'; statusIcon = <DollarSign size={12} />; statusColor = 'text-emerald-400'; statusBorder = 'border-emerald-500/30 bg-emerald-500/10'; }
                                if (stage === 3) { statusLabel = 'MOONBAG'; statusIcon = <Target size={12} />; statusColor = 'text-purple-400'; statusBorder = 'border-purple-500/30 bg-purple-500/10'; }

                                return (
                                    <div key={trade.id} className="grid grid-cols-7 gap-4 px-6 py-4 items-center hover:bg-white/2 transition-colors group">

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
                                        <div className="col-span-1 text-right flex flex-col justify-center">
                                            <span className="font-mono text-xs text-slate-300">${Number(entryPrice || 0).toLocaleString()}</span>
                                            {isPending && <span className="text-[8px] text-yellow-500/70 uppercase">Objetivo</span>}
                                        </div>

                                        {/* 3. Mark Price */}
                                        <div className="col-span-1 text-right font-mono text-xs text-white font-bold group-hover:text-blue-200 transition-colors">
                                            ${Number(currentPrice || 0).toLocaleString()}
                                        </div>

                                        {/* 4. Risk / Stop Loss */}
                                        <div className="col-span-1 flex flex-col items-center justify-center">
                                            <div className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded border ${stage >= 1 ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' : 'bg-slate-800/50 text-slate-400 border-white/5'}`}>
                                                <Shield size={10} className={stage >= 1 ? "text-blue-400" : (isWin ? "text-blue-400" : "text-rose-400")} />
                                                {trade.stop_loss ? `$${Number(trade.stop_loss || 0).toLocaleString()}` : '---'}
                                                {stage >= 1 && <span className="text-[8px] opacity-70 ml-1">🔒</span>}
                                            </div>
                                        </div>

                                        {/* 5. Dynamic Target  */}
                                        <div className="col-span-1 flex flex-col items-center justify-center">
                                            <div className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded border ${isAdapted ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30 animate-pulse' : 'bg-slate-800/30 text-slate-400 border-white/5'}`}>
                                                <Target size={10} className={isAdapted ? "text-indigo-400" : "text-slate-500"} />
                                                {nextTp ? (
                                                    <>
                                                        <span className="opacity-50 text-[9px]">{tpLabel}:</span>
                                                        ${Number(nextTp).toLocaleString()}
                                                    </>
                                                ) : (
                                                    <span>🚀 RUN</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* 6. PnL */}
                                        <div className={`col-span-1 text-right font-mono font-black text-sm ${showPnl ? pnlColor : 'text-slate-600'}`}>
                                            {showPnl ? (
                                                <span className={`px-2 py-1 rounded ${pnlBg}`}>
                                                    {pnl > 0 ? '+' : ''}{pnl.toFixed(2)}%
                                                </span>
                                            ) : (
                                                <span className="text-[10px] uppercase tracking-widest opacity-50">Esperando</span>
                                            )}
                                        </div>

                                        {/* 7. Status Badge */}
                                        <div className="col-span-1 flex justify-end">
                                            <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border ${statusBorder} ${statusColor}`}>
                                                {statusIcon}
                                                {statusLabel}
                                            </div>
                                        </div>

                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};


export default ActiveTradesPanel;
