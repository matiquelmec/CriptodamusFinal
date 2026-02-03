/**
 * ONE-TIME EMERGENCY CLEANUP SCRIPT
 * 
 * Resolves all current ghost alerts to immediately fix DEGRADED status.
 * Run once to clean slate, then let auto-cleanup handle future alerts.
 */

import { AlertCleanupService } from '../services/alertCleanupService';

async function runEmergencyCleanup() {
    console.log('🚨 [Emergency] Starting ghost alert cleanup...\n');

    const count = await AlertCleanupService.emergencyCleanup();

    console.log('\n✅ [Emergency] Cleanup complete!');
    console.log(`   Resolved: ${count} alerts`);
    console.log('   System status should return to OPTIMAL immediately.\n');

    process.exit(0);
}

runEmergencyCleanup().catch(err => {
    console.error('❌ Emergency cleanup failed:', err);
    process.exit(1);
});
