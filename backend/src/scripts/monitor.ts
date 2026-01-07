import { fetchCryptoData } from '../core/services/api/binanceApi';
import { TradingConfig } from '../core/config/tradingConfig';

/**
 * Criptodamus Operations Monitor
 * Run this script to verify system integrity, data flow, and active security rules.
 */
async function runSystemMonitor() {
    console.log(`\n🔍 CRIPTODAMUS SYSTEM MONITOR v1.0`);
    console.log(`========================================`);
    console.log(`Timestamp: ${new Date().toISOString()}`);

    let allSystemsGo = true;

    // 1. CONFIGURATION AUDIT
    console.log(`\n🛡️ SECURITY PROTOCOLS (The Gatekeeper)`);
    const minVol = TradingConfig.scoring.filters.min_volume_24h;
    const minScore = TradingConfig.scoring.min_score_entry;
    const minAdx = TradingConfig.scoring.filters.min_adx;

    if (minVol >= 5000000) console.log(`   ✅ Liquidity Filter: STRONG (>$${(minVol / 1000000).toFixed(0)}M)`);
    else { console.log(`   ❌ Liquidity Filter: WEAK (Current: $${minVol})`); allSystemsGo = false; }

    if (minScore >= 75) console.log(`   ✅ Quality Standard: INSTITUTIONAL (Score > ${minScore})`);
    else { console.log(`   ❌ Quality Standard: RETAIL (Current: ${minScore})`); allSystemsGo = false; }

    if (minAdx >= 20) console.log(`   ✅ Trend Requirement: ACTIVE (ADX > ${minAdx})`);
    else { console.log(`   ❌ Trend Requirement: NONE (Current: ${minAdx})`); allSystemsGo = false; }

    // 2. DATA FEED CHECK
    console.log(`\n📡 MARKET DATA FEED (Binance/CoinCap)`);
    try {
        const start = Date.now();
        const market = await fetchCryptoData('volume');
        const latency = Date.now() - start;

        console.log(`   ✅ Connection: ESTABLISHED (${latency}ms)`);
        console.log(`   ✅ Assets Tracked: ${market.length}`);

        // 3. INTEGRITY CHECK (Spot Check BTC)
        const btc = market.find((c: any) => c.symbol === 'BTC/USDT');
        if (btc) {
            const price = btc.price || 0;
            const volume = btc.rawVolume || 0;

            console.log(`   ✅ Heartbeat (BTC): $${price.toFixed(2)}`);

            if (volume > 0 && !isNaN(volume)) {
                console.log(`   ✅ Volume Feed: VALID ($${(volume / 1000000000).toFixed(2)}B)`);
            } else {
                console.log(`   ❌ Volume Feed: CORRUPT (Val: ${volume})`);
                allSystemsGo = false;
            }
        } else {
            console.log(`   ❌ CRITICAL: BTC/USDT Not Found in Feed`);
            allSystemsGo = false;
        }

    } catch (e: any) {
        console.log(`   ❌ Connection: FAILED ("${e.message}")`);
        allSystemsGo = false;
    }

    // CONCLUSION
    console.log(`\n========================================`);
    if (allSystemsGo) {
        console.log(`🚀 SYSTEM STATUS: 100% OPERATIONAL`);
        console.log(`   The system is secure, connected, and filtering strictly.`);
    } else {
        console.log(`⚠️ SYSTEM STATUS: ATTENTION REQUIRED`);
        console.log(`   Some checks failed. See logs above.`);
    }
    console.log(`========================================\n`);
}

runSystemMonitor();
