import { createClient } from '@supabase/supabase-js';
import { AIOpportunity } from '../core/types';
import { MLPerformanceStats } from '../core/types/types-advanced';
import { binanceStream } from './binanceStream';
import { telegramService } from './telegramService';
import { SmartFetch } from '../core/services/SmartFetch'; // Import SmartFetch for Proxy Polling
import EventEmitter from 'events';

// ... (Imports remain same)

class SignalAuditService extends EventEmitter {
    private supabase: any = null;
    private activeSignals: any[] = [];
    private auditInterval: NodeJS.Timeout | null = null;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private lastWSTick: number = Date.now(); // Heartbeat for Watchdog
    private lastPollSuccess: number = 0;
    private lastAuditError: string | null = null;
    private mlBrainStatus: MLPerformanceStats = {
        globalWinRate: 0,
        recentWinRate: 0,
        totalPredictions: 0,
        regimeStats: {},
        lastUpdated: 0,
        isDriftDetected: false
    };

    // CONSTANTES INSTITUCIONALES
    private readonly FEE_RATE = 0.001; // 0.1% (Maker/Taker blend estimate w/ BNB discount)
    private readonly SLIPPAGE_MARKET = 0.0005; // 0.05% slippage on market orders

    constructor() {
        super();
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_KEY = process.env.SUPABASE_KEY;

        if (SUPABASE_URL && SUPABASE_KEY) {
            this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        }
    }

    public async start() {
        console.log("🛡️ [SignalAudit] Auditoría de Señales Iniciada (Elite Mode: Stages & Real PnL).");

        // 1. Cargar señales PENDING/ACTIVE/PARTIAL_WIN de la base de datos
        await this.reloadActiveSignals();

        // 2. Suscribirse al stream binance
        binanceStream.subscribe((event) => {
            if (event.type === 'cvd_update') {
                this.processPriceTick(event.data.symbol, event.data.price);
            }
        });

        // 3. Proceso de expiración (cada 5m)
        this.auditInterval = setInterval(() => this.checkExpirations(), 5 * 60 * 1000);

        // 4. HYBRID WATCHDOG (Cada 30s)
        // Detects partial connection failure (Ghost WS) and switches to Polling
        this.healthCheckInterval = setInterval(() => this.checkHealthAndPoll(), 30 * 1000);
    }

    private async reloadActiveSignals() {
        if (!this.supabase) return;

        // "PARTIAL" is not a standard status yet, let's stick to existing + stage column logic
        // But for query simplicity, we load anything NOT Closed/Expired.
        const { data, error } = await this.supabase
            .from('signals_audit')
            .select('*')
            .in('status', ['PENDING', 'ACTIVE', 'OPEN', 'PARTIAL_WIN']); // Added PARTIAL_WIN

        if (!error && data) {
            this.activeSignals = data.map((sig: any) => {
                // Hydrate DCA if exists in technical_reasoning
                if (sig.technical_reasoning && sig.technical_reasoning.includes('{"dca":')) {
                    try {
                        const parts = sig.technical_reasoning.split(' | ');
                        const dcaData = JSON.parse(parts[0]);
                        sig.dcaPlan = dcaData.dca;
                    } catch (e) {
                        // console.error("Error parsing DCA:", e);
                    }
                }
                return sig;
            });
            console.log(`🛡️ [SignalAudit] Seguimiento activo de ${data.length} señales (DCA Hydrated).`);

            data.forEach((sig: any) => {
                const streamSymbol = sig.symbol.toLowerCase().replace('/', '') + '@aggTrade';
                binanceStream.addStream(streamSymbol);
            });
        }
    }

    private processingSignatures = new Set<string>();

    public getActiveSignals() {
        return this.activeSignals;
    }

