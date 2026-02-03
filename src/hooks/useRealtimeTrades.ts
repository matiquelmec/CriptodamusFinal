import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Load directly from env or config
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: any = null;

if (SUPABASE_URL && SUPABASE_KEY) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (err) {
        console.error("⚠️ Failed to initialize Supabase Realtime Client:", err);
    }
} else {
    console.warn("⚠️ Missing Supabase Env Vars (VITE_SUPABASE_URL) for Realtime Hook. Falling back to WebSocket only.");
}

export const useRealtimeTrades = (initialTrades: any[] = []) => {
    const [trades, setTrades] = useState<any[]>(initialTrades);
    const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

    useEffect(() => {
        // Hydrate initial state (optional fetch, or rely on passed prop)
        if (initialTrades.length > 0) {
            setTrades(initialTrades);
        }

        console.log("🔌 [RealtimeDB] Connecting to signals_audit stream...");

        const channel = supabase
            .channel('realtime_trades_audit')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'signals_audit',
                    filter: "status=in.(ACTIVE,OPEN,PARTIAL_WIN)"
                },
                (payload) => {
                    console.log(`📡 [RealtimeDB] Trade Updated: ${payload.new.symbol}`, payload.new);
                    setTrades((current) => {
                        const index = current.findIndex(t => t.id === payload.new.id);
                        if (index > -1) {
                            const updated = [...current];
                            updated[index] = { ...updated[index], ...payload.new };
                            return updated;
                        } else {
                            // If it transitioned to active and we didn't have it
                            return [...current, payload.new];
                        }
                    });
                    setLastUpdate(Date.now());
                }
            )
            .subscribe((status) => {
                console.log(`🔌 [RealtimeDB] Subscription Status: ${status}`);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []); // Run once on mount

    // Fallback/Sync method to merge with WebSocket data if needed
    const syncWithSocketData = (socketTrades: any[]) => {
        setTrades(prev => {
            // Merge strategy: Trust DB Realtime for specific fields (SL/TP/PnL), trust Socket for ephemeral pricing?
            // Actually, DB Realtime is mostly for state changes. 
            // If socketTrades has newer Tick data, we might want to keep that.
            // Simplified: Use Socket list as base, override with Realtime updates if ID matches?
            // OR: Let Realtime list be the source of truth for ActiveTradesPanel.

            // For now, let's just return the socket trades IF we haven't received a DB update recently?
            // Better: Just use this hook as primary source if connected.
            return socketTrades;
        });
    };

    return { trades, lastUpdate };
};
