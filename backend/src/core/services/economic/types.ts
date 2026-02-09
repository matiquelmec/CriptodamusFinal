export interface EconomicEvent {
    title: string;
    country: string;
    date: string; // ISO format or YYYY-MM-DD
    time: string; // HH:mm or similar
    impact: 'High' | 'Medium' | 'Low';
    isNuclear: boolean;
    source?: string;
}

export interface IEconomicProvider {
    name: string;
    priority: number;
    fetchEvents(): Promise<EconomicEvent[]>;
}

export interface ShieldStatus {
    isActive: boolean;
    isImminent: boolean;
    isCached?: boolean;
    source?: string;
    reason: string;
    nextEvent?: string;
    nextEventTime?: string;
}
