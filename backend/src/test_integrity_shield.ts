/**
 * DATA INTEGRITY SHIELD TEST SUITE
 * 
 * This script simulates various data integrity failures to verify that:
 * 1. The DataIntegrityGuard detects the issues correctly
 * 2. Alerts are logged to the database
 * 3. The scanner status is updated appropriately
 * 4. The UI receives real-time notifications
 */

import { DataIntegrityGuard } from '../core/services/engine/pipeline/DataIntegrityGuard';
import { systemAlerts } from '../services/systemAlertService';

async function testIntegrityScenarios() {
    console.log('\n🔬 ===== DATA INTEGRITY SHIELD TEST SUITE =====\n');

    // Test 1: OPTIMAL - All systems nominal
    console.log('📊 Test 1: OPTIMAL Scenario');
    const optimalReport = await DataIntegrityGuard.getSystemIntegrityReport({
        isPreFlight: true,
        globalData: {
            goldPrice: 2650,
            dxyIndex: 104.5,
            btcDominance: 58.2,
            isDataValid: true
        },
        newsSentiment: {
            summary: 'Markets showing moderate bullish sentiment',
            headlineCount: 15,
            score: 0.3
        },
        economicShield: { reason: 'OK' }
    });
    console.log('Result:', optimalReport);
    console.log('✅ Expected: OPTIMAL\n');

    // Test 2: DEGRADED - Stale Gold Data
    console.log('📊 Test 2: DEGRADED Scenario (Stale Gold Data)');
    const degradedReport = await DataIntegrityGuard.getSystemIntegrityReport({
        isPreFlight: true,
        globalData: {
            goldPrice: 2000, // Default fallback value = stale
            dxyIndex: 104.5,
            btcDominance: 55, // Hardcoded default
            isDataValid: true
        },
        newsSentiment: {
            summary: 'Markets showing moderate bullish sentiment',
            headlineCount: 15,
            score: 0.3
        },
        economicShield: { reason: 'OK' }
    });
    console.log('Result:', degradedReport);
    console.log('⚠️  Expected: DEGRADED or DOUBTFUL\n');

    // Test 3: DEGRADED - Economic Calendar Unreachable
    console.log('📊 Test 3: DEGRADED Scenario (Economic Calendar Down)');
    const economicDownReport = await DataIntegrityGuard.getSystemIntegrityReport({
        isPreFlight: true,
        globalData: {
            goldPrice: 2650,
            dxyIndex: 104.5,
            btcDominance: 58.2,
            isDataValid: true
        },
        newsSentiment: {
            summary: 'Market data unavailable.',
            headlineCount: 0,
            score: 0
        },
        economicShield: { reason: 'Calendar Unreachable' }
    });
    console.log('Result:', economicDownReport);
    console.log('⚠️  Expected: DEGRADED\n');

    // Test 4: HALTED - Missing Critical Data
    console.log('📊 Test 4: HALTED Scenario (Insufficient Candles)');
    const haltedReport = await DataIntegrityGuard.getSystemIntegrityReport({
        isPreFlight: false, // Per-coin check
        candles: new Array(50).fill({ timestamp: Date.now(), close: 100 }), // Only 50 candles (< 200 required)
        globalData: {
            goldPrice: 2650,
            dxyIndex: 104.5,
            btcDominance: 58.2,
            isDataValid: true
        },
        newsSentiment: {
            summary: 'Markets showing moderate bullish sentiment',
            headlineCount: 15,
            score: 0.3
        },
        economicShield: { reason: 'OK' }
    });
    console.log('Result:', haltedReport);
    console.log('🚨 Expected: HALTED\n');

    // Test 5: HALTED - Global Connectivity Failure
    console.log('📊 Test 5: HALTED Scenario (Global Connectivity Dead)');
    const connectivityHaltedReport = await DataIntegrityGuard.getSystemIntegrityReport({
        isPreFlight: true,
        globalData: {
            goldPrice: 0,
            dxyIndex: 0,
            btcDominance: 0,
            isDataValid: false
        },
        newsSentiment: {
            summary: 'Market data unavailable.',
            headlineCount: 0,
            score: 0
        },
        economicShield: { reason: 'Calendar Unreachable' }
    });
    console.log('Result:', connectivityHaltedReport);
    console.log('🚨 Expected: HALTED or DEGRADED\n');

    console.log('✅ ===== TEST SUITE COMPLETE =====\n');
    console.log('💡 Review the output above to verify detection logic.');
    console.log('💡 Check Supabase system_alerts table for logged entries.');
    console.log('💡 Verify UI shows warnings in System Logs page.\n');
}

// Execute tests
testIntegrityScenarios()
    .then(() => {
        console.log('🎯 All tests executed successfully.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Test suite failed:', err);
        process.exit(1);
    });
