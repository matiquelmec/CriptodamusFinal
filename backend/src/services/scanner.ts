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
    private hotScanInterval: NodeJS.Timeout | null = null;

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

        // 1.5 Start Elite 9 Hot Scan (Sniper Mode - 5m)
        this.startHotScan();

        // 2. Schedule next scan aligned to xx:00, xx:15, xx:30, xx:45
        this.scheduleNextAlignedScan();

        // ✅ STATUS HYGIENE: Auto-reset to OPTIMAL every 30min to prevent stuck DEGRADED
        setInterval(() => {
            // Only reset if not actively scanning or genuinely critical
            if (!['CRITICAL', 'SCANNING'].includes(this.currentStatus.status)) {
                console.log('🧹 [Status Hygiene] Auto-resetting to OPTIMAL (prevents stuck DEGRADED)');
                this.currentStatus = {
                    status: 'OPTIMAL',
                    reason: 'AUTO_RESET',
                    message: 'Sistemas operando normalmente.'
                };
                this.emit('system_status', this.currentStatus);
            }
        }, 30 * 60 * 1000); // Every 30 minutes
    }

    /**
     * Stop the scanner loops
     */
    public stop() {
        if (this.mainScanInterval) clearTimeout(this.mainScanInterval);
        if (this.hotScanInterval) clearInterval(this.hotScanInterval);
        this.mainScanInterval = null;
        this.hotScanInterval = null;
        console.log("🛑 [ScannerService] Stopped.");
    }

    /**
     * NEW: Sniper Mode Hot Scan (Tournament Assets only)
     * Every 5 minutes, independent of 15m candle alignment
     */
    private startHotScan() {
        if (this.hotScanInterval) clearInterval(this.hotScanInterval);

        const HOT_SCAN_MS = 5 * 60 * 1000; // 5 Minutes
        console.log(`🎯 [ScannerService] Sniper Mode Active: Hot-Scanning Elite 9 every 5m.`);

        this.hotScanInterval = setInterval(() => {
            // We only run if we aren't already doing a full scan
            if (!this.isScanning) {
                console.log("🔫 [ScannerService] Triggering Hot Scan (Elite 9)...");
                this.runFullScan('SWING_INSTITUTIONAL'); // Or SCALP_AGRESSIVE, based on preference
            }
        }, HOT_SCAN_MS);
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
    public async runFullScan(style: 'SWING_INSTITUTIONAL' | 'SCALP_AGRESSIVE' | 'MEME_SCALP' = 'SCALP_AGRESSIVE') {
        if (this.isScanning) return;
        this.isScanning = true;
        this.currentStatus = { status: 'SCANNING', reason: 'ANALYZING', message: `Analizando mercado global (${style})...` };
        this.emit('system_status', this.currentStatus);

        const startTime = Date.now();

        try {
            console.log(`🔍 [ScannerService] Executing DUAL-CORE Scan at ${new Date().toISOString()}...`);

            // 0. NUCLEAR SHIELD CHECK (Institutional Sniper Mode)
            const { EconomicService } = await import('../core/services/economicService');
            const shield = await EconomicService.checkNuclearStatus();

            if (shield.isActive) {
                if (shield.isImminent) {
                    // CRITICAL: REAL KILL SWITCH (FAIL-SAFE)
                    console.warn(`🛡️ [ScannerService] ☢️ SNIPER SHIELD TRIGGERED: ${shield.reason}`);

                    const pausedStatus = {
                        status: 'PAUSED',
                        reason: 'NUCLEAR_EVENT',
                        message: `⛔ TRADING SUSPENDED: ${shield.reason}`
                    };

                    this.currentStatus = pausedStatus;
                    this.emit('system_status', pausedStatus);

                    // Stop execution immediately
                    this.isScanning = false;
                    return;
                } else {
                    console.log(`🛡️ [ScannerService] Nuclear Day Awareness: ${shield.reason}`);
                }
            }

            // If we pass, we assume status is ACTIVE
            console.log("🟢 [ScannerService] Setting status to ACTIVE (Scanning in progress)...");
            const activeStatus = { status: 'ACTIVE', reason: 'NORMAL_OP', message: 'Analizando mercado global...' };
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
                // 🛡️ [SMART FILTER] DEDUPLICATION AGAINST ACTIVE TRADES (SALA DE CONTROL)
                // We must query the Audit Service to see if we satisfy the "Silence if Active" rule.
                const { signalAuditService } = await import('./signalAuditService');
                const activeTrades = signalAuditService.getActiveSignalsSnapshot();

                // Filter out opportunities that are already being managed (PENDING, ACTIVE, OPEN, PARTIAL_WIN)
                // We map symbols to upper case for robust comparison
                const activeSymbols = new Set(activeTrades.map((t: any) => t.symbol.toUpperCase().replace('/', '')));

                const returnableResults = uniqueResults.filter(op => {
                    const opSymbol = op.symbol.toUpperCase().replace('/', '');
                    if (activeSymbols.has(opSymbol)) {
                        console.log(`🔇 [ScannerService] Suppressed Duplicate Signal: ${op.symbol} (Already in Control Room)`);
                        return false;
                    }
                    return true;
                });

                if (returnableResults.length > 0) {
                    // 🛡️ SIGNAL AUDIT HOOK (New & Vetted)
                    // Note: Audit Service is the SOLE AUTHORITY. 
                    // We wait for it to vet the signals (Late check, spread, etc.)
                    const vettedResults = await signalAuditService.registerSignals(returnableResults);

                    if (vettedResults.length > 0) {
                        console.log(`✅ [ScannerService] Broadcast: ${vettedResults.length} VETTED opportunities.`);
                        this.emit('scan_complete', vettedResults);

                        // Update cache only with vetted results
                        this.opportunities = vettedResults;

                        // Golden Tickets (High Confidence)
                        const goldenTickets = vettedResults.filter(o => o.confidenceScore >= 80);
                        if (goldenTickets.length > 0) {
                            this.emit('golden_ticket', goldenTickets);
                        }
                    } else {
                        console.log(`ℹ️ [ScannerService] Scan complete. ${returnableResults.length} signals found but ALL were rejected by Auditor (Late/Risk).`);
                    }
                }
                else {
                    console.log(`ℹ️ [ScannerService] Scan complete. ${uniqueResults.length} signals found but ALL were duplicates of active trades.`);
                }
            } else {
                console.log("ℹ️ [ScannerService] Scan complete. Market is quiet (0 signals found).");
            }

            // SUCCESS STATUS RESET
            console.log("✅ [ScannerService] Resetting status to OPTIMAL...");
            this.currentStatus = { status: 'OPTIMAL', reason: 'OK', message: 'Sistemas operando normalmente.' };
            this.emit('system_status', this.currentStatus);
            console.log("✅ [ScannerService] Status reset complete. Current status:", this.currentStatus.status);

            // ✅ ROBUSTEZ: Double broadcast to forcefully override stale DEGRADED in all clients
            setTimeout(() => {
                if (this.currentStatus.status === 'OPTIMAL') {
                    this.emit('system_status', { status: 'OPTIMAL', reason: 'OK', message: 'Sistemas operando normalmente.' });
                    console.log("🔄 [ScannerService] Secondary OPTIMAL broadcast sent");
                }
            }, 500);

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
