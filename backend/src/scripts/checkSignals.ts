import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function checkData() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error("Missing Supabase env vars");
        return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log("--- SIGNAL AUDIT SNAPSHOT ---");

    // Check OPEN signals
    const { data: open, error: errOpen } = await supabase
        .from('signals_audit')
        .select('*')
        .eq('status', 'OPEN');

    console.log(`OPEN SIGNALS: ${open?.length || 0}`);
    if (open && open.length > 0) {
        open.forEach(s => console.log(`- [${s.symbol}] ${s.side} | Entry: ${s.entry_price} | TP1: ${s.tp1}`));
    }

    // Check CLOSED signals
    const { data: closed, error: errClosed } = await supabase
        .from('signals_audit')
        .select('*')
        .neq('status', 'OPEN');

    console.log(`\nCLOSED SIGNALS (History): ${closed?.length || 0}`);
    if (closed && closed.length > 0) {
        closed.forEach(s => console.log(`- [${s.symbol}] ${s.status} | PnL: ${s.pnl_percent}%`));
    }

    if (errOpen || errClosed) {
        console.error("Errors:", errOpen, errClosed);
    }
}

checkData();
