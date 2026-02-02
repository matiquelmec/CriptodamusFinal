import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertOctagon, AlertTriangle, ShieldCheck, ChevronRight } from 'lucide-react';
import { API_CONFIG } from '../services/config';

const SystemAlertsBanner: React.FC = () => {
    const [health, setHealth] = useState<any>(null);
    const [lastAlert, setLastAlert] = useState<any>(null);

    const effectiveBaseUrl = API_CONFIG.BASE_URL || 'http://localhost:3001';

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const res = await axios.get(`${effectiveBaseUrl}/api/system/health`);
                setHealth(res.data);

                if (res.data.status !== 'OPTIMAL') {
                    const alertRes = await axios.get(`${effectiveBaseUrl}/api/system/alerts`);
                    if (alertRes.data.length > 0) {
                        setLastAlert(alertRes.data[0]);
                    }
                }
            } catch (e: any) {
                setHealth({ status: 'OFFLINE', message: `No se pudo conectar al motor en ${effectiveBaseUrl}. Verifica que el backend esté corriendo en el puerto 3001.` });
            }
        };

        fetchHealth();
        const timer = setInterval(fetchHealth, 60000);
        return () => clearInterval(timer);
    }, [effectiveBaseUrl]);

    if (!health || health.status === 'OPTIMAL') return null;

    const isCritical = health.status === 'CRITICAL' || health.status === 'OFFLINE';

    return (
        <div className={`mb-4 p-3 rounded-xl border ${isCritical ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-warning/10 border-warning/30 text-warning'} animate-in fade-in slide-in-from-top duration-500`}>
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isCritical ? 'bg-danger/20' : 'bg-warning/20'}`}>
                        {isCritical ? <AlertOctagon size={20} /> : <AlertTriangle size={20} />}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase tracking-widest leading-none">
                            {isCritical ? 'ALERTA CRÍTICA DEL SISTEMA' : 'SISTEMA DEGRADADO'}
                        </span>
                        <p className="text-[10px] opacity-80 mt-1 font-medium">
                            {lastAlert ? lastAlert.message : (isCritical ? 'El motor de trading está fuera de línea o veteado por seguridad.' : 'Se han detectado irregularidades leves en la integridad de los datos.')}
                        </p>
                    </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-black/20 rounded-lg border border-white/5">
                    <span className="text-[9px] font-mono font-bold uppercase">Estado: {health.status}</span>
                </div>
            </div>
        </div>
    );
};

export default SystemAlertsBanner;
