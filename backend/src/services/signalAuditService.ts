import { createClient } from '@supabase/supabase-js';
import { AIOpportunity } from '../core/types';
import { binanceStream } from './binanceStream';
import EventEmitter from 'events';

class SignalAuditService extends EventEmitter {
    private supabase: any = null;
    private activeSignals: any[] = [];
    private auditInterval: NodeJS.Timeout | null = null;

    constructor() {
        super();
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_KEY = process.env.SUPABASE_KEY;

        if (SUPABASE_URL && SUPABASE_KEY) {
            this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        }
    }

    public async start() {
        console.log("🛡️ [SignalAudit] Auditoría de Señales Iniciada (Elite Mode).");

        // 1. Cargar señales PENDING/ACTIVE de la base de datos
        await this.reloadActiveSignals();

        // 2. Suscribirse al stream binance para auditoría reactiva (Tick-by-Tick)
        binanceStream.subscribe((event) => {
            if (event.type === 'cvd_update') {
                this.processPriceTick(event.data.symbol, event.data.price);
            }
        });

        // 3. Proceso de expiración sigue siendo cronológico (cada 5m es suficiente)
        this.auditInterval = setInterval(() => this.checkExpirations(), 5 * 60 * 1000);
    }

    private async reloadActiveSignals() {
        if (!this.supabase) return;

        const { data, error } = await this.supabase
            .from('signals_audit')
            .select('*')
            .in('status', ['PENDING', 'ACTIVE', 'OPEN']); // 'OPEN' for legacy support

        if (!error && data) {
            this.activeSignals = data;
            console.log(`🛡️ [SignalAudit] Seguimiento activo de ${data.length} señales.`);

            // Asegurar que estamos escuchando los precios de estos símbolos
            data.forEach((sig: any) => {
                const streamSymbol = sig.symbol.toLowerCase().replace('/', '') + '@aggTrade';
                binanceStream.addStream(streamSymbol);
            });
        }
    }

    /**
     * Registra una nueva señal recibida del Scanner
     */
    public async registerSignals(opportunities: AIOpportunity[]) {
        if (!this.supabase) return;

        for (const opp of opportunities) {
            // Deduplicación básica: No registrar si ya existe una señal OPEN para este par/dirección en la última hora
            const isDuplicate = this.activeSignals.find((s: any) =>
                s.symbol === opp.symbol &&
                s.side === opp.side &&
                (Date.now() - Number(s.created_at)) < 60 * 60 * 1000
            );

            if (isDuplicate) continue;

            const payload = {
                signal_id: opp.id,
                symbol: opp.symbol,
                side: opp.side,
                status: 'PENDING', // Start as Pending waiting for entry
                strategy: opp.strategy,
                timeframe: opp.timeframe,
                entry_price: opp.entryZone.currentPrice || opp.entryZone.max,
                tp1: opp.takeProfits.tp1,
                tp2: opp.takeProfits.tp2,
                tp3: opp.takeProfits.tp3,
                stop_loss: opp.stopLoss,
                confidence_score: opp.confidenceScore,
                created_at: Date.now()
            };

            const { data, error } = await this.supabase
                .from('signals_audit')
                .insert(payload)
                .select();

            if (!error && data) {
                this.activeSignals.push(data[0]);
                // Activar stream de precio para este símbolo
                const streamSymbol = opp.symbol.toLowerCase().replace('/', '') + '@aggTrade';
                binanceStream.addStream(streamSymbol);
            }
        }
    }

