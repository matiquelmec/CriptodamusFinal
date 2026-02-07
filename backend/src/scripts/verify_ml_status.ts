
import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';
import path from 'path';
import { predictNextMove } from '../ml/inference';

async function verify() {
    console.log("🔍 Verificando estado del Cerebro ML...");

    // 1. Check Artifacts
    const modelPath = path.join(process.cwd(), 'src', 'ml', 'temp_model');
    const modelFile = path.join(modelPath, 'model.json');
    const weightsFile = path.join(modelPath, 'weights.bin');

    if (fs.existsSync(modelFile) && fs.existsSync(weightsFile)) {
        console.log("✅ Archivos de modelo encontrados.");
    } else {
        console.error("❌ Faltan archivos del modelo en:", modelPath);
        return;
    }

    // 2. Test Inference Service
    console.log("🧠 Probando Servicio de Inferencia...");
    try {
        // Test raw ticker normalization (ETH -> ETHUSDT)
        console.log("🧪 Probando normalización de símbolo: 'ETH'...");
        const prediction = await predictNextMove('ETH');

        if (prediction) {
            console.log("✅ Predicción Exitosa:");
            console.log(JSON.stringify(prediction, null, 2));
        } else {
            console.error("❌ La predicción retornó null (Posible error interno o Guard Clause activada).");
        }
    } catch (e) {
        console.error("❌ Error CRÍTICO en inferencia:", e);
    }
}

verify();
