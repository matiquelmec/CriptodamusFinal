import React from 'react';
import { Loader2, Cpu } from 'lucide-react';

interface ProgressIndicatorProps {
    step: string;
    progress: number; // 0-100
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ step, progress }) => {
    return (
        <div className="h-full flex flex-col items-center justify-center text-secondary gap-6">
            {/* Animated Icon */}
            <div className="relative">
                <div className="w-16 h-16 border-4 border-border rounded-full border-t-accent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Cpu size={24} className="text-accent animate-pulse" />
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md px-4">
                <div className="mb-2 flex justify-between items-center">
                    <h3 className="text-sm font-mono font-bold text-primary">Ejecutando Algoritmos...</h3>
                    <span className="text-xs font-mono text-accent font-bold">{progress}%</span>
                </div>

                {/* Bar Container */}
                <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-600 to-cyan-600 transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Current Step */}
                <p className="mt-3 text-xs font-mono opacity-70 text-center animate-pulse">
                    {step}
                </p>
            </div>

            {/* Hint */}
            <p className="text-[10px] text-secondary/50 max-w-xs text-center">
                El sistema está analizando {progress < 50 ? 'datos de mercado' : 'confluencias técnicas'} en tiempo real...
            </p>
        </div>
    );
};

export default ProgressIndicator;
