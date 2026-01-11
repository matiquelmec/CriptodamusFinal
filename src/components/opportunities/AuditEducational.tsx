import React from 'react';
import {
    X, Info, Target, TrendingUp, ShieldCheck,
    Clock, Activity, Calculator, BarChart3, HelpCircle
} from 'lucide-react';

interface AuditEducationalProps {
    onClose: () => void;
}

const AuditEducational: React.FC<AuditEducationalProps> = ({ onClose }) => {
    return (
        <div className="absolute inset-0 bg-background/98 backdrop-blur-xl z-[60] p-6 flex flex-col animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="flex justify-between items-start mb-8 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                        <BarChart3 size={20} className="text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-wider">Guía de Auditoría Élite</h3>
                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Interpretación de métricas institucionales</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors group"
                >
                    <X size={20} className="text-slate-500 group-hover:text-white" />
                </button>
            </div>

            {/* Content Swiper/List */}
            <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">

                {/* 1. Win Rate */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Target className="text-emerald-400" size={18} />
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Win Rate Global (Frecuencia)</h4>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                        <p className="text-xs text-slate-400 leading-relaxed mb-4">
                            Indica qué tan seguido el algoritmo tiene razón. Es el porcentaje de operaciones ganadoras frente al total de cierres.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                                <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Rango Profesional</span>
                                <span className="text-xs text-white font-mono">60% - 75%</span>
                            </div>
                            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                                <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Cálculo</span>
                                <span className="text-xs text-slate-400 font-mono italic">(Wins / Total) * 100</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Profit Factor */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="text-blue-400" size={18} />
                        <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Profit Factor (La Métrica de Oro)</h4>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                        <p className="text-xs text-slate-400 leading-relaxed mb-4">
                            Mide la eficiencia económica. Nos dice cuántos dólares ganamos por cada dólar que perdemos. Es el indicador definitivo de rentabilidad real.
                        </p>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="text-blue-400" size={14} />
                                    <span className="text-[10px] font-bold text-blue-300 uppercase">Gold Ratio ({'>'}1.5)</span>
                                </div>
                                <span className="text-[10px] text-blue-200/60 italic font-mono uppercase">Rango Hedge Fund</span>
                            </div>
                            <p className="text-[10px] text-slate-500 italic">
                                *Incluso con un Win Rate bajo (40%), si tu Profit Factor es de 2.0, eres altamente rentable.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 3. Lógica de Auditoría */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Activity className="text-amber-400" size={18} />
                        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Lógica de Cierre Autónomo</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                            <span className="block text-[9px] font-black text-emerald-400/80 uppercase mb-1">WIN (Success)</span>
                            <p className="text-[10px] text-slate-500 leading-tight">El precio toca el Take Profit 1 (TP1) asignado.</p>
                        </div>
                        <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                            <span className="block text-[9px] font-black text-rose-400/80 uppercase mb-1">LOSS (Risk)</span>
                            <p className="text-[10px] text-slate-500 leading-tight">El precio toca el Stop Loss antes de reaccionar.</p>
                        </div>
                        <div className="p-3 bg-slate-500/5 border border-slate-500/10 rounded-xl">
                            <span className="block text-[9px] font-black text-slate-400 uppercase mb-1">EXPIRED (Time)</span>
                            <p className="text-[10px] text-slate-500 leading-tight">La señal no se decide en el tiempo límite (6h-48h).</p>
                        </div>
                    </div>
                </section>

                {/* 4. Porcentaje vs Capital */}
                <section className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <Calculator className="text-indigo-400" size={18} />
                        <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-widest">¿Por qué en Porcentajes?</h4>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        Criptodamus utiliza <span className="text-indigo-300">"Flat-Stake Modeling"</span>. Auditamos la <span className="text-white font-bold">pureza técnica</span> de la estrategia midiendo el PnL % bruto. Esto garantiza que el sistema sea rentable matemáticamente, independientemente del capital que tú decidas asignar a cada operación.
                    </p>
                </section>

            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-2 text-[9px] text-slate-600 font-mono uppercase tracking-tighter">
                    <ShieldCheck size={12} /> Datos auditados 1:1 contra Binance API
                </div>
                <button
                    onClick={onClose}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                >
                    Entendido, Proseguir
                </button>
            </div>
        </div>
    );
};

export default AuditEducational;
