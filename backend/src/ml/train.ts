import * as tf from '@tensorflow/tfjs';
// import '@tensorflow/tfjs-node-gpu'; // GPU Failed: Missing CUDA Drivers
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { createModel } from './model.js';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ESM Polyfill for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno (Asegurar que carga desde root o backend)
dotenv.config({ path: path.join(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ ERROR: Credenciales de Supabase no encontradas.');
    // No matamos el proceso, solo logueamos, para que el servidor siga corriendo
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
const BUCKET_NAME = 'models'; // Asegúrense de crear este bucket en Supabase

// --- CONFIGURACIÓN DE ENTRENAMIENTO ---
const SYMBOL = 'BTCUSDT';
const TIMEFRAME = '15m';
const LOOKBACK = 50;
const TEST_SIZE = 0.1;
const EPOCHS = 50;
const BATCH_SIZE = 1024; // CPU Optimization: Larger batches = Less overhead

async function fetchTrainingData() {
    console.log("📡 Descargando datos de la Corteza Cerebral (Supabase)...");

    // UNLIMITED DATA MODE
    const PAGE_SIZE = 1000;
    const MAX_ROWS = 75000; // Full Institutional Depth (As User Requested)

    // 1. Get Total Count
    const { count, error: countError } = await supabase
        .from('market_candles')
        .select('*', { count: 'exact', head: true })
        .eq('symbol', SYMBOL)
        .eq('timeframe', TIMEFRAME);

    if (countError) throw new Error(`Count Error: ${countError.message}`);
    const totalRows = count || 0;

    console.log(`🌊 Detectadas ${totalRows} velas totales. Iniciando Descarga Paralela de Alto Rendimiento...`);

    // 2. Parallel Fetching (Batches of 10 concurrent requests)
    const promises = [];
    const concurrency = 10;

    // We want the LATEST data, so we order by timestamp desc.
    // Supabase ranges are 0-indexed. 
    // If we want ALL data, we just chunk from 0 to totalRows.

    for (let i = 0; i < totalRows; i += PAGE_SIZE) {
        promises.push(
            supabase
                .from('market_candles')
                .select('close, volume, high, low')
                .eq('symbol', SYMBOL)
                .eq('timeframe', TIMEFRAME)
                .order('timestamp', { ascending: false }) // Latest first
                .range(i, i + PAGE_SIZE - 1)
        );
    }

    // Execute in chunks to avoid blowing up the connection pool too hard (optional, but Promise.all is usually fine for <100 requests)
    // For extreme datasets, mapLimit is better, but Promise.all is fine here.
    const results = await Promise.all(promises);

    let allData: any[] = [];
    results.forEach(r => {
        if (r.data) allData = allData.concat(r.data);
        if (r.error) console.error("Chunk Error:", r.error.message);
    });

    // Sort Chronologically (Oldest -> Newest) since we fetched Descending
    // The chunks themselves are descending.
    // Chunk 0: Today .. T-1000
    // Chunk 1: T-1001 .. T-2000
    // Concat results in: [Today..T-1000, T-1001..T-2000]
    // We need to reverse the HUGE array.
    allData = allData.reverse();

    console.log(`\n✅ Descarga Completa: ${allData.length} velas (100% Histórico disponible).`);
    return allData;
}

function prepareDatasets(data: any[]) {
    console.log("🧠 Preprocesando: Feature Engineering & Normalización...");



    const returns = data.map((d, i) => {
        if (i === 0) return 0;
        return (d.close - data[i - 1].close) / data[i - 1].close;
    });

    const ranges = data.map(d => (d.high - d.low) / d.close);
    const volumes = data.map(d => d.volume);

    // --- FEATURE ENGINEERING (EMBEDDED FOR SPEED) ---
    // 1. RSI (14) Normalizado (0-1)
    const period = 14;
    let avgGain = 0, avgLoss = 0;
    const rsiNorm: number[] = new Array(data.length).fill(0.5); // Default neutral

    // Initial SMA for RSI
    for (let i = 1; i <= period; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) avgGain += change;
        else avgLoss += Math.abs(change);
    }
    avgGain /= period; avgLoss /= period;

    for (let i = period + 1; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        const up = change > 0 ? change : 0;
        const down = change < 0 ? Math.abs(change) : 0;
        avgGain = ((avgGain * 13) + up) / 14;
        avgLoss = ((avgLoss * 13) + down) / 14;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        rsiNorm[i] = rsi / 100; // 0.0 to 1.0
    }

    // 2. RVOL (Relative Volume vs SMA 20)
    const rvol: number[] = new Array(data.length).fill(1);
    for (let i = 20; i < data.length; i++) {
        let sum = 0;
        for (let k = 1; k <= 20; k++) sum += volumes[i - k];
        const avg = sum / 20;
        rvol[i] = avg > 0 ? Math.min(5, volumes[i] / avg) : 1; // Cap at 5x to avoid outliers killing the gradient
    }

    // 3. Flattened Tensor Construction (Optimized for Speed)
    // We calculate "valid" samples: data.length - LOOKBACK - 1
    const validSamples = Math.max(0, data.length - LOOKBACK - 1);

    // Check if we have data
    if (validSamples === 0) return { X: new Float32Array(0), y: new Float32Array(0), samples: 0 };

    const X = new Float32Array(validSamples * LOOKBACK * 4);
    const y = new Float32Array(validSamples);

    let sampleIdx = 0;

    for (let i = LOOKBACK; i < data.length - 1; i++) {
        const windowReturns = returns.slice(i - LOOKBACK, i);
        const windowRanges = ranges.slice(i - LOOKBACK, i);
        const windowRSI = rsiNorm.slice(i - LOOKBACK, i);
        const windowRVOL = rvol.slice(i - LOOKBACK, i);

        // Fill Flat Buffer
        for (let j = 0; j < LOOKBACK; j++) {
            // Index logic: [sample, time_step, feature]
            // Flat Index = (sampleIdx * LOOKBACK * 4) + (j * 4) + featureIdx
            const baseIdx = (sampleIdx * LOOKBACK * 4) + (j * 4);
            X[baseIdx + 0] = windowReturns[j];
            X[baseIdx + 1] = windowRanges[j];
            X[baseIdx + 2] = windowRSI[j];
            X[baseIdx + 3] = windowRVOL[j];
        }

        const nextReturn = returns[i + 1];
        y[sampleIdx] = nextReturn > 0.00001 ? 1 : 0;

        sampleIdx++;
    }

    return { X, y, samples: validSamples };
}

// --- CLOUD PERSISTENCE ---
async function uploadToSupabase(filePath: string, fileName: string) {
    try {
        const fileContent = fs.readFileSync(filePath);
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, fileContent, {
                contentType: fileName.endsWith('.json') ? 'application/json' : 'application/octet-stream',
                upsert: true
            });

        if (error) throw error;
        console.log(`☁️ Subido a Supabase Storage: ${fileName}`);
    } catch (e: any) {
        console.error(`❌ Fallo subida de ${fileName}:`, e.message);
    }
}

export async function trainModel() {
    console.log(`🚀 [ML] Iniciando Protocolo de Entrenamiento Automático (Fase 2 - High Performance): ${new Date().toISOString()}`);

    try {
        const rawData = await fetchTrainingData();
        if (rawData.length < LOOKBACK * 2) {
            console.warn("⚠️ Datos insuficientes para entrenar.");
            return;
        }

        const { X, y, samples } = prepareDatasets(rawData);
        console.log(`🧩 Dataset creado en RAM (Float32). Muestras: ${samples} | Buffer Size: ${(X.byteLength / 1024 / 1024).toFixed(2)} MB`);

        const inputTensor = tf.tensor3d(X, [samples, LOOKBACK, 4]);
        const labelTensor = tf.tensor2d(y, [samples, 1]);

        const splitIdx = Math.floor(samples * (1 - TEST_SIZE));
        const xTrain = inputTensor.slice([0, 0, 0], [splitIdx, LOOKBACK, 4]);
        const yTrain = labelTensor.slice([0, 0], [splitIdx, 1]);
        const xTest = inputTensor.slice([splitIdx, 0, 0], [samples - splitIdx, LOOKBACK, 4]);
        const yTest = labelTensor.slice([splitIdx, 0], [samples - splitIdx, 1]);

        console.log("🏋️ Entrenando Cerebro (TensorFlow Core C++)...");

        const model = createModel([LOOKBACK, 4]);

        await model.fit(xTrain, yTrain, {
            epochs: EPOCHS,
            batchSize: BATCH_SIZE,
            validationData: [xTest, yTest],
            verbose: 1, // Show progress bar
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    if (epoch % 10 === 0) {
                        console.log(`   Epoch ${epoch}/${EPOCHS} - Val Acc: ${logs?.val_acc.toFixed(4)}`);
                    }
                }
            }
        });

        console.log("✅ Entrenamiento OK.");

        // Guardar Temporalmente en Disco (Efímero)
        const saveDir = path.join(__dirname, 'temp_model');
        if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir);

        await model.save(tf.io.withSaveHandler(async (artifacts) => {
            if (artifacts.modelTopology) {
                fs.writeFileSync(path.join(saveDir, 'model.json'), JSON.stringify({
                    modelTopology: artifacts.modelTopology,
                    format: artifacts.format,
                    generatedBy: artifacts.generatedBy,
                    convertedBy: artifacts.convertedBy,
                    weightsManifest: [{
                        paths: ['./weights.bin'], // Referencia relativa standard
                        weights: artifacts.weightSpecs
                    }]
                }, null, 2));
            }
            if (artifacts.weightData) {
                fs.writeFileSync(path.join(saveDir, 'weights.bin'), Buffer.from(artifacts.weightData as any));
            }
            return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } } as any;
        }));

        console.log("💾 Guardado local temporal. Iniciando subida a la Nube...");

        // Subir a Supabase Storage (Persistencia Real)
        await uploadToSupabase(path.join(saveDir, 'model.json'), 'model.json');
        await uploadToSupabase(path.join(saveDir, 'weights.bin'), 'weights.bin');

        console.log("✨ [ML] Ciclo de Entrenamiento Completado y Persistido.");

        // Cleanup
        inputTensor.dispose();
        labelTensor.dispose();
        xTrain.dispose();
        yTrain.dispose();
        model.dispose();

    } catch (e) {
        console.error("❌ Error Fatal en Entrenamiento Automático:", e);
    }
}

// Permitir ejecución manual y por scheduler
trainModel();
