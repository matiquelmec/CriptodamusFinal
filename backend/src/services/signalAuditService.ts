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
        console.log("🛡️ [SignalAudit] Auditoría de Señales Iniciada.");

        // 1. Cargar señales OPEN de la base de datos para seguimiento
        await this.reloadActiveSignals();

        // 2. Iniciar loop de monitoreo cada 1 minuto
        this.auditInterval = setInterval(() => this.performAudit(), 60 * 1000);
    }

    private async reloadActiveSignals() {
        if (!this.supabase) return;

        const { data, error } = await this.supabase
            .from('signals_audit')
            .select('*')
            .eq('status', 'OPEN');

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
                status: 'OPEN',
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
     * Proceso principal de revisión
     */
    private async performAudit() {
        if (this.activeSignals.length === 0) return;

        console.log(`🛡️ [SignalAudit] Ejecutando auditoría sobre ${this.activeSignals.length} señales...`);

        const snapshot = binanceStream.getSnapshot();
        const cvdData = snapshot.cvd;

        const signalsToUpdate = [];

        for (const signal of this.activeSignals) {
            const sym = signal.symbol.toUpperCase().replace('/', '');
            const currentPrice = cvdData[sym]?.price;

            if (!currentPrice) continue;

            let finalStatus: string | null = null;
            let pnl = 0;

            // 1. Verificación de WIN (TP1)
            if (signal.side === 'LONG') {
                if (currentPrice >= signal.tp1) finalStatus = 'WIN';
                else if (currentPrice <= signal.stop_loss) finalStatus = 'LOSS';
            } else {
                if (currentPrice <= signal.tp1) finalStatus = 'WIN';
                else if (currentPrice >= signal.stop_loss) finalStatus = 'LOSS';
            }

            // 2. Verificación de Expiración (Caducidad)
            if (!finalStatus) {
                const ageHours = (Date.now() - Number(signal.created_at)) / (1000 * 60 * 60);
                const limit = signal.timeframe === '15m' ? 6 : 48; // Según plan dinámico
                if (ageHours > limit) finalStatus = 'EXPIRED';
            }

            if (finalStatus) {
                pnl = ((currentPrice - signal.entry_price) / signal.entry_price) * 100 * (signal.side === 'LONG' ? 1 : -1);

                signalsToUpdate.push({
                    id: signal.id,
                    status: finalStatus,
                    closed_at: Date.now(),
                    final_price: currentPrice,
                    pnl_percent: pnl
                });
            }
        }

        // Actualizar en Supabase y Limpiar cache local
        if (signalsToUpdate.length > 0) {
            for (const upd of signalsToUpdate) {
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
                    this.activeSignals = this.activeSignals.filter((s: any) => s.id !== upd.id);
                    console.log(`🎯 [SignalAudit] Señal CERRADA (${upd.status}): ${upd.id} | PnL: ${upd.pnl_percent.toFixed(2)}%`);
                }
            }
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
