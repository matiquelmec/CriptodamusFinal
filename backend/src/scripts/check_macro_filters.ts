
import { getMacroContext } from '../core/services/macroService';
import { TradingConfig } from '../core/config/tradingConfig';
import dotenv from 'dotenv';
dotenv.config();

async function checkMacro() {
    try {
        const macro = await getMacroContext();
        console.log("--- Market Environment Audit ---");
        console.log(`BTC Price: $${macro.btcRegime.currentPrice.toFixed(2)}`);
        console.log(`BTC EMA200: $${macro.btcRegime.ema200.toFixed(2)}`);
        console.log(`Daily Regime: ${macro.btcRegime.regime}`);
        console.log(`ADX: ${macro.adx.toFixed(2)}`);

        console.log("\n--- Active Filters ---");
        console.log(`Min Score Entry: ${TradingConfig.scoring.min_score_entry}`);
        console.log(`Min RVOL: ${TradingConfig.scoring.filters.min_rvol}`);
        console.log(`Min Volume 24h: $${(TradingConfig.scoring.filters.min_volume_24h / 1000000).toFixed(1)}M`);
    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

checkMacro();
