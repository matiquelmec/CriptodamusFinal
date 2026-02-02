import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Activity, AlertTriangle, CheckCircle, ShieldAlert, ChevronDown, ListRestart } from 'lucide-react';
import { API_CONFIG } from '../services/config';
import { useSocket } from '../hooks/useSocket';

interface SystemHealth {
    status: 'OPTIMAL' | 'DEGRADED' | 'CRITICAL' | 'BOOTING' | 'SCANNING' | 'ACTIVE';
    alertCount: number;
    lastChecked: string;
    uptime: number;
    reason?: string;
}

interface SystemAlert {
    id: string;
    created_at: string;
    symbol: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
}

const SystemStatus: React.FC = () => {
    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [alerts, setAlerts] = useState<SystemAlert[]>([]);
    const [showDetails, setShowDetails] = useState(false);
    const [loading, setLoading] = useState(true);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    const effectiveBaseUrl = API_CONFIG.BASE_URL || 'http://localhost:3001';

    // Subscribe to WebSocket for real-time status updates
    const { systemStatus } = useSocket();

    const fetchStatus = async () => {
        try {
            const healthRes = await axios.get(`${effectiveBaseUrl}/api/system/health`);
            setHealth(healthRes.data);

            const alertsRes = await axios.get(`${effectiveBaseUrl}/api/system/alerts`);
            const alertsData = Array.isArray(alertsRes.data) ? alertsRes.data : [];
            setAlerts(alertsData.slice(0, 5)); // Only show last 5
        } catch (err) {
            console.warn('[SystemStatus] Failed to poll system health');
            setHealth({ status: 'CRITICAL', alertCount: 0, lastChecked: new Date().toISOString(), uptime: 0 });
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch and periodic refresh (less frequent now since WS provides updates)
    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 60000); // Reduced to 60s since WS handles real-time
        return () => clearInterval(interval);
    }, []);

    // Update health when WebSocket status changes
    useEffect(() => {
        if (systemStatus) {
            setHealth(prev => ({
                ...prev,
                status: systemStatus.status || prev?.status || 'BOOTING',
                reason: systemStatus.message || systemStatus.reason || prev?.reason,
                lastChecked: new Date().toISOString(),
                uptime: prev?.uptime || 0,
                alertCount: prev?.alertCount || 0
            }));
        }
    }, [systemStatus]);

    // Calculate dropdown position when showing
    useEffect(() => {
        if (showDetails && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + 8, // 8px below button
                right: window.innerWidth - rect.right
            });
        }
    }, [showDetails]);

    const getStatusColor = () => {
        if (!health) return 'text-secondary opacity-50';
        switch (health.status) {
            case 'OPTIMAL': return 'text-success';
            case 'BOOTING': return 'text-accent';
            case 'DEGRADED': return 'text-warning';
            case 'CRITICAL': return 'text-danger';
            default: return 'text-secondary';
        }
    };

    const getStatusGlow = () => {
        if (!health) return '';
        switch (health.status) {
            case 'OPTIMAL': return 'shadow-[0_0_10px_rgba(34,197,94,0.3)]';
            case 'BOOTING': return 'shadow-[0_0_10px_rgba(59,130,246,0.3)] animate-pulse';
            case 'DEGRADED': return 'shadow-[0_0_10px_rgba(234,179,8,0.3)]';
            case 'CRITICAL': return 'shadow-[0_0_10px_rgba(239,68,68,0.3)] shadow-danger-pulse animate-pulse';
            default: return '';
        }
    };

    const dropdownContent = showDetails ? (
        <div
            className="fixed w-72 bg-surface/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
            style={{
                top: `${dropdownPosition.top}px`,
                right: `${dropdownPosition.right}px`,
                zIndex: 999999
            }}
        >
            <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-2">
                    <ListRestart size={12} /> Status Report
                </span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/50 ${getStatusColor()}`}>
                    {health?.status}
                </span>
            </div>

            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 opacity-40">
                        <CheckCircle size={32} className="text-success mb-2" />
                        <p className="text-[10px] font-medium uppercase tracking-tighter">Sistema Óptimo</p>
                        <p className="text-[8px] text-center mt-1 uppercase">No se detectan vetos de integridad</p>
                    </div>
                ) : (
                    alerts.map((alert) => (
                        <div key={alert.id} className="p-2 border-l-2 border-border bg-black/20 rounded flex flex-col gap-1 transition-colors hover:bg-black/30" style={{ borderColor: alert.severity === 'CRITICAL' ? '#ef4444' : alert.severity === 'HIGH' ? '#f59e0b' : '#3b82f6' }}>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-accent">{alert.symbol || 'SYSTEM'}</span>
                                <span className="text-[8px] opacity-40">{new Date(alert.created_at).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-[10px] leading-snug">{alert.message}</p>
                        </div>
                    ))
                )}
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between opacity-50">
                <span className="text-[8px] uppercase font-mono">Uptime: {Math.floor((health?.uptime || 0) / 3600)}h {Math.floor(((health?.uptime || 0) % 3600) / 60)}m</span>
                <button
                    onClick={() => { fetchStatus(); setLoading(true); }}
                    className="text-[8px] hover:text-accent transition-colors uppercase font-bold"
                >
                    Refrescar
                </button>
            </div>
        </div>
    ) : null;

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={() => setShowDetails(!showDetails)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border transition-all hover:bg-border/20 ${getStatusGlow()}`}
            >
                <div className={`relative flex items-center justify-center`}>
                    <Activity size={14} className={getStatusColor()} />
                    {health?.status === 'OPTIMAL' ? (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full animate-ping opacity-75" />
                    ) : null}
                </div>

                <span className="text-[10px] font-mono font-bold tracking-tight uppercase">
                    {health?.status || 'ENGINE'}
                </span>

                <ChevronDown size={12} className={`opacity-50 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            </button>

            {/* Portal Dropdown - Rendered at document.body level */}
            {dropdownContent && createPortal(dropdownContent, document.body)}
        </div>
    );
};

export default SystemStatus;
