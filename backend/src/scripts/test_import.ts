
import { calculateKellySize } from '../core/services/engine/riskEngine';

try {
    console.log("Testing riskEngine import...");
    const size = calculateKellySize(0.6, 2.0);
    console.log("Kelly Size:", size);
} catch (e) {
    console.error("Import failed:", e);
}
