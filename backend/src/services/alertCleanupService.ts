import { createClient } from '@supabase/supabase-js';

// Initialize client lazily to avoid top-level environment variable issues
let supabaseInstance: any = null;

function getSupabase() {
    if (supabaseInstance) return supabaseInstance;

    const url = process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (!url || !key) {
        console.warn('⚠️ [AlertCleanup] Supabase URL or Key missing. Service will be inactive.');
        return null;
    }

    supabaseInstance = createClient(url, key);
    return supabaseInstance;
}

/**
 * ALERT CLEANUP SERVICE
 * 
 * Professional lifecycle management for system alerts.
 * Auto-resolves stale alerts based on severity-aware TTL.
 */

interface CleanupStats {
    totalCleaned: number;
    byType: Record<string, number>;
}

export class AlertCleanupService {
    // TTL Configuration (in milliseconds)
    private static readonly TTL_CONFIG = {
        LOW: 1 * 60 * 60 * 1000,      // 1 hour
        MEDIUM: 6 * 60 * 60 * 1000,   // 6 hours
        HIGH: 24 * 60 * 60 * 1000,    // 24 hours
        CRITICAL: Infinity             // Never auto-resolve
    };

    /**
     * Clean up stale alerts based on TTL rules
     */
    static async cleanupStaleAlerts(): Promise<CleanupStats> {
        const stats: CleanupStats = {
            totalCleaned: 0,
            byType: { LOW: 0, MEDIUM: 0, HIGH: 0 }
        };

        try {
            const now = Date.now();

            // Process each severity level (except CRITICAL)
            for (const [severity, ttl] of Object.entries(this.TTL_CONFIG)) {
                if (severity === 'CRITICAL') continue; // Never auto-resolve CRITICAL

                const expirationTime = new Date(now - ttl).toISOString();

                // Mark stale alerts as resolved
                const supabase = getSupabase();
                if (!supabase) return stats;

                const { data, error } = await supabase
                    .from('system_alerts')
                    .update({
                        resolved: true,
                        resolved_at: new Date().toISOString(),
                        resolution_type: 'AUTO_TTL_EXPIRED'
                    })
                    .eq('severity', severity)
                    .eq('resolved', false)
                    .lt('created_at', expirationTime)
                    .select('id');

                if (error) {
                    console.error(`❌ [AlertCleanup] Error cleaning ${severity}:`, error.message);
                    continue;
                }

                const count = data?.length || 0;
                if (count > 0) {
                    stats.byType[severity] = count;
                    stats.totalCleaned += count;
                    console.log(`🧹 [AlertCleanup] Resolved ${count} stale ${severity} alerts (older than ${ttl / (60 * 60 * 1000)}h)`);
                }
            }

            if (stats.totalCleaned > 0) {
                console.log(`✅ [AlertCleanup] Total cleaned: ${stats.totalCleaned} alerts`);
            }

        } catch (err: any) {
            console.error('❌ [AlertCleanup] CRITICAL ERROR:', err.message);
        }

        return stats;
    }

    /**
     * One-time cleanup for immediate relief (cleans ALL non-critical alerts)
     */
    static async emergencyCleanup(): Promise<number> {
        try {
            const supabase = getSupabase();
            if (!supabase) return 0;

            const { data, error } = await supabase
                .from('system_alerts')
                .update({
                    resolved: true,
                    resolved_at: new Date().toISOString(),
                    resolution_type: 'EMERGENCY_CLEANUP'
                })
                .neq('severity', 'CRITICAL')
                .eq('resolved', false)
                .select('id');

            if (error) throw error;

            const count = data?.length || 0;
            console.log(`🚨 [Emergency] Resolved ${count} ghost alerts`);
            return count;

        } catch (err: any) {
            console.error('❌ [Emergency] Cleanup failed:', err.message);
            return 0;
        }
    }
}

// Export singleton for easy import
export const alertCleanup = AlertCleanupService;
