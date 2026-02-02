import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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
 * Returns a summary of system health based on recent critical alerts.
 */
router.get('/health', async (req, res) => {
    try {
        // Check for unresolved critical alerts in the last 24h
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase
            .from('system_alerts')
            .select('severity')
            .eq('resolved', false)
            .gt('created_at', oneDayAgo);

        if (error) throw error;

        const hasCritical = data.some(a => a.severity === 'CRITICAL');
        const hasHigh = data.some(a => a.severity === 'HIGH');

        let status = 'OPTIMAL';
        if (hasCritical) status = 'CRITICAL';
        else if (hasHigh) status = 'DEGRADED';

        res.json({
            status,
            alertCount: data.length,
            lastChecked: new Date().toISOString(),
            uptime: process.uptime()
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
