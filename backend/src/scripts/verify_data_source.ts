
import { fetchCryptoData } from '../core/services/api/binanceApi';
import dotenv from 'dotenv';
import path from 'path';

// Load Environment Variables
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const verifyData = async () => {
    console.log("🕵️ Verifying Data Source Integriy...");
    console.log("-------------------------------------");

    try {
        const start = Date.now();
        console.log(`[System Clock] ${new Date().toISOString()} (Timestamp: ${start})`);

        // Fetch Data
        console.log("📡 Fetching Live Market Data from System Pipeline...");
        const data = await fetchCryptoData('volume');

        const btc = data.find(d => d.symbol === 'BTC/USDT');
        const eth = data.find(d => d.symbol === 'ETH/USDT');

        console.log("-------------------------------------");
        if (btc) {
            console.log(`✅ BTC/USDT Price: $${btc.price.toFixed(2)}`);
            console.log(`✅ BTC 24h Change: ${btc.change24h.toFixed(2)}%`);
        } else {
            console.error("❌ BTC Data NOT FOUND");
        }

        if (eth) {
            console.log(`✅ ETH/USDT Price: $${eth.price.toFixed(2)}`);
        }

        console.log("-------------------------------------");
        console.log("Analysis:");
        console.log("1. If prices match Google/Binance/CMC -> Data is REAL.");
        console.log("2. If prices are ~$60k or weird -> Data is SIMULATED/STALE.");

    } catch (error) {
        console.error("❌ Data Fetch Failed:", error);
    }
    process.exit(0);
};

verifyData();
