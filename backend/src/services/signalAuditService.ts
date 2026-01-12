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

    private processingSignatures = new Set<string>();

    /**
     * Registra una nueva señal recibida del Scanner
     */
    public async registerSignals(opportunities: AIOpportunity[]) {
        if (!this.supabase) return;

        for (const opp of opportunities) {
            const sigKey = `${opp.symbol}-${opp.side}`; // e.g. "FIL/USDT-SHORT"

            // 0. CHECK LOCK (Concurrency Protection)
            if (this.processingSignatures.has(sigKey)) {
                console.log(`🛡️ [SignalAudit] Bloqueado por Race Condition: ${sigKey}`);
                continue;
            }

            // 1. CHECK ACTIVE SIGNALS (Database/Cache Protection)
            // Deduplicación ESTRICTA: Normalizamos símbolos para evitar errores FIL/USDT vs FILUSDT
            const isDuplicate = this.activeSignals.find((s: any) =>
                s.symbol.replace('/', '') === opp.symbol.replace('/', '') &&
                s.side === opp.side &&
                ['PENDING', 'ACTIVE', 'OPEN'].includes(s.status)
            );

            if (isDuplicate) {
                // console.log(`🛡️ [SignalAudit] Duplicado Detectado (Cache): ${sigKey}`);
                continue;
            }

            // LOCK IMMEDIATELY
            this.processingSignatures.add(sigKey);

            // 2. CHECK REVERSAL (Stop & Reverse / Hedge Protecion)
            // Si existe una señal opuesta (ej: viene SHORT y ya hay LONG), cerramos la vieja.
            const oppositeSide = opp.side === 'LONG' ? 'SHORT' : 'LONG';
            const reversalSignal = this.activeSignals.find((s: any) =>
                s.symbol.replace('/', '') === opp.symbol.replace('/', '') &&
                s.side === oppositeSide &&
                ['PENDING', 'ACTIVE', 'OPEN'].includes(s.status)
            );

            if (reversalSignal) {
                console.log(`🔄 [SignalAudit] REVERSAL DETECTED: New ${opp.side} vs Old ${oppositeSide} (${reversalSignal.id})`);

                // Calcular precio de cierre para la vieja
                const closePrice = opp.entryZone.currentPrice || opp.entryZone.max;
                let finalStatus = 'EXPIRED'; // Default for PENDING
                let pnl = 0;

                if (reversalSignal.status === 'ACTIVE' || reversalSignal.status === 'OPEN') {
                    // Si estaba activa, realizamos PnL al precio actual
                    pnl = ((closePrice - reversalSignal.entry_price) / reversalSignal.entry_price) * 100 * (reversalSignal.side === 'LONG' ? 1 : -1);
                    finalStatus = pnl >= 0 ? 'WIN' : 'LOSS'; // Logic simplificada: Salida por Reversal
                }

                // Cerrar la señal vieja en DB
                await this.syncUpdates([{
                    id: reversalSignal.id,
                    status: finalStatus, // O podríamos usar un status 'REVERSED' si quisiéramos ser específicos
                    closed_at: Date.now(),
                    final_price: closePrice,
                    pnl_percent: pnl
                }]);

                // Eliminar del array local inmediatamente
                this.activeSignals = this.activeSignals.filter(s => s.id !== reversalSignal.id);
            }

            // 3. CHECK DATABASE (Cross-Instance Protection)
            // Consultamos directamente a la DB para ver si existe el par activo.
            // Esto protege si hay otra instancia corriendo (Local vs Cloud) o si el cache local falló.
            const { count } = await this.supabase
                .from('signals_audit')
                .select('*', { count: 'exact', head: true })
                .eq('symbol', opp.symbol)
                .eq('side', opp.side)
                .in('status', ['PENDING', 'ACTIVE', 'OPEN']);

            if (count && count > 0) {
                // console.log(`🛡️ [SignalAudit] Duplicado Detectado (DB): ${sigKey}`);
                continue;
            }

            try {
                // SMART EXECUTION: Verificar activación inmediata
                const entryTarget = opp.entryZone.currentPrice || opp.entryZone.max;
                const buffer = entryTarget * 0.003;
                const currentPrice = opp.entryZone.currentPrice || 0;

                let initialStatus = 'PENDING';

                if (currentPrice > 0) {
                    const canEnterNow = (opp.side === 'LONG')
                        ? currentPrice <= (entryTarget + buffer)
                        : currentPrice >= (entryTarget - buffer);

                    if (canEnterNow) {
                        initialStatus = 'ACTIVE';
                        console.log(`⚡ [SignalAudit] Ejecución Inmediata (Market): ${opp.symbol} @ ${currentPrice}`);
                    }
                }

                const payload = {
                    signal_id: opp.id,
                    symbol: opp.symbol,
                    side: opp.side,
                    status: initialStatus,
                    strategy: opp.strategy,
                    timeframe: opp.timeframe,
                    entry_price: entryTarget,
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

                if (error) {
                    console.error("❌ [SignalAudit] Error inserting signal:", error.message);
                }

                if (!error && data) {
                    this.activeSignals.push(data[0]);
                    const streamSymbol = opp.symbol.toLowerCase().replace('/', '') + '@aggTrade';
                    binanceStream.addStream(streamSymbol);
                    console.log(`✅ [SignalAudit] Signal Registered: ${opp.symbol} ${opp.side} (${opp.id})`);
                }
            } finally {
                // UNLOCK ALWAYS
                this.processingSignatures.delete(sigKey);
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

            // 0. Sanity Check: Ignorar precios absurdos (Protección contra glitches de API)
            // Si el precio se desvía más del 15% del precio de entrada de golpe, es probablemente un error de data feed.
            // Excepción: Monedas muy volátiles podrían necesitar ajuste, pero 15% en un tick es "Flash Crash" o Bug.
            if (signal.entry_price > 0) {
                const deviation = Math.abs((currentPrice - signal.entry_price) / signal.entry_price);
                if (deviation > 0.15 && signal.status !== 'ACTIVE') {
                    // Solo filtrar si NO está activa (evitar activar por error). 
                    // Si YA está activa, un flash crash real debería stoparla, pero 15% instantáneo suele ser glitch.
                    // Para seguridad, lo ignoramos si es PENDING. Si es ACTIVE, requerimos confirmación (future improvement).
                    // Por ahora, ignoramos desviaciones > 15% para todos para evitar PNL -40%.
                    console.warn(`⚠️ [SignalAudit] Anomalía de precio detectada para ${signal.symbol}: ${currentPrice} vs Entry ${signal.entry_price} (${(deviation * 100).toFixed(2)}%). Ignorando.`);
                    continue;
                }
                // Corrección: Aplicar filtro general.
                if (deviation > 0.15) continue;
            }

            // FASE 1: Verificación de Entrada ("Smart Execution")
            if (signal.status === 'PENDING' || signal.status === 'OPEN') {
                const entryPrice = signal.entry_price;
                // Buffer relajado (0.3%) - Standard Institucional para Volatilidad/Spread
                const buffer = entryPrice * 0.003;

                // 1. Marketable Check: Si el precio YA es mejor o igual a la entrada, entramos.
                // LONG: Precio actual <= Entrada (+buffer)
                // SHORT: Precio actual >= Entrada (-buffer)
                const entryTouched = (signal.side === 'LONG')
                    ? currentPrice <= (entryPrice + buffer)
                    : currentPrice >= (entryPrice - buffer);

                if (entryTouched) {
                    newStatus = 'ACTIVE';
                    console.log(`🚀 [SignalAudit] Entrada ACTIVADA (SmartExec): ${signal.symbol} ${signal.side} @ ${currentPrice} (Entry: ${entryPrice})`);
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
            // SOLO expirar señales PENDING. Las ACTIVE son trades abiertos que deben tocar TP/SL.
            if (signal.status === 'PENDING') {
                const limit = signal.timeframe === '15m' ? 4 : 48; // Reducido a 4h para scalping

                if (ageHours > limit) {
                    signalsToUpdate.push({
                        id: signal.id,
                        status: 'EXPIRED',
                        closed_at: Date.now(),
                        final_price: signal.entry_price,
                        pnl_percent: 0
                    });
                }
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
            open: data.filter((s: any) => ['OPEN', 'ACTIVE', 'PENDING'].includes(s.status)).length,
            profitFactor: Number(profitFactor.toFixed(2))
        };
    }
}

export const signalAuditService = new SignalAuditService();
