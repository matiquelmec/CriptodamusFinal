
import { calculateVolumeProfile } from './core/services/volumeProfile';

const mockCandles = [
    { high: 100, low: 90, close: 95, volume: 1000 },
    { high: 110, low: 100, close: 105, volume: 2000 },
    { high: 115, low: 110, close: 112, volume: 50 }, // Deep valley
    { high: 120, low: 115, close: 117, volume: 50 }, // Deep valley
    { high: 125, low: 120, close: 122, volume: 3000 },
    { high: 130, low: 125, close: 127, volume: 5000 },
    { high: 135, low: 130, close: 132, volume: 5000 },
    { high: 140, low: 135, close: 137, volume: 5000 },
    { high: 145, low: 140, close: 142, volume: 100 }, // Another valley
    { high: 150, low: 145, close: 147, volume: 4000 }
];

const profile = calculateVolumeProfile(mockCandles as any, 10);
console.log("VOLUME PROFILE TEST:");
console.log("POC:", profile.poc);
console.log("LVNs:", profile.lowVolumeNodes);
// console.log("Bins:", profile.bins); // Need to expose bins or just trust the logic

if (profile.lowVolumeNodes && profile.lowVolumeNodes.length > 0) {
    console.log("✅ LVN Detection Working.");
} else {
    console.log("❌ No LVNs detected. Check logic.");
}
