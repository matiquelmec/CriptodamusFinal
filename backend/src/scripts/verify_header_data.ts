
import { getMacroContext } from '../core/services/macroService';
import { fetchGlobalMarketData } from '../services/globalMarketService';

async function verifyHeaderData() {
    console.log("🔍 Verifying Header Data logic...");

    try {
        // 1. Check Macro Context (used for Regime/Vol)
        console.log("\n--- MacroContext (Source: macroService.ts) ---");
        const macro = await getMacroContext();
        console.log(`Regime: ${macro.btcRegime.regime}`);
        console.log(`Volatility Status: ${macro.btcRegime.volatilityStatus}`);
        console.log(`ATR: ${macro.btcRegime.atr.toFixed(2)}`);
        console.log(`Price: ${macro.btcRegime.currentPrice.toFixed(2)}`);
        const atrPercent = (macro.btcRegime.atr / macro.btcRegime.currentPrice) * 100;
        console.log(`Calculated ATR%: ${atrPercent.toFixed(2)}% (Threshold for HIGH > 4.5%)`);

        console.log(`BTC.D (Macro): ${macro.btcDominance.current}%`);
        console.log(`USDT.D (Macro): ${macro.usdtDominance.current}%`);

        // 2. Check Global Market Data (Source: globalMarketService.ts)
        console.log("\n--- GlobalMarketData (Source: globalMarketService.ts) ---");
        const global = await fetchGlobalMarketData();
        console.log(`BTC.D (Global): ${global.btcDominance}%`);
        console.log(`USDT.D (Global): ${global.usdtDominance}%`);
        console.log(`Data Valid: ${global.isDataValid}`);

        console.log("\n--- Diagnosis ---");
        if (atrPercent > 4.5) {
            console.log("✅ VOL: HIGH is CORRECT based on current logic (ATR% > 4.5%)");
        } else {
            console.log("❓ VOL: HIGH mismatch? Calculated ATR% is lower than threshold.");
        }

        if (Math.abs(global.btcDominance - macro.btcDominance.current) > 1) {
            console.log("⚠️ DOMINANCE MISMATCH: MacroService uses different source (or static fallback) than GlobalMarketService.");
        }

    } catch (error) {
        console.error("❌ Verification Failed:", error);
    }
}

verifyHeaderData();
