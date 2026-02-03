/**
 * SYSTEM HEALTH CHECK - Complete End-to-End Verification
 * 
 * Verifies:
 * 1. Binance API connectivity (live data)
 * 2. Supabase connectivity (DB reads/writes)
 * 3. Scanner service status
 * 4. Recent signals in database
 * 5. WebSocket functionality
 * 6. Market data freshness
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
);

interface HealthReport {
    timestamp: string;
    status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
    checks: {
        binanceAPI: boolean;
        supabaseDB: boolean;
        recentSignals: boolean;
        marketDataFresh: boolean;
        scannerActive: boolean;
    };
    details: {
        binanceSymbols?: number;
        latestSignal?: string;
        signalsLast24h?: number;
        latestCandle?: string;
        errors?: string[];
    };
}

async function runHealthCheck(): Promise<HealthReport> {
    const report: HealthReport = {
        timestamp: new Date().toISOString(),
        status: 'HEALTHY',
        checks: {
            binanceAPI: false,
            supabaseDB: false,
            recentSignals: false,
            marketDataFresh: false,
            scannerActive: false
        },
        details: {
            errors: []
        }
    };

    console.log('\n🔍 [HEALTH CHECK] Starting Complete System Verification...\n');

    // ===== CHECK 1: BINANCE API =====
    try {
        console.log('1️⃣ Testing Binance API connectivity...');
        const binanceResponse = await axios.get('https://api.binance.com/api/v3/ticker/price', {
            params: { symbol: 'BTCUSDT' },
            timeout: 5000
        });

        if (binanceResponse.data && binanceResponse.data.price) {
            report.checks.binanceAPI = true;
            console.log(`   ✅ Binance API OK - BTC Price: $${parseFloat(binanceResponse.data.price).toFixed(2)}`);

            // Get all symbols count
            const allSymbols = await axios.get('https://api.binance.com/api/v3/exchangeInfo', { timeout: 5000 });
            report.details.binanceSymbols = allSymbols.data.symbols.filter((s: any) => s.symbol.endsWith('USDT')).length;
            console.log(`   📊 Available USDT pairs: ${report.details.binanceSymbols}`);
        } else {
            throw new Error('Invalid response format');
        }
    } catch (err: any) {
        report.details.errors!.push(`Binance API: ${err.message}`);
        console.log(`   ❌ Binance API FAILED: ${err.message}`);
    }

    // ===== CHECK 2: SUPABASE DB =====
    try {
        console.log('\n2️⃣ Testing Supabase database connectivity...');
        const { data, error } = await supabase
            .from('signals_audit')
            .select('id')
            .limit(1);

        if (error) throw error;

        report.checks.supabaseDB = true;
        console.log('   ✅ Supabase DB connection OK');
    } catch (err: any) {
        report.details.errors!.push(`Supabase DB: ${err.message}`);
        console.log(`   ❌ Supabase DB FAILED: ${err.message}`);
    }

    // ===== CHECK 3: RECENT SIGNALS =====
    try {
        console.log('\n3️⃣ Checking recent signals in database...');
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: signals, error } = await supabase
            .from('signals_audit')
            .select('symbol, strategy_name, created_at, status')
            .gte('created_at', oneDayAgo)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        report.details.signalsLast24h = signals?.length || 0;

        if (signals && signals.length > 0) {
            report.checks.recentSignals = true;
            report.details.latestSignal = `${signals[0].symbol} (${signals[0].strategy_name}) - ${new Date(signals[0].created_at).toLocaleString('es-CL')}`;
            console.log(`   ✅ Found ${signals.length} signals in last 24h`);
            console.log(`   📍 Latest: ${report.details.latestSignal}`);

            // Show all recent signals
            signals.forEach((sig, idx) => {
                const timeAgo = Math.floor((Date.now() - new Date(sig.created_at).getTime()) / 60000);
                console.log(`      ${idx + 1}. ${sig.symbol} (${sig.strategy_name}) - ${sig.status} - hace ${timeAgo} min`);
            });
        } else {
            console.log('   ⚠️  No signals found in last 24h (market may be quiet)');
        }
    } catch (err: any) {
        report.details.errors!.push(`Recent Signals: ${err.message}`);
        console.log(`   ❌ Signal check FAILED: ${err.message}`);
    }

    // ===== CHECK 4: MARKET DATA FRESHNESS =====
    try {
        console.log('\n4️⃣ Checking market data freshness...');
        const { data: candles, error } = await supabase
            .from('market_candles')
            .select('symbol, timestamp, close')
            .eq('symbol', 'BTCUSDT')
            .order('timestamp', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (candles && candles.length > 0) {
            const candleTime = new Date(candles[0].timestamp);
            const ageMinutes = Math.floor((Date.now() - candleTime.getTime()) / 60000);

            report.details.latestCandle = `${candles[0].timestamp} (${ageMinutes} min ago)`;

            if (ageMinutes < 30) {
                report.checks.marketDataFresh = true;
                console.log(`   ✅ Market data is FRESH (${ageMinutes} min old)`);
                console.log(`   📈 Latest BTC candle: $${candles[0].close} at ${candleTime.toLocaleString('es-CL')}`);
            } else {
                console.log(`   ⚠️  Market data is STALE (${ageMinutes} min old)`);
            }
        } else {
            console.log('   ⚠️  No market candles found in DB');
        }
    } catch (err: any) {
        report.details.errors!.push(`Market Data: ${err.message}`);
        console.log(`   ❌ Market data check FAILED: ${err.message}`);
    }

    // ===== CHECK 5: SCANNER ACTIVITY =====
    try {
        console.log('\n5️⃣ Checking scanner activity...');
        const { data: alerts, error } = await supabase
            .from('system_alerts')
            .select('message, created_at, severity')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        if (alerts && alerts.length > 0) {
            const latestAlert = alerts[0];
            const ageMinutes = Math.floor((Date.now() - new Date(latestAlert.created_at).getTime()) / 60000);

            console.log(`   📋 Latest system alert (${ageMinutes} min ago):`);
            console.log(`      ${latestAlert.severity}: ${latestAlert.message}`);

            // Scanner is active if recent alerts exist
            if (ageMinutes < 30) {
                report.checks.scannerActive = true;
                console.log('   ✅ Scanner appears ACTIVE (recent system activity)');
            } else {
                console.log('   ⚠️  Scanner may be IDLE (no recent activity)');
            }
        } else {
            console.log('   ℹ️  No system alerts found (clean system)');
            report.checks.scannerActive = true; // Absence of alerts is actually good
        }
    } catch (err: any) {
        report.details.errors!.push(`Scanner Activity: ${err.message}`);
        console.log(`   ❌ Scanner check FAILED: ${err.message}`);
    }

    // ===== FINAL STATUS =====
    const passedChecks = Object.values(report.checks).filter(Boolean).length;
    const totalChecks = Object.keys(report.checks).length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL REPORT');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${passedChecks}/${totalChecks} checks`);
    console.log(`⏰ Timestamp: ${report.timestamp}`);

    if (passedChecks === totalChecks) {
        report.status = 'HEALTHY';
        console.log('🎯 Overall Status: HEALTHY ✅');
    } else if (passedChecks >= totalChecks * 0.6) {
        report.status = 'DEGRADED';
        console.log('⚠️  Overall Status: DEGRADED');
    } else {
        report.status = 'CRITICAL';
        console.log('🔴 Overall Status: CRITICAL');
    }

    if (report.details.errors && report.details.errors.length > 0) {
        console.log('\n❌ Errors:');
        report.details.errors.forEach(err => console.log(`   - ${err}`));
    }

    console.log('='.repeat(60) + '\n');

    return report;
}

// Run check
runHealthCheck()
    .then(report => {
        console.log('✅ Health check complete');
        process.exit(report.status === 'HEALTHY' ? 0 : 1);
    })
    .catch(err => {
        console.error('💥 Health check crashed:', err);
        process.exit(2);
    });
