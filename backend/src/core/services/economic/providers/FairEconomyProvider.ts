import { IEconomicProvider, EconomicEvent } from '../types';
import { SmartFetch } from '../../SmartFetch';

export class FairEconomyProvider implements IEconomicProvider {
    public name = 'FairEconomy (Primary)';
    public priority = 1;

    private readonly CSV_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.csv';
    private readonly NUCLEAR_KEYWORDS = ['CPI', 'FOMC', 'Funds Rate', 'Non-Farm Employment', 'Unemployment Rate'];

    async fetchEvents(): Promise<EconomicEvent[]> {
        try {
            const csvData = await SmartFetch.get<string>(this.CSV_URL);
            if (csvData && csvData.includes('Title')) {
                return this.parseCSV(csvData);
            }
            throw new Error('Invalid CSV Data');
        } catch (error: any) {
            console.warn(`[FairEconomy] Fetch failed: ${error.message}`);
            throw error;
        }
    }

    private parseCSV(csvData: string): EconomicEvent[] {
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

            if (country !== 'USD') continue;

            const isHighImpact = impact === 'High';
            const isNuclear = isHighImpact && this.NUCLEAR_KEYWORDS.some(k => title.includes(k));

            if (isHighImpact) {
                events.push({
                    title,
                    country,
                    date: this.parseDate(date),
                    time,
                    impact: 'High',
                    isNuclear,
                    source: this.name
                });
            }
        }
        return events;
    }

    private parseDate(usDate: string): string {
        try {
            const [month, day, year] = usDate.split('-');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } catch {
            return '';
        }
    }
}
