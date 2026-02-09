import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// ESM Polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar ENV
dotenv.config({ path: path.join(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BUCKET_NAME = 'models';

const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let model: tf.LayersModel | null = null;
const LOOKBACK = 50;

// Reutilizamos la lógica de Binance
import { SmartFetch } from '../core/services/SmartFetch';

// Reutilizamos la lógica de Binance (Proxied via SmartFetch)
async function fetchRecentCandles(symbol: string, interval: string = '15m', limit: number = 100) {
    // SmartFetch automatically handles BIFROST_URL proxying for binance.com
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

    try {
        const data = await SmartFetch.get<any[]>(url);

        // SmartFetch returns parsed JSON. We just validate structure.
        if (Array.isArray(data)) {
            return parseBinanceResponse(data);
        } else {
            // Fallback for weird responses (e.g. object with error)
            if ((data as any).code && (data as any).msg) throw new Error(`API Error: ${(data as any).msg}`);
            throw new Error("Invalid format from Binance");
        }
    } catch (error: any) {
        console.warn(`⚠️ [ML] Main Fetch failed: ${error.message}.`);

        // US Fallback (Manual, just in case Proxy fails)
        try {
            console.log(`⚠️ [ML] Trying US Fallback for ${symbol}...`);
            const urlUS = `https://api.binance.us/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            const dataUS = await SmartFetch.get<any[]>(urlUS); // SmartFetch handles US too (no proxy needed usually)
            return parseBinanceResponse(dataUS);
        } catch (e2) {
            throw new Error(`Data Fetch Failed (Main+US): ${error.message}`);
        }
    }
}

function parseBinanceResponse(data: any[]) {
    return data.map((c: any[]) => ({
        timestamp: c[0],
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[5])
    }));
}

async function downloadModelFromCloud(saveDir: string) {
    if (!supabase) {
        console.warn("⚠️ [ML] Sin credenciales Supabase. No se puede descargar modelo de la nube.");
        return false;
    }

    try {
        console.log("☁️ [ML] Buscando modelo actualizado en Supabase...");

        // 1. Download JSON
        const { data: jsonData, error: jsonErr } = await supabase.storage.from(BUCKET_NAME).download('model.json');
        if (jsonErr) throw jsonErr;

        // 2. Download Weights
        const { data: weightData, error: weightErr } = await supabase.storage.from(BUCKET_NAME).download('weights.bin');
        if (weightErr) throw weightErr;

        if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

        // Save to disk
        const jsonBuffer = await jsonData.arrayBuffer();
        const weightBuffer = await weightData.arrayBuffer();

        fs.writeFileSync(path.join(saveDir, 'model.json'), Buffer.from(jsonBuffer));
        fs.writeFileSync(path.join(saveDir, 'weights.bin'), Buffer.from(weightBuffer));

        console.log("✅ [ML] Modelo descargado y actualizado desde la Nube.");
        return true;

    } catch (e) {
        console.warn("⚠️ [ML] No se pudo descargar modelo de la nube (usando local si existe):", e);
        return false;
    }
}


export function reloadModel() {
    console.log("🧠 [ML] Recargando Cerebro en Caliente (Hot-Reload)...");
    if (model) {
        model.dispose(); // Limpiar memoria GPU/Tensors
        model = null; // Forzar recarga en próxima inferencia
    }
    console.log("✅ [ML] Modelo liberado de RAM. Listo para actualizar.");
}

export async function predictNextMove(symbol: string = 'BTCUSDT', existingCandles?: any[], persist: boolean = true) {
    try {
        if (!symbol.toUpperCase().endsWith('USDT')) symbol = `${symbol.toUpperCase()}USDT`;

        // ... (Model Loading Logic - same as before) ...
        if (!model) {
            console.log("🧠 Cargando el cerebro (Inferencia)...");
            const modelPath = path.join(__dirname, 'temp_model');
            const modelFile = path.join(modelPath, 'model.json');
            const weightsFile = path.join(modelPath, 'weights.bin');

            await downloadModelFromCloud(modelPath);

            if (!fs.existsSync(modelFile) || !fs.existsSync(weightsFile)) {
                console.error("❌ [ML] Model files missing even after cloud sync attempt.");
                return null;
            }

            const modelJson = JSON.parse(fs.readFileSync(modelFile, 'utf8'));
            const weightsBuffer = fs.readFileSync(weightsFile);
            const ioHandler: tf.io.IOHandler = {
                load: async () => ({
                    modelTopology: modelJson.modelTopology,
                    weightSpecs: modelJson.weightsManifest[0].weights,
                    weightData: weightsBuffer.buffer.slice(weightsBuffer.byteOffset, weightsBuffer.byteOffset + weightsBuffer.byteLength)
                })
            };

            model = await tf.loadLayersModel(ioHandler);
            const inputShape = model.inputs[0].shape;
            const featureCount = inputShape[2];
            console.log(`✅ Cerebro Listo (Input: ${featureCount} features detected).`);
        }

        if (!model) return null;

        // PIPELINE DE INFERENCIA
        const candles = existingCandles || await fetchRecentCandles(symbol);
        if (candles.length < LOOKBACK + 1) throw new Error("Not enough data");

        // Feature Engineering (Identical to train.ts)
        const returns: number[] = [];
        const ranges: number[] = [];
        const volumes: number[] = candles.map(c => c.volume);
        const period = 14;
        let avgGain = 0, avgLoss = 0;
        const rsiSeries: number[] = new Array(candles.length).fill(50);

        for (let i = 1; i <= period; i++) {
            const change = candles[i].close - candles[i - 1].close;
            if (change > 0) avgGain += change; else avgLoss += Math.abs(change);
        }
        avgGain /= period; avgLoss /= period;
        for (let i = period + 1; i < candles.length; i++) {
            const change = candles[i].close - candles[i - 1].close;
            const up = change > 0 ? change : 0;
            const down = change < 0 ? Math.abs(change) : 0;
            avgGain = ((avgGain * 13) + up) / 14;
            avgLoss = ((avgLoss * 13) + down) / 14;
            const rsi = 100 - (100 / (1 + (avgGain / avgLoss || 1)));
            rsiSeries[i] = rsi;
        }

        const rvolSeries: number[] = new Array(candles.length).fill(1);
        for (let i = 20; i < candles.length; i++) {
            let sum = 0;
            for (let k = 1; k <= 20; k++) sum += volumes[i - k];
            const avg = sum / 20;
            rvolSeries[i] = avg > 0 ? Math.min(5, volumes[i] / avg) : 1;
        }

        for (let i = 1; i < candles.length; i++) {
            returns.push((candles[i].close - candles[i - 1].close) / candles[i - 1].close);
            ranges.push((candles[i].high - candles[i].low) / candles[i].close);
        }

        const lastReturns = returns.slice(-LOOKBACK);
        const lastRanges = ranges.slice(-LOOKBACK);
        const lastRSI = rsiSeries.slice(-LOOKBACK);
        const lastRVOL = rvolSeries.slice(-LOOKBACK);

        const inputShape = model.inputs[0].shape;
        const features = inputShape[2] as number;
        const sequence: number[][] = [];
        for (let j = 0; j < LOOKBACK; j++) {
            if (features === 2) sequence.push([lastReturns[j], lastRanges[j]]);
            else sequence.push([lastReturns[j], lastRanges[j], lastRSI[j] / 100, lastRVOL[j]]);
        }

        const input = tf.tensor3d([sequence], [1, LOOKBACK, features]);
        const predictionTensor = model.predict(input) as tf.Tensor;
        const probabilityData = await predictionTensor.data();
        const probability = probabilityData[0];

        // 🛡️ PERSISTENCE CHECK (Saving to DB)
        const signal = probability > 0.55 ? 'BULLISH' : probability < 0.45 ? 'BEARISH' : 'NEUTRAL';

        // Only save if persist=true (Live Mode)
        if (persist) {
            await savePrediction(symbol, probability, signal, 'LIVE_INFERENCE', features === 4 ? 'v2_advanced' : 'v1_legacy');
        }

        input.dispose();
        predictionTensor.dispose();

        return {
            symbol,
            probabilityUp: probability,
            signal: signal as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
            confidence: Math.abs(probability - 0.5) * 2,
            timestamp: Date.now()
        };

    } catch (e: any) {
        console.error("❌ Error en AI Predictor:", e.message);
        return null;
    }
}

/**
 * PERSISTENCE: Save prediction to Supabase for audit
 */
export async function savePrediction(
    symbol: string,
    probability: number,
    signal: string = 'NEUTRAL',
    marketRegime: string = 'UNKNOWN',
    modelVersion: string = 'v1'
) {
    if (!supabase) return;

    try {
        const { error } = await supabase
            .from('model_predictions')
            .insert({
                symbol,
                probability,
                signal,
                market_regime: marketRegime,
                predicted_price: probability, // Still sync legacy column
                prediction_time: Date.now(),
                model_version: modelVersion
            });

        if (error) throw error;
    } catch (e) {
        console.error("⚠️ [ML] Failed to save prediction to DB:", e);
    }
}
