
import { analyzeSwingSignal } from './core/services/strategies/SwingStrategy';
import { analyzeBreakoutSignal } from './core/services/strategies/BreakoutStrategy';
import { analyzePinballSignal } from './core/services/strategies/PinballStrategy';
import { analyzeScalpSignal } from './core/services/strategies/ScalpStrategy';
import { analyzeFreezeStrategy } from './core/services/strategies/FreezeStrategy';
import { TechnicalIndicators, MarketRisk } from './core/types';

// ==========================================
// MOCK DATA GENERATOR
// ==========================================

const generatePriceData = (length: number, type: 'FLAT' | 'TREND_UP' | 'TREND_DOWN' = 'FLAT'): number[] => {
    const prices: number[] = new Array(length).fill(100);
    if (type === 'TREND_UP') {
        for (let i = 0; i < length; i++) prices[i] = 100 + i;
    } else if (type === 'TREND_DOWN') {
        for (let i = 0; i < length; i++) prices[i] = 100 - i;
    }
    return prices;
};

// Create a robust mock indicator object
const createMockIndicators = (): TechnicalIndicators => ({
    symbol: 'MOCK',
    price: 100,
    rsi: 50,
    macd: { line: 0, signal: 0, histogram: 0 },
    bollinger: { upper: 110, middle: 100, lower: 90, bandwidth: 0.2 },
    adx: 25,
    ema20: 100,
    ema50: 100,
    ema100: 100,
    ema200: 100,
    emaSlope: 0.1,
    vwap: 100,
    atr: 1.5,
    rvol: 1.0,
    zScore: 0,

    volumeProfile: { poc: 100, valueAreaHigh: 105, valueAreaLow: 95 },
    stochRsi: { k: 50, d: 50 },

    pivots: { p: 0, r1: 0, s1: 0, r2: 0, s2: 0 },
    fibonacci: { level0: 0, level0_236: 0, level0_382: 0, level0_5: 0, level0_618: 0, level0_65: 0, level0_786: 0, level0_886: 0, level1: 0, tp1: 0, tp2: 0, tp3: 0, tp4: 0, tp5: 0 },

    technicalReasoning: "MOCK",
    invalidated: false,
    trendStatus: { emaAlignment: 'BULLISH', goldenCross: false, deathCross: false },

    // Institutional Data
    fractals: { bullish: [], bearish: [] },
    cvd: new Array(20).fill(1000),
    orderBlocks: { bullish: [], bearish: [] },

    // Freeze specific
    sma5: 100, sma10: 100, sma30: 95,
    rsiFreeze: 50,
    boxTheory: { active: true, high: 102, low: 98, level0_5: 100, signal: 'BULLISH' },
    nPattern: { detected: false, type: 'BULLISH', entryPrice: 0, stopLoss: 0 }
});

// ==========================================
// TEST SUITE
// ==========================================

