import { createClient } from '@supabase/supabase-js';
import { SmartFetch } from './SmartFetch';

export interface EconomicEvent {
    title: string;
    country: string;
    date: string; // MM-DD-YYYY
    time: string; // 1:30pm
    impact: 'High' | 'Medium' | 'Low';
    isNuclear: boolean; // CPI, FOMC, NFP
}

export interface ShieldStatus {
    isActive: boolean;    // General day status
    isImminent: boolean;  // Sniper trigger: within -60m to +30m window
    isCached?: boolean;   // NEW: Indicates if source is live or from cache
    reason: string;
    nextEvent?: string;
    nextEventTime?: string;
}

export class EconomicService {

    private static CSV_URL = 'https://cdn.forexfactory.com/ff_calendar_thisweek.csv';
    private static NUCLEAR_KEYWORDS = ['CPI', 'FOMC', 'Funds Rate', 'Non-Farm Employment', 'Unemployment Rate'];

    // --- HYBRID CACHE STATE ---
    private static cachedEvents: EconomicEvent[] = [];
    private static lastUpdate: number = 0;
    private static sourceStatus: 'LIVE' | 'CACHE' | 'EMPTY' = 'EMPTY';
    private static supabaseInstance: any = null;

    /**
     * Checks if today is a "Nuclear Winter" day (High Impact USD Events)
     * Returns true if trading should be BLOCKED.
     */
    static async checkNuclearStatus(): Promise<ShieldStatus> {
        return this.checkNuclearStatusForTime(new Date());
    }

    /**
     * Checks for specific nuclear events approaching within N minutes.
     * Used for "Smart Defense" triggers (e.g. 1 hour before).
     */
    static async getApproachingNuclearEvent(minutesLookahead: number = 60): Promise<EconomicEvent | null> {
        try {
            const events = await this.fetchEvents();
            if (events.length === 0) return null;

            const now = new Date();
            const lookahead = new Date(now.getTime() + minutesLookahead * 60000);

            // Filter for events that are:
            // 1. Nuclear (High Impact + Keywords)
            // 2. Happening between NOW and NOW + LOOKAHEAD
            return events.find(e => {
                if (!e.isNuclear) return false;

                const eventDate = this.parseCSVDateTime(e.date, e.time); // Need new helper
                if (!eventDate) return false;

                return eventDate >= now && eventDate <= lookahead;
            }) || null;

        } catch (e) {
            console.error("[EconomicService] Approaching Check Error", e);
            return null;
        }
    }

    private static async checkNuclearStatusForTime(dateToCheck: Date): Promise<ShieldStatus> {
        try {
            const events = await this.fetchEvents();
            const isCached = this.sourceStatus === 'CACHE';
            const todayStr = dateToCheck.toISOString().split('T')[0]; // YYYY-MM-DD

            // 1. Check for ANY nuclear event today (General Awareness)
            const nuclearEventToday = events.find(e => {
                const eventDate = this.parseCSVDate(e.date);
                return eventDate === todayStr && e.country === 'USD' && e.isNuclear;
            });

            if (!nuclearEventToday) {
                return {
                    isActive: false,
                    isImminent: false,
                    isCached,
                    reason: isCached ? 'Calendar offline (using verified mirror)' : 'No Nuclear Events Today'
                };
            }

            // 2. Sniper Shield: Check if we are in the DANGER ZONE (-60m to +30m)
            const now = new Date();
            const eventDateTime = this.parseCSVDateTime(nuclearEventToday.date, nuclearEventToday.time);

            let isImminent = false;
            let reason = `NUCLEAR DAY: [${nuclearEventToday.title}] at ${nuclearEventToday.time}. Scanner observing from distance.`;

            if (eventDateTime) {
                const diffMs = now.getTime() - eventDateTime.getTime();
                const diffMins = diffMs / 60000;

                // Window: 60 mins before until 30 mins after
                if (diffMins >= -60 && diffMins <= 30) {
                    isImminent = true;
                    reason = `💥 SNIPER SHIELD ACTIVE: [${nuclearEventToday.title}] is happening NOW. Trading Vetoed for safety.`;
                }
            }

            if (isCached && !isImminent) {
                reason = `📡 CACHED ${reason}`;
            }

            return {
                isActive: true,
                isImminent,
                isCached,
                reason,
                nextEvent: nuclearEventToday.title,
                nextEventTime: nuclearEventToday.time
            };

        } catch (e: any) {
            console.warn("[EconomicService] ⚠️ Critical Shield Failure:", e.message);
            // ONLY if everything else failed (Empty status)
            return {
                isActive: true, // Fail-SAFE: If we have NO data at all, block until user checks
                isImminent: true,
                reason: 'TOTAL_NEWS_BLINDNESS: No live data and no mirror available.'
            };
        }
    }