    public async registerSignals(opportunities: AIOpportunity[]) {
        if (!this.supabase) return;

        for (const opp of opportunities) {
            const sigKey = `${opp.symbol}-${opp.side}`;

            if (this.processingSignatures.has(sigKey)) continue;

            // 1. SINGLE POSITION ENFORCEMENT (Professional Trader Rule)
            // No abrimos LONG si ya hay un LONG activo para este par.
            // Ignoramos deduplicación por estrategia. Un par = Una dirección.
            const existingPosition = this.activeSignals.find((s: any) =>
                s.symbol.replace('/', '') === opp.symbol.replace('/', '') &&
                ['PENDING', 'ACTIVE', 'OPEN', 'PARTIAL_WIN'].includes(s.status)
            );

            if (existingPosition) {
                // SINGLE POSITION ENFORCEMENT: Ignore new signal if we already have one.
                // Reversal logic removed to prevent "panting" / unprofessional flip-flopping.
                // The existing trade MUST run to SL or TP.
                continue;
            }

            this.processingSignatures.add(sigKey);

            // 2. CHECK DATABASE (Double check concurrency)
            const { count } = await this.supabase
                .from('signals_audit')
                .select('*', { count: 'exact', head: true })
                .eq('symbol', opp.symbol)
                .in('status', ['PENDING', 'ACTIVE', 'OPEN', 'PARTIAL_WIN']);

            if (count && count > 0) {
                this.processingSignatures.delete(sigKey);
                continue;
            }

            try {
                // SMART EXECUTION Check
                const entryTarget = opp.entryZone.currentPrice || opp.entryZone.max;
                const buffer = entryTarget * 0.003;
                const currentPrice = opp.entryZone.currentPrice || 0;

                let initialStatus = 'PENDING';
                let activationPrice = null;
                let fees = 0;

                // Entry logic (Market Execution Simulation)
                if (currentPrice > 0) {
                    const canEnterNow = (opp.side === 'LONG')
                        ? currentPrice <= (entryTarget + buffer)
                        : currentPrice >= (entryTarget - buffer);


                    if (canEnterNow) {
                        initialStatus = 'ACTIVE';
                        // REALITY CHECK: Apply Slippage
                        const slippageAmount = currentPrice * this.SLIPPAGE_MARKET;
                        activationPrice = (opp.side === 'LONG')
                            ? currentPrice + slippageAmount
                            : currentPrice - slippageAmount;

                        // Entry Fee
                        fees = (activationPrice * this.FEE_RATE);

                        console.log(`⚡ [SignalAudit] Market Entry: ${opp.symbol} @ $${activationPrice.toFixed(4)} (Slip: ${slippageAmount.toFixed(4)})`);
                    }
                }

                const payload = {
                    signal_id: opp.id,
                    symbol: opp.symbol,
                    side: opp.side,
                    status: initialStatus,
                    strategy: opp.strategy,
                    timeframe: opp.timeframe,
                    entry_price: entryTarget, // Plan Price
                    activation_price: activationPrice, // Real Execution Price
                    max_price_reached: activationPrice, // Initial extreme is entry
                    fees_paid: fees,
                    tp1: opp.takeProfits.tp1,
                    tp2: opp.takeProfits.tp2,
                    tp3: opp.takeProfits.tp3,
                    stop_loss: opp.stopLoss,
                    confidence_score: opp.confidenceScore,
                    ml_probability: opp.mlPrediction ? (opp.mlPrediction.probability / 100) : null,
                    stage: 0, // 0 = Entry Phase
                    created_at: Date.now(),
                    technical_reasoning: JSON.stringify({ dca: opp.dcaPlan || null }) + " | " + (opp.technicalReasoning || '')
                };

                const { data, error } = await this.supabase
                    .from('signals_audit')
                    .insert(payload)
                    .select();

                if (!error && data) {
                    this.activeSignals.push(data[0]);
                    const streamSymbol = opp.symbol.toLowerCase().replace('/', '') + '@aggTrade';
                    binanceStream.addStream(streamSymbol);
                    console.log(`✅ [SignalAudit] Registered: ${opp.symbol} ${opp.side} (PRO Strategy)`);
                }
            } finally {
                this.processingSignatures.delete(sigKey);
            }
        }
    }

    // handleReversal was removed to prevent unprofessional flip-flopping.

