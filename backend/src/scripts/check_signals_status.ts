
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function diagnose() {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

    console.log("--- Supabase Audit Table Status ---");
    const { data: pendingSignals, error: pError } = await supabase
        .from('signals_audit')
        .select('*')
        .in('status', ['PENDING', 'OPEN']);

    if (pError) console.error("Error fetching pending:", pError);
    else console.log(`Found ${pendingSignals?.length || 0} PENDING/OPEN signals in DB.`);

    const { data: activeSignals, error: aError } = await supabase
        .from('signals_audit')
        .select('*')
        .in('status', ['ACTIVE', 'PARTIAL_WIN']);

    if (aError) console.error("Error fetching active:", aError);
    else console.log(`Found ${activeSignals?.length || 0} ACTIVE/PARTIAL_WIN signals in DB.`);

    if (pendingSignals && pendingSignals.length > 0) {
        console.log("\n--- Sample Pending Signals ---");
        pendingSignals.slice(0, 5).forEach(s => {
            console.log(`- ${s.symbol} (${s.side}): Created ${s.created_at} | Status: ${s.status}`);
        });
    }

    const { data: recent, error: rError } = await supabase
        .from('signals_audit')
        .select('symbol, status, pnl_percent, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    console.log("\n--- Last 10 Signals ---");
    recent?.forEach(s => console.log(`${s.created_at} | ${s.symbol} | ${s.status} | ${s.pnl_percent}%`));
}

diagnose();
