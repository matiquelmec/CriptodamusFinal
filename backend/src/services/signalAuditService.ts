import { createClient } from '@supabase/supabase-js';
import { AIOpportunity } from '../core/types';
import { MLPerformanceStats } from '../core/types/types-advanced';
import { binanceStream } from './binanceStream';
import { systemAlerts } from './systemAlertService';
import { telegramService } from './telegramService';
import { SmartFetch } from '../core/services/SmartFetch'; // Import SmartFetch for Proxy Polling
import EventEmitter from 'events';

import { calculateRSIArray } from '../core/services/mathUtils';

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
            // TRACKING RECOVERY: Listen to any event with symbol and price for real-time tracking
            if (event.data && event.data.symbol && event.data.price) {
                this.processPriceTick(event.data.symbol, event.data.price);
            }
        });

        // 3. Proceso de expiración + Advanced Exits (cada 2 min)
        this.auditInterval = setInterval(() => {
            this.checkExpirations(); // Legacy: solo PENDING signals
            this.checkAdvancedExits(); // NEW: Hybrid exit system (reversal, momentum, trailing, time decay)
        }, 2 * 60 * 1000); // Increased frequency for time-sensitive exits

        // 4. HYBRID WATCHDOG (Cada 30s)
        // Detects partial connection failure (Ghost WS) and switches to Polling
        this.healthCheckInterval = setInterval(() => this.checkHealthAndPoll(), 30 * 1000);

        // 5. PRICE CONSENSUS (Every 3 min)
        // Fetches a random active signal's price via REST to verify stream integrity
        setInterval(() => this.runConsensusCheck(), 3 * 60 * 1000);
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

    /**
     * Force an immediate emit of active trades (for new WS connections)
     */
    public getActiveSignalsSnapshot() {
        return this.activeSignals;
    }



    private sessionStartTime = Date.now(); // NEW: To distinguish legacy vs new signals
    private recentClosures = new Map<string, number>(); // COOLDOWN: Track closed trades to prevent "Machine Gun" re-entry

    public async registerSignals(opportunities: AIOpportunity[]) {
        if (!this.supabase) return;

        // COOLDOWN CONFIG: 60 Minutes
        const COOLDOWN_MS = 60 * 60 * 1000;

        for (const opp of opportunities) {
            const sigKey = `${opp.symbol}-${opp.side}`;

            if (this.processingSignatures.has(sigKey)) continue;

            // 0. COOLDOWN CHECK (Prevent Machine Gun Logic)
            const lastClosed = this.recentClosures.get(sigKey);
            if (lastClosed) {
                if (Date.now() - lastClosed < COOLDOWN_MS) {
                    // Still in cooldown
                    // console.log(`❄️ [SignalAudit] Cooldown active for ${sigKey} (${((COOLDOWN_MS - (Date.now() - lastClosed))/60000).toFixed(0)}m left)`);
                    continue;
                } else {
                    this.recentClosures.delete(sigKey); // Expired
                }
            }

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
                    // 3. SANITY CHECK: Ensure we are not entering into a trade that is ALREADY lost or won.
                    // If Market Price is already below SL (Long) or above SL (Short), ABORT.
                    // If Market Price is already above TP1 (Long) or below TP1 (Short), ABORT (or take profit instantly? No, unprofessional).

                    const isInstantSL = (opp.side === 'LONG' ? currentPrice <= opp.stopLoss : currentPrice >= opp.stopLoss);
                    const isInstantTP = (opp.side === 'LONG' ? currentPrice >= opp.takeProfits.tp1 : currentPrice <= opp.takeProfits.tp1);

                    if (isInstantSL) {
                        console.warn(`⛔ [SignalAudit] REJECTED Instant-Entry: Price ($${currentPrice}) is already past SL ($${opp.stopLoss})`);
                        initialStatus = 'REJECTED_RISK';
                    } else if (isInstantTP) {
                        console.warn(`⚠️ [SignalAudit] REJECTED Instant-Entry: Price ($${currentPrice}) is already past TP1 ($${opp.takeProfits.tp1})`);
                        initialStatus = 'REJECTED_LATE';
                    }
                }

                // TRACKING MODE: Force PENDING status initially.
                // Let processPriceTick() handle the activation logic consistently.
                // This ensures we "track" the price to the entry zone rather than jumping in.
                if (initialStatus !== 'REJECTED_RISK' && initialStatus !== 'REJECTED_LATE') {
                    initialStatus = 'PENDING';
                }

                if (initialStatus.includes('REJECTED')) return; // Do not register bad trades

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

                    // 🔔 TELEGRAM ALERT
                    const { telegramService } = await import('./telegramService');
                    // We send the single opportunity as an array
                    // Check if it's worthy (score etc checked inside)
                    telegramService.broadcastSignals([opp]);
                }
            } finally {
                this.processingSignatures.delete(sigKey);
            }
        }
    }

    // handleReversal was removed to prevent unprofessional flip-flopping.

    // handleReversal was removed to prevent unprofessional flip-flopping.

    private async processPriceTick(symbol: string, currentPrice: number) {
        this.lastWSTick = Date.now(); // Update Heartbeat

        // --- STAGE 0: ATOMIC TICK INTEGRITY ---
        if (!currentPrice || Number.isNaN(currentPrice) || currentPrice <= 0 || typeof currentPrice !== 'number') {
            // Low priority log for legacy tick skips
            return;
        }

        if (this.activeSignals.length === 0) return;

        const signalsToUpdate: any[] = [];
        const sym = symbol.toUpperCase().replace('/', '');

        for (const signal of this.activeSignals) {
            if (signal.symbol.toUpperCase().replace('/', '') !== sym) continue;

            const isLegacy = signal.created_at < this.sessionStartTime; // Check age

            // FIX: Initialize updates with SYMBOL to prevent "UNKNOWN" in alerts
            let updates: any = { symbol: signal.symbol };
            let shouldClose = false;

            try {
                // TRACKING: Always update current price & floating PnL for UI visibility
                // We use a throttle or significant change check to avoid DB spam, 
                // but for "Pro" feel we want fairly frequent updates (e.g. every 1% move or every 10 mins)
                // Ideally, we store "last_persisted_price" in memory to check delta.

                // FASE 0: LIVE MEMORY UPDATE (For WebSocket Real-time)
                signal.last_price = currentPrice;

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

                        // NEW: Store buffer distance for Smart Beakeven validation
                        const bufferPercent = (await import('../core/config/tradingConfig')).TradingConfig.risk.safety.smart_breakeven_buffer_percent || 0.15;
                        signal.smart_be_buffer = realEntry * (bufferPercent / 100);
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
                    // Fix: Legacy/Sync check - If status implies progress but stage is 0, force stage.
                    const derivedStage = (signal.status === 'PARTIAL_WIN' && (!signal.stage || signal.stage < 1)) ? 1 : (signal.stage || 0);
                    const currentStage = derivedStage;
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
                        // updates.max_price_reached = currentPrice; // REMOVED: Too spammy for DB/WS
                        signal.max_price_reached = currentPrice; // Keep Memory Updated for Trailing Stop Logic (Robust)
                    }

                    // --- 2C: PROFESSIONAL DYNAMIC RISK (Smart BE + Trailing Stop) ---
                    let effectiveSL = sl;

                    if (currentStage >= 1) {
                        // TIME LOCK: Don't trail in first 2 hours (let trade breathe)
                        const tradeAgeHours = (Date.now() - new Date(signal.created_at).getTime()) / (1000 * 60 * 60);
                        const MIN_AGE_FOR_TRAILING = 2; // Professional standard

                        if (tradeAgeHours < MIN_AGE_FOR_TRAILING) {
                            effectiveSL = sl; // Keep initial SL
                            // console.log(`⏳ [Time-Lock] ${signal.symbol}: Trade too young for trailing (${tradeAgeHours.toFixed(1)}h < ${MIN_AGE_FOR_TRAILING}h)`);
                        } else {
                            // 1. FUNDAMENTAL: Smart Breakeven (Entry + Fees)
                            const buffer = signal.smart_be_buffer || (currentWAP * 0.0015);
                            const smartBE = isLong ? currentWAP + buffer : currentWAP - buffer;

                            // 2. ADVANCED: Dynamic Trailing Stop (ATR-Based, Not % Fixed)
                            let trailingSL = sl;

                            // CRITICAL: Read from Config (No Hardcoded Values)
                            const { TradingConfig } = await import('../core/config/tradingConfig');
                            const TRAILING_ACTIVATION = TradingConfig.exit_strategy.trailing_stop.min_profit_to_activate / 100; // 2.5% → 0.025
                            const TRAILING_DISTANCE_ATR = TradingConfig.exit_strategy.trailing_stop.atr_distance; // 2.0

                            const maxPrice = signal.max_price_reached || currentPrice;
                            const peakProfitPct = isLong
                                ? (maxPrice - currentWAP) / currentWAP
                                : (currentWAP - maxPrice) / currentWAP;

                            if (peakProfitPct >= TRAILING_ACTIVATION) {
                                // Use ATR for dynamic distance (not fixed %)
                                const atr = signal.atr || (currentPrice * 0.01); // Fallback: 1% of price
                                const trailDistance = atr * TRAILING_DISTANCE_ATR; // e.g. 2 × ATR

                                // Calculate Trail Level (absolute price, not percentage)
                                const trailLevel = isLong
                                    ? maxPrice - trailDistance
                                    : maxPrice + trailDistance;

                                trailingSL = trailLevel;
                                // console.log(`🏃 [Trailing] ${signal.symbol}: Peak +${(peakProfitPct*100).toFixed(2)}% → Trail SL: $${trailLevel.toFixed(2)} (ATR ${atr.toFixed(2)})`);
                            }

                            // 3. RATCHET SYSTEM + ANTI-WHIPSAW FILTER
                            // Winner takes all: We take the BEST (Tightest) SL among:
                            // - Current SL (Memory)
                            // - Smart Breakeven (Floor)
                            // - Dynamic Trailing (Ceiling)
                            // BUT NEVER LOOSEN RISK.

                            if (isLong) {
                                // Long: Higher is Safer.
                                const bestNewSL = Math.max(smartBE, trailingSL);

                                // ANTI-WHIPSAW: Only move if improvement is significant (0.5% min)
                                const improvement = (bestNewSL - sl) / currentWAP;
                                if (improvement > 0.005) {
                                    effectiveSL = bestNewSL;
                                    // console.log(`📈 [SL-Move] ${signal.symbol}: $${sl.toFixed(2)} → $${bestNewSL.toFixed(2)} (+${(improvement*100).toFixed(2)}%)`);
                                } else {
                                    effectiveSL = sl; // Keep current (noise filter)
                                    // console.log(`🔇 [Noise-Filter] ${signal.symbol}: SL unchanged (improvement ${(improvement*100).toFixed(2)}% < 0.5%)`);
                                }
                            } else {
                                // Short: Lower is Safer.
                                const bestNewSL = Math.min(smartBE, trailingSL);
                                const improvement = (sl - bestNewSL) / currentWAP;
                                if (improvement > 0.005) {
                                    effectiveSL = bestNewSL;
                                } else {
                                    effectiveSL = sl;
                                }
                            }
                        }
                    }

                    // --- 2D: TIME DECAY (Professional Exit Management) ---
                    // Force Breakeven if trade is open > 12h without hitting TP1
                    // This prevents "zombie trades" that consume mental capital
                    if (currentStage === 0 && signal.created_at) {
                        const tradeAgeHours = (Date.now() - new Date(signal.created_at).getTime()) / (1000 * 60 * 60);
                        const TIME_DECAY_HOURS = 12; // From TradingConfig

                        if (tradeAgeHours >= TIME_DECAY_HOURS) {
                            const buffer = signal.smart_be_buffer || (currentWAP * 0.0015);
                            const forcedBE = isLong ? currentWAP + buffer : currentWAP - buffer;

                            // If current price is profitable enough to at least break even
                            const canBreakeven = isLong
                                ? currentPrice >= forcedBE
                                : currentPrice <= forcedBE;

                            if (canBreakeven) {
                                console.log(`⏰ [Time-Decay] ${signal.symbol}: 12h limit reached. Forcing Breakeven Exit.`);
                                shouldClose = true;
                                updates.status = 'WIN'; // Technically BE = tiny win (covers fees)
                                updates.final_price = currentPrice;
                                updates.exit_reason = 'Time Decay (12h Breakeven Rule)';
                                updates.pnl_percent = this.calculateNetPnL(currentWAP, currentPrice, signal.side, 0, 1.0);
                            } else {
                                // Not profitable enough to break even, move SL to BE and let it close naturally
                                if (isLong ? effectiveSL < forcedBE : effectiveSL > forcedBE) {
                                    effectiveSL = forcedBE;
                                    signal.stop_loss = forcedBE;
                                    updates.stop_loss = forcedBE;
                                    console.log(`⏰ [Time-Decay] ${signal.symbol}: Moving SL to Breakeven after 12h.`);
                                }
                            }
                        }
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

                    // LIVE MEMORY UPDATE (For WebSocket)
                    signal.pnl_percent = totalPnL;

                    // CRITICAL: Update visible SL in UI to reflect Smart Breakeven
                    if (effectiveSL !== sl) {
                        signal.stop_loss = effectiveSL;
                        updates.stop_loss = effectiveSL; // FIX: Persist to DB

                        // Notify if this is the first time we move to BE
                        // (We compare against original SL to avoid spamming every tick if float changes slightly)
                        if (Math.abs(effectiveSL - (signal.activation_price || signal.entry_price)) < (currentWAP * 0.01)) {
                            // This is likely the "Move to BE" moment
                            // To avoid spam, we could check if we already alerted, but for now 
                            // updates.stop_loss causing a DB write is good. 
                            // Let's add a console log at least.
                            // console.log(`🛡️ [SignalAudit] ${signal.symbol}: Moving SL to Breakeven (${effectiveSL})`);
                        }
                    }

                    const lastSync = signal.last_sync || 0;
                    if (Date.now() - lastSync > 30000) { // Sync every 30s
                        updates.last_sync = Date.now();
                        updates.final_price = currentPrice; // Use this as "Current Price" in UI
                        updates.pnl_percent = totalPnL; // Persist PnL
                        updates.max_price_reached = signal.max_price_reached; // Persist Extreme High/Low (Efficient Batching)

                        // SELF-HEALING: Force SL sync every 30s to correct drift
                        // This ensures backend memory and DB are always consistent.
                        updates.stop_loss = signal.stop_loss;

                        // NEW: Retroactive Integrity Fix (For migrated/restarted trades)
                        // If status is SECURED (PARTIAL_WIN/WIN) but SL is still in LOSS zone, FORCE it to Smart Breakeven.
                        if ((signal.status === 'PARTIAL_WIN' || signal.status === 'WIN') && signal.entry_price) {
                            const isLong = signal.side === 'LONG';
                            const feeBuffer = 0.0015; // 0.15% to cover fees + tiny profit

                            // Calculate Professional Smart BE
                            const smartBE = isLong
                                ? signal.entry_price * (1 + feeBuffer)
                                : signal.entry_price * (1 - feeBuffer);

                            const isSecured = isLong ? signal.stop_loss >= smartBE : signal.stop_loss <= smartBE;

                            if (!isSecured) {
                                console.warn(`🛡️ [Integrity-Fix] Upgrading Secured Trade ${signal.symbol} to Smart BE ($${smartBE}).`);
                                signal.stop_loss = smartBE;
                                updates.stop_loss = smartBE;
                            }
                        }
                    }

                    if (slHit) {
                        shouldClose = true;
                        updates.status = currentStage > 0 ? 'WIN' : 'LOSS';
                        updates.final_price = currentPrice;
                        updates.pnl_percent = totalPnL; // FIX: Ensure PnL is passed to Integrity Guard

                        if (currentStage > 0) {
                            console.log(`🛡️ [SignalAudit] Smart Breakeven Hit: ${signal.symbol} (Secured Profit: ${totalPnL.toFixed(2)}%)`);
                            telegramService.sendUpdateAlert('SL_MOVED', {
                                symbol: signal.symbol,
                                oldSl: signal.stop_loss,
                                newSl: updates.final_price,
                                reason: 'Smart Breakeven (Profit Secured)',
                                pnl: totalPnL.toFixed(2)
                            });
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
                                const realPnL = this.calculateNetPnL(currentWAP, tp1, signal.side, 0, 0.50);
                                updates.realized_pnl_percent = realPnL;
                                signal.realized_pnl_percent = realPnL; // FIX: Update memory for next tick calculation
                                signal.stage = 1; // Sync stage to memory immediately

                                // FORCE SL TO BREAKEVEN (Safety Net)
                                // If TP1 is hit, we MUST ensure the stop is at least at entry + fees.
                                // FIX: Use currentWAP (Real execution price) + 0.2% Buffer to guarantee Green PnL.
                                const baseEntry = currentWAP || signal.activation_price || signal.entry_price;
                                const feeBuffer = baseEntry * 0.002; // 0.2% to cover open+close fees

                                if (baseEntry) {
                                    // Smart BE: Entry +/- Buffer
                                    const smartBE = isLong ? (baseEntry + feeBuffer) : (baseEntry - feeBuffer);

                                    // Make sure we don't move SL *worse* if it's already better (e.g. trailing stop is higher).
                                    // For LONG: We want MAX(currentSL, smartBE)
                                    // For SHORT: We want MIN(currentSL, smartBE)
                                    const betterSL = isLong ? Math.max(signal.stop_loss, smartBE) : Math.min(signal.stop_loss, smartBE);

                                    if (betterSL !== signal.stop_loss) {
                                        updates.stop_loss = betterSL;
                                        signal.stop_loss = betterSL; // Update memory too
                                        console.log(`🛡️ [TP1-Trigger] Forcing SL to Smart Breakeven (Entry+Fees): ${betterSL.toFixed(4)}`);
                                    }
                                }

                                console.log(`💰 [SignalAudit] TP1 Hit: ${signal.symbol} (50% Secured | Smart Breakeven Active)`);
                                telegramService.sendUpdateAlert('TP_HIT', {
                                    symbol: signal.symbol,
                                    stage: 1,
                                    price: tp1,
                                    pnl: updates.realized_pnl_percent.toFixed(2),
                                    // Add the new SL to the alert context if useful for debugging
                                    newSl: updates.stop_loss
                                });
                            }
                        }
                        // TP2 (30% out)
                        else if (currentStage < 2) {
                            const tp2Hit = isLong ? currentPrice >= tp2 : currentPrice <= tp2;
                            if (tp2Hit) {
                                updates.stage = 2;
                                const profit2 = this.calculateNetPnL(currentWAP, tp2, signal.side, 0, 0.3);
                                const newRealized = (signal.realized_pnl_percent || 0) + profit2;
                                updates.realized_pnl_percent = newRealized;
                                signal.realized_pnl_percent = newRealized; // FIX: Update memory
                                signal.stage = 2;
                                console.log(`💰💰 [SignalAudit] TP2 Hit: ${signal.symbol}`);
                                telegramService.sendUpdateAlert('TP_HIT', {
                                    symbol: signal.symbol,
                                    stage: 2,
                                    price: tp2,
                                    pnl: profit2.toFixed(2)
                                });
                            }
                        }
                        // TP3 (30% out / Final Moon)
                        else if (currentStage < 3) {
                            const tp3Hit = isLong ? currentPrice >= tp3 : currentPrice <= tp3;
                            if (tp3Hit) {
                                shouldClose = true;
                                updates.status = 'WIN';
                                updates.stage = 3;
                                const profit3 = this.calculateNetPnL(currentWAP, tp3, signal.side, 0, 0.20); // 20% Moonbag
                                updates.pnl_percent = (signal.realized_pnl_percent || 0) + profit3;
                                console.log(`🚀🚀🚀 [SignalAudit] TP3 Target Reached: ${signal.symbol}`);
                            }
                        }
                    }
                }
            } catch (err: any) {
                systemAlerts.logAlert({
                    symbol: signal.symbol,
                    severity: 'CRITICAL',
                    category: 'CALCULATION_ERROR',
                    message: `CRITICAL_TRADE_UPDATE_ERROR: ${err.message}`
                });

                // PROTOCOLO DE SEGURIDAD: Si falla el cálculo, NO PODEMOS CONFIAR en la señal.
                updates.status = 'ERROR_HALT';
                updates.technical_reasoning = `${signal.technical_reasoning || ''} | [SYSTEM] Halted due to calculation error: ${err.message}`;
                shouldClose = false;
            }

            if (Object.keys(updates).length > 0) {
                if (shouldClose) {
                    updates.closed_at = Date.now();
                    updates.final_price = currentPrice;

                    // Final PnL Fallback (if stopped at BE or SL)
                    if (updates.status !== 'WIN' || !updates.pnl_percent) {
                        const currentWAP = updates.activation_price || signal.activation_price || signal.entry_price;
                        const weightLeft = (signal.stage === 0) ? 1.0 : (signal.stage === 1 ? 0.5 : (signal.stage === 2 ? 0.2 : 0));
                        const finalChunk = this.calculateNetPnL(currentWAP, currentPrice, signal.side, currentPrice * this.FEE_RATE, weightLeft);
                        updates.pnl_percent = (signal.realized_pnl_percent || 0) + finalChunk;
                    }
                }

                updates.id = signal.id;
                updates.created_at = signal.created_at; // Pass for legacy check
                updates.side = signal.side; // Pass for Cooldown cache
                signalsToUpdate.push(updates);

                // Clean updates object before assigning to memory to avoid duplicates? No, created_at is fine.
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

    // --- KERNEL SECURITY UTILS ---

    /**
     * Calculates the Net PnL (Realized + Floating) for the current UTC day.
     * Used by RiskEngine to enforce the -5% Daily Stop Loss.
     */
    public async getDailyAccountPnL(initialBalance: number = 1000): Promise<number> {
        if (!this.supabase) return 0;

        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const startTimestamp = startOfDay.getTime();

        // 1. Get closed trades for today
        const { data: closed } = await this.supabase
            .from('signals_audit')
            .select('pnl_percent')
            .gte('closed_at', startTimestamp); // trades closed today

        let dailyRealizedPnL = 0;
        if (closed) {
            dailyRealizedPnL = closed.reduce((acc: number, curr: any) => acc + (curr.pnl_percent || 0), 0);
        }

        // 2. Get floating PnL from active trades
        // We iterate memory activeSignals for speed
        const floatingPnL = this.activeSignals.reduce((acc: number, curr: any) => acc + (curr.pnl_percent || 0), 0);

        // Total Daily PnL
        return dailyRealizedPnL + floatingPnL;
    }

    public async getTotalAccumulatedPnL(): Promise<number> {
        if (!this.supabase) return 0;

        // Sum of ALL closed trades forever
        const { data: allClosed } = await this.supabase
            .from('signals_audit')
            .select('pnl_percent')
            .not('closed_at', 'is', null);

        let totalRealized = 0;
        if (allClosed) {
            totalRealized = allClosed.reduce((acc: number, curr: any) => acc + (curr.pnl_percent || 0), 0);
        }

        // Add current floating
        const floatingPnL = this.activeSignals.reduce((acc: number, curr: any) => acc + (curr.pnl_percent || 0), 0);

        return totalRealized + floatingPnL;
    }

    private async syncUpdates(updates: any[]) {
        for (const upd of updates) {
            // PRO INTEGRITY GATE: Force WIN to LOSS if net PnL is negative (prevents accounting errors in UI)
            if (upd.status === 'WIN' && (upd.pnl_percent || 0) <= 0) {
                // Only warn loudly for NEW signals. For legacy, it's just cleanup.
                const isNew = upd.created_at > this.sessionStartTime;
                if (isNew) {
                    console.warn(`🛡️ [SignalAudit] Integrity Guard: Converting WIN to LOSS for ${upd.symbol} due to non-positive PnL (${upd.pnl_percent?.toFixed(2)}%)`);
                }
                upd.status = 'LOSS';
            }

            // Remove internal memory-only fields before sending to Supabase
            // 'last_sync' is acceptable if we added column, otherwise we should check schema. 
            // Assuming 'final_price' and 'pnl_percent' exist. 
            // We strip 'last_sync' from supabase payload to be safe unless we added it. 
            // Actually, we can just keep last_sync in memory `signal` object and not send to DB if it's not a column.

            // Remove internal memory-only fields before sending to Supabase
            // 'created_at' is used for logging filter but shouldn't be updated (it's immutable in DB logic usually)

            const { id, last_sync, created_at, ...data } = upd; // Extract created_at to prevent update attempt if not needed, or just to keep it clean.

            if (id) {
                // VERBOSE LOGGING START (Validation for User)
                // console.log(`💾 [Sync] Trace: Updating ${id}, fields:`, Object.keys(data));

                const { error: dbError } = await this.supabase
                    .from('signals_audit')
                    .update(data)
                    .eq('id', id);

                if (dbError) {
                    console.error(`❌ [Sync] FAILED to persist update for ${id}:`, dbError.message);
                } else {
                    if (data.stop_loss) {
                        console.log(`✅ [Sync] DB WRITE SUCCESS: SL for ${id} set to ${data.stop_loss}`);
                    }

                    // Integrity Check for Closure
                    if (upd.status === 'WIN' || upd.status === 'LOSS') {
                        const finalPnL = upd.pnl_percent || 0;
                        this.activeSignals = this.activeSignals.filter((s: any) => s.id !== upd.id);

                        // COOLDOWN: Mark as recently closed
                        const sigKey = `${upd.symbol}-${upd.side || (upd.strategy ? 'LONG' : 'LONG')}`; // Fallback side if missing found in activeSignals logic usually.
                        // Actually upd might not have 'side'. We need to be careful. activeSignals has it.
                        // The 'upd' object comes from processPriceTick but it is partial.
                        // We should grab side BEFORE filtering or from the filtered signal?
                        // activeSignals filter removes it. Let's find it first.
                        // Wait, we filtered line 763. This line 763 is destructive.
                        // We should fix the logic order or rely on upd having side if we pass it.

                        // Correct approach: We use the signal object from memory (which we just filtered OUT).
                        // But wait, line 763 removes it. We don't have reference unless we saved it.
                        // However, upd is derived from signal in processPriceTick loop.
                        // Does upd have side? Line 648 push updates. updates usually just has status, pnl etc.
                        // Let's modify processPriceTick to include side in updates for context.

                        if (upd.symbol && upd.side) {
                            this.recentClosures.set(`${upd.symbol}-${upd.side}`, Date.now());
                        }

                        console.log(`🎯 [SignalAudit] CERRADA (${upd.status}): ${upd.id} | Net PnL: ${finalPnL.toFixed(2)}%`);

                        telegramService.sendUpdateAlert('TRADE_CLOSED', {
                            symbol: upd.symbol || 'UNKNOWN',
                            status: upd.status,
                            pnl: finalPnL.toFixed(2),
                            reason: upd.exit_reason || 'Target/SL Hit'
                        });

                        // ML FEEDBACK LOOP: Update model_predictions outcome
                        this.updateMLOutcome(upd.id, finalPnL, upd.status).catch(e =>
                            console.error(`⚠️ [ML-Audit] Failed to sync outcome:`, e)
                        );
                    }
                }
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

    /**
     * ═══════════════════════════════════════════════════════════
     * PAU PERDICES: ADVANCED EXIT SYSTEM (Hybrid Multi-Factor)
     * ═══════════════════════════════════════════════════════════
     * Prioridades de Salida:
     * 1. Stop Loss Técnico (siempre en processPriceTick)
     * 2. Take Profit Targets (siempre en processPriceTick)
     * 3. Divergencia Regular → Reversión detectada
     * 4. Momentum Exhaustion → RSI >70 sin movimiento
     * 5. Trailing Stop → Después de TP1 (ATR-based)
     * 6. Time Decay (SOFT) → Estrecha SL 6-12h
     * 7. Max Time (HARD) → Solo trades FLAT >12h
     */
    private async checkAdvancedExits() {
        if (this.activeSignals.length === 0) return;

        try {
            const { TradingConfig } = await import('../core/config/tradingConfig');
            const exit_strategy = TradingConfig.exit_strategy;

            if (!exit_strategy) return; // Fallback to legacy

            const signalsToUpdate = [];

            for (const signal of this.activeSignals) {
                if (!['ACTIVE', 'PARTIAL_WIN'].includes(signal.status)) continue;

                const ageMs = Date.now() - Number(signal.created_at);
                const ageHours = ageMs / (1000 * 60 * 60);

                const isLong = signal.side === 'LONG';
                const currentPrice = signal.final_price || signal.entry_price;
                const currentWAP = signal.activation_price || signal.entry_price;
                const currentStage = signal.stage || 0;

                let shouldExit = false;
                let exitReason = '';
                let updates: any = {};

                try {
                    // Fetch recent candles for advanced analysis
                    const candles = await this.fetchRecentCandles(signal.symbol, 20);
                    if (!candles || candles.length < 10) continue;

                    const closes = candles.map(c => c.close);
                    const rsiArray = this.calculateRSI(closes, 14);
                    const currentRSI = rsiArray[rsiArray.length - 1];
                    const atr = this.calculateATR(candles, 14);

                    // === EXIT CHECK 1: DIVERGENCIA REGULAR (Reversión) ===
                    if (exit_strategy.reversal?.enabled) {
                        const { detectRegularBearishDivergence, detectRegularBullishDivergence } =
                            await import('../core/services/divergenceDetector');

                        if (isLong && detectRegularBearishDivergence(candles, rsiArray, exit_strategy.reversal.lookback_candles)) {
                            shouldExit = true;
                            exitReason = 'REGULAR_BEARISH_DIV';
                            console.log(`🔄 [AdvancedExit] ${signal.symbol}: Bearish Divergence (Reversal)`);
                        }

                        if (!isLong && detectRegularBullishDivergence(candles, rsiArray, exit_strategy.reversal.lookback_candles)) {
                            shouldExit = true;
                            exitReason = 'REGULAR_BULLISH_DIV';
                            console.log(`🔄 [AdvancedExit] ${signal.symbol}: Bullish Divergence (Reversal)`);
                        }
                    }

                    // === EXIT CHECK 2: MOMENTUM EXHAUSTION ===
                    if (!shouldExit && exit_strategy.momentum?.enabled && ageHours >= exit_strategy.momentum.min_hours_check) {
                        const rsiThreshold = exit_strategy.momentum.rsi_threshold;
                        const maxFlat = exit_strategy.momentum.max_flat_percent;

                        const priceChange = Math.abs(((currentPrice - currentWAP) / currentWAP) * 100);

                        if (isLong && currentRSI > rsiThreshold && priceChange < maxFlat) {
                            shouldExit = true;
                            exitReason = 'MOMENTUM_EXHAUSTED';
                            console.log(`⚡ [AdvancedExit] ${signal.symbol}: Momentum Dead (RSI ${currentRSI.toFixed(1)}, ${ageHours.toFixed(1)}h)`);
                        }

                        if (!isLong && currentRSI < (100 - rsiThreshold) && priceChange < maxFlat) {
                            shouldExit = true;
                            exitReason = 'MOMENTUM_EXHAUSTED';
                            console.log(`⚡ [AdvancedExit] ${signal.symbol}: SHORT Momentum Dead (RSI ${currentRSI.toFixed(1)})`);
                        }
                    }

                    // === EXIT CHECK 3: TRAILING STOP (Solo después de TP1) ===
                    if (!shouldExit && exit_strategy.trailing_stop?.enabled && currentStage >= 1) {
                        const trailingDistance = atr * exit_strategy.trailing_stop.atr_distance;
                        const maxReached = signal.max_price_reached || currentWAP;

                        const trailingSL = isLong
                            ? maxReached - trailingDistance
                            : maxReached + trailingDistance;

                        const hitTrailing = isLong
                            ? currentPrice <= trailingSL
                            : currentPrice >= trailingSL;

                        if (hitTrailing) {
                            shouldExit = true;
                            exitReason = 'TRAILING_STOP';
                            console.log(`📉 [AdvancedExit] ${signal.symbol}: Trailing Stop (${trailingDistance.toFixed(2)} from max)`);
                        } else {
                            // NEW: Persist Trailing SL if it moved significantly
                            const currentStoredSL = signal.stop_loss || 0;
                            if (Math.abs(trailingSL - currentStoredSL) > (currentPrice * 0.005)) { // Only update if > 0.5% move to avoid spam
                                const betterSL = isLong ? Math.max(currentStoredSL, trailingSL) : Math.min(currentStoredSL || Infinity, trailingSL);
                                if (betterSL !== currentStoredSL) {
                                    updates.stop_loss = Number(betterSL.toFixed(4));
                                    telegramService.sendUpdateAlert('SL_MOVED', {
                                        symbol: signal.symbol,
                                        oldSl: signal.stop_loss,
                                        newSl: updates.stop_loss,
                                        reason: 'Trailing Stop Follow-up'
                                    });
                                }
                            }
                        }
                    }

                    // === EXIT CHECK 4: TIME DECAY (SOFT - Estrecha SL) ===
                    if (!shouldExit && exit_strategy.time_decay?.enabled && ageHours >= exit_strategy.time_decay.soft_start_hours) {
                        const hoursSinceSoft = ageHours - exit_strategy.time_decay.soft_start_hours;
                        const decayFactor = hoursSinceSoft * exit_strategy.time_decay.sl_tighten_rate;
                        const tightenFactor = Math.max(0.3, 1 - decayFactor); // Min 30% of original

                        const originalSLDistance = atr * 1.5;
                        const tightenedDistance = originalSLDistance * tightenFactor;

                        const tightenedSL = isLong
                            ? currentWAP - tightenedDistance
                            : currentWAP + tightenedDistance;

                        // Solo actualizar SL si cambió significativamente
                        const slChanged = Math.abs(tightenedSL - signal.stop_loss) > (currentPrice * 0.001);
                        if (slChanged) {
                            updates.stop_loss = Number(tightenedSL.toFixed(4));
                            console.log(`⏱️ [TimeDecay] ${signal.symbol}: SL tightened to ${tightenedSL.toFixed(2)} (${ageHours.toFixed(1)}h, factor: ${tightenFactor.toFixed(2)})`);
                            telegramService.sendUpdateAlert('SL_MOVED', {
                                symbol: signal.symbol,
                                oldSl: signal.stop_loss,
                                newSl: updates.stop_loss,
                                reason: `Time Decay (${ageHours.toFixed(1)}h)`
                            });
                        }
                    }

                    // === EXIT CHECK 4.5: FORCED BREAKEVEN (12h sin TP1) ===
                    if (!shouldExit && exit_strategy.time_decay?.forced_breakeven?.enabled) {
                        const forcedBEConfig = exit_strategy.time_decay.forced_breakeven;

                        // Solo aplica si trade es viejo (>12h) y NO ha tocado TP1 (stage 0)
                        if (ageHours >= forcedBEConfig.hours && currentStage <= forcedBEConfig.stage_threshold) {
                            const realEntry = signal.entry || signal.target;

                            // Mover SL a breakeven si aún no está ahí
                            // (Permitimos pequeño margen de floating point error)
                            // Smart Breakeven for Time Decay
                            const buffer = signal.smart_be_buffer || (realEntry * 0.0015);
                            const smartBE = isLong ? realEntry + buffer : realEntry - buffer;

                            const currentSL = signal.stop_loss || realEntry;
                            // Only update if current SL is worse than Smart BE
                            const isImprovement = isLong ? currentSL < smartBE : currentSL > smartBE;

                            if (isImprovement) {
                                updates.stop_loss = Number(smartBE.toFixed(4));
                                console.log(`⏰ [ForcedBreakeven] ${signal.symbol}: SL → Smart BE ($${updates.stop_loss}) after ${ageHours.toFixed(1)}h`);
                                telegramService.sendUpdateAlert('SL_MOVED', {
                                    symbol: signal.symbol,
                                    oldSl: signal.stop_loss,
                                    newSl: updates.stop_loss,
                                    reason: `Forced Breakeven (>12h)`
                                });
                            }
                        }
                    }

                    // === EXIT CHECK 5: HARD TIME LIMIT (Solo FLAT trades) ===
                    if (!shouldExit && exit_strategy.time_decay?.enabled && ageHours >= exit_strategy.time_decay.hard_limit_hours) {
                        const pnlPercent = ((currentPrice - currentWAP) / currentWAP) * 100 * (isLong ? 1 : -1);

                        if (Math.abs(pnlPercent) < 0.5) {
                            shouldExit = true;
                            exitReason = 'MAX_TIME_FLAT';
                            console.log(`⌛ [AdvancedExit] ${signal.symbol}: Closed by time (${ageHours.toFixed(1)}h, FLAT: ${pnlPercent.toFixed(2)}%)`);
                        }
                    }

                    // === EXIT CHECK 6: NUCLEAR EVENT DEFENSE (Smart Defense) ===
                    // Added by Antigravity: Protects capital before NFP/FOMC
                    const eventProtection = (TradingConfig as any).event_protection;
                    if (!shouldExit && eventProtection && eventProtection.enabled) {
                        const { EconomicService } = await import('../core/services/economicService');

                        // Check cache/state to avoid spamming the API every 2 mins? 
                        // EconomicService handles fetching weekly CSV, it's cheap (memory).
                        // We check for event in next 60 mins.
                        const approachingEvent = await EconomicService.getApproachingNuclearEvent(eventProtection.pre_event_minutes);

                        if (approachingEvent) {
                            const pnlPercent = ((currentPrice - currentWAP) / currentWAP) * 100 * (isLong ? 1 : -1);

                            // A. PROFITABLE TRADES -> FORCE BREAKEVEN (Free Roll)
                            if (pnlPercent > eventProtection.actions.profitable_threshold) {
                                const realEntry = signal.activation_price || signal.entry_price;
                                // Smart BE (Entry + Buffer)
                                const buffer = signal.smart_be_buffer || (realEntry * 0.0015);
                                const smartBE = isLong ? realEntry + buffer : realEntry - buffer;

                                const currentSL = signal.stop_loss || realEntry;
                                // Check if we need to secure it (if SL is worse than BE)
                                const isUnsecured = isLong ? currentSL < smartBE : currentSL > smartBE;

                                if (isUnsecured) {
                                    updates.stop_loss = Number(smartBE.toFixed(4));
                                    updates.technical_reasoning = `${signal.technical_reasoning || ''} | [NUCLEAR] Secured BE before ${approachingEvent.title}`;

                                    console.log(`☢️ [NuclearGuard] ${signal.symbol}: Secured at BE (PnL ${pnlPercent.toFixed(2)}%) before ${approachingEvent.title}`);
                                    telegramService.sendUpdateAlert('SL_MOVED', {
                                        symbol: signal.symbol,
                                        oldSl: signal.stop_loss,
                                        newSl: updates.stop_loss,
                                        reason: `Nuclear Shield (${approachingEvent.title})`
                                    });
                                }
                            }
                            // B. WEAK TRADES -> EMERGENCY CLOSE (Avoid Slippage)
                            else if (pnlPercent < eventProtection.actions.weak_loss_threshold) {
                                // If loss is massive (e.g. -5%), maybe we hold? 
                                // But here we config to CLOSE if "weak" loss.
                                // Config says weak_loss_threshold = -1.0. 
                                // So if PnL is BETTER than -1.0 (e.g. -0.5), we are fine? 
                                // Wait, logic in plan: "Weak Trades (Loss < -1%): Force Close". 
                                // Actually, usually you close the small losses. You hold the deep ones (structura).
                                // Let's interpret "weak_loss_threshold" as the floor.
                                // If PnL is between -1.0 and 0.5 (The "Zone of Uncertainty"), kill it?
                                // Let's follow the standard:
                                // If PnL is NEGATIVE but manageable (e.g. > -1.5%). Kill it.
                                // If PnL is DEEP NEGATIVE (e.g. < -5%). Hold?

                                // Let's implement: If PnL is between -1.0% and 0.5% (The Flat/Weak Zone).
                                // Explicitly: Close if we are not winning significantly, and not losing massively.
                                const isWeak = pnlPercent < eventProtection.actions.profitable_threshold && pnlPercent > -2.0;

                                if (isWeak) {
                                    shouldExit = true;
                                    exitReason = `NUCLEAR_EVACUATION_${approachingEvent.title.replace(/\s+/g, '_')}`;
                                    console.log(`☢️ [NuclearGuard] ${signal.symbol}: Evacuating Weak Position (${pnlPercent.toFixed(2)}%) before ${approachingEvent.title}`);
                                }
                            }
                        }
                    }

                    // === EJECUTAR SALIDA ===
                    if (shouldExit) {
                        const weightLeft = (currentStage === 0) ? 1.0 : (currentStage === 1 ? 0.5 : (currentStage === 2 ? 0.2 : 0));
                        const closingFee = currentPrice * this.FEE_RATE * weightLeft;
                        const finalPnL = this.calculateNetPnL(currentWAP, currentPrice, signal.side, closingFee, weightLeft);
                        const totalPnL = (signal.realized_pnl_percent || 0) + finalPnL;

                        updates = {
                            ...updates,
                            id: signal.id,
                            status: totalPnL > 0.5 ? 'WIN' : (totalPnL < -0.5 ? 'LOSS' : 'BREAKEVEN'),
                            closed_at: Date.now(),
                            final_price: currentPrice,
                            pnl_percent: totalPnL,
                            fees_paid: (signal.fees_paid || 0) + closingFee,
                            exit_reason: exitReason
                        };

                        signalsToUpdate.push(updates);
                    } else if (Object.keys(updates).length > 0) {
                        // Solo update SL (no cierre)
                        updates.id = signal.id;
                        signalsToUpdate.push(updates);
                    }

                } catch (innerError: any) {
                    console.error(`[AdvancedExit] Error analyzing ${signal.symbol}:`, innerError.message);
                }
            }

            if (signalsToUpdate.length > 0) {
                await this.syncUpdates(signalsToUpdate);
            }

            // DOUBLE EMIT REMOVED: syncUpdates() now handles the broadcast logic centrally.
            // This prevents the frontend from receiving duplicate messages/renders.

        } catch (e: any) {
            console.error('[AdvancedExit] Critical error:', e.message);
        }
    }

    // Helper: Fetch recent candles
    private async fetchRecentCandles(symbol: string, count: number = 20) {
        try {
            const { SmartFetch } = await import('../core/services/SmartFetch');
            const symbolBinance = symbol.replace('/', '');
            const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbolBinance}&interval=15m&limit=${count}`;
            const data = await SmartFetch.get<any[]>(url);

            if (!Array.isArray(data)) return null;

            return data.map((k: any) => ({
                timestamp: k[0],
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5])
            }));
        } catch (e) {
            return null;
        }
    }

    // Helper: Calculate RSI
    private calculateRSI(closes: number[], period: number = 14): number[] {
        return calculateRSIArray(closes, period);
    }

    // Helper: Calculate ATR
    private calculateATR(candles: any[], period: number = 14): number {
        if (candles.length < period + 1) return 0;

        let sum = 0;
        for (let i = 1; i < Math.min(period + 1, candles.length); i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevClose = candles[i - 1].close;

            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            sum += tr;
        }

        return sum / period;
    }

    /**
     * ═══════════════════════════════════════════════════════════
     */

    /**
     * EXTERNAL CONTEXT INJECTION (The "Slow Lane")
     * Allows ScannerLogic (15m cycle) to update active trades with deep insights.
     */
    public async updateSignalContext(symbol: string, context: { new_tp?: number, reason?: string }) {
        const signal = this.activeSignals.find(s => s.symbol === symbol || s.symbol.replace('/', '') === symbol.replace('/', ''));

        if (signal && context.new_tp) {
            // Validate: Only Lower TP for LONGs (Front-run), Only Raise TP for SHORTs (Front-run) - Safety First
            const isLong = signal.side === 'LONG';
            const currentTP2 = signal.dcaPlan?.takeProfits?.tp2?.price || 0;
            const currentTP3 = signal.dcaPlan?.takeProfits?.tp3?.price || 0;

            // Simple Logic: We target TP2 or TP3 adjustment. Let's assume we adjust the NEXT relevant TP.
            let targetStage = signal.stage < 2 ? 2 : 3;
            let currentTargetPrice = targetStage === 2 ? currentTP2 : currentTP3;

            // Only update if improvement (safer/more likely to hit)
            // For LONG: New TP < Old TP (Front-running)
            // For SHORT: New TP > Old TP (Front-running)
            const isSafer = isLong ? context.new_tp < currentTargetPrice : context.new_tp > currentTargetPrice;

            if (isSafer && Math.abs(context.new_tp - currentTargetPrice) > (currentTargetPrice * 0.002)) { // >0.2% change

                // Update Local Cache
                if (targetStage === 2 && signal.dcaPlan?.takeProfits?.tp2) signal.dcaPlan.takeProfits.tp2.price = context.new_tp;
                if (targetStage === 3 && signal.dcaPlan?.takeProfits?.tp3) signal.dcaPlan.takeProfits.tp3.price = context.new_tp;

                // Sync to DB (Update reasoning or context field)
                if (this.supabase) {
                    await this.supabase.from('signals_audit').update({
                        technical_reasoning: `${signal.technical_reasoning || ''} | [Updated] ${context.reason}`
                    }).eq('id', signal.id);
                }

                console.log(`📉 [SignalAudit] Dynamic TP Adapted for ${symbol}: ${currentTargetPrice} -> ${context.new_tp}`);

                // Notify User
                telegramService.sendUpdateAlert('TP_ADAPTED', {
                    symbol: symbol,
                    newTp: context.new_tp,
                    reason: context.reason
                });
            }
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * PAU PERDICES: PORTFOLIO BALANCE & DRAWDOWN TRACKING
     * ═══════════════════════════════════════════════════════════
     */

    /**
     * Calcula el balance actual del portafolio basado en PnL realizado
     * Balance = Initial Balance + Σ(PnL de trades cerrados)
     */
    private async calculatePortfolioBalance(): Promise<number> {
        if (!this.supabase) return 1000; // Fallback

        const { TradingConfig } = await import('../core/config/tradingConfig');
        const initialBalance = TradingConfig.pau_drawdown_scaling?.initial_balance || 1000;

        // Fetch todos los trades cerrados
        const { data, error } = await this.supabase
            .from('signals_audit')
            .select('pnl_percent')
            .in('status', ['WIN', 'LOSS', 'BREAKEVEN', 'EXPIRED']);

        if (error || !data) return initialBalance;

        // Sumar PnL acumulado (en formato decimal)
        let totalPnLDecimal = 0;
        data.forEach((trade: any) => {
            const pnl = (trade.pnl_percent || 0) / 100; // Convert % to decimal (5% → 0.05)
            totalPnLDecimal += pnl;
        });

        // Balance = Initial × (1 + Total PnL)
        const currentBalance = initialBalance * (1 + totalPnLDecimal);

        return Math.max(0, currentBalance); // No negative balance
    }

    /**
     * Calcula el drawdown actual vs peak balance histórico
     * DD% = ((Peak - Current) / Peak) × 100
     */
    private async calculateCurrentDrawdown(): Promise<{
        currentBalance: number;
        peakBalance: number;
        drawdownPercent: number;
    }> {
        const currentBalance = await this.calculatePortfolioBalance();

        // Obtener peak balance de DB (o calcularlo si no existe)
        let peakBalance = currentBalance;

        if (this.supabase) {
            const { data } = await this.supabase
                .from('portfolio_metrics')
                .select('peak_balance')
                .order('timestamp', { ascending: false })
                .limit(1)
                .single();

            if (data?.peak_balance) {
                peakBalance = Math.max(data.peak_balance, currentBalance);
            }
        }

        const drawdownPercent = peakBalance > 0
            ? ((peakBalance - currentBalance) / peakBalance) * 100
            : 0;

        return {
            currentBalance,
            peakBalance,
            drawdownPercent: Math.max(0, drawdownPercent)
        };
    }

    /**
     * Obtiene el multiplicador de riesgo según DD actual
     * Usa tabla de scaling de Pau Perdices
     */
    public async getAdjustedRiskMultiplier(): Promise<{
        balance: number;
        drawdown: number;
        multiplier: number;
        shouldStopTrading: boolean;
    }> {
        const { TradingConfig } = await import('../core/config/tradingConfig');
        const config = TradingConfig.pau_drawdown_scaling;

        if (!config?.enabled) {
            // Disabled: return full risk
            return {
                balance: config?.initial_balance || 1000,
                drawdown: 0,
                multiplier: 1.0,
                shouldStopTrading: false
            };
        }

        const { currentBalance, peakBalance, drawdownPercent } = await this.calculateCurrentDrawdown();

        // Find multiplier from thresholds
        let multiplier = 0;
        for (const threshold of config.scaling_thresholds) {
            if (drawdownPercent <= threshold.max_dd) {
                multiplier = threshold.multiplier;
                break;
            }
        }

        // Hard stop check
        const shouldStopTrading = drawdownPercent >= config.max_allowed_drawdown;

        // Log for monitoring (only if DD > 0 or multiplier changed)
        if (drawdownPercent > 0.1 || multiplier < 1.0) {
            const emoji = shouldStopTrading ? '🛑' : (multiplier < 1.0 ? '⚠️' : '💰');
            console.log(`${emoji} [PortfolioRisk] Balance: $${currentBalance.toFixed(2)} | Peak: $${peakBalance.toFixed(2)} | DD: ${drawdownPercent.toFixed(2)}% | Risk: ${(multiplier * 100).toFixed(0)}%`);
        }

        // Persist to DB for analytics
        if (this.supabase) {
            try {
                await this.supabase.from('portfolio_metrics').insert({
                    timestamp: Date.now(),
                    current_balance: currentBalance,
                    peak_balance: peakBalance,
                    current_drawdown_pct: drawdownPercent,
                    risk_multiplier: multiplier
                });
            } catch (e) {
                // Silent fail (table might not exist yet)
            }
        }

        return {
            balance: currentBalance,
            drawdown: drawdownPercent,
            multiplier,
            shouldStopTrading
        };
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
            // ROBUST SORTING LOGIC:
            // Priority 1: Money on the table (ACTIVE, PARTIAL_WIN) - Score 3
            // Priority 2: Waiting for entry (PENDING, OPEN) - Score 2
            // Priority 3: History (WIN, LOSS, EXPIRED) - Score 1

            const getScore = (s: string) => {
                if (['ACTIVE', 'PARTIAL_WIN'].includes(s)) return 3;
                if (['PENDING', 'OPEN'].includes(s)) return 2;
                return 1;
            };

            const scoreA = getScore(a.status);
            const scoreB = getScore(b.status);

            if (scoreA !== scoreB) return scoreB - scoreA; // High score first

            // Tie-breaker: Newest First
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

        // Cache check (1m TTL) - Faster updates for Pro users
        if (Date.now() - this.mlBrainStatus.lastUpdated < 60 * 1000 && this.mlBrainStatus.lastUpdated !== 0) {
            return this.mlBrainStatus;
        }

        try {
            const { data, error } = await this.supabase
                .from('model_predictions')
                .select('actual_outcome, market_regime, probability, signal')
                .not('actual_outcome', 'is', null)
                .order('prediction_time', { ascending: false })
                .limit(200);

            if (error || !data || data.length === 0) {
                // RESET STATE if DB is empty (Factory Reset handling)
                this.mlBrainStatus = {
                    globalWinRate: 0,
                    recentWinRate: 0,
                    regimeStats: {},
                    totalPredictions: 0,
                    isDriftDetected: false,
                    lastUpdated: Date.now()
                };
                return this.mlBrainStatus;
            }

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

    // --- PRICE CONSENSUS (The Pulse) ---
    private async runConsensusCheck() {
        if (this.activeSignals.length === 0) return;

        // Pick one random signal to audit
        const randomSignal = this.activeSignals[Math.floor(Math.random() * this.activeSignals.length)];
        const symbol = randomSignal.symbol;
        const streamPrice = randomSignal.last_price || binanceStream.getPrice(symbol);

        if (!streamPrice || streamPrice <= 0) return;

        try {
            // Using direct fetch to avoid circular dependency if SmartFetch is problematic, 
            // but SmartFetch is imported at top.
            const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol.replace('/', '')}`;
            const data: any = await SmartFetch.get(url);

            if (data && data.price) {
                const restPrice = parseFloat(data.price);
                const diff = Math.abs(streamPrice - restPrice);
                const diffPercent = (diff / restPrice) * 100;

                if (diffPercent > 1.0) {
                    const msg = `🚨 CRITICAL PRICE DEVIATION for ${symbol}: Stream=${streamPrice}, REST=${restPrice} (Diff: ${diffPercent.toFixed(2)}%)`;
                    console.error(`[SignalAudit] ${msg}`);
                    // Only log critical, don't auto-kill yet to avoid false positives during high volatility
                    systemAlerts.logCritical(msg, { symbol, streamPrice, restPrice });
                } else {
                    // console.log(`✅ [SignalAudit] Consensus OK for ${symbol} (Diff: ${diffPercent.toFixed(4)}%)`);
                }
            }
        } catch (e) {
            // console.warn(`[SignalAudit] Consensus check failed for ${symbol}`, e);
        }
    }
}

export const signalAuditService = new SignalAuditService();
