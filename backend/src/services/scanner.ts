import EventEmitter from 'events';
import { scanMarketOpportunities } from '../core/services/engine/scannerLogic';
import { AIOpportunity, TradingStyle } from '../core/types';

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
     * Start the autonomous scanning loops
     */
    public start() {
        if (this.mainScanInterval) return; // Already running

        console.log("🚀 [ScannerService] Starting Autonomous Market Scanner...");

        // Initial Scan (Immediate)
        this.runFullScan();

        // 1. Main Institutional Scan (15m/4h)
        this.mainScanInterval = setInterval(() => {
            this.runFullScan();
        }, SCAN_INTERVAL_MS);

        // 2. Meme/Scalp Scan (Fast) - Optional, enabled if MEME_MODE is on
        // this.memeScanInterval = setInterval(() => {
        //     this.runMemeScan();
        // }, MEME_SCAN_INTERVAL_MS);
    }

    /**
     * Stop the scanner loops
     */
    public stop() {
        if (this.mainScanInterval) clearInterval(this.mainScanInterval);
        if (this.memeScanInterval) clearInterval(this.memeScanInterval);
        this.mainScanInterval = null;
        console.log("🛑 [ScannerService] Stopped.");
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
