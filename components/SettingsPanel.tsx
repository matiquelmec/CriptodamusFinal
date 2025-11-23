
import React, { useState, useEffect } from 'react';
import { Save, Key, Shield, AlertTriangle, Database, Activity, CheckCircle, Trash2 } from 'lucide-react';
import { initializeGemini, hasActiveSession } from '../services/geminiService';

interface SettingsPanelProps {
    onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
    const [apiKey, setApiKey] = useState('');
    const [defaultRisk, setDefaultRisk] = useState(1);
    const [isSaved, setIsSaved] = useState(false);
    const [apiStatus, setApiStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');

    useEffect(() => {
        // Load settings from localStorage
        const storedKey = localStorage.getItem('gemini_api_key') || '';
        const storedRisk = localStorage.getItem('default_risk');
        
        // If we have an env key, we might mask it, but for now we prioritize local storage if set
        setApiKey(storedKey);
        if (storedRisk) setDefaultRisk(Number(storedRisk));

        checkConnection();
    }, []);

    const checkConnection = () => {
        setApiStatus(hasActiveSession() ? 'connected' : 'disconnected');
    };

    const handleSave = () => {
        // Save to LocalStorage
        if (apiKey.trim()) {
            localStorage.setItem('gemini_api_key', apiKey);
            initializeGemini(apiKey);
        } else {
            localStorage.removeItem('gemini_api_key');
        }
        
        localStorage.setItem('default_risk', defaultRisk.toString());

        // Visual Feedback & Close
        setIsSaved(true);
        checkConnection();
        
        // Wait 1s so user sees the "Success" checkmark, then close
        setTimeout(() => {
            setIsSaved(false);
            onClose();
        }, 1000);
    };

    const handleClearCache = () => {
        localStorage.clear();
        window.location.reload();
    };

    return (
        <div className="max-w-4xl mx-auto h-full overflow-y-auto custom-scrollbar p-6">
            <div className="mb-8">
                <h2 className="text-2xl font-mono font-bold text-white mb-2">Configuración del Sistema</h2>
                <p className="text-sm text-secondary">Gestiona las llaves de acceso, parámetros de riesgo y estado del motor IA.</p>
            </div>

            <div className="space-y-6">
                
                {/* API SECTION */}
                <div className="bg-surface border border-border rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4 text-accent">
                        <Key size={20} />
                        <h3 className="font-mono font-bold text-lg text-primary">Motor de Inteligencia Artificial</h3>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-mono text-secondary mb-2 uppercase tracking-wider">
                                Google Gemini API Key
                            </label>
                            <div className="flex gap-2">
                                <input 
                                    type="password" 
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="sk-..."
                                    className="flex-1 bg-background border border-border rounded px-4 py-2 text-primary font-mono text-sm focus:border-accent focus:outline-none"
                                />
                            </div>
                            <p className="text-[10px] text-secondary mt-2">
                                La llave se almacena localmente en tu navegador. Criptodamus no guarda tus credenciales en ningún servidor.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 p-3 bg-background rounded border border-border">
                            <Activity size={16} className={apiStatus === 'connected' ? 'text-success' : 'text-danger'} />
                            <span className="text-xs font-mono">
                                Estado del Motor: <span className={apiStatus === 'connected' ? 'text-success font-bold' : 'text-danger font-bold'}>
                                    {apiStatus === 'connected' ? 'OPERATIVO' : 'DESCONECTADO'}
                                </span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* RISK SECTION */}
                <div className="bg-surface border border-border rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4 text-warning">
                        <Shield size={20} />
                        <h3 className="font-mono font-bold text-lg text-primary">Gestión de Riesgo por Defecto</h3>
                    </div>
                    
                    <div className="space-y-4">
                         <div>
                            <label className="block text-xs font-mono text-secondary mb-2 uppercase tracking-wider">
                                Riesgo Predeterminado por Operación (%)
                            </label>
                            <input 
                                type="range" 
                                min="0.1" 
                                max="5" 
                                step="0.1"
                                value={defaultRisk}
                                onChange={(e) => setDefaultRisk(Number(e.target.value))}
                                className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-warning"
                            />
                            <div className="flex justify-between mt-2">
                                <span className="text-xs font-mono text-primary font-bold">{defaultRisk}%</span>
                                <span className="text-[10px] text-secondary">Recomendado Institucional: 1% - 2%</span>
                            </div>
                        </div>
                    </div>
                </div>

                 {/* SYSTEM SECTION */}
                 <div className="bg-surface border border-border rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4 text-danger">
                        <Database size={20} />
                        <h3 className="font-mono font-bold text-lg text-primary">Zona de Peligro</h3>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-sm font-bold text-primary">Limpiar Caché Local</h4>
                            <p className="text-xs text-secondary">Borra llaves API guardadas y preferencias. Reinicia la app.</p>
                        </div>
                        <button 
                            onClick={handleClearCache}
                            className="flex items-center gap-2 px-4 py-2 border border-danger/30 text-danger hover:bg-danger/10 rounded text-xs font-mono transition-colors"
                        >
                            <Trash2 size={14} /> Restaurar Fábrica
                        </button>
                    </div>
                </div>

            </div>

            {/* ACTION BAR */}
            <div className="sticky bottom-0 bg-background/80 backdrop-blur border-t border-border p-4 mt-6 flex justify-end">
                <button 
                    onClick={handleSave}
                    disabled={isSaved}
                    className="flex items-center gap-2 px-6 py-2 bg-accent hover:bg-accentHover text-white rounded font-mono text-sm font-bold transition-all shadow-lg shadow-accent/20 disabled:opacity-80 disabled:cursor-wait"
                >
                    {isSaved ? <CheckCircle size={16} /> : <Save size={16} />}
                    {isSaved ? 'Guardado...' : 'Guardar Cambios'}
                </button>
            </div>
        </div>
    );
};

export default SettingsPanel;