    private async processPriceTick(symbol: string, currentPrice: number) {
        this.lastWSTick = Date.now(); // Update Heartbeat

        if (this.activeSignals.length === 0) return;

        const signalsToUpdate = [];
        const sym = symbol.toUpperCase().replace('/', '');

        for (const signal of this.activeSignals) {
            if (signal.symbol.toUpperCase().replace('/', '') !== sym) continue;

            let updates: any = {};
            let shouldClose = false;

            // TRACKING: Always update current price & floating PnL for UI visibility
            // We use a throttle or significant change check to avoid DB spam, 
            // but for "Pro" feel we want fairly frequent updates (e.g. every 1% move or every 10 mins)
            // Ideally, we store "last_persisted_price" in memory to check delta.

            // FASE 1: Activation (PENDING -> ACTIVE)
            if (signal.status === 'PENDING' || signal.status === 'OPEN') {
                const entryPrice = signal.entry_price;
                const buffer = entryPrice * 0.003;

                const entryTouched = (signal.side === 'LONG')
                    ? currentPrice <= (entryPrice + buffer)
                    : currentPrice >= (entryPrice - buffer);

                if (entryTouched) {
                    updates.status = 'ACTIVE';
                    const slippage = currentPrice * 0.0002;
                    const realEntry = (signal.side === 'LONG') ? currentPrice + slippage : currentPrice - slippage;
                    updates.activation_price = realEntry;
                    updates.fees_paid = (realEntry * this.FEE_RATE);
                    updates.max_price_reached = realEntry;
                    updates.stage = 0;

                    // Init Floating PnL
                    updates.pnl_percent = this.calculateNetPnL(realEntry, currentPrice, signal.side, 0, 1.0); // Unrealized

                    console.log(`🚀 [SignalAudit] Filled E1: ${signal.symbol} @ $${realEntry.toFixed(4)}`);
                }
            }

            // FASE 2: Active Management (DCA & TP)
            const isActive = signal.status === 'ACTIVE' || updates.status === 'ACTIVE' || signal.status === 'PARTIAL_WIN';

            if (isActive) {
                const isLong = signal.side === 'LONG';
                const originalWAP = updates.activation_price || signal.activation_price || signal.entry_price;
                let currentWAP = originalWAP;
                const currentStage = signal.stage || 0; // 0=Fresh, 1=TP1 Hit, etc.
                const sl = signal.stop_loss;
                const { tp1, tp2, tp3 } = signal;

                // --- 2A: DCA ENTRY MANAGEMENT ---
                if (currentStage === 0 && signal.dcaPlan) {
                    const entries = signal.dcaPlan.entries || [];
                    const e2 = entries.find((e: any) => e.level === 2)?.price;
                    const e3 = entries.find((e: any) => e.level === 3)?.price;

                    // Entry 2 (30% weight)
                    if (e2 && !signal.e2_filled) {
                        const hitE2 = isLong ? currentPrice <= e2 : currentPrice >= e2;
                        if (hitE2) {
                            currentWAP = (originalWAP * 40 + e2 * 30) / 70;
                            updates.activation_price = currentWAP;
                            signal.e2_filled = true; // Session cache
                            updates.fees_paid = (signal.fees_paid || 0) + (e2 * this.FEE_RATE * 0.3); // Partial fee
                            console.log(`📡 [SignalAudit] DCA E2 Filled: ${signal.symbol} (New WAP: $${currentWAP.toFixed(4)})`);
                        }
                    }

                    // Entry 3 (30% weight)
                    if (e3 && signal.e2_filled && !signal.e3_filled) {
                        const hitE3 = isLong ? currentPrice <= e3 : currentPrice >= e3;
                        if (hitE3) {
                            currentWAP = (currentWAP * 70 + e3 * 30) / 100;
                            updates.activation_price = currentWAP;
                            signal.e3_filled = true;
                            updates.fees_paid = (signal.fees_paid || 0) + (e3 * this.FEE_RATE * 0.3);
                            console.log(`📡 [SignalAudit] DCA E3 Filled: ${signal.symbol} (Final WAP: $${currentWAP.toFixed(4)})`);
                        }
                    }
                }

                // --- 2B: EXTREME TRACKING ---
                const prevMax = signal.max_price_reached;
                const isNewExtreme = isLong ? (currentPrice > (prevMax || 0)) : (currentPrice < (prevMax || 999999));
                if (isNewExtreme) {
                    updates.max_price_reached = currentPrice;
                    signal.max_price_reached = currentPrice;
                }

                // --- 2C: SMART BREAKEVEN & STOP LOSS ---
                let effectiveSL = sl;
                if (currentStage >= 1) {
                    effectiveSL = currentWAP; // Breakeven after TP1
                }

                const slHit = isLong ? currentPrice <= effectiveSL : currentPrice >= effectiveSL;

                // Calculate Floating PnL for UI (Unrealized)
                // If partial closed, weight is less.
                const weightLeft = (currentStage === 0) ? 1.0 : (currentStage === 1 ? 0.6 : (currentStage === 2 ? 0.3 : 0));

                // For UI purposes, we want the "Trade PnL" (Realized + Unrealized) or just Unrealized of remaining?
                // Standard: Show "Net Position PnL".
                // We'll trust realized_pnl_percent + current floating.
                const floatingPnL = this.calculateNetPnL(currentWAP, currentPrice, signal.side, 0, weightLeft);
                const totalPnL = (signal.realized_pnl_percent || 0) + floatingPnL;

                // Update live metrics on object usually, but for DB we throttle.
                // However, to fix "stagnant UI", we force update if sufficient time passed or huge move.
                const lastSync = signal.last_sync || 0;
                if (Date.now() - lastSync > 30000) { // Sync every 30s
                    updates.last_sync = Date.now();
                    updates.final_price = currentPrice; // Use this as "Current Price" in UI
                    updates.pnl_percent = totalPnL; // Live PnL
                }

                if (slHit) {
                    shouldClose = true;
                    updates.status = currentStage > 0 ? 'WIN' : 'LOSS';
                    updates.final_price = currentPrice;
                    if (currentStage > 0) {
                        console.log(`🛡️ [SignalAudit] Smart Breakeven Hit: ${signal.symbol} (Secured Profit)`);
                    } else {
                        console.log(`⛔ [SignalAudit] Technical Stop Loss Hit: ${signal.symbol} @ $${currentPrice}`);
                    }
                } else {
                    // --- 2D: TP SEQUENTIAL MANAGEMENT ---
                    // TP1 (40% out)
                    if (currentStage < 1) {
                        const tp1Hit = isLong ? currentPrice >= tp1 : currentPrice <= tp1;
                        if (tp1Hit) {
                            updates.stage = 1;
                            updates.status = 'PARTIAL_WIN';
                            updates.realized_pnl_percent = this.calculateNetPnL(currentWAP, tp1, signal.side, 0, 0.4);
                            console.log(`💰 [SignalAudit] TP1 Hit: ${signal.symbol} (SL -> Breakeven Active)`);
                        }
                    }
                    // TP2 (30% out)
                    else if (currentStage < 2) {
                        const tp2Hit = isLong ? currentPrice >= tp2 : currentPrice <= tp2;
                        if (tp2Hit) {
                            updates.stage = 2;
                            const profit2 = this.calculateNetPnL(currentWAP, tp2, signal.side, 0, 0.3);
                            updates.realized_pnl_percent = (signal.realized_pnl_percent || 0) + profit2;
                            console.log(`💰💰 [SignalAudit] TP2 Hit: ${signal.symbol}`);
                        }
                    }
                    // TP3 (30% out / Final Moon)
                    else if (currentStage < 3) {
                        const tp3Hit = isLong ? currentPrice >= tp3 : currentPrice <= tp3;
                        if (tp3Hit) {
                            shouldClose = true;
                            updates.status = 'WIN';
                            updates.stage = 3;
                            const profit3 = this.calculateNetPnL(currentWAP, tp3, signal.side, 0, 0.3);
                            updates.pnl_percent = (signal.realized_pnl_percent || 0) + profit3;
                            console.log(`🚀🚀🚀 [SignalAudit] TP3 Target Reached: ${signal.symbol}`);
                        }
                    }
                }
            }

            if (Object.keys(updates).length > 0) {
                if (shouldClose) {
                    updates.closed_at = Date.now();
                    updates.final_price = currentPrice;

                    // Final PnL Fallback (if stopped at BE or SL)
                    if (updates.status !== 'WIN' || !updates.pnl_percent) {
                        const currentWAP = updates.activation_price || signal.activation_price || signal.entry_price;
                        const weightLeft = (signal.stage === 0) ? 1.0 : (signal.stage === 1 ? 0.6 : (signal.stage === 2 ? 0.3 : 0));
                        const finalChunk = this.calculateNetPnL(currentWAP, currentPrice, signal.side, currentPrice * this.FEE_RATE, weightLeft);
                        updates.pnl_percent = (signal.realized_pnl_percent || 0) + finalChunk;
                    }
                }

                updates.id = signal.id;
                signalsToUpdate.push(updates);
                Object.assign(signal, updates); // Sync cache
            }
        }

        if (signalsToUpdate.length > 0) {
            await this.syncUpdates(signalsToUpdate);
        }
    }

