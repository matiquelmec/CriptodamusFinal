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
async function fetchRecentCandles(symbol: string, interval: string = '15m', limit: number = 100) {
    let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    try {
        const res = await fetch(url);
        if (res.status === 451) {
            url = `https://api.binance.us/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            const resUS = await fetch(url);
            if (!resUS.ok) throw new Error('Binance US Error');
            return parseBinanceResponse(await resUS.json());
        }
        if (!res.ok) throw new Error('Binance Error');
        return parseBinanceResponse(await res.json());
    } catch (error: any) {
        throw new Error(`Data Fetch Failed: ${error.message}`);
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
            console.log("✅ Cerebro Listo para Predicciones.");
        }

        if (!model) return null;

        // PIPELINE DE INFERENCIA
        const candles = existingCandles || await fetchRecentCandles(symbol);
        if (candles.length < LOOKBACK + 1) throw new Error("Not enough data");

        // Feature Engineering (Debe ser idéntico a train.ts)
        const returns: number[] = [];
        const ranges: number[] = [];

        for (let i = 1; i < candles.length; i++) {
            const r = (candles[i].close - candles[i - 1].close) / candles[i - 1].close;
            const rng = (candles[i].high - candles[i].low) / candles[i].close;
            returns.push(r);
            ranges.push(rng);
        }

        const lastReturns = returns.slice(-LOOKBACK);
        const lastRanges = ranges.slice(-LOOKBACK);

        const sequence: number[][] = [];
        for (let j = 0; j < LOOKBACK; j++) {
            sequence.push([lastReturns[j], lastRanges[j]]);
        }

        const input = tf.tensor3d([sequence], [1, LOOKBACK, 2]);
        const predictionTensor = model.predict(input) as tf.Tensor;
        const probabilityData = await predictionTensor.data();
        const probability = probabilityData[0];

        input.dispose();
        predictionTensor.dispose();

        return {
            symbol,
            probabilityUp: probability,
            signal: probability > 0.55 ? 'BULLISH' : probability < 0.45 ? 'BEARISH' : 'NEUTRAL', // Tightened threshold
            confidence: Math.abs(probability - 0.5) * 2,
            timestamp: Date.now()
        };

    } catch (e) {
        console.error("❌ Error en AI Predictor:", e);
        return null;
    }
}
