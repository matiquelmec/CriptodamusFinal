
import * as tf from '@tensorflow/tfjs';
try {
    // Try dynamic import for node version which might fail
    import('@tensorflow/tfjs-node').then(() => {
        console.log("✅ TensorFlow Node loaded successfully.");
    }).catch(e => {
        console.log("⚠️ Failed to load tfjs-node (using pure JS):", e.message);
        console.log("✅ Pure JS TensorFlow ready:", tf.version.tfjs);
    });
} catch (e) {
    console.error("Critical Error:", e);
}