    private calculateNetPnL(entry: number, exit: number, side: string, fees: number, sizeRatio: number): number {
        const raw = ((exit - entry) / entry) * 100 * (side === 'LONG' ? 1 : -1);
        const feeRatio = 0.001; // 0.1% per trade
        return (raw - (feeRatio * 100)) * sizeRatio;
    }

    // ... (syncUpdates, checkExpirations, getRecentSignals, getPerformanceStats remain mostly same but updated headers)

    private async syncUpdates(updates: any[]) {
        for (const upd of updates) {
            // PRO INTEGRITY GATE: Force WIN to LOSS if net PnL is negative (prevents accounting errors in UI)
            if (upd.status === 'WIN' && (upd.pnl_percent || 0) <= 0) {
                console.warn(`🛡️ [SignalAudit] Integrity Guard: Converting WIN to LOSS for ${upd.id} due to non-positive PnL (${upd.pnl_percent?.toFixed(2)}%)`);
                upd.status = 'LOSS';
            }

            // Remove internal memory-only fields before sending to Supabase
            // 'last_sync' is acceptable if we added column, otherwise we should check schema. 
            // Assuming 'final_price' and 'pnl_percent' exist. 
            // We strip 'last_sync' from supabase payload to be safe unless we added it. 
            // Actually, we can just keep last_sync in memory `signal` object and not send to DB if it's not a column.

            const { id, last_sync, ...data } = upd;

            const { error } = await this.supabase
                .from('signals_audit')
                .update(data)
                .eq('id', id);

            if (!error && (upd.status === 'WIN' || upd.status === 'LOSS')) {
                const finalPnL = upd.pnl_percent || 0;
                this.activeSignals = this.activeSignals.filter((s: any) => s.id !== upd.id);
                console.log(`🎯 [SignalAudit] CERRADA (${upd.status}): ${upd.id} | Net PnL: ${finalPnL.toFixed(2)}%`);

                // ML FEEDBACK LOOP: Update model_predictions outcome
                this.updateMLOutcome(upd.id, finalPnL, upd.status).catch(e =>
                    console.error(`⚠️ [ML-Audit] Failed to sync outcome:`, e)
                );
            }
        }
    }

