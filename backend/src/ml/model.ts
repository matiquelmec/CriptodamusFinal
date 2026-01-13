import * as tf from '@tensorflow/tfjs';

/**
 * Crea una Red Neuronal Recurrente (LSTM) optimizada para series de tiempo financieras.
 * Arquitectura:
 * - Input: [SequenceLength, Features] (50 velas de historia)
 * - Layer 1: LSTM (64 units) - Capta patrones complejos temporales.
 * - Layer 2: Dropout (0.2) - Evita memorizar (Overfitting).
 * - Layer 3: Dense (32 units, Relu) - Procesa la memoria extraída.
 * - Output: Dense (1, Sigmoid) - Probabilidad 0-1 (¿Subirá?).
 */
export function createModel(inputShape: [number, number]): tf.Sequential {
    const model = tf.sequential();

    // 1. Capa LSTM Principal (El "Hipocampo")
    model.add(tf.layers.lstm({
        units: 32, // Reduced from 64 for Speed on CPU
        returnSequences: false,
        inputShape: inputShape,
        kernelInitializer: 'glorotUniform', // SPEED HACK: Orthogonal is too slow on CPU/JS
        recurrentInitializer: 'glorotUniform'
    }));

    // 2. Dropout (Olvido selectivo para generalizar mejor)
    model.add(tf.layers.dropout({ rate: 0.2 }));

    // 3. Capa Densa (Razonamiento)
    model.add(tf.layers.dense({
        units: 16, // Reduced from 32
        activation: 'relu',
        kernelInitializer: 'glorotUniform',
        biasInitializer: 'zeros'
    }));

    // 4. Salida (Predicción: 0% a 100% probabilidad de subida)
    model.add(tf.layers.dense({
        units: 1,
        activation: 'sigmoid',
        kernelInitializer: 'glorotUniform',
        biasInitializer: 'zeros'
    }));

    // Compilar el cerebro
    model.compile({
        optimizer: tf.train.adam(0.001), // Adam es el standard de oro
        loss: 'binaryCrossentropy',      // Problema binario: ¿Sube o No?
        metrics: ['accuracy']
    });

    return model;
}
