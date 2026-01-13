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

export async function predictNextMove(symbol: string = 'BTCUSDT', existingCandles?: any[]) {
    try {
        if (!symbol.toUpperCase().endsWith('USDT')) symbol = `${symbol.toUpperCase()}USDT`;

        if (!model) {
            console.log("🧠 Cargando el cerebro (Inferencia)...");

            // PATHS
            const modelPath = path.join(__dirname, 'temp_model'); // Usamos misma carpeta que train
            const modelFile = path.join(modelPath, 'model.json');
            const weightsFile = path.join(modelPath, 'weights.bin');

            // INTENTO DE DESCARGA CLOUD (Sincronización al inicio)
            // Solo descargamos si no existe o forzamos? 
            // Por simplicidad, intentamos descargar si no está en memoria.
            await downloadModelFromCloud(modelPath);

            if (!fs.existsSync(modelFile) || !fs.existsSync(weightsFile)) {
                console.error("❌ [ML] Model files missing even after cloud sync attempt.");
                return null;
            }

            // CARGA MANUAL (Bypass tfjs-node file:// weirdness)
            const modelJson = JSON.parse(fs.readFileSync(modelFile, 'utf8'));
            const weightsBuffer = fs.readFileSync(weightsFile);

            const ioHandler: tf.io.IOHandler = {
                load: async () => {
                    return {
                        modelTopology: modelJson.modelTopology,
                        weightSpecs: modelJson.weightsManifest[0].weights,
                        weightData: weightsBuffer.buffer.slice(weightsBuffer.byteOffset, weightsBuffer.byteOffset + weightsBuffer.byteLength)
                    };
                }
            };

            model = await tf.loadLayersModel(ioHandler);

            // Validate Transformation Shape (Adaptive)
            const inputShape = model.inputs[0].shape; // e.g. [null, 50, 4]
            const featureCount = inputShape[2];

            console.log(`✅ Cerebro Listo (Input: ${featureCount} features detected).`);


        }

        if (!model) return null;

        // PIPELINE DE INFERENCIA
        const candles = existingCandles || await fetchRecentCandles(symbol);
        if (candles.length < LOOKBACK + 1) throw new Error("Not enough data");

        // Feature Engineering (Debe ser idéntico a train.ts)
        const returns: number[] = [];
        const ranges: number[] = [];
        const volumes: number[] = candles.map(c => c.volume);

        // --- RSI CALC ---
        const period = 14;
        let avgGain = 0, avgLoss = 0;
        const rsiSeries: number[] = new Array(candles.length).fill(50);

        for (let i = 1; i <= period; i++) {
            const change = candles[i].close - candles[i - 1].close;
            if (change > 0) avgGain += change;
            else avgLoss += Math.abs(change);
        }
        avgGain /= period; avgLoss /= period;

        for (let i = period + 1; i < candles.length; i++) {
            const change = candles[i].close - candles[i - 1].close;
            const up = change > 0 ? change : 0;
            const down = change < 0 ? Math.abs(change) : 0;
            avgGain = ((avgGain * 13) + up) / 14;
            avgLoss = ((avgLoss * 13) + down) / 14;
            const rsi = 100 - (100 / (1 + (avgGain / avgLoss || 1))); // Safety div by 0
            rsiSeries[i] = rsi;
        }

        // --- RVOL CALC ---
        const rvolSeries: number[] = new Array(candles.length).fill(1);
        for (let i = 20; i < candles.length; i++) {
            let sum = 0;
            for (let k = 1; k <= 20; k++) sum += volumes[i - k];
            const avg = sum / 20;
            rvolSeries[i] = avg > 0 ? Math.min(5, volumes[i] / avg) : 1;
        }

        for (let i = 1; i < candles.length; i++) {
            const r = (candles[i].close - candles[i - 1].close) / candles[i - 1].close;
            const rng = (candles[i].high - candles[i].low) / candles[i].close;
            returns.push(r);
            ranges.push(rng);
        }

        // Align arrays (Slice last LOOKBACK)
        // returns/ranges are index 0 based (from candle 1).
        // rsi/rvol are index 0 based (from candle 0).
        // Need to be careful with alignment.
        // Let's just slice the END of every array.

        // Align arrays (Slice last LOOKBACK)
        const lastReturns = returns.slice(-LOOKBACK);
        const lastRanges = ranges.slice(-LOOKBACK);
        const lastRSI = rsiSeries.slice(-LOOKBACK);
        const lastRVOL = rvolSeries.slice(-LOOKBACK);

        // --- ADAPTIVE INPUT LAYER (Auto-Detect Brain Version) ---
        const inputShape = model.inputs[0].shape;
        // tfjs input shape is (null, 50, 4) -> index 2 is features. It can be null in types but practically is number here.
        const requiredFeatures = inputShape[2] as number; // 2 (Old Brain) or 4 (New Brain)

        const sequence: number[][] = [];
        for (let j = 0; j < LOOKBACK; j++) {
            if (requiredFeatures === 2) {
                // Legacy Mode (Old Model)
                sequence.push([
                    lastReturns[j],
                    lastRanges[j]
                ]);
            } else {
                // Advanced Mode (New Model)
                sequence.push([
                    lastReturns[j],
                    lastRanges[j],
                    lastRSI[j] / 100, // Normalize RSI
                    lastRVOL[j]
                ]);
            }
        }

        const input = tf.tensor3d([sequence], [1, LOOKBACK, requiredFeatures]);
        const predictionTensor = model.predict(input) as tf.Tensor;
        const probabilityData = await predictionTensor.data();
        const probability = probabilityData[0];

        console.log(`🧠 Brain Prediction (${requiredFeatures} feats): ${probability.toFixed(4)}`);

        input.dispose();
        predictionTensor.dispose();

        return {
            symbol,
            probabilityUp: probability,
            signal: probability > 0.55 ? 'BULLISH' : probability < 0.45 ? 'BEARISH' : 'NEUTRAL',
            confidence: Math.abs(probability - 0.5) * 2,
            timestamp: Date.now()
        };

    } catch (e) {
        console.error("❌ Error en AI Predictor:", e);
        return null;
    }
}
