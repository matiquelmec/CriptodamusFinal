
import { getExpertVolumeAnalysis } from './services/volumeExpertService.ts';

async function verify() {
    console.log("=== Verifying Expert Volume Analysis (Free API) ===");

    // Test BTC
    console.log("\n1. Testing BTC (Major Asset)...");
    const btcData = await getExpertVolumeAnalysis('BTC/USDT');

    console.log("DERIVATIVES:");
    console.log(`- Open Interest: ${btcData.derivatives.openInterest.toFixed(2)} BTC ($${(btcData.derivatives.openInterestValue / 1000000).toFixed(2)}M)`);
    console.log(`- Funding Rate: ${btcData.derivatives.fundingRate.toFixed(4)}%`);

    console.log("COINBASE PREMIUM:");
    console.log(`- Signal: ${btcData.coinbasePremium.signal}`);
    console.log(`- Gap: ${btcData.coinbasePremium.gapPercent.toFixed(4)}% ($${btcData.coinbasePremium.index.toFixed(2)})`);

    console.log("SYNTHETIC CVD:");
    console.log(`- Trend: ${btcData.cvd.trend}`);
    console.log(`- Current Delta: ${btcData.cvd.current.toFixed(2)}`);

    // Test Altcoin (Solana)
    console.log("\n2. Testing SOL (Altcoin)...");
    const solData = await getExpertVolumeAnalysis('SOL/USDT');
    console.log(`- Open Interest: ${solData.derivatives.openInterest.toFixed(0)} SOL`);
    console.log(`- Funding Rate: ${solData.derivatives.fundingRate.toFixed(4)}%`);
    console.log(`- Premium Gap: ${solData.coinbasePremium.gapPercent.toFixed(4)}%`);

    console.log("\nVerification Complete.");
}

verify().catch(console.error);
