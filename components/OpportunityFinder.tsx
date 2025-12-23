
import React, { useEffect, useState } from 'react';
import { AIOpportunity, TradingStyle, MarketRisk } from '../types';
import { scanMarketOpportunities, getMarketRisk } from '../services/cryptoService';
import { STRATEGIES } from '../services/strategyContext';
import { Crosshair, RefreshCw, BarChart2, ArrowRight, Target, Shield, Zap, TrendingUp, TrendingDown, Layers, AlertTriangle, Cloud, Cpu, Rocket, Eye, BookOpen, X, Calculator, Activity, Database, Lightbulb, Clock, Globe, Hexagon } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import { GLOSSARY } from '../constants/glossary';
import { useOpportunityCache } from '../hooks/useOpportunityCache';
import ProgressIndicator from './ProgressIndicator';

interface OpportunityFinderProps {
    onSelectOpportunity: (symbol: string) => void;
}

const OpportunityFinder: React.FC<OpportunityFinderProps> = ({ onSelectOpportunity }) => {
    const [opportunities, setOpportunities] = useState<AIOpportunity[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detectedRegime, setDetectedRegime] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);
    const [currentRisk, setCurrentRisk] = useState<MarketRisk | null>(null);
    const [selectedSignal, setSelectedSignal] = useState<AIOpportunity | null>(null);

    // NEW: Progress tracking
    const [scanProgress, setScanProgress] = useState({ step: '', progress: 0 });

    // NEW: Cache integration
    const { cachedData, saveCache, clearCache, cacheAge } = useOpportunityCache();
    const [isFromCache, setIsFromCache] = useState(false);

    const scan = async () => {
        if (cooldown > 0) return;

        setLoading(true);
        setError(null);
        setOpportunities([]); // Clear previous
        setIsFromCache(false);
        clearCache(); // Clear old cache when doing fresh scan

        try {
            // NEW: Progress tracking
            setScanProgress({ step: 'Obteniendo datos de mercado...', progress: 10 });

            const [opps, riskData] = await Promise.all([
                scanMarketOpportunities('SCALP_AGRESSIVE'),
                getMarketRisk()
            ]);

            setScanProgress({ step: 'Procesando señales...', progress: 90 });

            setOpportunities(opps);
            setCurrentRisk(riskData);

            // Extract detected regime from first opportunity
            if (opps.length > 0 && opps[0].strategy) {
                setDetectedRegime(opps[0].strategy);
                // NEW: Save to cache
                saveCache(opps, opps[0].strategy);
            }

            setScanProgress({ step: 'Completado', progress: 100 });
        } catch (e: any) {
            console.error(e);
            setError("Error de conexión al obtener datos de mercado.");
        } finally {
            setLoading(false);
        }
    };

    // Auto-scan on mount OR load from cache
    useEffect(() => {
        // Try to load from cache first
        if (cachedData && cachedData.opportunities.length > 0) {
            console.log('[OpportunityFinder] Loading from cache...');
            setOpportunities(cachedData.opportunities);
            setDetectedRegime(cachedData.regime || null);
            setIsFromCache(true);
        } else {
            // No cache, do fresh scan
            scan();
        }
    }, []);

    return (
        <div className="h-full bg-surface border border-border rounded-xl shadow-sm flex flex-col overflow-hidden relative">
            {/* Header / Controls */}
            <div className="p-4 border-b border-border bg-background/50 backdrop-blur-sm flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg text-white shadow-lg shadow-blue-500/20">
                            <Cpu size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-mono font-bold text-primary uppercase tracking-wider">Criptodamus Auto-Pilot</h2>
                            <p className="text-[10px] text-secondary">Motor Matemático Autónomo v4.0</p>
                        </div>
                    </div>

                    <button
                        onClick={scan}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-white text-background rounded font-mono text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md min-w-[120px] justify-center ml-auto md:ml-0"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        {loading ? 'Calculando...' : 'Escanear'}
                    </button>
                </div>

                {/* Risk Shield Banner */}
                {currentRisk && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${currentRisk.level === 'HIGH' ? 'bg-danger/10 border-danger/20 text-danger' :
                        currentRisk.level === 'MEDIUM' ? 'bg-warning/10 border-warning/20 text-warning' :
                            'bg-success/5 border-success/10 text-success'
                        }`}>
                        {currentRisk.riskType === 'MANIPULATION' ? (
                            <Eye size={14} className={currentRisk.level === 'HIGH' ? 'animate-pulse' : ''} />
                        ) : (
                            <Shield size={14} className={currentRisk.level === 'HIGH' ? 'animate-pulse' : ''} />
                        )}

                        <span className="text-[10px] font-mono font-bold uppercase">
                            {currentRisk.riskType === 'MANIPULATION' ? 'Whale Alert' : `Escudo Macro: ${currentRisk.level}`}
                        </span>
                        <span className="text-[10px] opacity-80 border-l border-current pl-2 ml-1 truncate">
                            {currentRisk.note}
                        </span>
                    </div>
                )}

                {/* Autonomous Mode Indicator */}
                <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Cpu className="text-blue-400 animate-pulse" size={16} />
                            <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider">
                                Modo Autónomo Activo
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {detectedRegime && (
                                <div className="flex items-center gap-2 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                                    <Activity size={12} className="text-cyan-400" />
                                    <span className="text-[10px] font-mono text-cyan-400">
                                        {detectedRegime}
                                    </span>
                                </div>
                            )}
                            {/* NEW: Cache Indicator */}
                            {isFromCache && cacheAge && (
                                <div className="flex items-center gap-1.5 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                                    <Database size={12} className="text-amber-400" />
                                    <span className="text-[10px] font-mono text-amber-400">
                                        Cache: {cacheAge}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <p className="text-[10px] text-secondary mt-2 leading-relaxed">
                        El sistema detecta automáticamente el régimen de mercado y selecciona las estrategias óptimas con ponderación inteligente.
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-background/50">
                {loading ? (
                    <ProgressIndicator step={scanProgress.step} progress={scanProgress.progress} />
                ) : error ? (
                    <div className="h-full flex flex-col items-center justify-center text-secondary gap-3 opacity-80">
                        <div className="p-3 bg-danger/10 rounded-full text-danger mb-2">
                            <AlertTriangle size={32} />
                        </div>
                        <span className="font-mono text-sm text-danger font-bold">Error de Datos</span>
                        <span className="text-xs max-w-xs text-center">{error}</span>
                        <button onClick={scan} className="mt-2 px-4 py-2 bg-surface border border-border hover:bg-background rounded text-xs">
                            Reintentar
                        </button>
                    </div>
                ) : opportunities.length === 0 ? (
                    // SMART EMPTY STATE: Check if empty because of RISK or just NO SETUPS
                    (currentRisk?.level === 'HIGH' || currentRisk?.riskType === 'MANIPULATION') ? (
                        <div className="h-full flex flex-col items-center justify-center text-secondary gap-4 px-6 max-w-2xl mx-auto animate-pulse">
                            <div className="p-4 bg-danger/10 rounded-full border border-danger/20">
                                <Shield size={48} className="text-danger" />
                            </div>
                            <div className="text-center space-y-3">
                                <h3 className="text-lg font-bold text-danger">🛡️ MODO PROTECCIÓN ACTIVO</h3>
                                <p className="text-sm text-secondary leading-relaxed">
                                    El sistema ha <span className="text-danger font-bold">BLOQUEADO</span> temporalmente la búsqueda de señales debido a condiciones de alto riesgo.
                                </p>
                                <div className="bg-danger/5 border border-danger/10 rounded-lg p-4 text-left space-y-2">
                                    <p className="text-xs text-secondary leading-relaxed">
                                        <span className="text-danger font-bold">🚨 Motivo:</span> {currentRisk.note}
                                    </p>
                                    <p className="text-xs text-secondary/80 italic">
                                        "A veces, el mejor trade es no operar." - Capital Preservation Protocol
                                    </p>
                                </div>
                                <button
                                    onClick={scan}
                                    className="mt-4 px-6 py-2 bg-surface hover:bg-danger/10 border border-border text-danger font-bold text-xs uppercase rounded transition-colors"
                                >
                                    Monitorear Riesgo
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-secondary gap-4 px-6 max-w-2xl mx-auto">
                            <div className="p-4 bg-blue-500/10 rounded-full">
                                <Target size={48} className="text-blue-400" />
                            </div>
                            <div className="text-center space-y-3">
                                <h3 className="text-lg font-bold text-primary">🎯 Modo Cazador Activado</h3>
                                <p className="text-sm text-secondary leading-relaxed">
                                    No hay señales <span className="text-accent font-bold">PREMIUM</span> en este momento. Esto es <span className="text-success font-bold">BUENO</span>.
                                </p>
                                <div className="bg-surface border border-border rounded-lg p-4 text-left space-y-2">
                                    <p className="text-xs text-secondary leading-relaxed">
                                        <span className="text-blue-400 font-bold">💡 Filosofía Institucional:</span> Los mejores traders esperan setup perfectos en lugar de forzar operaciones. El sistema solo muestra señales con <span className="text-accent font-bold">60+ de confianza</span> (VALID o PREMIUM).
                                    </p>
                                    <div className="flex items-start gap-2 text-xs text-secondary/80 pt-2 border-t border-border/50">
                                        <Shield size={14} className="text-success mt-0.5 shrink-0" />
                                        <span className="leading-relaxed italic">"Trade less, win more. Patience is the ultimate edge." - Institutional Traders</span>
                                    </div>
                                </div>
                                <button
                                    onClick={scan}
                                    className="mt-4 px-6 py-2 bg-primary hover:bg-white text-background font-bold text-xs uppercase rounded transition-colors"
                                >
                                    Refrescar Análisis
                                </button>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {opportunities.map((opp) => (
                            <SignalCard
                                key={opp.id}
                                data={opp}
                                onSelect={() => onSelectOpportunity(opp.symbol.split('/')[0])}
                                onShowDetails={() => setSelectedSignal(opp)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* EDUCATIONAL MODAL */}
            {selectedSignal && (
                <div className="absolute inset-0 bg-background/95 backdrop-blur-md z-50 p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-start mb-6 border-b border-border pb-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <BookOpen size={18} className="text-accent" />
                                <h3 className="text-lg font-mono font-bold text-white uppercase">Análisis Táctico: {selectedSignal.symbol}</h3>
                            </div>
                            <p className="text-xs text-secondary">Desglose educativo de la señal detectada</p>
                        </div>
                        <button
                            onClick={() => setSelectedSignal(null)}
                            className="p-2 bg-surface hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X size={20} className="text-secondary" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                        {/* 1. STRATEGY CONTEXT */}
                        <div className="bg-surface rounded-xl p-5 border border-border">
                            <h4 className="text-xs font-bold text-secondary uppercase mb-3 flex items-center gap-2">
                                <Activity size={14} /> La Estrategia Usada
                            </h4>
                            <div className="space-y-2">
                                <p className="text-sm font-mono font-bold text-primary">
                                    {STRATEGIES.find(s => s.id === selectedSignal.strategy.toLowerCase())?.name || selectedSignal.strategy}
                                </p>
                                <p className="text-xs text-secondary leading-relaxed border-l-2 border-accent/50 pl-3">
                                    {STRATEGIES.find(s => s.id === selectedSignal.strategy.toLowerCase())?.description || "Algoritmo de detección de patrones matemáticos avanzados."}
                                </p>
                            </div>
                        </div>

                        {/* 2. THE TRIGGER (WHY?) */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-surface rounded-xl p-5 border border-border col-span-2 md:col-span-1">
                                <h4 className="text-xs font-bold text-secondary uppercase mb-3 flex items-center gap-2">
                                    <Calculator size={14} /> El Gatillo (Datos Duros)
                                </h4>
                                {selectedSignal.metrics ? (
                                    <div className="space-y-3 font-mono text-xs">
                                        <div className="flex justify-between border-b border-border/50 pb-1">
                                            <span className="text-secondary">Disparador:</span>
                                            <span className="text-accent font-bold text-right">{selectedSignal.metrics.specificTrigger}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-border/50 pb-1">
                                            <span className="text-secondary">RSI:</span>
                                            <span className={selectedSignal.metrics.rsi > 70 || selectedSignal.metrics.rsi < 30 ? 'text-warning font-bold' : 'text-primary'}>
                                                {selectedSignal.metrics.rsi}
                                            </span>
                                        </div>
                                        <div className="flex justify-between border-b border-border/50 pb-1">
                                            <span className="text-secondary">Volumen (RVOL):</span>
                                            <span className={selectedSignal.metrics.rvol > 1.5 ? 'text-success font-bold' : 'text-primary'}>
                                                {selectedSignal.metrics.rvol}x
                                            </span>
                                        </div>
                                        <div className="flex justify-between border-b border-border/50 pb-1">
                                            <span className="text-secondary">Estructura:</span>
                                            <span className="text-primary">{selectedSignal.metrics.structure}</span>
                                        </div>
                                        {selectedSignal.metrics.zScore !== undefined && (
                                            <div className="flex justify-between border-b border-border/50 pb-1">
                                                <span className="text-secondary">Z-Score (Desviación):</span>
                                                <span className={Math.abs(selectedSignal.metrics.zScore) > 2 ? 'text-accent font-bold' : 'text-primary'}>
                                                    {selectedSignal.metrics.zScore}σ
                                                </span>
                                            </div>
                                        )}
                                        {selectedSignal.metrics.emaSlope !== undefined && (
                                            <div className="flex justify-between border-b border-border/50 pb-1">
                                                <span className="text-secondary">Fuerza Tendencia (Slope):</span>
                                                <span className={Math.abs(selectedSignal.metrics.emaSlope) > 0.5 ? 'text-success font-bold' : 'text-secondary'}>
                                                    {selectedSignal.metrics.emaSlope}°
                                                </span>
                                            </div>
                                        )}
                                        {selectedSignal.metrics.rsiExpert?.target && (
                                            <div className="flex justify-between border-b border-border/50 pb-1">
                                                <span className="text-secondary">🎯 RSI Target (Cardwell):</span>
                                                <span className="text-accent font-bold">
                                                    ${selectedSignal.metrics.rsiExpert.target.toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                        {selectedSignal.metrics.rsiExpert?.range && (
                                            <div className="flex justify-between border-b border-border/50 pb-1">
                                                <span className="text-secondary">Rango RSI:</span>
                                                <span className={selectedSignal.metrics.rsiExpert.range.includes('SUPER') ? 'text-accent font-bold' : 'text-primary'}>
                                                    {selectedSignal.metrics.rsiExpert.range.replace('_', ' ')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-secondary italic">Métricas detalladas no disponibles para este tick.</p>
                                )}
                            </div>

                            {/* 3. INTERPRETATION */}
                            <div className="bg-blue-500/5 rounded-xl p-5 border border-blue-500/20 col-span-2 md:col-span-1 flex flex-col justify-center">
                                <h4 className="text-xs font-bold text-blue-400 uppercase mb-2 flex items-center gap-2">
                                    <Cpu size={14} /> Interpretación Institucional
                                </h4>
                                <p className="text-xs text-secondary leading-relaxed">
                                    "{selectedSignal.technicalReasoning}"
                                </p>
                                <p className="text-[10px] text-blue-300/60 mt-2 italic">
                                    *El algoritmo detectó esta oportunidad porque la confluencia matemática supera el 70% de probabilidad.*
                                </p>
                            </div>
                        </div>

                        {/* 4. RISK MANAGEMENT */}
                        <div className="bg-surface rounded-xl p-5 border border-border">
                            <h4 className="text-xs font-bold text-secondary uppercase mb-3 flex items-center gap-2">
                                <Shield size={14} /> Gestión de Riesgo Sugerida
                            </h4>
                            <div className="flex items-center gap-4 text-xs">
                                <div className="flex-1 bg-background p-3 rounded border border-border">
                                    <span className="block text-[10px] text-secondary uppercase mb-1">Entrada Óptima</span>
                                    <span className="font-mono font-bold text-primary">${selectedSignal.entryZone.min}</span>
                                </div>
                                <ArrowRight size={16} className="text-secondary" />
                                <div className="flex-1 bg-danger/10 p-3 rounded border border-danger/20">
                                    <span className="block text-[10px] text-danger uppercase mb-1">Stop Loss (Invalidación)</span>
                                    <span className="font-mono font-bold text-danger">${selectedSignal.stopLoss}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-border flex justify-end">
                        <button
                            onClick={() => {
                                onSelectOpportunity(selectedSignal.symbol.split('/')[0]);
                                setSelectedSignal(null);
                            }}
                            className="px-6 py-2 bg-accent hover:bg-accentHover text-white rounded font-bold text-xs font-mono uppercase transition-colors"
                        >
                            Ver Gráfico en Vivo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper for clean price formatting
const formatPrice = (price: number) => {
    if (!price) return '0.00';
    if (price < 0.01) return price.toFixed(8);
    if (price < 1) return price.toFixed(5); // Crypto penny stocks
    if (price < 10) return price.toFixed(4);
    if (price < 1000) return price.toFixed(2);
    return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

// Helper for strategy context
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

    // 3. Fallback
    return "Patrón de alta probabilidad estadística validado por el algoritmo.";
};

// Sub-component for the "Signal Ticket" look
const SignalCard: React.FC<{ data: AIOpportunity, onSelect: () => void, onShowDetails: () => void }> = ({ data, onSelect, onShowDetails }) => {
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
                <div className="flex flex-col items-end gap-1">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] text-secondary uppercase tracking-widest mb-1">Estrategia</span>
                        <span className="text-[10px] font-mono font-bold text-primary bg-background px-2 py-1 rounded border border-border">
                            {data.strategy.split('_')[0]}
                        </span>
                    </div>

                    {/* NEW: TIER BADGE */}
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
            <div className="flex items-center gap-4 px-5 py-2 bg-background/50 border-b border-border/50 text-[10px] text-secondary font-mono uppercase tracking-tight">
                <div className="flex items-center gap-1.5" title="Timeframe Analizado">
                    <Clock size={12} className="text-secondary/70" />
                    <span>{data.timeframe || '15m'}</span>
                </div>
                <div className="flex items-center gap-1.5 border-l border-border/50 pl-4" title="Sesión de Mercado">
                    <Globe size={12} className="text-secondary/70" />
                    <span>{data.session || 'GLOBAL'}</span>
                </div>
                <div className="flex items-center gap-1.5 border-l border-border/50 pl-4" title="Ratio Riesgo:Beneficio (vs TP3)">
                    <Target size={12} className="text-secondary/70" />
                    <span className={data.riskRewardRatio && data.riskRewardRatio >= 3 ? "text-success font-bold" : "text-primary"}>
                        R:R 1:{data.riskRewardRatio || 'N/A'}
                    </span>
                </div>
                {/* NEW: Harmonic Badge */}
                {data.harmonicPatterns && data.harmonicPatterns.length > 0 && (
                    <div className="flex items-center gap-1.5 border-l border-border/50 pl-4 text-purple-400 animate-pulse">
                        <Hexagon size={12} />
                        <span className="font-bold">{data.harmonicPatterns[0].type}</span>
                    </div>
                )}
                {/* NEW: Squeeze Badge */}
                {data.metrics?.isSqueeze && (
                    <div className="flex items-center gap-1.5 border-l border-border/50 pl-4 text-warning animate-pulse">
                        <Zap size={12} />
                        <span className="font-bold">TTM SQUEEZE</span>
                    </div>
                )}
                {/* NEW: MACD Div Badge */}
                {data.metrics?.macdDivergence && (
                    <div className="flex items-center gap-1.5 border-l border-border/50 pl-4 text-cyan-400">
                        <Target size={12} />
                        <span className="font-bold">DIV MACD</span>
                    </div>
                )}
            </div>

            {/* Signal Body */}
            <div className="p-5 flex-1 space-y-5">

                {/* Strategy Context (New) */}
                <div className="flex items-start gap-2 p-2 bg-background border border-border rounded-lg">
                    <Activity size={14} className="text-accent mt-0.5 shrink-0" />
                    <div>
                        <span className="block text-[9px] text-secondary uppercase font-bold">¿Por qué esta estrategia?</span>
                        <p className="text-[10px] text-primary leading-tight">
                            {getStrategyReason(data.strategy)}
                        </p>
                    </div>
                </div>

                {/* Entry & DCA (New Educational Layout) */}
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
                            <span className="block text-xs font-mono text-success font-bold">${data.takeProfits.tp1}</span>
                        </div>
                        <div className="text-center p-2 rounded bg-success/10 border border-success/20">
                            <span className="block text-[9px] text-success/70 font-bold">TP 2</span>
                            <span className="block text-xs font-mono text-success font-bold">${data.takeProfits.tp2}</span>
                        </div>
                        <div className="text-center p-2 rounded bg-success/20 border border-success/30 relative overflow-hidden">
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
    )
}

export default OpportunityFinder;
