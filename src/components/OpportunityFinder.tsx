import React, { useEffect, useState } from 'react';
import { AIOpportunity, MarketRisk } from '../types';
import { useSocket } from '../hooks/useSocket';
import { RefreshCw, Shield, AlertTriangle, Target, Cpu, Activity, Database, Eye } from 'lucide-react';
import { LiquidationFeed } from './LiquidationFeed';
import ProgressIndicator from './ProgressIndicator';
import SignalCard from './opportunities/SignalCard';
import EducationalModal from './opportunities/EducationalModal';
import PerformanceStats from './opportunities/PerformanceStats';

interface OpportunityFinderProps {
    onSelectOpportunity: (symbol: string) => void;
}

const OpportunityFinder: React.FC<OpportunityFinderProps> = ({ onSelectOpportunity }) => {
    // State Definitions
    const [opportunities, setOpportunities] = useState<AIOpportunity[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detectedRegime, setDetectedRegime] = useState<string | null>(null);
    const [currentRisk, setCurrentRisk] = useState<MarketRisk | null>(null);
    const [selectedSignal, setSelectedSignal] = useState<AIOpportunity | null>(null);
    const [scanProgress, setScanProgress] = useState({ step: 'Esperando señal...', progress: 0 });
    const [activeFilter, setActiveFilter] = useState<'ALL' | 'PAU'>('ALL'); // NEW: Filter State

    // Cache visual states (Dummy for now to prevent crash, or derived)
    const [isFromCache, setIsFromCache] = useState(false);
    const [cacheAge, setCacheAge] = useState<string | null>(null);

    // NEW: Socket Integration (Replaces local scanner)
    const { aiOpportunities, isConnected } = useSocket();

    // Sync socket data to local state for display
    useEffect(() => {
        if (aiOpportunities && aiOpportunities.length > 0) {
            setOpportunities(aiOpportunities);

            // Auto-detect regime from first opp if available
            if (aiOpportunities[0].strategy) {
                setDetectedRegime(aiOpportunities[0].strategy);
            }
        }
    }, [aiOpportunities]);

    // Cleanup local loading/error states since we are now passive listeners
    useEffect(() => {
        if (isConnected) {
            setLoading(false);
            setError(null);
        }
    }, [isConnected]);

    const handleRefresh = () => {
        alert("El escáner opera automáticamente en el servidor (Intervalo: 15min)");
    };

    // Alias for backward compatibility
    const scan = handleRefresh;

    // Filter Logic
    const displayedOpportunities = activeFilter === 'ALL'
        ? opportunities
        : opportunities.filter(o => o.strategy === 'pau_perdices_gold');

    return (
        <div className="h-auto md:h-full bg-surface border border-border rounded-xl shadow-sm flex flex-col md:overflow-hidden relative">
            {/* Real-time Ticker */}
            <LiquidationFeed />

            {/* Header / Controls */}
            <div className="p-3 md:p-4 border-b border-border bg-background/50 backdrop-blur-sm flex flex-col gap-3 md:gap-4">
                <div className="flex flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="relative">
                            <div className={`p-1.5 md:p-2 rounded-lg text-white shadow-lg ${isConnected ? 'bg-gradient-to-br from-green-600 to-emerald-600 shadow-green-500/20' : 'bg-gray-600'}`}>
                                <Cpu size={18} className={isConnected ? "animate-pulse" : ""} />
                            </div>
                            {isConnected && <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 md:h-3 md:w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-full w-full bg-green-500"></span>
                            </span>}
                        </div>
                        <div>
                            <h2 className="text-[12px] md:text-sm font-mono font-bold text-primary uppercase tracking-wider">Criptodamus Auto-Pilot</h2>
                            <p className="text-[9px] md:text-[10px] text-secondary">
                                {isConnected ? '🟢 Conectado (24/7)' : '🔴 Desconectado'}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {/* PAU PERDICES FILTER BUTTON */}
                        <button
                            onClick={() => setActiveFilter(prev => prev === 'ALL' ? 'PAU' : 'ALL')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded font-mono text-[10px] md:text-xs font-bold transition-all shadow-sm
                                ${activeFilter === 'PAU'
                                    ? 'bg-yellow-400/20 border-yellow-400/60 text-yellow-500 shadow-[0_0_10px_rgba(250,204,21,0.2)]'
                                    : 'bg-surface hover:bg-background border-border text-secondary'
                                }`}
                        >
                            <span>🏆</span>
                            <span className="hidden xs:inline">Gold Sniper</span>
                        </button>

                        <button
                            onClick={handleRefresh}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-background border border-border rounded font-mono text-[10px] md:text-xs font-bold transition-colors shadow-sm opacity-80"
                        >
                            <RefreshCw size={12} />
                            <span className="hidden xs:inline">Auto-Scan</span> (15m)
                        </button>
                    </div>
                </div>

                {/* Risk Shield Banner - Optimized for mobile */}
                {currentRisk && (
                    <div className={`flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg border text-[9px] md:text-[10px] ${currentRisk.level === 'HIGH' ? 'bg-danger/10 border-danger/20 text-danger' :
                        currentRisk.level === 'MEDIUM' ? 'bg-warning/10 border-warning/20 text-warning' :
                            'bg-success/5 border-success/10 text-success'
                        }`}>
                        {currentRisk.riskType === 'MANIPULATION' ? (
                            <Eye size={12} className={currentRisk.level === 'HIGH' ? 'animate-pulse' : ''} />
                        ) : (
                            <Shield size={12} className={currentRisk.level === 'HIGH' ? 'animate-pulse' : ''} />
                        )}

                        <span className="font-mono font-bold uppercase shrink-0">
                            {currentRisk.riskType === 'MANIPULATION' ? 'Whale Alert' : `Escudo: ${currentRisk.level}`}
                        </span>
                        <span className="opacity-80 border-l border-current pl-2 ml-1 truncate">
                            {currentRisk.note}
                        </span>
                    </div>
                )}

                {/* Autonomous Mode Indicator - COMPACTED FOR MOBILE */}
                <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg p-2 md:p-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Cpu className="text-blue-400 animate-pulse" size={16} />
                            <span className="text-[10px] md:text-xs font-mono font-bold text-blue-400 uppercase tracking-wider">
                                MODO AUTÓNOMO
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {detectedRegime && (
                                <div className="flex items-center gap-1.5 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                    <Activity size={10} className="text-cyan-400" />
                                    <span className="text-[9px] font-mono text-cyan-400 uppercase">
                                        {detectedRegime.split('_')[0]}
                                    </span>
                                </div>
                            )}
                            {/* Cache Indicator */}
                            {isFromCache && cacheAge && (
                                <div className="hidden xs:flex items-center gap-1.5 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                    <Database size={10} className="text-amber-400" />
                                    <span className="text-[9px] font-mono text-amber-400">
                                        {cacheAge}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* HIDE description on mobile to reclaim space */}
                    <p className="hidden md:block text-[10px] text-secondary mt-2 leading-relaxed">
                        El sistema detecta automáticamente el régimen de mercado y selecciona las estrategias óptimas con ponderación inteligente.
                    </p>
                </div>
            </div>

            {/* Dashboard de Rendimiento */}
            <PerformanceStats />

            {/* Main Content Area */}
            <div className="opportunities-grid md:overflow-y-auto p-4 custom-scrollbar bg-background/50">
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
                ) : displayedOpportunities.length === 0 ? (
                    // SMART EMPTY STATE (If Filter Active or No Opps)
                    activeFilter === 'PAU' ? (
                        <div className="h-full flex flex-col items-center justify-center text-secondary gap-4 animate-pulse">
                            <div className="p-4 bg-yellow-500/10 rounded-full border border-yellow-500/20">
                                <Target size={32} className="text-yellow-500" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-sm font-bold text-yellow-500 mb-1">Sniper Mode: Waiting...</h3>
                                <p className="text-xs text-secondary max-w-[200px]">
                                    Esperando la configuración perfecta en XAU/USD (Fib 0.50 + Divergencia).
                                </p>
                            </div>
                        </div>
                    ) : (
                        // SMART EMPTY STATE
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
                            <div className="min-h-full flex flex-col items-center justify-center text-secondary gap-4 px-6 py-12 max-w-2xl mx-auto">
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
                    )) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {displayedOpportunities.map((opp) => (
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
                <EducationalModal
                    selectedSignal={selectedSignal}
                    onClose={() => setSelectedSignal(null)}
                    onSelectOpportunity={onSelectOpportunity}
                />
            )}
        </div>
    );
};

export default OpportunityFinder;