    private static async fetchEvents(): Promise<EconomicEvent[]> {
        const now = Date.now();

        // 1. Live Fetch Priority
        try {
            const csvData = await SmartFetch.get<string>(this.CSV_URL);
            if (csvData && csvData.includes('Title')) {
                const events = this.parseLineToEvents(csvData);
                if (events.length > 0) {
                    this.cachedEvents = events;
                    this.lastUpdate = now;
                    this.sourceStatus = 'LIVE';

                    // Mirror to DB as background task
                    this.persistMirror(csvData).catch(() => { });

                    return events;
                }
            }
        } catch (e) {
            console.warn("[EconomicService] 📡 Primary source offline. Falling back to mirrors...");
        }

        // 2. Database Mirror (if memory is empty or web failed)
        if (this.cachedEvents.length === 0) {
            const mirror = await this.recoverMirror();
            if (mirror) {
                this.cachedEvents = this.parseLineToEvents(mirror);
                this.sourceStatus = 'CACHE';
                console.log("[EconomicService] 🔄 Recovered economic data from DB Mirror.");
            }
        }

        // 3. Memory Fallback
        if (this.cachedEvents.length > 0) {
            this.sourceStatus = 'CACHE';
            return this.cachedEvents;
        }

        this.sourceStatus = 'EMPTY';
        return [];
    }

    private static parseLineToEvents(csvData: string): EconomicEvent[] {
        const lines = csvData.split('\n');
        const events: EconomicEvent[] = [];

        // Skip header
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            const parts = line.split(',');

            if (parts.length < 5) continue;

            const title = parts[0];
            const country = parts[1];
            const date = parts[2];
            const time = parts[3];
            const impact = parts[4];

            if (country !== 'USD') continue; // Only care about USD

            const isHighImpact = impact === 'High';
            const isNuclear = isHighImpact && this.NUCLEAR_KEYWORDS.some(k => title.includes(k));

            if (isHighImpact) {
                events.push({
                    title, country, date, time,
                    impact: 'High',
                    isNuclear
                });
            }
        }
        return events;
    }

    private static async persistMirror(csv: string) {
        const supabase = this.getSupabase();
        if (!supabase) return;

        try {
            await supabase
                .from('system_metadata')
                .upsert({
                    key: 'economic_calendar_mirror',
                    value: csv,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });

            console.log("💾 [EconomicService] Sync: Mirror successfully persisted to Supabase.");
        } catch (e: any) {
            console.error("❌ [EconomicService] Sync: Failed to persist mirror to Supabase:", e.message);
        }
    }

    private static async recoverMirror(): Promise<string | null> {
        const supabase = this.getSupabase();
        if (!supabase) return null;

        try {
            const { data } = await supabase
                .from('system_metadata')
                .select('value')
                .eq('key', 'economic_calendar_mirror')
                .single();

            if (data?.value) {
                console.log("📂 [EconomicService] Sync: Mirror data recovered from DB.");
                return data.value;
            }
            return null;
        } catch (e: any) {
            console.warn("⚠️ [EconomicService] Sync: Mirror recovery failed:", e.message);
            return null;
        }
    }

    private static getSupabase() {
        if (this.supabaseInstance) return this.supabaseInstance;

        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

        if (!url || !key) {
            console.warn("⚠️ [EconomicService] Supabase credentials missing. Mirroring disabled.");
            return null;
        }

        this.supabaseInstance = createClient(url, key);
        return this.supabaseInstance;
    }

    // Helper: Convert MM-DD-YYYY (FF) to YYYY-MM-DD (ISO)
    private static parseCSVDate(usDate: string): string {
        try {
            const [month, day, year] = usDate.split('-');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } catch {
            return '';
        }
    }

    // Helper: Parse Date + Time (FF usually 1:30pm) to Date Object
    // Assumes Server is UTC and FF CSV is roughly ET (UTC-5/UTC-4).
    // For safety, we treat it as if the event is happening in approx 5 hours offset.
    // Ideally use moment-timezone but for native JS we approximate.
    private static parseCSVDateTime(usDate: string, timeStr: string): Date | null {
        try {
            // 1. Parse Date
            const [month, day, year] = usDate.split('-');

            // 2. Parse Time (e.g. 1:30pm, 10:00am)
            const isPM = timeStr.toLowerCase().includes('pm');
            const timeRaw = timeStr.toLowerCase().replace('am', '').replace('pm', '').trim();
            const [hourStr, minuteStr] = timeRaw.split(':');

            let hour = parseInt(hourStr);
            if (isPM && hour < 12) hour += 12;
            if (!isPM && hour === 12) hour = 0;

            const minute = parseInt(minuteStr);

            // Create Date in UTC (Assuming FF time is approx ET, we add 5 hours for safe UTC conversion)
            // Or simpler: Just create local date and assume server is aligned or we use 
            // a relative buffer. High Impact events are synchronized globally roughly.
            // Let's assume input is ET (New York).
            // NY is UTC-5 (Standard) or UTC-4 (DST).
            // We'll map it to UTC by adding 5 hours to be safe/standard.

            const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), hour + 5, minute));
            return date;
        } catch (e) {
            return null;
        }
    }
}
