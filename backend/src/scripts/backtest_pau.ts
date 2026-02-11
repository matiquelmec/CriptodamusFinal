
import { analyzePauPerdicesStrategy } from '../core/services/strategies/PauPerdicesStrategy';
import { calculateEMA, calculateRSI, calculateATR, calculateAutoFibs, calculateMACD, calculateADX } from '../core/services/mathUtils';
import axios from 'axios';

// Polyfill minimal checks
const symbol = 'SOL/USDT';

async function runBacktest() {
    console.log(`🧪 Testing Enhanced Pau Perdices Strategy on ${symbol}...`);

    try {
        // Fetch 200 candles (15m)
        const resp = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${symbol.replace('/', '')}&interval=15m&limit=200`);
        const data = resp.data;

        const highs = data.map(d => parseFloat(d[2]));
        const lows = data.map(d => parseFloat(d[3]));
        const closes = data.map(d => parseFloat(d[4]));
        const volumes = data.map(d => parseFloat(d[5]));

        // Calculate Indicators
        const ema200 = calculateEMA(closes, 200);
        const rsi = calculateRSI(closes, 14);
        const atr = calculateATR(highs, lows, closes, 14);
        const fibs = calculateAutoFibs(highs, lows, ema200);
        const macd = calculateMACD(closes);
        const adx = calculateADX(highs, lows, closes, 14);

        const currentPrice = closes[closes.length - 1];

        const indicators = {
            ema200,
            rsi,
            atr,
            fibonacci: fibs,
            macd,
            adx // Not used inside strategy interface yet, but calculated for verify
        };

        // Context (H4) - Mocked or Fetched? Let's fetch H4 for realism
        const respH4 = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${symbol.replace('/', '')}&interval=4h&limit=50`);
        const candlesH4 = respH4.data.map(d => ({ close: parseFloat(d[4]) }));

        // Run Strategy
        const result = analyzePauPerdicesStrategy(
            symbol,
            currentPrice,
            closes,
            highs,
            lows,
            volumes,
            indicators as any,
            candlesH4,
            1000,
            1.0
        );

        console.log("\n📊 MARKET CONDITIONS:");
        console.log(`   - Price: ${currentPrice}`);
        console.log(`   - ADX: ${adx.toFixed(2)} (${adx < 25 ? 'CHOPPY ⚠️' : 'TRENDING ✅'})`);
        console.log(`   - ATR%: ${((atr / currentPrice) * 100).toFixed(3)}%`);
        console.log(`   - EMA200 Distance: ${((currentPrice - ema200) / ema200 * 100).toFixed(2)}%`);

        console.log("\n🤖 STRATEGY OUTPUT:");
        console.log(`   - Signal: ${result.signal}`);
        console.log(`   - Score: ${result.score}`);
        console.log(`   - Reason: ${result.reason.join(' | ')}`);

        if (result.signal === 'NEUTRAL') {
            // Extract failure details from neutral result reason if encoded
            console.log(`   - Failure Details: ${result.reason[0]}`);
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

runBacktest();
