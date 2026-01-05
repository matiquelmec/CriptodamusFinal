import * as tf from '@tensorflow/tfjs';
// import '@tensorflow/tfjs-node'; // Enable C++ Backend (Disabled for Windows Compatibility)
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
const BATCH_SIZE = 64;

async function fetchTrainingData() {
    console.log("📡 Descargando datos de la Corteza Cerebral (Supabase)...");

    let allData: any[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    const MAX_ROWS = 75000;

    while (allData.length < MAX_ROWS) {
        const { data, error } = await supabase
            .from('market_candles')
            .select('close, volume, high, low')
            .eq('symbol', SYMBOL)
            .eq('timeframe', TIMEFRAME)
            .order('timestamp', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw new Error(`Data Error: ${error.message}`);
        if (!data || data.length === 0) break;

        allData = allData.concat(data);
        from += PAGE_SIZE;
        // process.stdout.write(`.`); 
    }

    console.log(`\n✅ Datos recibidos: ${allData.length} velas.`);
    return allData;
}

function prepareDatasets(data: any[]) {
    console.log("🧠 Preprocesando: Feature Engineering & Normalización...");

    const X: number[][][] = [];
    const y: number[] = [];

    const returns = data.map((d, i) => {
        if (i === 0) return 0;
        return (d.close - data[i - 1].close) / data[i - 1].close;
    });

    const ranges = data.map(d => (d.high - d.low) / d.close);

    for (let i = LOOKBACK; i < data.length - 1; i++) {
        const windowReturns = returns.slice(i - LOOKBACK, i);
        const windowRanges = ranges.slice(i - LOOKBACK, i);

        const sequence: number[][] = [];
        for (let j = 0; j < LOOKBACK; j++) {
            sequence.push([
                windowReturns[j],
                windowRanges[j]
            ]);
        }

        X.push(sequence);

        const nextReturn = returns[i + 1];
        y.push(nextReturn > 0.00001 ? 1 : 0);
    }

    return { X, y };
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
    console.log(`🚀 [ML] Iniciando Protocolo de Entrenamiento Automático: ${new Date().toISOString()}`);

    try {
        const rawData = await fetchTrainingData();
        if (rawData.length < LOOKBACK * 2) {
            console.warn("⚠️ Datos insuficientes para entrenar.");
            return;
        }

        const { X, y } = prepareDatasets(rawData);
        console.log(`🧩 Dataset creado. Muestras: ${X.length}`);

        const inputTensor = tf.tensor3d(X, [X.length, LOOKBACK, 2]);
        const labelTensor = tf.tensor2d(y, [y.length, 1]);

        const splitIdx = Math.floor(X.length * (1 - TEST_SIZE));
        const xTrain = inputTensor.slice([0, 0, 0], [splitIdx, LOOKBACK, 2]);
        const yTrain = labelTensor.slice([0, 0], [splitIdx, 1]);
        const xTest = inputTensor.slice([splitIdx, 0, 0], [X.length - splitIdx, LOOKBACK, 2]);
        const yTest = labelTensor.slice([splitIdx, 0], [X.length - splitIdx, 1]);

        console.log("🏋️ Entrenando Cerebro (TensorFlow Core C++)...");

        const model = createModel([LOOKBACK, 2]);

        await model.fit(xTrain, yTrain, {
            epochs: EPOCHS,
            batchSize: BATCH_SIZE,
            validationData: [xTest, yTest],
            verbose: 0, // Silent mode for production cron
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
