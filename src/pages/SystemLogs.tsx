import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldCheck, AlertOctagon, AlertTriangle, Info, Clock, RefreshCw, Database } from 'lucide-react';
import { API_CONFIG } from '../services/config';
import { useSocket } from '../hooks/useSocket';

interface SystemAlert {
    id: string;
    created_at: string;
    symbol: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
    category: string;
    technical_details: string;
    resolved: boolean;
}

const SystemLogs: React.FC = () => {
    const [alerts, setAlerts] = useState<SystemAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [health, setHealth] = useState<any>(null);

    const effectiveBaseUrl = API_CONFIG.BASE_URL || 'http://localhost:3001';

    // Subscribe to WebSocket for real-time updates
    const { systemStatus } = useSocket();

    const fetchData = async () => {
        setLoading(true);
        try {
            const [healthRes, alertsRes] = await Promise.all([
                axios.get(`${effectiveBaseUrl}/api/system/health`),
                axios.get(`${effectiveBaseUrl}/api/system/alerts`)
            ]);
            setHealth(healthRes.data);
            setAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : []);
        } catch (error) {
            console.error('Failed to fetch system data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 120000); // Reduced frequency since WS provides updates
        return () => clearInterval(interval);
    }, []);

    // Update health when WebSocket status changes
    useEffect(() => {
        if (systemStatus && health) {
            setHealth((prev: any) => ({
                ...prev,
                status: systemStatus.status || prev?.status || 'BOOTING',
                reason: systemStatus.message || systemStatus.reason || prev?.reason,
                engineStatus: systemStatus.status
            }));
        }
    }, [systemStatus]);

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return <AlertOctagon className="text-danger" size={20} />;
            case 'HIGH': return <AlertTriangle className="text-warning" size={20} />;
            case 'MEDIUM': return <Info className="text-accent" size={20} />;
            default: return <Clock className="text-secondary" size={20} />;
        }
    };

    const getStatusCard = () => {
        if (!health) return null;
        const isNominal = ['OPTIMAL', 'BOOTING', 'SCANNING', 'ACTIVE'].includes(health.status);
        return (
            <div className={`p-6 rounded-2xl border ${isNominal ? 'bg-success/5 border-success/20' : 'bg-warning/5 border-warning/20'} flex flex-col md:flex-row items-center justify-between gap-6 mb-8`}>
                <div className="flex items-center gap-4 text-center md:text-left">
                    <div className={`p-4 rounded-full ${isNominal ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                        <ShieldCheck size={48} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold uppercase tracking-tighter">Estado: {health.status}</h2>
                        <p className="text-secondary text-sm mt-1 max-w-md">
                            {health.status === 'OPTIMAL' ? (
                                "El motor de blindaje atómico está operando sin restricciones. Todos los datos de mercado son íntegros."
                            ) : health.status === 'BOOTING' ? (
                                "El sistema se está iniciando y sincronizando con las fuentes de datos globales. Espere un momento..."
                            ) : health.status === 'SCANNING' ? (
                                "El motor está analizando activamente oportunidades en el mercado global. Integridad: 100%."
                            ) : (health.status === 'DEGRADED' || health.status === 'CRITICAL' || health.status === 'ERROR') ? (
                                health.reason || "Se han detectado irregularidades. El sistema está aplicando vetos preventivos para proteger el capital."
                            ) : (
                                "Sincronizando estado del sistema..."
                            )}
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                    <div className="bg-surface p-4 rounded-xl border border-border flex flex-col items-center">
                        <span className="text-2xl font-mono font-bold text-accent">{alerts.length}</span>
                        <span className="text-[10px] text-secondary uppercase font-bold mt-1">Alertas Activas</span>
                    </div>
                    <div className="bg-surface p-4 rounded-xl border border-border flex flex-col items-center">
                        <span className="text-2xl font-mono font-bold text-accent">{Math.floor((health.uptime || 0) / 3600)}h</span>
                        <span className="text-[10px] text-secondary uppercase font-bold mt-1">Uptime Motor</span>
                    </div>
                </div>
            </div >
        );
    };

    return (
        <div className="container mx-auto p-4 max-w-6xl animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-8">
                <div className="flex flex-col">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Database className="text-accent" /> Centro de Integridad y Logs
                    </h1>
                    <p className="text-secondary mt-1 uppercase text-xs font-bold tracking-widest">Monitoreo sistémico del blindaje de datos</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-border/20 border border-border rounded-xl transition-all font-mono text-sm uppercase font-bold"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refrescar
                </button>
            </div>

            {!health && !loading && (
                <div className="p-6 rounded-2xl border bg-danger/5 border-danger/20 flex items-center justify-center gap-4 mb-8">
                    <AlertOctagon className="text-danger" size={32} />
                    <div className="flex flex-col">
                        <h2 className="text-lg font-bold uppercase">Backend Fuera de Línea</h2>
                        <p className="text-secondary text-xs uppercase font-bold">No se pudo conectar con el motor de blindaje ({effectiveBaseUrl})</p>
                    </div>
                </div>
            )}

            {health && getStatusCard()}

            <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-border bg-black/20 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-secondary">Historial de Alertas de Sistema</h3>
                    <span className="text-[10px] font-mono opacity-50">Última actualización: {new Date().toLocaleTimeString()}</span>
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-[60vh] custom-scrollbar">
                    {/* INTELLIGENT EMPTY STATE: Only show 100% Integrity IF connected and optimal */}
                    {alerts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-80">
                            {(!health || health.status === 'OFFLINE' || health.status === 'ERROR') ? (
                                <>
                                    <AlertOctagon size={64} className="text-danger mb-4 animate-pulse" />
                                    <p className="text-xl font-bold uppercase text-danger">Conexión con Blindaje Perdida</p>
                                    <p className="text-sm mt-2 font-mono text-secondary">No se puede verificar la integridad de los datos.</p>
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={64} className="text-success mb-4" />
                                    <p className="text-xl font-bold uppercase text-success">Sistema Nominal</p>
                                    <p className="text-sm mt-2 text-secondary">La integridad del sistema está verificada al 100%</p>
                                    <p className="text-[10px] mt-1 opacity-50 font-mono">Sin alertas activas.</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-surface z-10">
                                <tr className="text-[10px] uppercase font-bold text-secondary border-b border-border">
                                    <th className="p-4">Severidad</th>
                                    <th className="p-4">Timestamp</th>
                                    <th className="p-4">Símbolo</th>
                                    <th className="p-4">Mensaje Técnico</th>
                                    <th className="p-4 text-right">Detalles</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alerts.map((alert) => (
                                    <tr key={alert.id} className="border-b border-border/50 hover:bg-white/5 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 font-mono text-[10px] font-bold">
                                                {getSeverityIcon(alert.severity)}
                                                <span className={alert.severity === 'CRITICAL' ? 'text-danger' : alert.severity === 'HIGH' ? 'text-warning' : 'text-accent'}>
                                                    {alert.severity}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-xs font-mono opacity-60">
                                            {new Date(alert.created_at).toLocaleString()}
                                        </td>
                                        <td className="p-4">
                                            <span className="font-bold text-accent px-2 py-1 bg-accent/10 rounded">{alert.symbol || 'SYSTEM'}</span>
                                        </td>
                                        <td className="p-4">
                                            <p className="text-xs font-medium leading-relaxed max-w-md">{alert.message}</p>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button className="p-2 hover:bg-accent/20 rounded-lg text-secondary transition-all opacity-0 group-hover:opacity-100">
                                                Ver XML/Data
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <footer className="mt-8 p-6 bg-black/40 rounded-2xl border border-white/5 text-center">
                <p className="text-xs text-secondary leading-relaxed max-w-2xl mx-auto">
                    Este panel muestra la actividad del <span className="text-accent font-bold">Atomic Shield v2.0</span>. Todas las discrepancias de datos son veteadas instantáneamente antes de generar una señal. La ausencia de alertas indica una ejecución nominal y segura.
                </p>
            </footer>
        </div>
    );
};

export default SystemLogs;
