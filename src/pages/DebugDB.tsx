
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const DebugDB = () => {
    const [status, setStatus] = useState('Initializing...');
    const [data, setData] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

    useEffect(() => {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            setStatus('❌ Missing Env Vars (Checkout Vercel Settings)');
            return;
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        const fetchData = async () => {
            setStatus('⏳ Querying DB directly...');
            try {
                const { data: signals, error: dbError } = await supabase
                    .from('signals_audit')
                    .select('id, symbol, status, stop_loss, entry_price, final_price, updated_at')
                    .in('status', ['ACTIVE', 'OPEN', 'PARTIAL_WIN', 'WIN'])
                    .order('updated_at', { ascending: false })
                    .limit(5);

                if (dbError) {
                    throw dbError;
                }

                setData(signals || []);
                setStatus(`✅ Success! Found ${signals?.length || 0} active/recent signals.`);
            } catch (err: any) {
                console.error("DebugDB Error:", err);
                setError(err.message);
                setStatus('❌ Query Failed');
            }
        };

        fetchData();

        // Also setup Realtime listener to debug that channel
        const channel = supabase.channel('debug_direct')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'signals_audit' }, payload => {
                console.log("🔥 [DEBUG-REALTIME] Update received:", payload.new);
                alert(`🔥 REALTIME UPDATE: ${payload.new.symbol} -> SL: ${payload.new.stop_loss}`);
                fetchData(); // Refresh list on update
            })
            .subscribe((status) => {
                console.log("🔌 [DEBUG-REALTIME] Status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <div className="p-8 bg-black text-white font-mono min-h-screen">
            <h1 className="text-2xl font-bold mb-4">🕵️ DB Diagnostic Tool</h1>

            <div className="mb-6 p-4 border border-gray-700 rounded">
                <p><strong>Status:</strong> {status}</p>
                {error && <p className="text-red-500 mt-2"><strong>Error:</strong> {error}</p>}
                <p className="text-sm text-gray-400 mt-2">Env URL: {SUPABASE_URL ? '✅ Loaded' : '❌ Missing'}</p>
            </div>

            <h2 className="text-xl font-bold mb-2">Active Signals (Raw Data)</h2>
            <div className="grid gap-4">
                {data.map(signal => (
                    <div key={signal.id} className="p-4 bg-gray-900 border border-gray-800 rounded">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-lg font-bold text-yellow-500">{signal.symbol}</span>
                            <span className={`px-2 py-1 rounded text-xs ${signal.status === 'WIN' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'}`}>
                                {signal.status}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>entry: <span className="text-white">{signal.entry_price}</span></div>
                            <div>current_price: <span className="text-white">{signal.final_price}</span></div>
                            <div className="bg-red-900/30 p-1 rounded">STOP_LOSS: <span className="text-red-400 font-bold">{signal.stop_loss}</span></div>
                            <div className="text-gray-500 text-xs col-span-2 mt-1">Updated: {new Date(signal.updated_at).toLocaleString()}</div>
                        </div>
                    </div>
                ))}
            </div>

            {data.length === 0 && !error && (
                <p className="text-gray-500">No active signals found in DB.</p>
            )}
        </div>
    );
};

export default DebugDB;