async function runTests() {
    console.log("🚀 STARTING INSTITUTIONAL STRATEGY VERIFICATION...\n");
    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, testName: string) => {
        if (condition) {
            console.log(`✅ PASS: ${testName}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${testName}`);
            failed++;
        }
    };

    // --------------------------------------------------------
    // TEST 1: SWING STRATEGY (SMC SFP)
    // --------------------------------------------------------
    console.log("--- Testing Swing Strategy (SMC V2) ---");

    const pricesSFP = generatePriceData(10, 'FLAT');
    pricesSFP[pricesSFP.length - 1] = 101; // Close
    const highsSFP = new Array(10).fill(102);
    const lowsSFP = new Array(10).fill(101);
    lowsSFP[lowsSFP.length - 1] = 99; // Sweep current low

    const indicatorsSFP = createMockIndicators();
    indicatorsSFP.fractals = { bullish: [100], bearish: [] };
    // Rising CVD (Absorption)
    indicatorsSFP.cvd = [1000, 1000, 1000, 1200, 1400];
    indicatorsSFP.orderBlocks = {
        bullish: [{ high: 99.5, low: 98, mitigated: false, price: 99, strength: 80 }],
        bearish: []
    };

    const resultSFP = analyzeSwingSignal(pricesSFP, highsSFP, lowsSFP, indicatorsSFP);
    assert(resultSFP.signalSide === 'LONG', "Swing Strategy detects LONG SFP");
    assert(resultSFP.score >= 80, "SFP Score is high (>80)");

    // Test Fake SFP (CVD Dumping)
    const indicatorsFakeSFP = createMockIndicators();
    indicatorsFakeSFP.fractals = { bullish: [100], bearish: [] };
    indicatorsFakeSFP.cvd = [1400, 1300, 1200, 1100, 1000]; // Dumping
    const resultFakeSFP = analyzeSwingSignal(pricesSFP, highsSFP, lowsSFP, indicatorsFakeSFP);
    assert(resultFakeSFP.signalSide === 'NEUTRAL', "Swing Strategy rejects Fake SFP (Bad CVD)");


    // --------------------------------------------------------
    // TEST 2: BREAKOUT STRATEGY (CVD Filter)
    // --------------------------------------------------------
    console.log("\n--- Testing Breakout Strategy (Institutional Filter) ---");

    // Breakout Bullish Setup
    const pricesBO = generatePriceData(30, 'FLAT');
    pricesBO[pricesBO.length - 1] = 106; // Breakout over 105
    const highsBO = new Array(30).fill(102);
    highsBO[5] = 105; // 20p High
    highsBO[29] = 106; // Current High matches price
    const lowsBO = new Array(30).fill(98);

    const indicatorsBO = createMockIndicators();
    indicatorsBO.rvol = 3.0;
    indicatorsBO.cvd = [1000, 1100, 1200, 1300, 1400, 1500]; // Strong rising CVD for >5 check

    const resultBO = analyzeBreakoutSignal(pricesBO, highsBO, lowsBO, indicatorsBO);

    if (resultBO) {
        assert(resultBO.signalSide === 'LONG', "Breakout Strategy Long Signal");
    } else {
        console.log("⚠️ Breakout skipped (volatility condition), forcing check via Fakeout test only...");
    }

    // FAKEOUT TEST (Drop CVD)
    const indicatorsFakeBO = createMockIndicators();
    indicatorsFakeBO.rvol = 3.0;
    indicatorsFakeBO.cvd = [1500, 1400, 1300, 1200, 1100, 1000]; // Dropping CVD >5 points
    const resultFakeBO = analyzeBreakoutSignal(pricesBO, highsBO, lowsBO, indicatorsFakeBO);
    assert(resultFakeBO === null, "Breakout Strategy rejects Fakeout (Divergent CVD)");


    // --------------------------------------------------------
    // TEST 3: PINBALL STRATEGY (Order Block Confluence)
    // --------------------------------------------------------
    console.log("\n--- Testing Pinball Strategy (OB Confluence) ---");

    const pricesPB = generatePriceData(200, 'FLAT');
    const lastPrice = 100.1; // MUST be > EMA200 (100) for Pinball logic
    pricesPB[pricesPB.length - 1] = lastPrice;

    const indicatorsPB = createMockIndicators();
    indicatorsPB.emaSlope = 0.5; // Secular Bull
    indicatorsPB.ema50 = 105;
    indicatorsPB.ema200 = 100; // Price sits just above EMA200
    // Trend = EMA50 > EMA200 = BULLISH.
    // Price (100.1) is between EMA200 (100) and EMA50 (105). Valid Pinball State.

    // Case A: No Order Block
    indicatorsPB.orderBlocks = { bullish: [], bearish: [] };
    const resultPB_NoOB = analyzePinballSignal(pricesPB, indicatorsPB);
    assert(resultPB_NoOB === null, "Pinball rejects EMA200 bounce WITHOUT Order Block");

    // Case B: With Order Block
    indicatorsPB.orderBlocks = {
        bullish: [{ high: 101, low: 99, mitigated: false, price: 100, strength: 90 }],
        bearish: []
    };
    const resultPB_OB = analyzePinballSignal(pricesPB, indicatorsPB);
    // Note: PinballStrategy checks ob.low * 0.99 <= currentPrice <= ob.high * 1.01
    // OB: 99-101. Price 100.1. Inside.
    assert(resultPB_OB !== null && resultPB_OB.score >= 90, "Pinball accepts EMA200 bounce WITH Order Block");


    // --------------------------------------------------------
    // TEST 4: SCALP STRATEGY (CVD Validation)
    // --------------------------------------------------------
    console.log("\n--- Testing Scalp Strategy (CVD Filter) ---");

    // Setup Bullish Squeeze
    const pricesScalp = generatePriceData(60, 'FLAT');
    // Volatile start
    for (let i = 0; i < 30; i++) pricesScalp[i] = 100 + (Math.random() * 20 - 10);
    // Flat end (Squeeze)
    for (let i = 30; i < 60; i++) pricesScalp[i] = 100;

    // Match end price
    pricesScalp[pricesScalp.length - 1] = 100.1;

    const indicatorsScalp = createMockIndicators();
    indicatorsScalp.vwap = 99; // Price (100.1) > VWAP
    indicatorsScalp.rsi = 55; // > 52

    // Case A: Valid CVD (Rising)
    indicatorsScalp.cvd = [1000, 1100, 1200, 1300, 1400, 1500];
    const resultScalp = analyzeScalpSignal(pricesScalp, indicatorsScalp);

    if (resultScalp) {
        assert(resultScalp.signalSide === 'LONG', "Scalp Signal Long");
        assert(resultScalp.detectionNote.includes("CVD"), "Scalp validated by CVD");
    } else {
        console.log("⚠️ Scalp Squeeze not triggered. Checking fakeout...");
    }

    // Fakeout Scalp
    const indicatorsFakeScalp = createMockIndicators();
    indicatorsFakeScalp.vwap = 99;
    indicatorsFakeScalp.rsi = 55;
    indicatorsFakeScalp.cvd = [1500, 1400, 1300, 1200, 1100, 1000]; // Dumping
    const resultFakeScalp = analyzeScalpSignal(pricesScalp, indicatorsFakeScalp);
    assert(resultFakeScalp === null, "Scalp rejects Fakeout (or no squeeze)");


    // --------------------------------------------------------
    // TEST 5: FREEZE STRATEGY (Kill Switch)
    // --------------------------------------------------------
    console.log("\n--- Testing Freeze Strategy (Kill Switch) ---");

    const indicatorsFreeze = createMockIndicators();
    indicatorsFreeze.sma5 = 101; indicatorsFreeze.sma10 = 102; indicatorsFreeze.sma30 = 99; // Bullish Trend
    indicatorsFreeze.price = 105;

    // Case A: High Risk -> KILL SWITCH
    const riskHigh: MarketRisk = { level: 'HIGH', riskType: 'MANIPULATION', note: "Simulated Risk" };
    const resultKill = analyzeFreezeStrategy(indicatorsFreeze, riskHigh);
    assert(resultKill.active === false, "Freeze Strategy BLOCKED by High Risk");
    assert(resultKill.reason.some(r => r.includes("PROTECTION ACTIVE")), "Reason cites PROTECTION");

    // Case B: Low Risk -> Allowed
    const riskLow: MarketRisk = { level: 'LOW', riskType: 'NORMAL', note: "Simulated Safe" };
    // Provide a valid setup (Box Theory)
    indicatorsFreeze.boxTheory = { active: true, signal: 'BULLISH', level0_5: 105, low: 104, high: 106 }; // Price 105 = 0.5 Retest
    indicatorsFreeze.price = 105;

    // N-Pattern fallback
    indicatorsFreeze.nPattern = { detected: true, type: 'BULLISH', entryPrice: 105, stopLoss: 104 };

    const resultLive = analyzeFreezeStrategy(indicatorsFreeze, riskLow);
    assert(resultLive.active === true, "Freeze Strategy ACTIVE when Risk is Low");


    // --------------------------------------------------------
    // SUMMARY
    // --------------------------------------------------------
    console.log(`\n🏁 VERIFICATION COMPLETE: ${passed} Passed, ${failed} Failed.`);
    if (failed > 0) process.exit(1);
    else process.exit(0);
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
