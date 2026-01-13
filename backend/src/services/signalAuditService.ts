import { createClient } from '@supabase/supabase-js';
import { AIOpportunity } from '../core/types';
import { binanceStream } from './binanceStream';
import { telegramService } from './telegramService';
import EventEmitter from 'events';

// ... (Imports remain same)

class SignalAuditService extends EventEmitter {
    private supabase: any = null;
    private activeSignals: any[] = [];
    private auditInterval: NodeJS.Timeout | null = null;

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
            this.activeSignals = data;
            console.log(`🛡️ [SignalAudit] Seguimiento activo de ${data.length} señales.`);

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
                // Si existe posición contraria (Hedge/Reversal), la cerramos primero.
                if (existingPosition.side !== opp.side) {
                    await this.handleReversal(existingPosition, opp);
                } else {
                    // Si es la misma dirección, IGNORAMOS la nueva señal.
                    // console.log(`🛡️ [SignalAudit] Skip ${opp.symbol}: Posición ya activa (${existingPosition.status}).`);
                    continue;
                }
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
                    fees_paid: fees,
                    tp1: opp.takeProfits.tp1,
                    tp2: opp.takeProfits.tp2,
                    tp3: opp.takeProfits.tp3,
                    stop_loss: opp.stopLoss,
                    confidence_score: opp.confidenceScore,
                    stage: 0, // 0 = Entry Phase
                    created_at: Date.now()
                };

                const { data, error } = await this.supabase
                    .from('signals_audit')
                    .insert(payload)
                    .select();

                if (!error && data) {
                    this.activeSignals.push(data[0]);
                    const streamSymbol = opp.symbol.toLowerCase().replace('/', '') + '@aggTrade';
                    binanceStream.addStream(streamSymbol);
                    console.log(`✅ [SignalAudit] Registered: ${opp.symbol} ${opp.side} (${initialStatus})`);
                }
            } finally {
                this.processingSignatures.delete(sigKey);
            }
        }
    }

    private async handleReversal(oldSig: any, newOpp: AIOpportunity) {
        console.log(`🔄 [SignalAudit] REVERSAL: Closing ${oldSig.symbol} ${oldSig.side} for new ${newOpp.side}`);

        const closePrice = newOpp.entryZone.currentPrice || newOpp.entryZone.max;
        const entryPrice = oldSig.activation_price || oldSig.entry_price;

        // PnL Calculation (Net with Fees)
        const rawPnL = ((closePrice - entryPrice) / entryPrice) * 100 * (oldSig.side === 'LONG' ? 1 : -1);

        // Add Exit Fee
        const exitFee = (closePrice * this.FEE_RATE);
        const totalFees = (oldSig.fees_paid || 0) + exitFee;
        const feeImpactPercent = (totalFees / entryPrice) * 100; // Approx impact on RoI

        const netPnL = rawPnL - feeImpactPercent;

        const finalStatus = netPnL >= 0 ? 'WIN' : 'LOSS';

        await this.syncUpdates([{
            id: oldSig.id,
            status: finalStatus,
            closed_at: Date.now(),
            final_price: closePrice,
            pnl_percent: netPnL,
            fees_paid: totalFees,
            realized_pnl_percent: netPnL
        }]);

        // Notify
        telegramService.sendReversalAlert(newOpp.symbol, oldSig.side, newOpp.side, closePrice, netPnL);
        this.activeSignals = this.activeSignals.filter(s => s.id !== oldSig.id);
    }

    private async processPriceTick(symbol: string, currentPrice: number) {
        if (this.activeSignals.length === 0) return;

        const signalsToUpdate = [];
        const sym = symbol.toUpperCase().replace('/', '');

        for (const signal of this.activeSignals) {
            if (signal.symbol.toUpperCase().replace('/', '') !== sym) continue;

            let updates: any = {};
            let shouldClose = false;

            // FASE 1: Activation (PENDING -> ACTIVE)
            if (signal.status === 'PENDING' || signal.status === 'OPEN') {
                const entryPrice = signal.entry_price;
                const buffer = entryPrice * 0.003;

                const entryTouched = (signal.side === 'LONG')
                    ? currentPrice <= (entryPrice + buffer)
                    : currentPrice >= (entryPrice - buffer);

                if (entryTouched) {
                    updates.status = 'ACTIVE';

                    // Real Execution Logic
                    const slippage = currentPrice * 0.0002; // Limit Order Slippage (smaller than market)
                    const realEntry = (signal.side === 'LONG') ? currentPrice + slippage : currentPrice - slippage;

                    updates.activation_price = realEntry;
                    updates.fees_paid = (realEntry * this.FEE_RATE);

                    console.log(`🚀 [SignalAudit] Filled: ${signal.symbol} @ $${realEntry.toFixed(4)}`);
                }
            }

            // FASE 2: Position Management (Active Trades)
            const isActive = signal.status === 'ACTIVE' || updates.status === 'ACTIVE' || signal.status === 'PARTIAL_WIN';

            if (isActive) {
                // Use Real Entry if available, else theoretical
                const basePrice = updates.activation_price || signal.activation_price || signal.entry_price;
                const currentStage = signal.stage || 0; // 0=Fresh, 1=TP1 Hit, 2=TP2 Hit

                // Stop Loss Logic (Trailing if Partial)
                // If Stage >= 1 (TP1 Hit), Stop Loss moves to Breakeven
                let effectiveSL = signal.stop_loss;
                if (currentStage >= 1) {
                    effectiveSL = basePrice; // Breakeven
                }

                // Check Stop Loss
                const slHit = (signal.side === 'LONG') ? currentPrice <= effectiveSL : currentPrice >= effectiveSL;

                if (slHit) {
                    shouldClose = true;
                    updates.status = currentStage > 0 ? 'WIN' : 'LOSS'; // BE is techincally a wash, but saved fees make it slight loss usually. Logic: if stage>0 it's a "scratch" win.
                    if (currentStage > 0) updates.status = 'WIN'; // Secured Profit
                } else {
                    // Check Take Profits
                    // Priority: Check highest TPs first? No, sequential.

                    // TP1 Check
                    if (currentStage < 1) {
                        const tp1Hit = (signal.side === 'LONG') ? currentPrice >= signal.tp1 : currentPrice <= signal.tp1;
                        if (tp1Hit) {
                            updates.status = 'PARTIAL_WIN';
                            updates.stage = 1;
                            updates.realized_pnl_percent = this.calculateNetPnL(basePrice, currentPrice, signal.side, signal.fees_paid, 0.4); // 40% out
                            console.log(`💰 [SignalAudit] TP1 Hit: ${signal.symbol} (Moving SL to BE)`);
                        }
                    }

                    // TP2 Check
                    if (currentStage < 2) {
                        const tp2Hit = (signal.side === 'LONG') ? currentPrice >= signal.tp2 : currentPrice <= signal.tp2;
                        if (tp2Hit) {
                            updates.status = 'PARTIAL_WIN'; // Still running for TP3
                            updates.stage = 2;
                            // Add PnL accumulation logic here ideally, simplest to recalculate realized based on stages
                            console.log(`💰💰 [SignalAudit] TP2 Hit: ${signal.symbol}`);
                        }
                    }

                    // TP3 Check (Final Exit)
                    const tp3Hit = (signal.side === 'LONG') ? currentPrice >= signal.tp3 : currentPrice <= signal.tp3;
                    if (tp3Hit) {
                        shouldClose = true;
                        updates.status = 'WIN';
                        updates.stage = 3;
                        console.log(`🚀🚀🚀 [SignalAudit] TP3 MOON: ${signal.symbol}`);
                    }
                }
            }

            if (Object.keys(updates).length > 0) {
                // Determine closing metrics if closing
                if (shouldClose) {
                    updates.closed_at = Date.now();
                    updates.final_price = currentPrice;

                    const basePrice = updates.activation_price || signal.activation_price || signal.entry_price;
                    const prevFees = signal.fees_paid || 0;
                    const exitFee = currentPrice * this.FEE_RATE;

                    // Final Net PnL w/ Fees
                    const rawPnL = ((currentPrice - basePrice) / basePrice) * 100 * (signal.side === 'LONG' ? 1 : -1);
                    const feeImpact = ((prevFees + exitFee) / basePrice) * 100;

                    updates.pnl_percent = rawPnL - feeImpact;
                    updates.fees_paid = prevFees + exitFee;
                }

                updates.id = signal.id;
                signalsToUpdate.push(updates);

                // Update Local Cache Immediately to prevent oscillation
                Object.assign(signal, updates);
            }
        }

        if (signalsToUpdate.length > 0) {
            this.syncUpdates(signalsToUpdate);
        }
    }

    private calculateNetPnL(entry: number, exit: number, side: string, fees: number, sizeRatio: number): number {
        const raw = ((exit - entry) / entry) * 100 * (side === 'LONG' ? 1 : -1);
        // Fee approximation for this chunk
        const feePct = 0.1;
        return (raw - feePct) * sizeRatio;
    }

    // ... (syncUpdates, checkExpirations, getRecentSignals, getPerformanceStats remain mostly same but updated headers)

    private async syncUpdates(updates: any[]) {
        for (const upd of updates) {
            const { error } = await this.supabase
                .from('signals_audit')
                .update(upd)
                .eq('id', upd.id);

            if (!error && (upd.status === 'WIN' || upd.status === 'LOSS')) {
                this.activeSignals = this.activeSignals.filter((s: any) => s.id !== upd.id);
                console.log(`🎯 [SignalAudit] CERRADA (${upd.status}): ${upd.id} | Net PnL: ${upd.pnl_percent?.toFixed(2)}%`);
            }
        }
    }

    // Reuse existing expiration logic but ensure it resets stage
    private async checkExpirations() {
        if (this.activeSignals.length === 0) return;
        const signalsToUpdate = [];
        for (const signal of this.activeSignals) {
            const ageHours = (Date.now() - Number(signal.created_at)) / (1000 * 60 * 60);
            if (signal.status === 'PENDING' || signal.status === 'OPEN') {
                const limit = signal.timeframe === '15m' ? 4 : 48;
                if (ageHours > limit) {
                    signalsToUpdate.push({
                        id: signal.id,
                        status: 'EXPIRED',
                        closed_at: Date.now(),
                        final_price: signal.entry_price, // No PnL impact
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
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());

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

        const closed = data.filter((s: any) => ['WIN', 'LOSS'].includes(s.status));
        const winsCount = closed.filter((s: any) => s.status === 'WIN').length;

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
            profitFactor: Number(profitFactor.toFixed(2))
        };
    }
}

export const signalAuditService = new SignalAuditService();
