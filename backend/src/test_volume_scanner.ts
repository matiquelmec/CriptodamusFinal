
import { getExpertVolumeAnalysis } from './services/volumeExpert';

async function testVolumeExpert() {
    console.log("🔍 Testing Volume Expert Service...");
    const symbol = 'BTCUSDT';

    try {
        const start = Date.now();
        const analysis = await getExpertVolumeAnalysis(symbol);
        const duration = (Date.now() - start) / 1000;

        console.log(`✅ Analysis Complete in ${duration}s`);
        console.log("---------------------------------------------------");
        console.log(`📊 Derivatives Data:`);
        console.log(`   - Open Interest: $${(analysis.derivatives.openInterestValue / 1_000_000).toFixed(2)}M`);
        console.log(`   - Funding Rate: ${(analysis.derivatives.fundingRate * 100).toFixed(4)}%`);
        console.log("---------------------------------------------------");
        console.log(`🏦 Coinbase Premium:`);
        console.log(`   - Gap: ${analysis.coinbasePremium.gapPercent.toFixed(4)}%`);
        console.log(`   - Signal: ${analysis.coinbasePremium.signal}`);
        console.log("---------------------------------------------------");
        console.log(`🌊 CVD (Synthetic):`);
        console.log(`   - Trend: ${analysis.cvd.trend}`);
        console.log(`   - Delta: ${analysis.cvd.current.toFixed(2)}`);
        console.log("---------------------------------------------------");
        console.log(`💧 Liquidity Score: ${analysis.liquidity.marketDepthScore}/100`);

    } catch (error) {
        console.error("❌ Test Failed:", error);
    }
}

testVolumeExpert();
