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

        // 2. Determine final status
        const liveStatus = scannerService.getLastStatus();

        let status = liveStatus.status || 'OPTIMAL';
        let reason = liveStatus.message || liveStatus.reason || 'Sistemas operando normalmente.';

        // Critical DB alerts always take precedence
        const dbCritical = dbAlerts.some(a => a.severity === 'CRITICAL');
        const dbHigh = dbAlerts.some(a => a.severity === 'HIGH');

        if (dbCritical) {
            status = 'CRITICAL';
            reason = dbAlerts.find(a => a.severity === 'CRITICAL')?.message || reason;
        } else if (dbHigh && (status === 'OPTIMAL' || status === 'BOOTING' || status === 'SCANNING' || status === 'ACTIVE')) {
            status = 'DEGRADED';
            reason = dbAlerts.find(a => a.severity === 'HIGH')?.message || reason;
        }

        res.json({
            status,
            reason,
            alertCount: dbAlerts.length,
            engineStatus: liveStatus.status,
            lastChecked: new Date().toISOString(),
            uptime: Math.floor(process.uptime())
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
