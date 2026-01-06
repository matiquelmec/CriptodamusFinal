
import dotenv from 'dotenv';
import path from 'path';

// Load Env
dotenv.config();

import { scannerService } from './services/scanner';
import { fetchGlobalMarketData } from './services/globalMarketService';
import { fetchCryptoSentiment } from './services/newsService';
import { estimateLiquidationClusters } from './services/engine/liquidationEngine';

async function testFullSystem() {
    console.log("🚀 STARTING FINAL SYSTEM AUDIT (LIVE DATA)...");
    console.log("---------------------------------------------------");

    // 1. Test Global Macro (Dormant Engine 1)
    try {
        console.log("📡 Testing Global Market Service...");
        const globalData = await fetchGlobalMarketData();
        console.log(`✅ Global Data: BTC.D ${globalData.btcDominance}% | Gold $${globalData.goldPrice} | DXY ${globalData.dxyIndex.toFixed(2)}`);
    } catch (e) { console.error("❌ Global Market Service Failed", e); }

    // 2. Test Sentiment (News Agent) - REAL DATA (Fear & Greed Fallback)
    try {
        console.log("📡 Testing Crypto Sentiment (Gemini/F&G)...");
        const sentiment = await fetchCryptoSentiment('BTC');
        console.log(`✅ Sentiment: ${sentiment.score} (${sentiment.sentiment}) - "${sentiment.summary}"`);
    } catch (e) { console.error("❌ Sentiment Service Failed", e); }

    // 3. Test Full Dual-Core Scan
    console.log("---------------------------------------------------");
    console.log("📡 Triggering DUAL-CORE Scan (4H + 15m)...");

    // Listen for events to confirm flow
    scannerService.on('scan_complete', (ops) => {
        console.log("---------------------------------------------------");
        console.log(`🎉 SCAN COMPLETE. Found ${ops.length} Opportunities.`);

        if (ops.length > 0) {
            const sample = ops[0];
            console.log(`🔍 Sample Result (${sample.symbol}):`);
            console.log(`   - Strategy: ${sample.strategy}`);
            console.log(`   - Score: ${sample.confidenceScore}/100`);
            console.log(`   - Timeframe: ${sample.timeframe}`);
            console.log(`   - Reasoning:`);
            sample.reasoning?.forEach(r => console.log(`     • ${r}`));

            // Check for new features in reasoning
            const hasSentiment = sample.reasoning?.some(r => r.includes('Sentiment'));
            const hasLiq = sample.reasoning?.some(r => r.includes('Liq Magnet'));
            const hasML = sample.reasoning?.some(r => r.includes('IA Confluence') || r.includes('IA Divergence'));

            console.log("---------------------------------------------------");
            console.log("✅ Verification Checklist:");
            console.log(`   [${hasML ? 'OK' : 'WAIT'}] ML Integration`);
            console.log(`   [${hasSentiment ? 'OK' : 'WAIT'}] Sentiment Integration`);
            console.log(`   [${hasLiq ? 'OK' : 'WAIT'}] Liquidation Engine Integration`);
        } else {
            console.log("ℹ️ No opportunities found (Market might be quiet). Check logs for internal execution.");
        }
        process.exit(0);
    });

    await scannerService.runFullScan();
}

testFullSystem();
