import React from 'react';
import { AIOpportunity } from '../../types';
import { STRATEGIES } from '../../services/strategyContext';
import {
    BookOpen, X, Activity, Cpu, Calculator, TrendingUp,
    Target, Shield, Layers, Zap, Globe, ArrowRight
} from 'lucide-react';

interface EducationalModalProps {
    selectedSignal: AIOpportunity;
    onClose: () => void;
    onSelectOpportunity: (symbol: string) => void;
}

const EducationalModal: React.FC<EducationalModalProps> = ({ selectedSignal, onClose, onSelectOpportunity }) => {

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
                    onClick={onClose}
                    className="p-2 bg-surface hover:bg-white/10 rounded-full transition-colors"
                >
                    <X size={20} className="text-secondary" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                {/* 0. GLOBAL MACRO CONTEXT (God Mode) */}
                {selectedSignal.metrics?.macroContext && (
                    <div className="bg-surface rounded-xl p-5 border border-border">
                        <h4 className="text-xs font-bold text-indigo-400 uppercase mb-3 flex items-center gap-2">
                            <Globe size={14} /> Contexto Macro Global
                        </h4>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] text-secondary uppercase font-bold">Régimen BTC</span>
                                <div className={`text-sm font-mono font-bold ${selectedSignal.metrics.macroContext.btcRegime === 'BULL' ? 'text-success' : selectedSignal.metrics.macroContext.btcRegime === 'BEAR' ? 'text-danger' : 'text-warning'}`}>
                                    {selectedSignal.metrics.macroContext.btcRegime}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-secondary uppercase font-bold">DXY Index</span>
                                <div className={`text-sm font-mono font-bold ${selectedSignal.metrics.macroContext.dxyIndex > 105 ? 'text-danger' : 'text-primary'}`}>
                                    {selectedSignal.metrics.macroContext.dxyIndex}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-secondary uppercase font-bold">Gold (Risk-Off)</span>
                                <div className="text-sm font-mono font-bold text-amber-400">
                                    ${selectedSignal.metrics.macroContext.goldPrice}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-secondary uppercase font-bold">BTC.D (Liquidity)</span>
                                <div className="text-sm font-mono font-bold text-primary">
                                    {selectedSignal.metrics.macroContext.btcDominance}%
                                </div>
                            </div>
                        </div>
                    </div>
                )}

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

                {/* 1.5. ML BRAIN DIAGNOSIS */}
                {selectedSignal.mlPrediction && (
                    <div className="bg-surface rounded-xl p-5 border border-border">
                        <h4 className="text-xs font-bold text-blue-400 uppercase mb-3 flex items-center gap-2">
                            <Cpu size={14} /> Diagnóstico Neuronal (LSTM)
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] text-secondary uppercase font-bold">Predicción</span>
                                <div className={`text-lg font-mono font-bold ${selectedSignal.mlPrediction.signal === 'BULLISH' ? 'text-success' : selectedSignal.mlPrediction.signal === 'BEARISH' ? 'text-danger' : 'text-secondary'
                                    }`}>
                                    {selectedSignal.mlPrediction.signal}
                                </div>
                            </div>
                            <div className="space-y-1 text-right">
                                <span className="text-[10px] text-secondary uppercase font-bold">Probabilidad</span>
                                <div className="text-lg font-mono font-bold text-primary">
                                    {(selectedSignal.mlPrediction?.probability || 0).toFixed(1)}%
                                </div>
                            </div>
                            <div className="col-span-2 pt-2 border-t border-border/50">
                                <p className="text-[10px] text-secondary leading-relaxed italic">
                                    "El modelo analiza patrones no-lineales en las últimas 50 velas. Un score superior al 60% indica alta confianza estadística."
                                </p>
                            </div>
                        </div>
                    </div>
                )}

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
                                {selectedSignal.freezeSignal?.active && (
                                    <div className="flex justify-between border-b border-border/50 pb-1 bg-cyan-500/10 p-1 rounded">
                                        <span className="text-cyan-400 font-bold">❄️ Config:</span>
                                        <span className="text-cyan-100 text-[10px] text-right">{selectedSignal.freezeSignal.reason.join(' + ')}</span>
                                    </div>
                                )}
                                {selectedSignal.chartPatterns && selectedSignal.chartPatterns.length > 0 && (
                                    <div className="flex justify-between border-b border-border/50 pb-1">
                                        <span className="text-secondary">Patrón Gráfico:</span>
                                        <span className="text-pink-400 font-bold">{selectedSignal.chartPatterns[0].type}</span>
                                    </div>
                                )}
                                {/* NEW: Harmonic Patterns */}
                                {selectedSignal.harmonicPatterns && selectedSignal.harmonicPatterns.length > 0 && (
                                    <div className="flex justify-between border-b border-border/50 pb-1 bg-purple-500/10 p-1 rounded">
                                        <span className="text-secondary">Patrón Armónico:</span>
                                        <span className="text-purple-400 font-bold">
                                            {selectedSignal.harmonicPatterns[0].type} ({selectedSignal.harmonicPatterns[0].direction === 'BULLISH' ? 'Bullish' : 'Bearish'})
                                        </span>
                                    </div>
                                )}
                                {/* NEW: Fair Value Gaps (SMC) */}
                                {selectedSignal.fairValueGaps && (
                                    (selectedSignal.fairValueGaps.bullish.length > 0 || selectedSignal.fairValueGaps.bearish.length > 0) && (
                                        <div className="flex justify-between border-b border-border/50 pb-1 bg-blue-500/10 p-1 rounded">
                                            <span className="text-secondary">Fair Value Gap:</span>
                                            <span className="text-blue-400 font-bold text-[10px]">
                                                {selectedSignal.fairValueGaps.bullish[0] && `Support $${selectedSignal.fairValueGaps.bullish[0].bottom.toFixed(2)}`}
                                                {selectedSignal.fairValueGaps.bearish[0] && `Resistance $${selectedSignal.fairValueGaps.bearish[0].top.toFixed(2)}`}
                                            </span>
                                        </div>
                                    )
                                )}
                                {/* NEW: Order Blocks (SMC) */}
                                {selectedSignal.orderBlocks && (
                                    (selectedSignal.orderBlocks.bullish.length > 0 || selectedSignal.orderBlocks.bearish.length > 0) && (
                                        <div className="flex justify-between border-b border-border/50 pb-1 bg-green-500/10 p-1 rounded">
                                            <span className="text-secondary">Order Block:</span>
                                            <span className="text-green-400 font-bold text-[10px]">
                                                {selectedSignal.orderBlocks.bullish[0] && `Bullish OB $${selectedSignal.orderBlocks.bullish[0].price.toFixed(2)}`}
                                                {selectedSignal.orderBlocks.bearish[0] && `Bearish OB $${selectedSignal.orderBlocks.bearish[0].price.toFixed(2)}`}
                                            </span>
                                        </div>
                                    )
                                )}
                                {selectedSignal.metrics.fractalAnalysis && (
                                    <div className="flex justify-between border-b border-border/50 pb-1 bg-yellow-500/10 p-1 rounded">
                                        <span className="text-secondary">Estructura (15m vs 4H):</span>
                                        <div className="flex items-center gap-1">
                                            <span className={`font-bold ${selectedSignal.metrics.fractalAnalysis.aligned ? 'text-success' : 'text-warning'}`}>
                                                {selectedSignal.metrics.fractalAnalysis.aligned ? 'ALINEADA' : 'DIVERGENTE'}
                                            </span>
                                            <span className="text-[10px] text-zinc-500">
                                                ({selectedSignal.metrics.fractalAnalysis.trend_4h})
                                            </span>
                                        </div>
                                    </div>
                                )}
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
                                {/* RSI Break */}
                                {selectedSignal.metrics.rsiExpert?.trendlineBreak?.detected && (
                                    <div className="flex justify-between border-b border-border/50 pb-1">
                                        <span className="text-secondary">Ruptura RSI:</span>
                                        <span className="text-success font-bold animate-pulse">
                                            {selectedSignal.metrics.rsiExpert.trendlineBreak.direction} BREAKOUT
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-xs text-secondary italic">Métricas detalladas no disponibles para este tick.</p>
                        )}
                    </div>

                    {/* 2.5. INSTITUTIONAL VOLUME & FLOW */}
                    {selectedSignal.metrics?.volumeExpert && (
                        <div className="bg-surface rounded-xl p-5 border border-border col-span-2 md:col-span-1">
                            <h4 className="text-xs font-bold text-purple-400 uppercase mb-3 flex items-center gap-2">
                                <TrendingUp size={14} /> Flujo Institucional (Smart Money)
                            </h4>
                            <div className="space-y-3 font-mono text-xs">
                                <div className="flex justify-between border-b border-border/50 pb-1">
                                    <span className="text-secondary">Coinbase Premium:</span>
                                    <span className={selectedSignal.metrics.volumeExpert.coinbasePremium.signal === 'INSTITUTIONAL_BUY' ? 'text-success font-bold' : selectedSignal.metrics.volumeExpert.coinbasePremium.signal === 'INSTITUTIONAL_SELL' ? 'text-danger font-bold' : 'text-primary'}>
                                        {(selectedSignal.metrics.volumeExpert.coinbasePremium.gapPercent || 0).toFixed(3)}%
                                    </span>
                                </div>
                                <div className="flex justify-between border-b border-border/50 pb-1">
                                    <span className="text-secondary">Funding Rate:</span>
                                    <span className={Math.abs(selectedSignal.metrics.volumeExpert.derivatives.fundingRate) > 0.01 ? 'text-warning font-bold' : 'text-primary'}>
                                        {(selectedSignal.metrics.volumeExpert.derivatives.fundingRate || 0).toFixed(4)}%
                                    </span>
                                </div>
                                <div className="flex justify-between border-b border-border/50 pb-1">
                                    <span className="text-secondary">CVD Sintético:</span>
                                    <span className={selectedSignal.metrics.volumeExpert.cvd.trend === 'BULLISH' ? 'text-success font-bold' : selectedSignal.metrics.volumeExpert.cvd.trend === 'BEARISH' ? 'text-danger font-bold' : 'text-secondary'}>
                                        {selectedSignal.metrics.volumeExpert.cvd.trend}
                                    </span>
                                </div>
                                {/* CVD Divergence Alert */}
                                {selectedSignal.metrics.cvdDivergence && (
                                    <div className="flex justify-between border-b border-border/50 pb-1 mt-1 bg-purple-500/10 p-1 rounded animate-pulse">
                                        <span className="text-secondary">Divergencia CVD:</span>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${selectedSignal.metrics.cvdDivergence.type.includes('BULL') ? 'text-success' : 'text-danger'
                                            }`}>
                                            {selectedSignal.metrics.cvdDivergence.type.replace('HIDDEN_', 'OCULTA ')}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between border-b border-border/50 pb-1">
                                    <span className="text-secondary">Open Interest:</span>
                                    <span className="text-primary font-bold">
                                        {selectedSignal.metrics.volumeExpert.derivatives.openInterestValue
                                            ? `$${(selectedSignal.metrics.volumeExpert.derivatives.openInterestValue / 1000000).toFixed(1)}M`
                                            : <span className="text-secondary italic">N/A</span>
                                        }
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

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

                    {/* 3.5 LIQUIDATION & DEPTH PROFILE */}
                    {selectedSignal.metrics?.volumeExpert?.liquidity?.liquidationClusters && (
                        <div className="bg-surface rounded-xl p-5 border border-border col-span-2">
                            <h4 className="text-xs font-bold text-pink-400 uppercase mb-3 flex items-center gap-2">
                                <Target size={14} /> Mapa de Liquidaciones (Imanes)
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <span className="text-[10px] text-secondary uppercase font-bold">Top Clústeres (Riesgo Alto)</span>
                                    {selectedSignal.metrics.volumeExpert.liquidity.liquidationClusters.slice(0, 3).map((cluster, i) => (
                                        <div key={i} className="flex justify-between items-center text-xs p-2 bg-background rounded border border-border/50">
                                            <span className={cluster.type === 'SHORT_LIQ' ? 'text-danger' : 'text-success'}>
                                                {cluster.type === 'SHORT_LIQ' ? 'Shorts' : 'Longs'} {cluster.strength}x
                                            </span>
                                            <span className="font-mono text-primary font-bold">
                                                ${formatPrice(cluster.priceMin)} - ${formatPrice(cluster.priceMax)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[10px] text-secondary uppercase font-bold">Muros Detectados (Orderbook)</span>
                                    {selectedSignal.metrics.volumeExpert.liquidity.orderBook?.bidWall ? (
                                        <div className="flex justify-between items-center text-xs p-2 bg-success/10 rounded border border-success/20">
                                            <span className="text-success font-bold">Muro Compra</span>
                                            <span className="font-mono text-primary">${formatPrice(selectedSignal.metrics.volumeExpert.liquidity.orderBook.bidWall.price)}</span>
                                        </div>
                                    ) : <div className="text-xs text-secondary italic p-2">Sin muros de compra relevantes</div>}

                                    {selectedSignal.metrics.volumeExpert.liquidity.orderBook?.askWall ? (
                                        <div className="flex justify-between items-center text-xs p-2 bg-danger/10 rounded border border-danger/20">
                                            <span className="text-danger font-bold">Muro Venta</span>
                                            <span className="font-mono text-primary">${formatPrice(selectedSignal.metrics.volumeExpert.liquidity.orderBook.askWall.price)}</span>
                                        </div>
                                    ) : <div className="text-xs text-secondary italic p-2">Sin muros de venta relevantes</div>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. RISK MANAGEMENT */}
                <div className="bg-surface rounded-xl p-5 border border-border">
                    <h4 className="text-xs font-bold text-orange-400 uppercase mb-3 flex items-center gap-2">
                        <Shield size={14} /> Ingeniería de Riesgo (Kelly & Volatility)
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-background p-3 rounded border border-border">
                            <span className="block text-[10px] text-secondary uppercase mb-1">Entrada Óptima</span>
                            <span className="font-mono font-bold text-primary">${selectedSignal.entryZone.min}</span>
                        </div>
                        <div className="bg-danger/10 p-3 rounded border border-danger/20">
                            <span className="block text-[10px] text-danger uppercase mb-1">Stop Loss</span>
                            <span className="font-mono font-bold text-danger">${selectedSignal.stopLoss}</span>
                        </div>
                        <div className="bg-accent/10 p-3 rounded border border-accent/20">
                            <span className="block text-[10px] text-accent uppercase mb-1">Kelly Size</span>
                            <span className="font-mono font-bold text-accent">{((selectedSignal.kellySize || 0) * 100).toFixed(2)}%</span>
                        </div>
                        {selectedSignal.recommendedLeverage && (
                            <div className="bg-blue-500/10 p-3 rounded border border-blue-500/20">
                                <span className="block text-[10px] text-blue-400 uppercase mb-1">Palancaje (ATR)</span>
                                <span className="font-mono font-bold text-blue-400">{(selectedSignal.recommendedLeverage || 1).toFixed(1)}x</span>
                            </div>
                        )}
                        {selectedSignal.correlationRisk && (
                            <div className={`p-3 rounded border col-span-2 ${selectedSignal.correlationRisk.recommendation === 'BLOCK' ? 'bg-danger/20 border-danger/30 text-danger' :
                                selectedSignal.correlationRisk.recommendation === 'REDUCE' ? 'bg-warning/20 border-warning/30 text-warning' :
                                    'bg-success/20 border-success/30 text-success'
                                }`}>
                                <span className="block text-[10px] uppercase mb-1 font-bold">Heatmap de Correlación</span>
                                <span className="font-mono text-[10px]">{selectedSignal.correlationRisk.recommendation}: Riesgo {((selectedSignal.correlationRisk.score || 0) * 100).toFixed(0)}%</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border flex justify-end">
                <button
                    onClick={() => {
                        onSelectOpportunity(selectedSignal.symbol.split('/')[0]);
                        onClose();
                    }}
                    className="px-6 py-2 bg-accent hover:bg-accentHover text-white rounded font-bold text-xs font-mono uppercase transition-colors"
                >
                    Ver Gráfico en Vivo
                </button>
            </div>
        </div>
    );
};

export default EducationalModal;
