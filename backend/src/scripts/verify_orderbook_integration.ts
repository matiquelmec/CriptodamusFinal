/**
 * VERIFICATION SCRIPT: OrderBook Advanced Analysis Integration Test
 * 
 * Purpose: Verify that the institutional OrderBook analysis is correctly
 * integrated into the scanner pipeline and produces expected results.
 */

import { OrderBookAnalyzer } from '../core/services/engine/pipeline/OrderBookAnalyzer';
import { enrichWithDepthAndLiqs } from '../core/services/volumeExpertService';
import { fetchOrderBook } from '../core/services/api/binanceApi';

async function verifyOrderBookIntegration() {
    console.log('🔍 VERIFICATION: OrderBook Institucional Integration\n');
    console.log('='.repeat(60));

    // Test Symbol
    const testSymbol = 'BTCUSDT';
    const currentPrice = 95000; // Mock price

    console.log(`\n📊 Testing Symbol: ${testSymbol}`);
    console.log(`💰 Mock Price: $${currentPrice.toLocaleString()}\n`);

    // STEP 1: Verify fetchOrderBook returns sufficient depth
    console.log('STEP 1: Fetching OrderBook from API...');
    const orderBook = await fetchOrderBook(testSymbol);

    if (!orderBook) {
        console.error('❌ FAIL: fetchOrderBook returned null');
        return false;
    }

    console.log(`✅ OrderBook fetched successfully`);
    console.log(`   - Bids: ${orderBook.bids.length} levels`);
    console.log(`   - Asks: ${orderBook.asks.length} levels`);

    if (orderBook.bids.length < 20 || orderBook.asks.length < 20) {
        console.warn(`⚠️  WARNING: Insufficient depth (need 20+ levels for advanced analysis)`);
        console.warn(`   - Got: ${orderBook.bids.length} bids, ${orderBook.asks.length} asks`);
    }

    // STEP 2: Verify OrderBookAnalyzer can process the data
    console.log('\nSTEP 2: Testing OrderBookAnalyzer...');

    const fullBids = orderBook.bids.slice(0, 20).map((b: any) => ({
        price: parseFloat(b[0]),
        qty: parseFloat(b[1]),
        total: parseFloat(b[0]) * parseFloat(b[1])
    }));

    const fullAsks = orderBook.asks.slice(0, 20).map((a: any) => ({
        price: parseFloat(a[0]),
        qty: parseFloat(a[1]),
        total: parseFloat(a[0]) * parseFloat(a[1])
    }));

    const mockWallHistory: any[] = []; // Empty for first test
    const mockSpreadHistory: number[] = [];
    const mockPriceHistory = [{ price: currentPrice, time: Date.now(), volume: 1000 }];

    try {
        const advancedAnalysis = OrderBookAnalyzer.analyzeOrderBook(
            fullBids,
            fullAsks,
            mockWallHistory,
            mockSpreadHistory,
            mockPriceHistory,
            currentPrice,
            1000 // recentVolume
        );

        console.log('✅ OrderBookAnalyzer executed successfully\n');
        console.log('📈 Analysis Results:');
        console.log(`   - Fake Wall Risk: ${advancedAnalysis.fakeWallRisk}`);
        console.log(`   - Wall Stability: ${advancedAnalysis.wallStability}`);
        console.log(`   - Absorption Score: ${advancedAnalysis.absorptionScore}/100`);
        console.log(`   - Was Absorbed: ${advancedAnalysis.wasAbsorbed}`);
        console.log(`   - Depth Imbalance:`);
        console.log(`     • Surface: ${advancedAnalysis.depthImbalance.surface.toFixed(2)}x`);
        console.log(`     • Deep: ${advancedAnalysis.depthImbalance.deep.toFixed(2)}x`);
        console.log(`     • Divergence: ${advancedAnalysis.depthImbalance.divergence}`);
        console.log(`   - Spread Analysis:`);
        console.log(`     • Current: ${advancedAnalysis.spreadAnalysis.currentSpread.toFixed(4)}%`);
        console.log(`     • Is Panic: ${advancedAnalysis.spreadAnalysis.isPanic}`);
        console.log(`     • Is Tight: ${advancedAnalysis.spreadAnalysis.isTight}`);
        console.log(`   - Iceberg Zones: ${advancedAnalysis.icebergZones.length} detected`);
        console.log(`   - Overall Confidence: ${advancedAnalysis.confidence}/100`);

        // STEP 3: Verify integration with volumeExpertService
        console.log('\nSTEP 3: Testing enrichWithDepthAndLiqs integration...');

        const mockVolumeAnalysis: any = {
            derivatives: {},
            cvd: {},
            coinbasePremium: {},
            liquidity: {
                bidAskSpread: 0,
                marketDepthScore: 50
            }
        };

        const mockHighs = Array(50).fill(currentPrice * 1.01);
        const mockLows = Array(50).fill(currentPrice * 0.99);

        const enrichedAnalysis = await enrichWithDepthAndLiqs(
            testSymbol,
            mockVolumeAnalysis,
            mockHighs,
            mockLows,
            currentPrice
        );

        if (enrichedAnalysis.liquidity.orderBook?.advanced) {
            console.log('✅ Advanced analysis attached successfully');
            console.log(`   - Type: ${typeof enrichedAnalysis.liquidity.orderBook.advanced}`);
            console.log(`   - Has fakeWallRisk: ${!!enrichedAnalysis.liquidity.orderBook.advanced.fakeWallRisk}`);
            console.log(`   - Has depthImbalance: ${!!enrichedAnalysis.liquidity.orderBook.advanced.depthImbalance}`);
        } else {
            console.warn('⚠️  WARNING: Advanced analysis NOT attached');
            console.warn('   Possible reasons:');
            console.warn('   - Insufficient depth (<20 levels)');
            console.warn('   - Error in OrderBookAnalyzer');
            console.warn('   - Supabase connection issue');
        }

        // FINAL VERDICT
        console.log('\n' + '='.repeat(60));
        console.log('🎯 FINAL VERDICT:');

        const checks = {
            'OrderBook API returns data': !!orderBook,
            'Sufficient depth (20+ levels)': orderBook.bids.length >= 20,
            'OrderBookAnalyzer executes': !!advancedAnalysis,
            'Analysis has all 5 features': !!(
                advancedAnalysis.fakeWallRisk &&
                advancedAnalysis.depthImbalance &&
                advancedAnalysis.spreadAnalysis &&
                typeof advancedAnalysis.absorptionScore === 'number' &&
                Array.isArray(advancedAnalysis.icebergZones)
            ),
            'Integration with volumeExpertService': !!enrichedAnalysis.liquidity.orderBook?.advanced
        };

        const passedChecks = Object.values(checks).filter(v => v).length;
        const totalChecks = Object.keys(checks).length;

        console.log(`\nChecks Passed: ${passedChecks}/${totalChecks}\n`);

        Object.entries(checks).forEach(([check, passed]) => {
            console.log(`${passed ? '✅' : '❌'} ${check}`);
        });

        if (passedChecks === totalChecks) {
            console.log('\n🎉 ALL SYSTEMS GO! Integration is PERFECT!\n');
            return true;
        } else {
            console.log(`\n⚠️  ${totalChecks - passedChecks} issue(s) found. Review needed.\n`);
            return false;
        }

    } catch (error: any) {
        console.error('\n❌ CRITICAL ERROR during verification:');
        console.error(error);
        return false;
    }
}

// Run verification
verifyOrderBookIntegration()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
