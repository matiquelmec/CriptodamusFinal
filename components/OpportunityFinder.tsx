import React, { useEffect, useState } from 'react';
import { AIOpportunity, TradingStyle } from '../types';
import { scanMarketOpportunities } from '../services/cryptoService';
import { Crosshair, RefreshCw, BarChart2, ArrowRight, Target, Shield, Zap, TrendingUp, TrendingDown, Layers, AlertTriangle, Cloud, Clock } from 'lucide-react';

interface OpportunityFinderProps {
    onSelectOpportunity: (symbol: string) => void;
}

const OpportunityFinder: React.FC<OpportunityFinderProps> = ({ onSelectOpportunity }) => {
    const [opportunities, setOpportunities] = useState<AIOpportunity[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [style, setStyle] = useState<TradingStyle>('SCALP_AGRESSIVE');
    const [cooldown, setCooldown] = useState(0);

    const scan = async () => {
        if (cooldown > 0) return;

        setLoading(true);
        setError(null);
        setOpportunities([]); // Clear previous
        
        try {
            const opps = await scanMarketOpportunities(style);
            setOpportunities(opps);
        } catch (e: any) {
            console.error(e);
            if (e.message && (e.message.includes('429') || e.message.includes('Quota'))) {
                setError("Límite de API alcanzado. El sistema está enfriándose.");
                startCooldown(60); // 60s cooldown for quota reset
            } else {
                setError("Error de conexión al escanear el mercado.");
            }
        } finally {
            setLoading(false);
        }
    };

    const startCooldown = (seconds: number) => {
        setCooldown(seconds);
        const interval = setInterval(() => {
            setCooldown((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    // Auto-scan on style change only if not in cooldown
    useEffect(() => {
        if (cooldown === 0) {
            scan();
        }
    }, [style]);

    return (
        <div className="h-full bg-surface border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
            {/* Header / Controls */}
            <div className="p-4 border-b border-border bg-background/50 backdrop-blur-sm flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-accent to-blue-700 rounded-lg text-white shadow-lg shadow-accent/20">
                        <Crosshair size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-mono font-bold text-primary uppercase tracking-wider">Quant AI Scanner</h2>
                        <p className="text-[10px] text-secondary">Generador de Señales Gemini 2.5</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 bg-background p-1 rounded-lg border border-border">
                    <button 
                        onClick={() => setStyle('SCALP_AGRESSIVE')}
                        disabled={cooldown > 0}
                        className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold transition-all uppercase flex items-center gap-2 ${style === 'SCALP_AGRESSIVE' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-secondary hover:text-primary'}`}
                    >
                        <Zap size={12} /> Scalp
                    </button>
                    <button 
                        onClick={() => setStyle('SWING_INSTITUTIONAL')}
                        disabled={cooldown > 0}
                        className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold transition-all uppercase flex items-center gap-2 ${style === 'SWING_INSTITUTIONAL' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-secondary hover:text-primary'}`}
                    >
                        <Layers size={12} /> Swing
                    </button>
                    <button 
                        onClick={() => setStyle('BREAKOUT_MOMENTUM')}
                        disabled={cooldown > 0}
                        className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold transition-all uppercase flex items-center gap-2 ${style === 'BREAKOUT_MOMENTUM' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-secondary hover:text-primary'}`}
                    >
                        <TrendingUp size={12} /> Breakout
                    </button>
                     <button 
                        onClick={() => setStyle('ICHIMOKU_CLOUD')}
                        disabled={cooldown > 0}
                        className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold transition-all uppercase flex items-center gap-2 ${style === 'ICHIMOKU_CLOUD' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-secondary hover:text-primary'}`}
                    >
                        <Cloud size={12} /> Ichimoku
                    </button>
                </div>

                <button 
                    onClick={scan} 
                    disabled={loading || cooldown > 0}
                    className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded font-mono text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-accent/10 min-w-[120px] justify-center"
                >
                    {loading ? (
                        <RefreshCw size={14} className="animate-spin" />
                    ) : cooldown > 0 ? (
                        <Clock size={14} className="animate-pulse" />
                    ) : (
                        <RefreshCw size={14} />
                    )}
                    {loading ? 'Analizando...' : cooldown > 0 ? `Espera ${cooldown}s` : 'Actualizar'}
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-background/50">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-secondary gap-6">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-border rounded-full border-t-accent animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Zap size={24} className="text-accent animate-pulse" />
                            </div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-sm font-mono font-bold text-primary mb-1">IA Analizando Estructura...</h3>
                            <p className="text-xs font-mono opacity-70">
                                {style === 'SCALP_AGRESSIVE' && "Buscando divergencias y sobrecompra/venta..."}
                                {style === 'SWING_INSTITUTIONAL' && "Calculando niveles Fibonacci y Order Blocks..."}
                                {style === 'BREAKOUT_MOMENTUM' && "Midiendo volumen relativo y roturas..."}
                                {style === 'ICHIMOKU_CLOUD' && "Evaluando Kumo Cloud y Tenkan/Kijun Cross..."}
                            </p>
                            <p className="text-[10px] mt-4 text-secondary/50 animate-pulse">Optimizando peticiones para evitar congestión...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="h-full flex flex-col items-center justify-center text-secondary gap-3 opacity-80">
                         <div className="p-3 bg-danger/10 rounded-full text-danger mb-2">
                             <AlertTriangle size={32} />
                         </div>
                        <span className="font-mono text-sm text-danger font-bold">Sistema en Pausa</span>
                        <span className="text-xs max-w-xs text-center">{error}</span>
                        {cooldown === 0 && (
                            <button onClick={scan} className="mt-2 px-4 py-2 bg-surface border border-border hover:bg-background rounded text-xs">
                                Reintentar Ahora
                            </button>
                        )}
                    </div>
                ) : opportunities.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-secondary gap-3 opacity-60">
                        <BarChart2 size={48} strokeWidth={1} />
                        <h3 className="font-mono text-sm font-bold">Escaneo Completado: 0 Resultados</h3>
                        <p className="text-xs text-center max-w-sm">
                            El sistema analizó las 30 monedas principales, pero ninguna superó el umbral de confianza (>65%) para la estrategia <span className="text-primary font-bold">{style.split('_')[0]}</span>.
                        </p>
                        <p className="text-[10px] mt-2 bg-surface p-2 rounded border border-border">
                            El sistema funciona correctamente. Simplemente no hay operaciones de alta probabilidad ahora mismo.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {opportunities.map((opp) => (
                            <SignalCard key={opp.id} data={opp} onSelect={() => onSelectOpportunity(opp.symbol.split('/')[0])} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// Sub-component for the "Signal Ticket" look
const SignalCard = ({ data, onSelect }: { data: AIOpportunity, onSelect: () => void }) => {
    const isLong = data.side === 'LONG';
    const mainColor = isLong ? 'text-success' : 'text-danger';
    const bgColor = isLong ? 'bg-success/5' : 'bg-danger/5';
    const borderColor = isLong ? 'border-success/20' : 'border-danger/20';

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
                <div className="flex flex-col items-end">
                    <span className="text-[9px] text-secondary uppercase tracking-widest mb-1">Estrategia</span>
                    <span className="text-[10px] font-mono font-bold text-primary bg-background px-2 py-1 rounded border border-border">
                        {data.strategy.split('_')[0]}
                    </span>
                </div>
            </div>

            {/* Signal Body */}
            <div className="p-5 flex-1 space-y-5">
                
                {/* Entry & DCA */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] text-secondary uppercase font-bold flex items-center gap-1">
                            <Target size={10} /> Zona Entrada
                        </label>
                        <div className="p-2 bg-background border border-border rounded font-mono text-xs text-primary">
                            ${data.entryZone.min} - ${data.entryZone.max}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-secondary uppercase font-bold flex items-center gap-1">
                            <Layers size={10} /> {data.dcaLevel ? 'DCA (Límite)' : 'Entrada 2'}
                        </label>
                        <div className={`p-2 bg-background border border-border rounded font-mono text-xs ${data.dcaLevel ? 'text-accent' : 'text-secondary/50'}`}>
                            {data.dcaLevel ? `$${data.dcaLevel}` : 'N/A'}
                        </div>
                    </div>
                </div>

                {/* TP Stack */}
                <div className="space-y-2">
                     <label className="text-[10px] text-secondary uppercase font-bold">Objetivos (Take Profit)</label>
                     <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 rounded bg-success/5 border border-success/10">
                            <span className="block text-[9px] text-success/70 font-bold">TP 1</span>
                            <span className="block text-xs font-mono text-success font-bold">${data.takeProfits.tp1}</span>
                        </div>
                        <div className="text-center p-2 rounded bg-success/10 border border-success/20">
                            <span className="block text-[9px] text-success/70 font-bold">TP 2</span>
                            <span className="block text-xs font-mono text-success font-bold">${data.takeProfits.tp2}</span>
                        </div>
                        <div className="text-center p-2 rounded bg-success/20 border border-success/30 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-2 h-2 bg-accent rounded-full animate-ping"></div>
                            <span className="block text-[9px] text-success/70 font-bold">TP 3</span>
                            <span className="block text-xs font-mono text-success font-bold">${data.takeProfits.tp3}</span>
                        </div>
                     </div>
                </div>

                {/* Stop Loss & Reason */}
                <div className="flex gap-4">
                     <div className="flex-1 space-y-1">
                        <label className="text-[10px] text-secondary uppercase font-bold flex items-center gap-1">
                            <Shield size={10} /> Stop Loss
                        </label>
                        <div className="p-2 bg-danger/10 border border-danger/20 rounded font-mono text-xs text-danger font-bold">
                            ${data.stopLoss}
                        </div>
                     </div>
                </div>
                
                <div className="p-3 bg-accent/5 border border-accent/10 rounded-lg">
                    <p className="text-[10px] text-secondary italic leading-relaxed">
                        "<span className="text-accent not-italic font-medium">{data.technicalReasoning}</span>"
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
    )
}

export default OpportunityFinder;