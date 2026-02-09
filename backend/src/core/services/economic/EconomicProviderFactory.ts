import { IEconomicProvider, EconomicEvent } from './types';
import { FairEconomyProvider } from './providers/FairEconomyProvider';

export class EconomicProviderFactory {
    private static providers: IEconomicProvider[] = [
        new FairEconomyProvider()
        // Add more providers here (e.g. ForexFactory, Investing, etc.)
    ];

    /**
     * Tries to fetch events from providers in priority order.
     * Returns the first successful result.
     */
    static async fetchEvents(): Promise<{ events: EconomicEvent[], source: string }> {
        const errors: string[] = [];

        for (const provider of this.providers.sort((a, b) => a.priority - b.priority)) {
            try {
                console.log(`[EconomicFactory] Trying provider: ${provider.name}...`);
                const events = await provider.fetchEvents();

                if (events.length > 0) {
                    console.log(`[EconomicFactory] Success: ${provider.name} returned ${events.length} events.`);
                    return { events, source: provider.name };
                } else {
                    console.warn(`[EconomicFactory] Provider ${provider.name} returned empty list.`);
                }
            } catch (error: any) {
                console.warn(`[EconomicFactory] Provider ${provider.name} failed: ${error.message}`);
                errors.push(`${provider.name}: ${error.message}`);
            }
        }

        throw new Error(`All Economic Providers failed: ${errors.join(' | ')}`);
    }
}
