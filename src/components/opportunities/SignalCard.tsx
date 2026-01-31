import React from 'react';
import { AIOpportunity } from '../../types';
import {
    TrendingUp, TrendingDown, BookOpen, Clock, Globe,
    Layers, Target, Zap, Hexagon, Database, Cpu,
    Shield, AlertTriangle, Triangle, ArrowRight
} from 'lucide-react';

interface SignalCardProps {
    data: AIOpportunity;
    onSelect: () => void;
    onShowDetails: () => void;
}

const SignalCard: React.FC<SignalCardProps> = ({ data, onSelect, onShowDetails }) => {
    const isLong = data.side === 'LONG';
    const mainColor = isLong ? 'text-success' : 'text-danger';
    const bgColor = isLong ? 'bg-success/5' : 'bg-danger/5';
    const borderColor = isLong ? 'border-success/20' : 'border-danger/20';

    const getStrategyReason = (id: string) => {
        const strategy = id.toLowerCase();

        // 1. Regímenes de Mercado (Auto-Pilot)
        if (strategy.includes('trending')) return "Tendencia fuerte detectada (ADX > 25). Buscamos continuidad del movimiento.";
        if (strategy.includes('ranging')) return "Mercado lateral. Operamos reversión a la media en extremos del rango.";
        if (strategy.includes('volatile')) return "Expansión de volatilidad. Buscamos rupturas explosivas (Breakouts).";
        if (strategy.includes('extreme')) return "Condiciones extremas (Sobrecompra/Venta). Buscamos reversiones.";

        // 2. Estrategias Específicas
        if (strategy.includes('breakout')) return "Mercado con momentum. Buscamos rupturas de niveles clave.";
        if (strategy.includes('swing')) return "Mercado en rango/reversión. Buscamos rebotes en zonas de valor.";
        if (strategy.includes('meme')) return "Alta volatilidad especulativa. Aprovechando hype y volumen.";
        if (strategy.includes('scalp')) return "Micro-estructuras de corto plazo. Entradas y salidas rápidas.";
        if (strategy.includes('smc')) return "Smart Money Concepts. Cazando liquidez institucional y Order Blocks.";
        if (strategy.includes('ichimoku')) return "Equilibrio de mercado. Confirmación de tendencia con Nube Ichimoku.";
        if (strategy.includes('quant')) return "Análisis cuantitativo. Explotando ineficiencias matemáticas.";
        if (strategy.includes('divergence')) return "Agotamiento de momentum detectado. Reversión probable en zona clave.";

        // 3. Fallback
        return "Patrón de alta probabilidad estadística validado por el algoritmo.";
    };

    // Helper for clean price formatting locally
    const formatPrice = (price: number) => {
        if (!price) return '0.00';
        if (price < 0.01) return price.toFixed(8);
        if (price < 1) return price.toFixed(5);
        if (price < 10) return price.toFixed(4);
        if (price < 1000) return price.toFixed(2);
        return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    };

    return (
        <div className={`relative bg-surface border ${borderColor} rounded-xl overflow-hidden hover:shadow-lg transition-all group flex flex-col`}>
            {/* Header Ticket */}
            <div className={`p-3 md:p-4 ${bgColor} border-b ${borderColor} flex justify-between items-start`}>
                <div className="flex gap-2 md:gap-3">
                    <div className={`p-1.5 md:p-2 rounded-lg bg-surface border ${borderColor} ${mainColor}`}>
                        {isLong ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 md:gap-2">
                            <h3 className="font-bold text-base md:text-lg font-mono tracking-tight text-primary">{data.symbol}</h3>
                            <span className={`text-[9px] md:text-[10px] font-bold px-1 py-0.5 rounded border ${borderColor} ${mainColor} uppercase`}>
                                {data.side}
                            </span>
                        </div>
                        <p className="text-[9px] md:text-[10px] text-secondary mt-0.5 font-mono">
                            {new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • <span className="text-accent">{data.confidenceScore}%</span>
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex flex-col items-end">
                        <span className="hidden md:block text-[9px] text-secondary uppercase tracking-widest mb-1">Estrategia</span>
                        <span className="text-[9px] md:text-[10px] font-mono font-bold text-primary bg-background px-1.5 py-0.5 md:px-2 md:py-1 rounded border border-border">
                            {data.strategy.split('_')[0]}
                        </span>

                        {/* PAU PERDICES BADGE */}
                        {data.strategy === 'pau_perdices_gold' && (
                            <div className="mt-1 px-1.5 py-0.5 rounded border bg-yellow-400/20 border-yellow-400/50 text-yellow-500 text-[9px] font-bold flex items-center gap-1 animate-pulse shadow-[0_0_10px_rgba(250,204,21,0.2)]">
                                <span>🏆</span>
                                <span>SNIPER</span>
                            </div>
                        )}
                    </div>

                    {/* TIER BADGE */}
                    {data.tier && (
                        <div className={`mt-0.5 md:mt-1 px-1.5 py-0.5 rounded border text-[9px] md:text-[10px] font-bold font-mono flex items-center gap-1
                            ${data.tier === 'S' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' :
                                data.tier === 'A' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                                    data.tier === 'C' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                        'bg-gray-500/10 border-gray-500/30 text-gray-400'
                            }`}
                        >
                            {data.tier === 'S' && <Shield size={10} />}
                            {data.tier === 'C' && <AlertTriangle size={10} />}
                            T{data.tier}
                        </div>
                    )}
                </div>
            </div>

            {/* Institutional Metadata Bar */}
            <div className="flex items-center gap-3 md:gap-4 px-3 md:px-5 py-1.5 md:py-2 bg-background/50 border-b border-border/50 text-[9px] md:text-[10px] text-secondary font-mono uppercase tracking-tight overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1.5 shrink-0">
                    <Clock size={12} className="text-secondary/70" />
                    <span>{data.timeframe || '15m'}</span>
                </div>
                <div className="flex items-center gap-1.5 border-l border-border/50 pl-3 md:pl-4 shrink-0">
                    <Globe size={12} className="text-secondary/70" />
                    <span>{data.session || 'GLOBAL'}</span>
                </div>
                {/* Macro Compass Badge */}
                {data.metrics?.fractalAnalysis && (
                    <div className="flex items-center gap-1.5 border-l border-border/50 pl-3 md:pl-4 shrink-0">
                        {data.metrics.fractalAnalysis.trend_4h === (data.side === 'LONG' ? 'BULLISH' : 'BEARISH') ? (
                            <span className="flex items-center gap-1 text-success font-bold">
                                <Layers size={12} /> 4H
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-warning font-bold">
                                <Layers size={12} /> 4H
                            </span>
                        )}
                    </div>
                )}
                {/* Simplified Badges for Mobile */}
                {data.freezeSignal?.active && <span className="shrink-0 text-cyan-400 font-bold ml-1">❄️ SMART</span>}
                {data.mlPrediction && (
                    <span className={`shrink-0 font-bold border-l border-border/50 pl-3 md:pl-4 ${data.mlPrediction.signal === 'BULLISH' ? 'text-success' : 'text-danger'}`}>
                        AI: {data.mlPrediction.signal.charAt(0)} ({(data.mlPrediction.probability > 1 ? data.mlPrediction.probability : data.mlPrediction.probability * 100).toFixed(0)}%)
                    </span>
                )}
            </div>

            {/* Signal Body */}
            <div className="p-3 md:p-5 flex-1 space-y-3 md:space-y-5">

                {/* Entry & DCA */}
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-[9px] md:text-[10px] text-secondary uppercase font-bold">
                            Entradas (DCA)
                        </label>
                        <span className="hidden xs:inline text-[8px] text-accent/60 italic uppercase">Promediación</span>
                    </div>

                    {data.dcaPlan ? (
                        <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                            {data.dcaPlan.entries.map((entry, idx) => {
                                // Check for Market Entry Factor
                                const isMarket = entry.factors && entry.factors.some(f => f.includes('Market') || f.includes('Inmediata'));
                                const badgeColor = isMarket ? 'text-accent border-accent/20 bg-accent/5' : 'text-primary border-border bg-background';
                                const label = isMarket ? '⚡ MARKET' : `${entry.positionSize}%`;

                                return (
                                    <div key={idx} className={`p-1.5 md:p-2 border rounded flex flex-col items-center ${badgeColor}`}>
                                        <span className={`text-[8px] uppercase mb-0.5 ${isMarket ? 'text-accent font-bold' : 'text-secondary'}`}>
                                            {label}
                                        </span>
                                        <span className="font-mono text-[11px] md:text-xs font-bold text-primary">
                                            ${formatPrice(entry.price)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-1.5 bg-background border border-border rounded font-mono text-[11px] text-primary text-center">
                            ${data.entryZone.min} - ${data.entryZone.max}
                        </div>
                    )
                    }
                </div>

                {/* TP Stack */}
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-[9px] md:text-[10px] text-secondary uppercase font-bold">Objetivos</label>
                        <div className="flex gap-2">
                            <button onClick={(e) => { e.stopPropagation(); onShowDetails(); }} className="text-secondary hover:text-accent"><BookOpen size={12} /></button>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                        <div className="text-center p-1.5 md:p-2 rounded bg-success/5 border border-success/10">
                            <span className="block text-[8px] text-success/60 font-bold">TP 1</span>
                            <span className="block text-[11px] md:text-xs font-mono text-success font-bold">${formatPrice(data.takeProfits.tp1)}</span>
                        </div>
                        <div className="text-center p-1.5 md:p-2 rounded bg-success/10 border border-success/20">
                            <span className="block text-[8px] text-success/60 font-bold">TP 2</span>
                            <span className="block text-[11px] md:text-xs font-mono text-success font-bold">${formatPrice(data.takeProfits.tp2)}</span>
                        </div>
                        <div className="text-center p-1.5 md:p-2 rounded bg-success/20 border border-success/30">
                            <span className="block text-[8px] text-success/60 font-bold">TP 3</span>
                            <span className="block text-[11px] md:text-xs font-mono text-success font-bold">${formatPrice(data.takeProfits.tp3)}</span>
                        </div>
                    </div>
                </div>

                {/* Risk Engineering Bar (Compact on mobile) */}
                <div className="flex gap-2 md:gap-4">
                    <div className="flex-1 space-y-1">
                        <label className="text-[8px] md:text-[9px] text-secondary uppercase font-bold px-1">Stop Loss</label>
                        <div className="p-1.5 md:p-2 bg-danger/5 border border-danger/10 rounded font-mono text-xs text-danger font-bold text-center">
                            ${formatPrice(Number(data.stopLoss))}
                        </div>
                    </div>
                    {data.kellySize && (
                        <div className="flex-1 space-y-1">
                            <label className="text-[8px] md:text-[9px] text-accent uppercase font-bold px-1">Risk%</label>
                            <div className="p-1.5 md:p-2 bg-accent/5 border border-accent/10 rounded font-mono text-xs text-accent font-bold text-center">
                                {((data.kellySize || 0) * 100).toFixed(0)}%
                            </div>
                        </div>
                    )}
                    {data.recommendedLeverage && (
                        <div className="flex-1 space-y-1">
                            <label className="text-[8px] md:text-[9px] text-blue-400 uppercase font-bold px-1">Lev</label>
                            <div className="p-1.5 md:p-2 bg-blue-500/5 border border-blue-500/10 rounded font-mono text-xs text-blue-400 font-bold text-center">
                                {data.recommendedLeverage}x
                            </div>
                        </div>
                    )}
                </div>

                {/* Algorithm Reasoning (One line on mobile) */}
                <div className="p-2 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                    <p className="text-[9px] md:text-[10px] text-secondary italic leading-relaxed line-clamp-1 md:line-clamp-2">
                        <span className="text-blue-400 not-italic font-bold mr-1">[AI]:</span>
                        {data.technicalReasoning}
                    </p>
                </div>
            </div>

            {/* Action */}
            <div className="px-3 pb-3 md:px-4 md:pb-4">
                <button
                    onClick={onSelect}
                    className="w-full py-2.5 md:py-3 rounded-lg bg-primary hover:bg-white text-background font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                    Analizar Gráfico <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );
};

export default SignalCard;
