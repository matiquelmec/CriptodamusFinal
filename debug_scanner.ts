
import { scanMarketOpportunities } from '../backend/src/core/services/engine/scannerLogic';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '../backend/.env' });

async function debugScanner() {
    console.log("🚀 Starting Scanner Debug...");
    try {
        const results = await scanMarketOpportunities('SCALP_AGRESSIVE');
        fs.writeFileSync('scanner_debug_results.json', JSON.stringify(results, null, 2));
        console.log(`✅ Done. Found ${results.length} signals.`);
    } catch (e: any) {
        console.error("❌ Error:", e.message);
    }
}

debugScanner();
