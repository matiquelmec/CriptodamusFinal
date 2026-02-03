import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
);

async function quickHealthCheck() {
    console.log('\n🔍 QUICK SYSTEM HEALTH CHECK\n');

    // 1. Binance
    try {
        const res = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', { timeout: 5000 });
        console.log(`✅ Binance API: BTC = $${parseFloat(res.data.price).toFixed(2)}`);
    } catch (e: any) {
        console.log(`❌ Binance API: ${e.message}`);
    }

    // 2. Database signals
    try {
        const { data, error } = await supabase
            .from('signals_audit')
            .select('symbol, created_at, strategy_name')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        console.log(`\n✅ Database: ${data?.length || 0} signals in last 24h`);
        if (data && data.length > 0) {
            data.forEach((s, i) => {
                const ago = Math.floor((Date.now() - new Date(s.created_at).getTime()) / 60000);
                console.log(`   ${i + 1}. ${s.symbol} (${s.strategy_name}) - hace ${ago} min`);
            });
        } else {
            console.log('   ⚠️  No signals (market quiet or scanner issue)');
        }
    } catch (e: any) {
        console.log(`❌ Database: ${e.message}`);
    }

    // 3. Latest candle
    try {
        const { data, error } = await supabase
            .from('market_candles')
            .select('timestamp, close')
            .eq('symbol', 'BTCUSDT')
            .order('timestamp', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
            const age = Math.floor((Date.now() - new Date(data[0].timestamp).getTime()) / 60000);
            console.log(`\n✅ Market Data: Latest candle ${age} min old ($${data[0].close})`);
        } else {
            console.log('\n⚠️  No market candles in DB');
        }
    } catch (e: any) {
        console.log(`\n❌ Market Data: ${e.message}`);
    }

    console.log('\n✅ Health check complete\n');
}

quickHealthCheck().catch(console.error);
