
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

async function diagnose() {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
    const { data } = await supabase.from('signals_audit').select('id, symbol, status, created_at, closed_at, pnl_percent, side').order('created_at', { ascending: false }).limit(10);

    if (!data) return;

    data.forEach(s => {
        const dur = s.closed_at ? ((s.closed_at - s.created_at) / 60000).toFixed(0) + 'm' : 'OPEN';
        console.log(`${s.symbol} | ${s.status} | PnL: ${s.pnl_percent}% | Dur: ${dur}`);
    });
}
diagnose();
