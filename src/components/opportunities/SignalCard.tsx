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
            <div className={`p-4 ${bgColor} border-b ${borderColor} flex justify-between items-start`}>
                <div className="flex gap-3">
                    <div className={`p-2 rounded-lg bg-surface border ${borderColor} ${mainColor}`}>
                        {isLong ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg font-mono tracking-tight text-primary">{data.symbol}</h3>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${borderColor} ${mainColor} uppercase`}>
                                {data.side}
                            </span>
                        </div>
                        <p className="text-[10px] text-secondary mt-0.5 font-mono">
                            {new Date(data.timestamp).toLocaleTimeString()} • Score: <span className="text-accent">{data.confidenceScore}%</span>
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] text-secondary uppercase tracking-widest mb-1">Estrategia</span>
                        <span className="text-[10px] font-mono font-bold text-primary bg-background px-2 py-1 rounded border border-border">
                            {data.strategy.split('_')[0]}
                        </span>
                    </div>

                    {/* TIER BADGE */}
                    {data.tier && (
                        <div className={`mt-1 px-2 py-0.5 rounded border text-[10px] font-bold font-mono flex items-center gap-1
                            ${data.tier === 'S' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' :
                                data.tier === 'A' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                                    data.tier === 'C' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                        'bg-gray-500/10 border-gray-500/30 text-gray-400'
                            }`}
                            title={`Fundamental Tier: ${data.tier} (Risk Assessment)`}
                        >
                            {data.tier === 'S' && <Shield size={10} />}
                            {data.tier === 'C' && <AlertTriangle size={10} />}
                            TIER {data.tier}
                        </div>
                    )}

                    {/* INFO BUTTON */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onShowDetails(); }}
                        className="mt-1 p-1 text-secondary hover:text-accent transition-colors"
                        title="Ver Explicación Educativa"
                    >
                        <BookOpen size={14} />
                    </button>
                </div>
            </div>

            {/* Institutional Metadata Bar */}
            <div className="flex items-center gap-4 px-5 py-2 bg-background/50 border-b border-border/50 text-[10px] text-secondary font-mono uppercase tracking-tight overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1.5 shrink-0" title="Timeframe Analizado">
                    <Clock size={12} className="text-secondary/70" />
                    <span>{data.timeframe || '15m'}</span>
                </div>
                <div className="flex items-center gap-1.5 border-l border-border/50 pl-4 shrink-0" title="Sesión de Mercado">
                    <Globe size={12} className="text-secondary/70" />
                    <span>{data.session || 'GLOBAL'}</span>
                </div>
                {/* Macro Compass Badge */}
                {data.metrics?.fractalAnalysis && (
                    <div className="flex items-center gap-1.5 border-l border-border/50 pl-4 shrink-0" title="Macro Tendencia (4H)">
                        {data.metrics.fractalAnalysis.trend_4h === (data.side === 'LONG' ? 'BULLISH' : 'BEARISH') ? (
                            <span className="flex items-center gap-1 text-success font-bold animate-pulse">
                                <Layers size={12} /> 4H ALIGNED
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-warning font-bold">
                                <Layers size={12} /> 4H NEUTRAL
                            </span>
                        )}
                    </div>
                )}
                {/* Freeze Badge */}
                {data.freezeSignal?.active && (
                    <div className="flex items-center gap-1.5 border-l border-border/50 pl-4 text-cyan-400 animate-pulse shrink-0">
                        <span className="text-sm">❄️</span>
                        <span className="font-bold">SMART FREEZE</span>
                    </div>
                )}
                {/* Harmonic Badge */}
                {data.harmonicPatterns && data.harmonicPatterns.length > 0 && (
                    <div className="flex items-center gap-1.5 border-l border-border/50 pl-4 text-purple-400 animate-pulse shrink-0">
                        <Hexagon size={12} />
                        <span className="font-bold">{data.harmonicPatterns[0].type}</span>
                    </div>
                )}
                {/* Squeeze Badge */}
                {data.metrics?.isSqueeze && (
                    <div className="flex items-center gap-1.5 border-l border-border/50 pl-4 text-warning animate-pulse shrink-0">
                        <Zap size={12} />
                        <span className="font-bold">TTM SQUEEZE</span>
                    </div>
                )}
                {/* MACD Div Badge */}
                {data.metrics?.macdDivergence && (
                    <div className="flex items-center gap-1.5 border-l border-border/50 pl-4 text-cyan-400 shrink-0">
                        <Target size={12} />
                        <span className="font-bold">DIV MACD</span>
                    </div>
                )}
                {/* Whale Alert Badge */}
                {data.metrics?.volumeExpert?.cvd?.divergence?.includes('ABSORPTION') && (
                    <div className="flex items-center gap-1.5 border-l border-border/50 pl-4 text-cyan-400 animate-pulse shrink-0">
                        <Database size={12} />
                        <span className="font-bold">WHALE ALERT</span>
                    </div>
                )}
                {/* ML Brain Badge */}
                {data.mlPrediction && (
                    <div className={`flex items-center gap-1.5 border-l border-border/50 pl-4 shrink-0 ${data.mlPrediction.signal === 'BULLISH' ? 'text-success' : data.mlPrediction.signal === 'BEARISH' ? 'text-danger' : 'text-secondary/70'
                        } animate-pulse`} title={`Predicción Neuronal: ${data.mlPrediction.signal} (${(data.mlPrediction.probability || 0).toFixed(1)}%)`}>
                        <Cpu size={12} />
                        <span className="font-bold">AI: {data.mlPrediction.signal}</span>
                    </div>
                )}
            </div>

            {/* Signal Body */}
            <div className="p-5 flex-1 space-y-5">

                {/* Strategy Context */}
                <div className="flex items-start gap-2 p-2 bg-background border border-border rounded-lg">
                    <Cpu size={14} className="text-accent mt-0.5 shrink-0" />
                    <div>
                        <span className="block text-[9px] text-secondary uppercase font-bold">¿Por qué esta estrategia?</span>
                        <p className="text-[10px] text-primary leading-tight">
                            {getStrategyReason(data.strategy)}
                        </p>
                    </div>
                </div>

                {/* Entry & DCA */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-secondary uppercase font-bold flex items-center gap-1">
                            <Layers size={10} /> Plan de Entrada Institucional (DCA)
                        </label>
                        <span className="text-[9px] text-accent/80 italic">Promediación Inteligente</span>
                    </div>

                    {data.dcaPlan ? (
                        <div className="grid grid-cols-3 gap-2">
                            {/* Entry 1 */}
                            <div className="p-2 bg-background border border-border rounded flex flex-col items-center group/entry hover:border-primary/30 transition-colors cursor-help" title="Entrada Inicial: 40% del capital asignado">
                                <span className="text-[9px] text-secondary uppercase mb-0.5">Inicial (40%)</span>
                                <span className="font-mono text-xs font-bold text-primary">${formatPrice(data.dcaPlan.entries[0].price)}</span>
                            </div>
                            {/* Entry 2 */}
                            <div className="p-2 bg-background border border-border rounded flex flex-col items-center group/entry hover:border-primary/30 transition-colors cursor-help" title="DCA 1: 30% del capital. Zona de soporte intermedio.">
                                <span className="text-[9px] text-secondary uppercase mb-0.5">DCA 1 (30%)</span>
                                <span className="font-mono text-xs font-bold text-primary">${formatPrice(data.dcaPlan.entries[1].price)}</span>
                            </div>
                            {/* Entry 3 */}
                            <div className="p-2 bg-background border border-border rounded flex flex-col items-center group/entry hover:border-accent/50 transition-colors cursor-help" title="DCA 2: 30% del capital. Zona de 'Golden Pocket' o soporte mayor.">
                                <span className="text-[9px] text-secondary uppercase mb-0.5">DCA 2 (30%)</span>
                                <span className="font-mono text-xs font-bold text-accent">${formatPrice(data.dcaPlan.entries[2].price)}</span>
                            </div>
                        </div>
                    ) : (
                        // Fallback for old signals or errors
                        <div className="p-2 bg-background border border-border rounded font-mono text-xs text-primary text-center">
                            ${data.entryZone.min} - ${data.entryZone.max}
                        </div>
                    )}
                </div>

                {/* TP Stack */}
                <div className="space-y-2">
                    <label className="text-[10px] text-secondary uppercase font-bold">Objetivos (Take Profit)</label>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 rounded bg-success/5 border border-success/10">
                            <span className="block text-[9px] text-success/70 font-bold">TP 1</span>
                            <span className="block text-xs font-mono text-success font-bold">${formatPrice(data.takeProfits.tp1)}</span>
                        </div>
                        <div className="text-center p-2 rounded bg-success/10 border border-success/20">
                            <span className="block text-[9px] text-success/70 font-bold">TP 2</span>
                            <span className="block text-xs font-mono text-success font-bold">${formatPrice(data.takeProfits.tp2)}</span>
                        </div>
                        <div className="text-center p-2 rounded bg-success/20 border border-success/30 relative overflow-hidden">
                            <span className="block text-[9px] text-success/70 font-bold">TP 3</span>
                            <span className="block text-xs font-mono text-success font-bold">${formatPrice(data.takeProfits.tp3)}</span>
                        </div>
                    </div>
                </div>

                {/* SL & Risk Engineering Bar */}
                <div className="flex gap-4">
                    <div className="flex-1 space-y-1">
                        <label className="text-[9px] text-secondary uppercase font-bold">Stop Loss</label>
                        <div className="p-2 bg-danger/5 border border-danger/10 rounded font-mono text-xs text-danger font-bold text-center">
                            ${formatPrice(Number(data.stopLoss))}
                        </div>
                    </div>
                    {data.kellySize && (
                        <div className="flex-1 space-y-1">
                            <label className="text-[9px] text-accent uppercase font-bold">Kelly (Size)</label>
                            <div className="p-2 bg-accent/5 border border-accent/10 rounded font-mono text-xs text-accent font-bold text-center">
                                {((data.kellySize || 0) * 100).toFixed(1)}%
                            </div>
                        </div>
                    )}
                    {data.recommendedLeverage && (
                        <div className="flex-1 space-y-1">
                            <label className="text-[9px] text-blue-400 uppercase font-bold">Leverage</label>
                            <div className="p-2 bg-blue-500/5 border border-blue-500/10 rounded font-mono text-xs text-blue-400 font-bold text-center">
                                {(data.recommendedLeverage || 1).toFixed(1)}x
                            </div>
                        </div>
                    )}
                </div>

                {/* Algorithm Reasoning Summary */}
                <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                    <p className="text-[10px] text-secondary italic leading-relaxed line-clamp-2">
                        <span className="text-blue-400 not-italic font-bold mr-1">[ALGORITMO]:</span>
                        {data.technicalReasoning}
                    </p>
                </div>
            </div>

            {/* Action */}
            <div className="p-4 pt-0">
                <button
                    onClick={onSelect}
                    className="w-full py-3 rounded-lg bg-primary hover:bg-white text-background font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                >
                    Ver en Gráfico <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );
};

export default SignalCard;
