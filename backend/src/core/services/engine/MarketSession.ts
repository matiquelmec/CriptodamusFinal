/**
 * Institutional Market Session & Volatility Guard
 * 
 * Responsible for "Time Awareness":
 * 1. Identifying the current Trading Session (Asia, London, NY)
 * 2. Detecting "Kill Zones" (High Volatility Windows like NY Open)
 * 
 * USES DYNAMIC TIMEZONE LOGIC (Intl API) - Automatically handles DST changes.
 */

export type SessionRegion = 'ASIA' | 'LONDON' | 'NEW_YORK' | 'OVERLAP_NY_LND';

interface SessionState {
    activeSessions: SessionRegion[];
    isKillZone: boolean; // TRUE if within 15 mins of a major open/close
    killZoneReason?: string;
    volatilityFactor: number; // Multiplier for risk (1.0 = Normal, 0.0 = DO NOT TRADE)
}

export class MarketSession {

    // Timezone safe getters
    private static getTimeInZone(timeZone: string): { hour: number, minute: number } {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
        });
        const parts = formatter.formatToParts(now);
        const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
        const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
        return { hour, minute };
    }

    /**
     * Helper to convert Time (13:30) to minutes from midnight (810)
     */
    private static toMinutes(time: { hour: number, minute: number }): number {
        return time.hour * 60 + time.minute;
    }

    /**
     * Main Analysis Function
     */
    static analyzeSession(): SessionState {
        const nyTime = this.getTimeInZone('America/New_York');
        const lndTime = this.getTimeInZone('Europe/London');
        const tokTime = this.getTimeInZone('Asia/Tokyo');

        const nyMins = this.toMinutes(nyTime);
        const lndMins = this.toMinutes(lndTime);
        const tokMins = this.toMinutes(tokTime);

        const activeSessions: SessionRegion[] = [];
        let isKillZone = false;
        let killZoneReason = undefined;
        let volatilityFactor = 1.0;

        // --- 1. DETECT ACTIVE SESSIONS ---

        // ASIA (Tokyo): 09:00 - 15:00 (Approx crypto relevancy extends to London Open)
        if (tokMins >= 9 * 60 && tokMins <= 18 * 60) activeSessions.push('ASIA');

        // LONDON: 08:00 - 16:30
        if (lndMins >= 8 * 60 && lndMins <= 16 * 60 + 30) activeSessions.push('LONDON');

        // NEW YORK: 09:30 - 16:00
        if (nyMins >= 9 * 60 + 30 && nyMins <= 16 * 60) activeSessions.push('NEW_YORK');

        // OVERLAP
        if (activeSessions.includes('LONDON') && activeSessions.includes('NEW_YORK')) {
            activeSessions.push('OVERLAP_NY_LND');
        }

        // --- 2. KILL ZONES (Volatility Guard) ---
        // Institutional traders DO NOT open positions 15 mins before/after the bell.

        // NY OPEN (09:30 NY)
        const nyOpenMins = 9 * 60 + 30;
        if (Math.abs(nyMins - nyOpenMins) <= 15) {
            isKillZone = true;
            killZoneReason = "NY OPEN VOLATILITY";
            volatilityFactor = 0.5; // Reduce sizing by half
        }

        // NY CLOSE (16:00 NY)
        const nyCloseMins = 16 * 60;
        if (Math.abs(nyMins - nyCloseMins) <= 15) {
            isKillZone = true;
            killZoneReason = "NY CLOSE IMBALANCE";
        }

        // LONDON OPEN (08:00 London)
        const lndOpenMins = 8 * 60;
        if (Math.abs(lndMins - lndOpenMins) <= 15) {
            isKillZone = true;
            killZoneReason = "LONDON OPEN VOLATILITY";
        }

        // FOMC / MACRO EVENTS (Placeholder: ideally hooked to calendar)
        // For now, we rely on the generic 'volatilityFactor'

        return {
            activeSessions,
            isKillZone,
            killZoneReason,
            volatilityFactor
        };
    }
}
