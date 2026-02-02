import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_KEY || ''
);

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertCategory = 'DATA_INTEGRITY' | 'API_FAILURE' | 'CALCULATION_ERROR' | 'HALT_PROTOCOL';

export class SystemAlertService {
    private static instance: SystemAlertService;

    private constructor() { }

    public static getInstance(): SystemAlertService {
        if (!SystemAlertService.instance) {
            SystemAlertService.instance = new SystemAlertService();
        }
        return SystemAlertService.instance;
    }

    /**
     * Logs a system alert to Supabase and console.
     */
    public async logAlert(params: {
        symbol?: string;
        severity: AlertSeverity;
        category: AlertCategory;
        message: string;
        metadata?: any;
    }) {
        const { symbol, severity, category, message, metadata } = params;

        // 1. Console Output (Immediate visibility)
        const logMethod = severity === 'CRITICAL' || severity === 'HIGH' ? 'error' : 'warn';
        console[logMethod](`[SystemAlert] [${category}] ${symbol ? `(${symbol}) ` : ''}${message}`);

        // 2. Persist to Supabase
        try {
            const { error } = await supabase
                .from('system_alerts')
                .insert([{
                    symbol,
                    severity,
                    category,
                    message,
                    metadata: metadata || {}
                }]);

            if (error) throw error;
        } catch (err: any) {
            console.error(`[SystemAlert] Failed to persist alert to Supabase: ${err.message}`);
        }
    }

    /**
     * Specialized method for Data Integrity Vetos
     */
    public async logVeto(symbol: string, reason: string, details?: any) {
        await this.logAlert({
            symbol,
            severity: 'MEDIUM',
            category: 'DATA_INTEGRITY',
            message: `VETO: ${reason}`,
            metadata: details
        });
    }

    /**
     * Specialized method for Critical Server Errors
     */
    public async logCritical(message: string, error?: any) {
        await this.logAlert({
            severity: 'CRITICAL',
            category: 'HALT_PROTOCOL',
            message,
            metadata: { error: error?.message || error }
        });
    }
}

export const systemAlerts = SystemAlertService.getInstance();
