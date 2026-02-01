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
    isActive: boolean;
    reason: string;
    nextEvent?: string;
}

export class EconomicService {

    private static CSV_URL = 'https://cdn.forexfactory.com/ff_calendar_thisweek.csv';
    private static NUCLEAR_KEYWORDS = ['CPI', 'FOMC', 'Funds Rate', 'Non-Farm Employment', 'Unemployment Rate'];

    /**
     * Checks if today is a "Nuclear Winter" day (High Impact USD Events)
     * Returns true if trading should be BLOCKED.
     */
    static async checkNuclearStatus(): Promise<ShieldStatus> {
        try {
            const events = await this.fetchEvents();
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

            // Format today to match CSV format (roughly) or parse CSV date to ISO
            // FF CSV Date format is usually MM-DD-YYYY

            // Let's rely on parsing the CSV rows correctly
            const nuclearEventToday = events.find(e => {
                const eventDate = this.parseCSVDate(e.date); // Returns YYYY-MM-DD
                return eventDate === today && e.country === 'USD' && e.isNuclear;
            });

            if (nuclearEventToday) {
                return {
                    isActive: true,
                    reason: `NUCLEAR EVENT DETECTED: [${nuclearEventToday.title}] at ${nuclearEventToday.time}. TRADING PAUSED ALL DAY.`,
                    nextEvent: nuclearEventToday.title
                };
            }

            return { isActive: false, reason: 'No Nuclear Events Today' };

        } catch (e) {
            console.warn("[EconomicService] Failed to fetch calendar. Defaulting to OPEN (Risk of missing event).", e);
            // Fail Open to avoid blocking trading if FF is down, but log warning.
            // Or Fail Closed? User wants maximum safety. 
            // Let's Fail Open but log heavily, because infinite blocks due to network error are annoying.
            return { isActive: false, reason: 'Calendar Unreachable' };
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
}