    /**
     * Finds the nearest ML prediction for this signal and updates its outcome
     */
    private async updateMLOutcome(signalId: string, pnl: number, status: string) {
        // Find the signal in the DB to get symbol and timestamp
        const { data: signal } = await this.supabase
            .from('signals_audit')
            .select('symbol, created_at, side')
            .eq('id', signalId)
            .single();

        if (!signal) return;

        // Find nearest prediction in a 5-minute window
        const windowMs = 5 * 60 * 1000;
        const startTime = signal.created_at - windowMs;
        const endTime = signal.created_at + windowMs;

        const { data: predictions } = await this.supabase
            .from('model_predictions')
            .select('id, predicted_price')
            .eq('symbol', signal.symbol)
            .gte('prediction_time', startTime)
            .lte('prediction_time', endTime)
            .order('prediction_time', { ascending: false });

        if (predictions && predictions.length > 0) {
            // Update the most recent one in that window
            const pred = predictions[0];

            // Accuracy Logic: 
            // If WIN -> Outcome = 1 (IA was right)
            // If LOSS -> Outcome = 0 (IA was wrong)
            // Or use PnL directly for regression models
            const outcome = status === 'WIN' ? 1 : 0;

            await this.supabase
                .from('model_predictions')
                .update({ actual_outcome: outcome })
                .eq('id', pred.id);

            console.log(`🧠 [ML-Audit] Loop Closed: Prediction ${pred.id} marked as ${outcome === 1 ? 'ACCURATE' : 'INACCURATE'} (PnL: ${pnl.toFixed(2)}%)`);
        }
    }

    // ...

