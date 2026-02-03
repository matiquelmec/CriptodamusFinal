import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import axios from 'axios';
import { API_CONFIG } from '../services/config';

const SystemStatusIndicator: React.FC = () => {
    const [lastScan, setLastScan] = useState<Date | null>(null);
    const [nextScan, setNextScan] = useState<string>('');
    const { systemStatus, isConnected } = useSocket();

    const effectiveBaseUrl = API_CONFIG.BASE_URL || 'http://localhost:3001';

    // Fetch health to get last scan time
    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const res = await axios.get(`${effectiveBaseUrl}/api/system/health`);
                if (res.data.lastChecked) {
                    setLastScan(new Date(res.data.lastChecked));
                }
            } catch (e) {
                // Silent fail - not critical
            }
        };

        fetchHealth();
        const timer = setInterval(fetchHealth, 60000); // Every 60s
        return () => clearInterval(timer);
    }, [effectiveBaseUrl]);

    // Calculate time ago
    const getTimeAgo = () => {
        if (!lastScan) return 'Iniciando...';

        const now = new Date();
        const diffMs = now.getTime() - lastScan.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Hace <1 min';
        if (diffMins < 60) return `Hace ${diffMins} min`;

        const diffHours = Math.floor(diffMins / 60);
        return `Hace ${diffHours}h ${diffMins % 60}m`;
    };

    // Calculate next scan (scans are aligned to :00, :15, :30, :45)
    useEffect(() => {
        const calculateNextScan = () => {
            const now = new Date();
            const minutes = now.getMinutes();
            const remainder = minutes % 15;
            const minutesToNext = 15 - remainder;

            const next = new Date(now.getTime() + minutesToNext * 60000);
            const timeStr = next.toLocaleTimeString('es-CL', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            setNextScan(timeStr);
        };

        calculateNextScan();
        const timer = setInterval(calculateNextScan, 10000); // Update every 10s
        return () => clearInterval(timer);
    }, []);

    const status = systemStatus?.status || 'OPTIMAL';
    const isScanning = status === 'SCANNING';
    const isCritical = status === 'CRITICAL' || status === 'OFFLINE';

    // Icon and color based on status
    const getStatusIcon = () => {
        if (isCritical) return <AlertCircle size={14} className="text-red-500" />;
        if (isScanning) return <Activity size={14} className="text-blue-400 animate-pulse" />;
        return <CheckCircle size={14} className="text-green-500" />;
    };

    const getStatusColor = () => {
        if (isCritical) return 'text-red-500';
        if (isScanning) return 'text-blue-400';
        return 'text-green-500';
    };

    const getStatusText = () => {
        if (status === 'CRITICAL') return 'Crítico';
        if (status === 'OFFLINE') return 'Desconectado';
        if (isScanning) return 'Analizando';
        if (status === 'PAUSED') return 'Pausado';
        return 'Operativo';
    };

    return (
        <div className="fixed top-4 right-4 z-40 bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-lg px-3 py-2 shadow-xl">
            <div className="flex items-center gap-3 text-xs">
                {/* Status Icon + Text */}
                <div className="flex items-center gap-1.5">
                    {getStatusIcon()}
                    <span className={`font-semibold ${getStatusColor()}`}>
                        {getStatusText()}
                    </span>
                </div>

                {/* Divider */}
                <div className="w-px h-4 bg-gray-700/50" />

                {/* Last Scan */}
                <div className="flex items-center gap-1.5 text-gray-400">
                    <Clock size={12} />
                    <span className="font-medium">{getTimeAgo()}</span>
                </div>

                {/* Next Scan (only if not scanning) */}
                {!isScanning && !isCritical && (
                    <>
                        <div className="w-px h-4 bg-gray-700/50" />
                        <span className="text-gray-500 text-[10px]">
                            Próximo: {nextScan}
                        </span>
                    </>
                )}

                {/* WebSocket Connection Indicator */}
                <div className="w-px h-4 bg-gray-700/50" />
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
                    title={isConnected ? 'Conectado' : 'Desconectado'} />
            </div>
        </div>
    );
};

export default SystemStatusIndicator;
