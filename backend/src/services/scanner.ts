import EventEmitter from 'events';
import { scanMarketOpportunities } from '../core/services/engine/scannerLogic';
import { AIOpportunity, TradingStyle } from '../core/types';
import { telegramService } from './telegramService';

// Configuration
const SCAN_INTERVAL_MS = 15 * 60 * 1000; // 15 Minutes
const MEME_SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 Minutes (Faster for memes)

class ScannerService extends EventEmitter {
    private isScanning: boolean = false;
    private opportunities: AIOpportunity[] = [];
    private lastScanTime: number = 0;

    // Interval Handles
    private mainScanInterval: NodeJS.Timeout | null = null;
    private memeScanInterval: NodeJS.Timeout | null = null;

    constructor() {
        super();
        this.opportunities = [];
    }



    /**
     * Helper: Verify and Log Data Freshness from Supabase
     */
    private async checkDataIntegrity() {
        try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

            const { data, error } = await supabase
                .from('market_candles')
                .select('timestamp')
                .eq('symbol', 'BTCUSDT')
                .order('timestamp', { ascending: false })
                .limit(1);

            if (data && data.length > 0) {
                console.log(`📊 [Data Check] Última vela en BD (Corteza Cerebral): ${data[0].timestamp}`);
            } else {
                console.warn("⚠️ [Data Check] No se encontraron velas en la BD.");
            }
        } catch (e) {
            console.error("⚠️ [Data Check] Error verificando integridad de datos.", e);
        }
    }

    /**
     * Start the autonomous scanning loops, aligned with 15m candles
     */
    public start() {
        if (this.mainScanInterval) return; // Already running logic check (though we use timeout now)

        console.log("🚀 [ScannerService] Starting Autonomous Market Scanner (Synced to 15m Candles)...");

        // 0. Verify Data Integrity (Log latest candle to console for user peace of mind)
        this.checkDataIntegrity();

        // 1. Initial Scan (Immediate) - Per user requirement
        this.runFullScan();

        // 2. Schedule next scan aligned to xx:00, xx:15, xx:30, xx:45
        this.scheduleNextAlignedScan();
    }

    /**
     * Stop the scanner loops
     */
    public stop() {
        if (this.mainScanInterval) clearTimeout(this.mainScanInterval);
        this.mainScanInterval = null;
        console.log("🛑 [ScannerService] Stopped.");
    }

    /**
     * Helper: Schedule next scan at the exact 15m mark
     */
    private scheduleNextAlignedScan() {
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const milliseconds = now.getMilliseconds();

        // Calculate minutes to next quarter hour (15, 30, 45, 60/00)
        // If minutes is 14, remainder is 14. 15 - 14 = 1 min to go.
        // If minutes is 15, remainder is 0. 15 - 0 = 15 min to go (Next slot).
        const remainder = minutes % 15;
        const minutesToNext = 15 - remainder;

        // Convert to total milliseconds delay
        // Subtract current seconds/ms to hit the minute mark exactly :00
        let delayMs = (minutesToNext * 60 * 1000) - (seconds * 1000) - milliseconds;

        // Safety buffer: If delay is too small (e.g. < 5s), push to next cycle to avoid double execution on edge
        if (delayMs < 5000) {
            delayMs += 15 * 60 * 1000;
        }

        console.log(`⏱️ [ScannerService] Next alignment in ${(delayMs / 1000 / 60).toFixed(2)} minutes (Target: Next 15m Candle)`);

        this.mainScanInterval = setTimeout(() => {
            this.runFullScan();
            // Recursive schedule for next cycle
            this.scheduleNextAlignedScan();
        }, delayMs);
    }

    /**
     * Get the latest cached opportunities
     */
    public getLatestOpportunities(): AIOpportunity[] {
        return this.opportunities;
    }

    /**
     * Run the comprehensive market scan
     */
    public async runFullScan() {
        if (this.isScanning) {
            console.log("⚠️ [ScannerService] Skip: Previous scan still running.");
            return;
        }

        this.isScanning = true;
        const startTime = Date.now();

        try {
            console.log(`🔍 [ScannerService] Executing Full Scan at ${new Date().toISOString()}...`);

            // 1. Run Core Scanner Logic
            // We use 'SWING_INSTITUTIONAL' as the baseline for the 24/7 backend 
            // as it covers the most robust signals.
            const results = await scanMarketOpportunities('SWING_INSTITUTIONAL');

            // 2. Update Cache
            this.opportunities = results;
            this.lastScanTime = Date.now();

            // 3. Broadcast Results
            if (results.length > 0) {
                console.log(`✅ [ScannerService] Found ${results.length} opportunities. Broadcasting...`);
                this.emit('scan_complete', results);

                // 🚀 TELEGRAM NOTIFICATION HOOK
                telegramService.broadcastSignals(results).catch(err => console.error("[Scanner] Telegram Error:", err));

                // Also emit a specific event for high quality setups
                const goldenTickets = results.filter(o => o.confidenceScore >= 80);
                if (goldenTickets.length > 0) {
                    this.emit('golden_ticket', goldenTickets);
                }
            } else {
                console.log("ℹ️ [ScannerService] Scan complete. No opportunities found matching strict criteria.");
            }

        } catch (error) {
            console.error("❌ [ScannerService] Critical Error:", error);
            this.emit('error', error);
        } finally {
            this.isScanning = false;
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`⏱️ [ScannerService] Scan finished in ${duration}s`);
        }
    }

    /**
     * Run a faster, focused scan for volatile assists
     */
    public async runMemeScan() {
        // Implementation for meme scanning if needed separately
        // keeping it simple for Phase 1
    }
}

// Singleton Instance
export const scannerService = new ScannerService();
