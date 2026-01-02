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
        units: 64,
        returnSequences: false, // Solo necesitamos el resultado final de la secuencia
        inputShape: inputShape
    }));

    // 2. Dropout (Olvido selectivo para generalizar mejor)
    model.add(tf.layers.dropout({ rate: 0.2 }));

    // 3. Capa Densa (Razonamiento)
    model.add(tf.layers.dense({
        units: 32,
        activation: 'relu'
    }));

    // 4. Salida (Predicción: 0% a 100% probabilidad de subida)
    model.add(tf.layers.dense({
        units: 1,
        activation: 'sigmoid'
    }));

    // Compilar el cerebro
    model.compile({
        optimizer: tf.train.adam(0.001), // Adam es el standard de oro
        loss: 'binaryCrossentropy',      // Problema binario: ¿Sube o No?
        metrics: ['accuracy']
    });

    return model;
}
