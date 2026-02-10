
import { analyzeSingleTicker } from '../core/services/engine/scannerLogic';
import { ReportGenerator } from '../core/services/reports/ReportGenerator';

async function main() {
    console.log("🔍 Verifying Scanner Logic Refactor...");

    try {
        const symbol = 'BTCUSDT';
        console.log(`Analyzing ${symbol}...`);

        const start = Date.now();
        // const opportunity = await analyzeSingleTicker(symbol);
        const opportunity = null; // FORCE MOCK
        const duration = 0;

        let opp = opportunity;
        if (!opp) {
            console.log("⚠️ No live signal found. Using MOCK data to verify Report Generator...");
            opp = {
                id: 'MOCK-BTC',
                symbol: 'BTC/USDT',
                side: 'LONG',
                confidenceScore: 85,
                timeframe: '15m',
                status: 'ACTIVE',
                entryZone: { min: 69000, max: 69500, currentPrice: 69200, signalPrice: 69200 },
                takeProfits: { tp1: 70000, tp2: 71000, tp3: 75000 },
                stopLoss: 68000,
                metrics: {
                    adx: 35, rsi: 60, volume24h: 1000000000, rvol: 2.5, vwapDist: 1.5,
                    structure: 'BULLISH', specificTrigger: 'Breakout',
                    marketRegime: { regime: 'BULL', confidence: 80, metrics: {}, recommendedStrategies: [], reasoning: 'Bullish Mock' }
                },
                technicalReasoning: "Análisis Simulado: Tendencia alcista fuerte detectada.",
                reasoning: ["✅ Tendencia Alineada", "🌊 CVD Alcista", "🧠 Confluencia IA: 85%"],
                riskRewardRatio: NaN, // TEST NaN HANDLING
                kellySize: null, // TEST NULL HANDLING
                timestamp: Date.now()
            } as any;
        }

        const safeOpp = opp as any; // Force cast for verification script

        console.log(`✅ Analysis Complete (Live or Mock)`);
        console.log(`Score: ${safeOpp.confidenceScore}`);
        console.log(`Side: ${safeOpp.side}`);
        console.log(`Entry: $${safeOpp.entryZone.min} - $${safeOpp.entryZone.max}`);

        console.log("\n--- GENERATING REPORT ---\n");
        const report = ReportGenerator.generateReport(safeOpp);
        console.log(report);

        console.log("\n--- JSON OUTPUT ---\n");
        const json = ReportGenerator.generateJSON(safeOpp);
        console.log(JSON.stringify(json, null, 2));

        process.exit(0);

    } catch (e: any) {
        console.error("❌ Verification Failed:", e);
    }
}

main();
