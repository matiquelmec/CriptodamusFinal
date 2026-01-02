import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';
import path from 'path';
// Native fetch used


let model: tf.LayersModel | null = null;
const LOOKBACK = 50;

// Reutilizamos la lógica de Binance (Duplicada por ahora para seguridad durante ejecución)
async function fetchRecentCandles(symbol: string, interval: string = '15m', limit: number = 100) {
    // 1. Intentar Binance Global
    let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

    try {
        const res = await fetch(url);

        // Si es error 451 (Geo-Block USA), intentar Binance US
        if (res.status === 451) {
            console.warn(`⚠️ Binance Global bloqueado (451). Cambiando a Binance US para ${symbol}...`);
            url = `https://api.binance.us/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            const resUS = await fetch(url);

            if (!resUS.ok) {
                const errTextUS = await resUS.text();
                throw new Error(`Binance US Error (${resUS.status}): ${errTextUS}`);
            }
            return parseBinanceResponse(await resUS.json());
        }

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Binance Error (${res.status}): ${errText}`);
        }

        return parseBinanceResponse(await res.json());

    } catch (error: any) {
        // Fallback final: Si falla todo, lanzar error
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

export async function predictNextMove(symbol: string = 'BTCUSDT', existingCandles?: any[]) {
    try {
        if (!model) {
            console.log("🧠 Cargando el cerebro (Modelo LSTM)...");
            // Custom Loader for Pure JS
            // Custom model loading (bypass tfjs-node file:// issues)
            try {
                const modelPath = path.join(process.cwd(), 'cols_brain_v1');
                const modelFile = path.join(modelPath, 'model.json');
                const weightsFile = path.join(modelPath, 'weights.bin');

                console.log(`🧠 [ML] Loading Brain from: ${modelPath}`);
                console.log(`    - Model File: ${modelFile} (${fs.existsSync(modelFile) ? 'FOUND' : 'MISSING'})`);
                console.log(`    - Weights File: ${weightsFile} (${fs.existsSync(weightsFile) ? 'FOUND' : 'MISSING'})`);

                if (!fs.existsSync(modelFile) || !fs.existsSync(weightsFile)) {
                    console.error("❌ [ML] Model files missing. Cannot load brain.");
                    return null;
                }

                const modelJson = JSON.parse(fs.readFileSync(modelFile, 'utf8'));
                const weightsBuffer = fs.readFileSync(weightsFile);

                // Reconstruct IOHandler
                const ioHandler: tf.IOHandler = {
                    load: async () => {
                        return {
                            modelTopology: modelJson.modelTopology,
                            weightSpecs: modelJson.weightsManifest[0].weights,
                            weightData: weightsBuffer.buffer.slice(weightsBuffer.byteOffset, weightsBuffer.byteOffset + weightsBuffer.byteLength)
                        };
                    }
                };

                model = await tf.loadLayersModel(ioHandler);
                console.log("✅ Cerebro Cargado (Modo Manual)");
            } catch (loadErr) {
                console.error("Failed to load model from disk:", loadErr);
            }
        }

        if (!model) {
            console.warn("⚠️ Modelo no disponible, saltando predicción.");
            return null;
        }

        // 2. Obtener Datos (Reusar o Fetch)
        const candles = existingCandles || await fetchRecentCandles(symbol);
        if (candles.length < LOOKBACK + 1) throw new Error("Not enough data");

        // 3. Preprocesar (Feature Engineering EXACTO al de entrenamiento)
        const returns: number[] = [];
        const ranges: number[] = [];

        for (let i = 1; i < candles.length; i++) {
            const r = (candles[i].close - candles[i - 1].close) / candles[i - 1].close;
            const rng = (candles[i].high - candles[i].low) / candles[i].close;
            returns.push(r);
            ranges.push(rng);
        }

        // Tomar las últimas 50
        const lastReturns = returns.slice(-LOOKBACK);
        const lastRanges = ranges.slice(-LOOKBACK);

        // Construir Secuencia [1, 50, 2]
        const sequence: number[][] = [];
        for (let j = 0; j < LOOKBACK; j++) {
            sequence.push([lastReturns[j], lastRanges[j]]);
        }

        // Tensor
        const input = tf.tensor3d([sequence], [1, LOOKBACK, 2]);

        // 4. Inferencia
        const predictionTensor = model.predict(input) as tf.Tensor;
        const probabilityData = await predictionTensor.data();
        const probability = probabilityData[0];

        // Cleanup tensors
        input.dispose();
        predictionTensor.dispose();

        return {
            symbol,
            probabilityUp: probability, // 0.0 a 1.0 (Probabilidad de Subida)
            signal: probability > 0.6 ? 'BULLISH' : probability < 0.4 ? 'BEARISH' : 'NEUTRAL',
            confidence: Math.abs(probability - 0.5) * 2, // 0 a 1
            timestamp: Date.now()
        };

    } catch (e) {
        console.error("❌ Error en AI Predictor:", e);
        return null;
    }
}