    private async checkExpirations() {
        if (this.activeSignals.length === 0) return;
        const signalsToUpdate = [];
        for (const signal of this.activeSignals) {
            // Only expire PENDING signals. Once ACTIVE, they must hit SL or TP.
            if (signal.status === 'PENDING' || signal.status === 'OPEN') {
                const ageHours = (Date.now() - Number(signal.created_at)) / (1000 * 60 * 60);
                const limit = signal.timeframe === '15m' ? 4 : 72; // Increased to 72h
                if (ageHours > limit) {
                    console.log(`⌛ [SignalAudit] Expiring stale signal: ${signal.symbol}`);
                    signalsToUpdate.push({
                        id: signal.id,
                        status: 'EXPIRED',
                        closed_at: Date.now(),
                        final_price: signal.entry_price,
                        pnl_percent: 0,
                        fees_paid: 0
                    });
                }
            }
        }
        if (signalsToUpdate.length > 0) this.syncUpdates(signalsToUpdate);
    }

    // Legacy support methods (getRecentSignals, getPerformanceStats) - kept for UI compat
    public async getRecentSignals(limit: number = 10) {
        if (!this.supabase) return [];
        const { data, error } = await this.supabase
            .from('signals_audit')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error || !data) return [];

        const combined = [...this.activeSignals, ...data];

        // Ensure numeric fields are non-null for UI safety (toFixed crash prevention)
        const sanitized = combined.map(sig => ({
            ...sig,
            pnl_percent: sig.pnl_percent ?? 0,
            realized_pnl_percent: sig.realized_pnl_percent ?? 0,
            final_price: sig.final_price ?? sig.entry_price ?? 0,
            fees_paid: sig.fees_paid ?? 0
        }));

        const unique = Array.from(new Map(sanitized.map(item => [item.id, item])).values());

        return unique.sort((a: any, b: any) => {
            const scoreA = ['ACTIVE', 'PARTIAL_WIN'].includes(a.status) ? 1 : 0;
            const scoreB = ['ACTIVE', 'PARTIAL_WIN'].includes(b.status) ? 1 : 0;
            if (scoreA !== scoreB) return scoreB - scoreA;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }

    public async getPerformanceStats() {
        if (!this.supabase) return { winRate: 0, total: 0, wins: 0, closed: 0, open: 0, profitFactor: 0 };
        const { data, error } = await this.supabase.from('signals_audit').select('status, pnl_percent');
        if (error || !data) return { winRate: 0, total: 0, wins: 0, closed: 0, open: 0, profitFactor: 0 };

        const closed = data.filter((s: any) => ['WIN', 'LOSS', 'PARTIAL_WIN'].includes(s.status));
        const winsCount = closed.filter((s: any) => ['WIN', 'PARTIAL_WIN'].includes(s.status)).length;

        let grossProfit = 0, grossLoss = 0;
        closed.forEach((s: any) => {
            const pnl = s.pnl_percent || 0;
            if (pnl > 0) grossProfit += pnl; else grossLoss += Math.abs(pnl);
        });
        const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 99 : 0);

        return {
            total: data.length,
            closed: closed.length,
            wins: winsCount,
            winRate: closed.length > 0 ? (winsCount / closed.length) * 100 : 0,
            open: data.filter((s: any) => ['OPEN', 'ACTIVE', 'PENDING', 'PARTIAL_WIN'].includes(s.status)).length,
            profitFactor: Number(profitFactor.toFixed(2)),
            // Diagnostic Metadata
            techInfo: {
                lastWSTick: this.lastWSTick,
                lastPollSuccess: this.lastPollSuccess,
                lastError: this.lastAuditError,
                isWSAlive: (Date.now() - this.lastWSTick) < 60000,
                activeTrackingCount: this.activeSignals.length
            }
        };
    }

    /**
     * MANUAL AUDIT PASS (Diagnostic/Recovery)
     * Allows forcing a poll cycle via API or Scheduler.
     */
    public async forceAuditPass() {
        console.log("🚑 [SignalAudit] Manual Audit Pass Triggered...");
        return await this.checkHealthAndPoll(true);
    }

