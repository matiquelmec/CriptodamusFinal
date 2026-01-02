import * as tf from '@tensorflow/tfjs';
// Native fetch used


let model: tf.LayersModel | null = null;
const LOOKBACK = 50;

// Reutilizamos la lógica de Binance (Duplicada por ahora para seguridad durante ejecución)
async function fetchRecentCandles(symbol: string, interval: string = '15m', limit: number = 100) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance Error: ${res.statusText}`);
    const data: any = await res.json();

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
            try {
                // Read files manually
                const modelPath = path.join(process.cwd(), 'cols_brain_v1');
                const jsonPath = path.join(modelPath, 'model.json');
                const weightsPath = path.join(modelPath, 'weights.bin');

                if (!fs.existsSync(jsonPath) || !fs.existsSync(weightsPath)) {
                    throw new Error("Model artifacts not found");
                }

                const modelJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
                const weightsBuffer = fs.readFileSync(weightsPath);

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
                // Fallback to empty if critical
            }
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
