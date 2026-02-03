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
    reason: string;
    nextEvent?: string;
    nextEventTime?: string;
}

export class EconomicService {

    private static CSV_URL = 'https://cdn.forexfactory.com/ff_calendar_thisweek.csv';
    private static NUCLEAR_KEYWORDS = ['CPI', 'FOMC', 'Funds Rate', 'Non-Farm Employment', 'Unemployment Rate'];

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
            const todayStr = dateToCheck.toISOString().split('T')[0]; // YYYY-MM-DD

            // 1. Check for ANY nuclear event today (General Awareness)
            const nuclearEventToday = events.find(e => {
                const eventDate = this.parseCSVDate(e.date);
                return eventDate === todayStr && e.country === 'USD' && e.isNuclear;
            });

            if (!nuclearEventToday) {
                return { isActive: false, isImminent: false, reason: 'No Nuclear Events Today' };
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

            return {
                isActive: true,
                isImminent,
                reason,
                nextEvent: nuclearEventToday.title,
                nextEventTime: nuclearEventToday.time
            };

        } catch (e) {
            console.warn("[EconomicService] ⚠️ Calendar Unreachable - FAILING OPEN (proceeding without news check)", e);
            // ✅ FAIL-OPEN STRATEGY: If we can't verify events, assume NO critical events
            // Rationale: False negatives (missing 1 event/month) << False positives (blocking ALL scans)
            // Nuclear events are rare (~0.2% of days), calendar failures are common (rate limits/DNS)
            return {
                isActive: false,
                isImminent: false,
                reason: 'Calendar offline (fail-open mode)'
            };
        }
    }

    private static async fetchEvents(): Promise<EconomicEvent[]> {
        try {
            const csvData = await SmartFetch.get<string>(this.CSV_URL);
            if (!csvData || !csvData.includes('Title')) return [];

            const lines = csvData.split('\n');
            const events: EconomicEvent[] = [];

            // Skip header
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                // Basic CSV split, might break if title has comma, but FF usually clean
                // Title,Country,Date,Time,Impact,Forecast,Previous
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

        } catch (e) {
            console.error("[EconomicService] Fetch Error", e);
            return [];
        }
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