    /**
     * GOD MODE: ADVANCED ML ANALYTICS
     * Calculates model accuracy, regime-specific affinity and drift.
     */
    public async getAdvancedMLMetrics() {
        if (!this.supabase) return this.mlBrainStatus;

        // Cache check (15m TTL)
        if (Date.now() - this.mlBrainStatus.lastUpdated < 15 * 60 * 1000 && this.mlBrainStatus.lastUpdated !== 0) {
            return this.mlBrainStatus;
        }

        try {
            const { data, error } = await this.supabase
                .from('model_predictions')
                .select('actual_outcome, market_regime, probability, signal')
                .not('actual_outcome', 'is', null)
                .order('prediction_time', { ascending: false })
                .limit(200);

            if (error || !data || data.length === 0) return this.mlBrainStatus;

            const total = data.length;
            const wins = data.filter((p: any) => p.actual_outcome === 1).length;
            const winRate = (wins / total) * 100;

            // Regime Analysis
            const regimes: Record<string, { total: number, wins: number, rate: number }> = {};
            data.forEach((p: any) => {
                const r = p.market_regime || 'UNKNOWN';
                if (!regimes[r]) regimes[r] = { total: 0, wins: 0, rate: 0 };
                regimes[r].total++;
                if (p.actual_outcome === 1) regimes[r].wins++;
            });

            Object.keys(regimes).forEach(k => {
                regimes[k].rate = (regimes[k].wins / regimes[k].total) * 100;
            });

            // Drift Detection (Last 20 vs Last 200)
            const recent = data.slice(0, 20);
            const recentWins = recent.filter((p: any) => p.actual_outcome === 1).length;
            const recentRate = (recentWins / recent.length) * 100;
            const isDriftDetected = total > 40 && (recentRate < winRate - 15);

            this.mlBrainStatus = {
                globalWinRate: Number(winRate.toFixed(2)),
                recentWinRate: Number(recentRate.toFixed(2)),
                regimeStats: regimes,
                totalPredictions: total,
                isDriftDetected,
                lastUpdated: Date.now()
            };

            console.log(`🧠 [ML-Audit] Advanced Stats Updated: ${winRate.toFixed(2)}% Accuracy | Drift: ${isDriftDetected ? '⚠️ YES' : '✅ NO'}`);
            return this.mlBrainStatus;

        } catch (e) {
            console.error("❌ [ML-Audit] Failed to calculate advanced metrics:", e);
            return this.mlBrainStatus;
        }
    }

    /**
     * Retrieves recent signal history for a specific symbol.
     * Used by FilterEngine for Apex Whipsaw protection.
     */
    public async getRecentSymbolHistory(symbol: string, hours: number = 4) {
        if (!this.supabase) return [];
        const since = Date.now() - (hours * 60 * 60 * 1000);

        try {
            const { data, error } = await this.supabase
                .from('signals_audit')
                .select('side, status, closed_at, pnl_percent')
                .eq('symbol', symbol)
                .gte('created_at', since)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error(`❌ [SignalAudit] Error fetching history for ${symbol}:`, e);
            return [];
        }
    }

    private async checkHealthAndPoll(force: boolean = false) {
        const timeSinceLastTick = Date.now() - this.lastWSTick;
        const SILENCE_THRESHOLD = 45000; // 45 Seconds of silence = BROKEN

        if (force || (timeSinceLastTick > SILENCE_THRESHOLD && this.activeSignals.length > 0)) {
            if (!force) {
                console.warn(`⚠️ [SignalAudit] WS Silence Detected (${(timeSinceLastTick / 1000).toFixed(0)}s). Engaging Proxy Polling...`);
            }

            try {
                const allPrices = await SmartFetch.get<any[]>('https://fapi.binance.com/fapi/v1/ticker/price');

                if (Array.isArray(allPrices)) {
                    const priceMap = new Map(allPrices.map(p => [p.symbol, parseFloat(p.price)]));
                    let updatesCount = 0;

                    for (const signal of this.activeSignals) {
                        try {
                            const symbolRaw = signal.symbol.replace('/', '');
                            const price = priceMap.get(symbolRaw);

                            if (price) {
                                await this.processPriceTick(signal.symbol, price);
                                updatesCount++;
                            }
                        } catch (signalErr: any) {
                            console.error(`❌ [SignalAudit] Error processing ${signal.symbol}:`, signalErr.message);
                        }
                    }

                    this.lastPollSuccess = Date.now();
                    this.lastAuditError = null;
                    console.log(`🚑 [SignalAudit] Audit Pass Complete: Updated ${updatesCount} signals.`);

                    if (!force) this.lastWSTick = Date.now();
                    return { success: true, updated: updatesCount };
                }
            } catch (e: any) {
                this.lastAuditError = e.message;
                console.error(`❌ [SignalAudit] Audit Pass Failed: ${e.message}`);
                return { success: false, error: e.message };
            }
        }
        return { success: true, status: 'No pass needed' };
    }
}

export const signalAuditService = new SignalAuditService();
