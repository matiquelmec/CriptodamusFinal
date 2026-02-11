
import EventEmitter from 'events';

class MockAudit extends EventEmitter {
    public activeSignals: any[] = [{ id: 'test', symbol: 'BTC/USDT', pnl_percent: 0, status: 'ACTIVE' }];
    private lastBroadcastTime: number = 0;
    private readonly BROADCAST_THROTTLE_MS = 1000; // 1s for testing purposes

    async processPriceTicks(ticks: number, intervalMs: number, forceCritical: boolean = false) {
        console.log(`\n--- Starting Simulation: ${ticks} ticks every ${intervalMs}ms ---`);
        let broadcastCount = 0;
        this.on('trades_updated', () => {
            broadcastCount++;
            console.log(`📡 [WS] Broadcast #${broadcastCount} at ${Date.now() - startTime}ms`);
        });

        const startTime = Date.now();
        for (let i = 0; i < ticks; i++) {
            const now = Date.now();
            const updates: any[] = [{ id: 'test', pnl_percent: i }];

            // Simulate critical change on specific tick
            if (forceCritical && i === Math.floor(ticks / 2)) {
                updates[0].status = 'PARTIAL_WIN';
                console.log(`🔥 [Sim] Critical Change injected at tick ${i}`);
            }

            // --- INTEL BROADCAST LOGIC (From Code) ---
            const hasCriticalChange = updates.some(u =>
                u.status !== undefined ||
                u.stage !== undefined ||
                u.stop_loss !== undefined ||
                u.take_profit !== undefined
            );

            const shouldBroadcast = hasCriticalChange || (now - this.lastBroadcastTime > this.BROADCAST_THROTTLE_MS);

            if (shouldBroadcast) {
                this.emit('trades_updated', this.activeSignals);
                this.lastBroadcastTime = now;
            }

            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }

        console.log(`--- Simulation End. Total Broadcasts: ${broadcastCount} (Expected: ~${Math.ceil((ticks * intervalMs) / this.BROADCAST_THROTTLE_MS) + (forceCritical ? 1 : 0)} or similar) ---`);
    }
}

async function runTest() {
    const auditor = new MockAudit();

    // Scenario 1: Normal ticks (No critical changes)
    console.log("SCENARIO 1: High frequency small updates (Should throttle)");
    await auditor.processPriceTicks(20, 100); // 2 seconds total, 100ms interval. Should emit ~2 times.

    // Scenario 2: Critical change during throttling
    console.log("\nSCENARIO 2: Critical change override");
    const auditor2 = new MockAudit();
    await auditor2.processPriceTicks(20, 100, true); // Should emit ~2 times + 1 immediate for critical.
}

runTest();
