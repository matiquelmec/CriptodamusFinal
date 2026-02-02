/**
 * NOTIFICATION INTELLIGENCE FILTER
 * 
 * Professional-grade notification system that prevents spam while ensuring
 * critical updates are always communicated. Based on institutional trading practices.
 * 
 * Philosophy: "Only notify what's actionable or psychologically significant."
 */

interface NotificationState {
    lastSL: number;
    lastTP: { tp1?: number; tp2?: number; tp3?: number };
    lastNotificationTime: number;
    lastNotificationType: string;
}

export class NotificationFilter {
    private static cache = new Map<string, NotificationState>();

    /**
     * Determines if an SL/TP update warrants a Telegram notification
     * @returns { shouldNotify: boolean, reason?: string }
     */
    static shouldNotifyUpdate(
        symbol: string,
        updateType: 'SL_MOVED' | 'TP_HIT' | 'TP_ADAPTED' | 'TRADE_CLOSED',
        data: {
            oldValue?: number;
            newValue?: number;
            stage?: number;
            reason?: string;
            pnl?: number;
        }
    ): { shouldNotify: boolean; reason?: string; suppressionReason?: string } {

        // CRITICAL RULE 1: Always notify on trade closure
        if (updateType === 'TRADE_CLOSED') {
            return { shouldNotify: true, reason: 'Trade lifecycle complete' };
        }

        // CRITICAL RULE 2: Always notify on TP hits (profit-taking is always important)
        if (updateType === 'TP_HIT') {
            return { shouldNotify: true, reason: 'Profit milestone reached' };
        }

        // Get cached state
        const state = this.cache.get(symbol) || {
            lastSL: 0,
            lastTP: {},
            lastNotificationTime: 0,
            lastNotificationType: ''
        };

        const now = Date.now();

        // ========== SL MOVEMENT FILTERING ==========
        if (updateType === 'SL_MOVED') {
            const oldSL = data.oldValue || state.lastSL;
            const newSL = data.newValue || 0;

            // FILTER 1: Cooldown for same event type (prevent double notifications)
            const MIN_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
            if (
                now - state.lastNotificationTime < MIN_COOLDOWN_MS &&
                state.lastNotificationType === 'SL_MOVED'
            ) {
                return {
                    shouldNotify: false,
                    suppressionReason: 'Cooldown active (5min between SL updates)'
                };
            }

            // FILTER 2: Significance threshold (% change needed to notify)
            if (oldSL > 0) {
                const changePercent = Math.abs(((newSL - oldSL) / oldSL) * 100);
                const MINIMUM_CHANGE_PERCENT = 0.5; // 0.5% minimum movement to notify

                if (changePercent < MINIMUM_CHANGE_PERCENT) {
                    return {
                        shouldNotify: false,
                        suppressionReason: `Insignificant change (${changePercent.toFixed(2)}% < ${MINIMUM_CHANGE_PERCENT}%)`
                    };
                }
            }

            // FILTER 3: Direction & Psychology
            // ALWAYS notify if moving to breakeven or profit (major psychological milestone)
            if (data.reason?.toLowerCase().includes('breakeven') ||
                data.reason?.toLowerCase().includes('profit secured')) {
                this.updateCache(symbol, updateType, newSL, {});
                return {
                    shouldNotify: true,
                    reason: 'Breakeven milestone (psychologically critical)'
                };
            }

            // ALWAYS notify if SL is tightening significantly (> 2%)
            if (oldSL > 0) {
                const movementPercent = ((newSL - oldSL) / oldSL) * 100;
                if (Math.abs(movementPercent) > 2.0) {
                    this.updateCache(symbol, updateType, newSL, {});
                    return {
                        shouldNotify: true,
                        reason: `Significant SL adjustment (${movementPercent.toFixed(2)}%)`
                    };
                }
            }

            // If we pass all filters, allow notification
            this.updateCache(symbol, updateType, newSL, {});
            return { shouldNotify: true, reason: 'SL update meets all criteria' };
        }

        // ========== TP ADAPTATION FILTERING ==========
        if (updateType === 'TP_ADAPTED') {
            // TP adaptations are contextual (e.g., front-running detection)
            // ALWAYS notify if it's a defensive move (front-run detected)
            if (data.reason?.toLowerCase().includes('front-run') ||
                data.reason?.toLowerCase().includes('cluster')) {
                return {
                    shouldNotify: true,
                    reason: 'Defensive TP adaptation (market structure changed)'
                };
            }

            // Otherwise, apply cooldown (prevent spam from rapid adaptations)
            const ADAPTATION_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
            if (now - state.lastNotificationTime < ADAPTATION_COOLDOWN_MS) {
                return {
                    shouldNotify: false,
                    suppressionReason: 'Cooldown active (15min between TP adaptations)'
                };
            }

            return { shouldNotify: true, reason: 'TP adaptation cleared cooldown' };
        }

        // Default: Allow (safety fallback)
        return { shouldNotify: true, reason: 'Default allow for unknown type' };
    }

    /**
     * Update internal cache after notification
     */
    private static updateCache(
        symbol: string,
        type: string,
        newSL?: number,
        newTP?: Record<string, number>
    ) {
        const state = this.cache.get(symbol) || {
            lastSL: 0,
            lastTP: {},
            lastNotificationTime: 0,
            lastNotificationType: ''
        };

        if (newSL !== undefined) state.lastSL = newSL;
        if (newTP) state.lastTP = { ...state.lastTP, ...newTP };
        state.lastNotificationTime = Date.now();
        state.lastNotificationType = type;

        this.cache.set(symbol, state);
    }

    /**
     * Clear cache for a closed trade
     */
    static clearCache(symbol: string) {
        this.cache.delete(symbol);
    }

    /**
     * Get notification priority (for logging/debugging)
     */
    static getPriority(updateType: string, data: any): 'HIGH' | 'MEDIUM' | 'LOW' {
        if (updateType === 'TRADE_CLOSED') return 'HIGH';
        if (updateType === 'TP_HIT') return 'HIGH';
        if (data.reason?.toLowerCase().includes('breakeven')) return 'HIGH';
        if (updateType === 'TP_ADAPTED' && data.reason?.toLowerCase().includes('front-run'))
            return 'HIGH';
        if (updateType === 'SL_MOVED') return 'MEDIUM';
        return 'LOW';
    }
}
