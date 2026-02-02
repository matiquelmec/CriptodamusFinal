import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { scannerService } from '../services/scanner';

dotenv.config();

const router = express.Router();
const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_KEY || ''
);

/**
 * GET /api/system/alerts
 * Returns the latest 20 system alerts.
 */
router.get('/alerts', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('system_alerts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/system/health
 * Returns a summary of system health based on recent critical alerts and live engine state.
 */
router.get('/health', async (req, res) => {
    try {
        // 1. Check database alerts
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: dbAlerts, error } = await supabase
            .from('system_alerts')
            .select('severity, message')
            .eq('resolved', false)
            .gt('created_at', oneDayAgo);

        if (error) throw error;

        // 2. Check live scanner status
        const liveStatus = scannerService.getLastStatus();

        const hasCritical = dbAlerts.some(a => a.severity === 'CRITICAL') || liveStatus.status === 'CRITICAL';
        const hasHigh = dbAlerts.some(a => a.severity === 'HIGH') || liveStatus.status === 'DEGRADED';

        let status = 'OPTIMAL';
        if (hasCritical) status = 'CRITICAL';
        else if (hasHigh) status = 'DEGRADED';

        // 3. Technical explanation
        let reason = 'Todos los sistemas operativos.';
        if (status !== 'OPTIMAL') {
            const firstAlert = dbAlerts.find(a => a.severity === status);
            reason = liveStatus.message || (firstAlert ? firstAlert.message : 'Detección de irregularidades en el flujo de datos.');
        }

        res.json({
            status,
            reason,
            alertCount: dbAlerts.length,
            engineStatus: liveStatus.status,
            lastChecked: new Date().toISOString(),
            uptime: process.uptime()
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
