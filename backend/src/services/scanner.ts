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

    // Status State
    private currentStatus: any = { status: 'BOOTING', reason: 'INIT', message: 'System Initializing...' };

    constructor() {
        super();
        this.opportunities = [];
    }

    public getLastStatus() {
        return this.currentStatus;
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
            console.log(`🔍 [ScannerService] Executing DUAL-CORE Scan at ${new Date().toISOString()}...`);

            // 0. NUCLEAR SHIELD CHECK (Hard Filter)
            const { EconomicService } = await import('../core/services/economicService');
            try {
                await EconomicService.checkNuclearStatus();
            } catch (e: any) {
                console.warn(`🛡️ [ScannerService] Nuclear Shield Active: ${e.message}`);
                const status = {
                    status: 'PAUSED',
                    reason: 'NUCLEAR_EVENT',
                    message: e.message
                };
                this.currentStatus = status; // Update State
                this.emit('system_status', status);
                this.isScanning = false;
                return; // SKIP SCAN
            }

            // If we pass, we assume status is ACTIVE
            const activeStatus = { status: 'ACTIVE', reason: 'NORMAL_OP', message: 'Scanning Market...' };
            this.currentStatus = activeStatus;
            this.emit('system_status', activeStatus);

            const [swingResults, scalpResults] = await Promise.all([
                scanMarketOpportunities('SWING_INSTITUTIONAL'),
                scanMarketOpportunities('SCALP_AGRESSIVE')
            ]);

            console.log(`📊 [Scanner] Raw Results - Swing (4H): ${swingResults.length} | Scalp (15m): ${scalpResults.length}`);

            // 3. Merge & Deduplicate
            // If a coin appears in both, usually we keep both if strategies differ. 
            // If identical strategy/signal, we prioritize the higher score.
            // For simplicity in UI, we just push all distinct opportunities.
            const allResults = [...swingResults, ...scalpResults];

            // Deduplicate by ID (Symbol + Strategy) to avoid react key issues if any overlap occurs
            const uniqueResults = Array.from(new Map(allResults.map(item => [item.id, item])).values());

            // 4. Update Cache
            this.opportunities = uniqueResults;
            this.lastScanTime = Date.now();

            // 5. Broadcast Results
            if (uniqueResults.length > 0) {
                console.log(`✅ [ScannerService] Broadcast: ${uniqueResults.length} opportunities (Merged).`);
                this.emit('scan_complete', uniqueResults);

                // 🚀 TELEGRAM NOTIFICATION HOOK
                telegramService.broadcastSignals(uniqueResults).catch(err => console.error("[Scanner] Telegram Error:", err));

                // 🛡️ SIGNAL AUDIT HOOK (New)
                const { signalAuditService } = await import('./signalAuditService');
                signalAuditService.registerSignals(uniqueResults).catch(err => console.error("[Scanner] Audit Error:", err));

                // Golden Tickets (High Confidence)
                const goldenTickets = uniqueResults.filter(o => o.confidenceScore >= 80);
                if (goldenTickets.length > 0) {
                    this.emit('golden_ticket', goldenTickets);
                }
            } else {
                console.log("ℹ️ [ScannerService] Scan complete. Market is quiet (0 signals found).");
            }

        } catch (error: any) {
            console.error("❌ [ScannerService] Critical Error:", error);
            const { systemAlerts } = await import('./systemAlertService');
            systemAlerts.logAlert({
                severity: 'CRITICAL',
                category: 'API_FAILURE',
                message: `SCANNER_CRITICAL_FAILURE: ${error.message}`
            });
            const errorStatus = { status: 'CRITICAL', reason: 'SCANNER_ERROR', message: error.message };
            this.currentStatus = errorStatus;
            this.emit('system_status', errorStatus);
            this.emit('error', error);
        } finally {
            this.isScanning = false;
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`⏱️ [ScannerService] Dual-Core Scan finished in ${duration}s`);
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