    /**
     * Procesa cada tick de precio en tiempo real
     */
    private async processPriceTick(symbol: string, currentPrice: number) {
        if (this.activeSignals.length === 0) return;

        const signalsToUpdate = [];
        const sym = symbol.toUpperCase().replace('/', '');

        for (const signal of this.activeSignals) {
            if (signal.symbol.toUpperCase().replace('/', '') !== sym) continue;

            let newStatus: string | null = null;
            let pnl = 0;

            // FASE 1: Verificación de Entrada (PENDING -> ACTIVE)
            if (signal.status === 'PENDING' || signal.status === 'OPEN') {
                const entryPrice = signal.entry_price;
                const buffer = entryPrice * 0.001; // 0.1% de tolerancia

                const entryTouched = (signal.side === 'LONG')
                    ? currentPrice <= (entryPrice + buffer)
                    : currentPrice >= (entryPrice - buffer);

                if (entryTouched) {
                    newStatus = 'ACTIVE';
                    console.log(`🚀 [SignalAudit] Entrada ACTIVADA: ${signal.symbol} ${signal.side} @ ${currentPrice}`);
                }
            }

            // FASE 2: Verificación de Salida (ACTIVE -> WIN/LOSS)
            // Una señal que acaba de pasar a ACTIVE puede tocar el SL/TP en el mismo tick
            const isActive = newStatus === 'ACTIVE' || signal.status === 'ACTIVE';

            if (isActive) {
                if (signal.side === 'LONG') {
                    if (currentPrice >= signal.tp1) newStatus = 'WIN';
                    else if (currentPrice <= signal.stop_loss) newStatus = 'LOSS';
                } else {
                    if (currentPrice <= signal.tp1) newStatus = 'WIN';
                    else if (currentPrice >= signal.stop_loss) newStatus = 'LOSS';
                }
            }

            if (newStatus && newStatus !== signal.status) {
                pnl = ((currentPrice - signal.entry_price) / signal.entry_price) * 100 * (signal.side === 'LONG' ? 1 : -1);

                // Actualizar cache local inmediatamente para evitar procesamiento doble
                signal.status = newStatus;

                signalsToUpdate.push({
                    id: signal.id,
                    status: newStatus,
                    closed_at: (newStatus === 'WIN' || newStatus === 'LOSS') ? Date.now() : null,
                    final_price: currentPrice,
                    pnl_percent: pnl
                });
            }
        }

        if (signalsToUpdate.length > 0) {
            this.syncUpdates(signalsToUpdate);
        }
    }

    /**
     * Sincroniza los cambios con la base de datos
     */
    private async syncUpdates(updates: any[]) {
        for (const upd of updates) {
            const { error } = await this.supabase
                .from('signals_audit')
                .update({
                    status: upd.status,
                    closed_at: upd.closed_at,
                    final_price: upd.final_price,
                    pnl_percent: upd.pnl_percent
                })
                .eq('id', upd.id);

            if (!error) {
                if (upd.status === 'WIN' || upd.status === 'LOSS') {
                    this.activeSignals = this.activeSignals.filter((s: any) => s.id !== upd.id);
                    console.log(`🎯 [SignalAudit] Señal CERRADA (${upd.status}): ${upd.id} | PnL: ${upd.pnl_percent.toFixed(2)}%`);
                }
            }
        }
    }

    private async checkExpirations() {
        if (this.activeSignals.length === 0) return;

        const signalsToUpdate = [];
        for (const signal of this.activeSignals) {
            const ageHours = (Date.now() - Number(signal.created_at)) / (1000 * 60 * 60);
            const limit = signal.timeframe === '15m' ? 6 : 48;

            if (ageHours > limit) {
                signalsToUpdate.push({
                    id: signal.id,
                    status: 'EXPIRED',
                    closed_at: Date.now(),
                    final_price: signal.entry_price, // Use entry as neutral ref
                    pnl_percent: 0
                });
            }
        }

        if (signalsToUpdate.length > 0) {
            this.syncUpdates(signalsToUpdate);
        }
    }

    /**
     * Obtener señales recientes para el Histórico (Audit Log)
     */
    public async getRecentSignals(limit: number = 10) {
        if (!this.supabase) return [];

        const { data, error } = await this.supabase
            .from('signals_audit')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error || !data) return [];
        return data;
    }

    /**
     * Obtener estadísticas agregadas para el Frontend (Elite Mode)
     */
    public async getPerformanceStats() {
        if (!this.supabase) return { winRate: 0, total: 0, wins: 0, closed: 0, open: 0, profitFactor: 0 };

        const { data, error } = await this.supabase
            .from('signals_audit')
            .select('status, pnl_percent');

        if (error || !data) return { winRate: 0, total: 0, wins: 0, closed: 0, open: 0, profitFactor: 0 };

        const closed = data.filter((s: any) => s.status === 'WIN' || s.status === 'LOSS');
        const winsCount = closed.filter((s: any) => s.status === 'WIN').length;

        // Cálculo de Profit Factor (Métrica Institucional)
        // Profit Factor = Total Gross Profit / Total Gross Loss
        let grossProfit = 0;
        let grossLoss = 0;

        closed.forEach((s: any) => {
            const pnl = s.pnl_percent || 0;
            if (pnl > 0) grossProfit += pnl;
            else grossLoss += Math.abs(pnl);
        });

        const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 99 : 0);

        return {
            total: data.length,
            closed: closed.length,
            wins: winsCount,
            winRate: closed.length > 0 ? (winsCount / closed.length) * 100 : 0,
            open: data.filter((s: any) => s.status === 'OPEN').length,
            profitFactor: Number(profitFactor.toFixed(2))
        };
    }
}

export const signalAuditService = new SignalAuditService();
