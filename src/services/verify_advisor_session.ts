
import { getKillZoneStatus, getSessionProximityInfo } from './sessionExpert';

console.log("🔍 Verifying Session Intelligence Logic...");

// 1. Test Kill Zone
const kz = getKillZoneStatus();
console.log(`\n🕐 Current Kill Zone Status:`);
console.log(`   Is Active: ${kz.isActive}`);
console.log(`   Zone: ${kz.zoneName}`);
console.log(`   Msg: ${kz.message}`);

// 2. Test Proximity
const prox = getSessionProximityInfo();
console.log(`\n⏳ Session Proximity:`);
console.log(`   Drift Status: ${prox.driftStatus}`);
console.log(`   Warning: ${prox.warningMessage}`);

console.log("\n✅ Verification Complete (Logic Check).");
