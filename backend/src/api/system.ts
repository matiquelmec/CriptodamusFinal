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
 * POST /api/system/cleanup-alerts (ADMIN ONLY)
 * Emergency cleanup: Resolves all non-critical ghost alerts immediately
 */
router.post('/cleanup-alerts', async (req, res) => {
    try {
        // Basic auth check
        const secret = req.headers['x-admin-secret'];
        if (secret !== process.env.ADMIN_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { AlertCleanupService } = await import('../services/alertCleanupService');
        const count = await AlertCleanupService.emergencyCleanup();

        res.json({
            success: true,
            message: `Resolved ${count} ghost alerts`,
            count
        });
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
            .select('severity, message, created_at')
            .eq('resolved', false)
            .gt('created_at', oneDayAgo);

        if (error) throw error;

        // 2. Determine final status
        const liveStatus = scannerService.getLastStatus();

        let status = liveStatus.status || 'OPTIMAL';
        let reason = liveStatus.message || liveStatus.reason || 'Sistemas operando normalmente.';

        // Critical DB alerts always take precedence (Persistent for 24h)
        const dbCritical = dbAlerts.find((a: any) => a.severity === 'CRITICAL');

        // INTELLIGENT CLEANUP: Auto-resolve stale HIGH alerts before evaluation
        // This prevents ghost alerts from causing permanent DEGRADED status
        const { AlertCleanupService } = await import('../services/alertCleanupService');
        await AlertCleanupService.cleanupStaleAlerts(); // Non-blocking, runs in background

        // High severity alerts (Degraded) are only relevant if recent (e.g., last 15 mins)
        // because the engine re-logs them every cycle if the issue persists.
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).getTime();
        const dbHigh = dbAlerts.find((a: any) =>
            a.severity === 'HIGH' &&
            new Date(a.created_at).getTime() > fifteenMinsAgo
        );

        if (dbCritical) {
            status = 'CRITICAL';
            reason = dbCritical.message;
        } else if (dbHigh && (status === 'OPTIMAL' || status === 'BOOTING' || status === 'SCANNING' || status === 'ACTIVE')) {
            status = 'DEGRADED';
            reason = dbHigh.message; // Show the specific reason (e.g., "Integrity DEGRADED...")
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
