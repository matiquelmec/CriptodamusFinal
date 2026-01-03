import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { VirtualPortfolio } from './virtualPortfolio';
import { predictNextMove } from '../ml/inference';
import { IndicatorCalculator } from '../core/services/engine/pipeline/IndicatorCalculator';
import * as tf from '@tensorflow/tfjs';
// import '@tensorflow/tfjs-node'; // Acceleration disabled for local Windows compatibility

dotenv.config({ path: path.join(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

const SYMBOL = 'BTCUSDT';
const TIMEFRAME = '15m';

interface BacktestConfig {
    initialCapital: number;
    startFromIndex?: number; // Skip early history
    limit?: number; // How many candles to process (e.g. 1000 for quick test)
}

export class BacktestEngine {
    private portfolio: VirtualPortfolio;
    private config: BacktestConfig;

    constructor(config: BacktestConfig) {
        this.portfolio = new VirtualPortfolio(config.initialCapital);
        this.config = config;
    }

    async run() {
        console.log(`⏳ Downloading Market History for ${SYMBOL}...`);

        let allData: any[] = [];
        let from = 0;
        const PAGE = 1000;
        const MAX = this.config.limit ? this.config.limit + 200 : 75000;

        while (allData.length < MAX) {
            const { data, error } = await supabase
                .from('market_candles')
                .select('*')
                .eq('symbol', SYMBOL)
                .eq('timeframe', TIMEFRAME)
                .order('timestamp', { ascending: true }) // Oldest first
                .range(from, from + PAGE - 1);

            if (!data || data.length === 0) break;
            allData = allData.concat(data);
            from += PAGE;
        }

        console.log(`\n📚 History Loaded: ${allData.length} candles.`);
        console.log(`🚀 Starting Simulation... (Hybrid God Mode: ML + Technicals)`);

        const LOOKBACK = 200;
        const START_IDX = this.config.startFromIndex || LOOKBACK;

        for (let i = START_IDX; i < allData.length - 1; i++) {
            const currentCandle = allData[i];
            const nextCandle = allData[i + 1];

            // Check Stops
            const pos = this.portfolio.positions.get(SYMBOL);
            if (pos) {
                let exit = null;
                if (pos.side === 'LONG') {
                    if (pos.stopLoss && nextCandle.low <= pos.stopLoss) {
                        exit = this.portfolio.closePosition(SYMBOL, pos.stopLoss, 'SL', nextCandle.timestamp);
                    }
                } else {
                    if (pos.stopLoss && nextCandle.high >= pos.stopLoss) {
                        exit = this.portfolio.closePosition(SYMBOL, pos.stopLoss, 'SL', nextCandle.timestamp);
                    }
                }
                if (exit) continue;
            }

            // Window
            const windowStart = Math.max(0, i - 999);
            const contextCandles = allData.slice(windowStart, i + 1);

            // Techs
            const indicators = IndicatorCalculator.compute(SYMBOL, contextCandles);

            // ML
            let mlScore = 0;
            let mlSignal = 'NEUTRAL';
            try {
                // Removed ADX guard
                const prediction = await predictNextMove(SYMBOL, contextCandles);
                if (prediction) {
                    mlSignal = prediction.signal;
                    mlScore = prediction.confidence;
                }
            } catch (e) { }

            // HYBRID STRATEGY
            const price = currentCandle.close;
            const ema200 = indicators.ema200;

            if (!pos) {
                const confidentML = mlScore > 0.01;
                const trendBullish = price > ema200;
                const trendBearish = price < ema200;
                const oversold = indicators.rsi < 35;
                const overbought = indicators.rsi > 65;

                // 1. ML Entries
                if (mlSignal === 'BULLISH' && confidentML && trendBullish) {
                    const sl = price * 0.98;
                    this.portfolio.openPosition(SYMBOL, 'LONG', nextCandle.open, this.portfolio.balance * 0.1, sl);
                    console.log(`[TRADE] LONG (ML) at ${nextCandle.open} (Confidence: ${mlScore.toFixed(2)})`);
                }
                else if (mlSignal === 'BEARISH' && confidentML && trendBearish) {
                    const sl = price * 1.02;
                    this.portfolio.openPosition(SYMBOL, 'SHORT', nextCandle.open, this.portfolio.balance * 0.1, sl);
                    console.log(`[TRADE] SHORT (ML) at ${nextCandle.open} (Confidence: ${mlScore.toFixed(2)})`);
                }
                // 2. Technical Fallback
                else if (trendBullish && oversold) {
                    const sl = price * 0.98;
                    this.portfolio.openPosition(SYMBOL, 'LONG', nextCandle.open, this.portfolio.balance * 0.05, sl);
                    console.log(`[TRADE] LONG (Tech) at ${nextCandle.open} (RSI: ${indicators.rsi.toFixed(2)})`);
                }
                else if (trendBearish && overbought) {
                    const sl = price * 1.02;
                    this.portfolio.openPosition(SYMBOL, 'SHORT', nextCandle.open, this.portfolio.balance * 0.05, sl);
                    console.log(`[TRADE] SHORT (Tech) at ${nextCandle.open} (RSI: ${indicators.rsi.toFixed(2)})`);
                }

                // Debug
                if (i % 50 === 0) console.log(`[DEBUG] Price:${price} EMA:${ema200?.toFixed(2)} ML:${mlSignal}(${mlScore.toFixed(2)}) RSI:${indicators.rsi?.toFixed(2)}`);

            } else {
                // Exit Logic
                if (pos.side === 'LONG' && mlSignal === 'BEARISH' && mlScore > 0.8) {
                    this.portfolio.closePosition(SYMBOL, nextCandle.open, 'ML_FLIP', nextCandle.timestamp);
                }
                else if (pos.side === 'SHORT' && mlSignal === 'BULLISH' && mlScore > 0.8) {
                    this.portfolio.closePosition(SYMBOL, nextCandle.open, 'ML_FLIP', nextCandle.timestamp);
                }
            }

            if (i % 100 === 0) process.stdout.write('.');
        }

        console.log("\n🏁 Simulation Complete.");

        // Report
        const stats = this.portfolio.getStats();
        console.log("\n📊 --- BACKTEST RESULTS (God Mode) ---");
        console.log(`Initial Capital: $${this.config.initialCapital}`);
        console.log(`Final Balance:   $${stats.finalBalance.toFixed(2)}`);
        console.log(`ROI:             ${stats.roi.toFixed(2)}%`);
        console.log(`Total Trades:    ${stats.totalTrades}`);
        console.log(`Win Rate:        ${stats.winRate.toFixed(2)}%`);
        console.log(`Profit Factor:   ${stats.profitFactor.toFixed(2)}`);
        console.log(`Max Drawdown:    ${stats.maxDrawdown.toFixed(2)}%`);

        return stats;
    }
}

// Auto-run (Simplified for direct execution)
const engine = new BacktestEngine({ initialCapital: 10000, limit: 1000 }); // Quick Test Default
engine.run();
