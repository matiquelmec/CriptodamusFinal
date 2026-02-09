
import dns from 'dns';
import axios from 'axios';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);

async function diagnose() {
    console.log("🕵️ Diagnosis Started...");

    // 1. Check System Time
    console.log(`\n🕒 System Time: ${new Date().toISOString()}`);

    // 2. DNS Resolution
    try {
        console.log("\n🌍 DNS Resolution for api.binance.com:");
        const addresses = await resolve4('api.binance.com');
        console.log(`   -> Resolved IPs: ${addresses.join(', ')}`);

        if (addresses.some(ip => ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.'))) {
            console.error("   🚨 LOCAL/PRIVATE IP DETECTED! Interception confirmed.");
        } else {
            console.log("   ✅ Public IP detected (likely real Binance, unless transparent proxy).");
        }
    } catch (e: any) {
        console.error(`   ❌ DNS Failed: ${e.message}`);
    }

    // 3. Check Binance Server Time (The Source of Truth)
    try {
        console.log("\n🏦 Binance API Server Time:");
        const res = await axios.get('https://api.binance.com/api/v3/time');
        const binanceTime = new Date(res.data.serverTime).toISOString();
        console.log(`   -> Host: api.binance.com`);
        console.log(`   -> Server Time: ${binanceTime}`);
    } catch (e: any) {
        console.error(`   ❌ Binance Time Fetch Failed: ${e.message}`);
    }

    // 4. Check External World Time (Control)
    try {
        console.log("\n🌐 World Time API (Control):");
        const res = await axios.get('https://timeapi.io/api/Time/current/zone?timeZone=UTC');
        console.log(`   -> DateTime: ${res.data.dateTime}`);
    } catch (e: any) {
        console.error(`   ❌ World Time Fetch Failed: ${e.message}`);
    }

    // 5. Check Kraken Time (Alternative Source)
    try {
        console.log("\n🦑 Kraken API Time:");
        const res = await axios.get('https://api.kraken.com/0/public/Time');
        const krakenTime = new Date(res.data.result.unixtime * 1000).toISOString();
        console.log(`   -> Server Time: ${krakenTime}`);
    } catch (e: any) {
        console.error(`   ❌ Kraken Time Fetch Failed: ${e.message}`);
    }

    // 6. Check Google (Control)
    try {
        console.log("\n🔎 Google.com Date Header:");
        const res = await axios.head('https://www.google.com');
        const googleDate = new Date(res.headers['date']).toISOString();
        console.log(`   -> Date Header: ${googleDate}`);
    } catch (e: any) {
        console.error(`   ❌ Google Check Failed: ${e.message}`);
    }

    // 7. Check CoinGecko Price (Potential Bypass)
    try {
        console.log("\n🦎 CoinGecko BTC Price:");
        const res = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        console.log(`   -> BTC Price: $${res.data.bitcoin.usd}`);
    } catch (e: any) {
        console.error(`   ❌ CoinGecko Price Fetch Failed: ${e.message}`);
    }
}

diagnose();
