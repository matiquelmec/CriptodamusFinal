import TelegramBot from 'node-telegram-bot-api';
import { TradingConfig } from '../core/config/tradingConfig';
import { AIOpportunity } from '../core/types';

/**
 * TELEGRAM SERVICE (Autre-Pilot Notification System)
 * 
 * Goals:
 * 1. Deliver High Confidence Signals to User's Phone
 * 2. Prevent Notification Fatigue (Smart Cooldowns)
 * 3. Provide actionable "at a glance" data
 */
export class TelegramService {
    private bot: TelegramBot | null = null;
    // Cache for Cooldowns: Map<Symbol, Timestamp>
    private lastAlertTime: Map<string, number> = new Map();
    // Cache for Last Score: Map<Symbol, Score> (To alert only on improvements)
    private lastAlertScore: Map<string, number> = new Map();

    constructor() {
        if (TradingConfig.telegram.enabled && TradingConfig.telegram.botToken) {
            try {
                this.bot = new TelegramBot(TradingConfig.telegram.botToken, { polling: false }); // No polling needed, we push
                console.log("✅ Telegram Service Initialized");
            } catch (error) {
                console.error("❌ Failed to initialize Telegram Bot:", error);
            }
        }
    }

    /**
     * Main Entry Point: Receives opportunities from Scanner and filters them
     */
    public async broadcastSignals(opportunities: AIOpportunity[]) {
        if (!this.bot || !TradingConfig.telegram.chatId) return;

        console.log(`[Telegram] Processing ${opportunities.length} candidates...`);

        for (const opp of opportunities) {
            if (this.shouldAlert(opp)) {
                await this.sendOpportunityAlert(opp);
                // Update Cache
                this.lastAlertTime.set(opp.symbol, Date.now());
                this.lastAlertScore.set(opp.symbol, opp.confidenceScore);
            }
        }
    }

    /**
     * Smart Filtering Logic
     */
    private shouldAlert(opp: AIOpportunity): boolean {
        // 1. Minimum Score Filter
        const minScore = TradingConfig.telegram.minScoreAlert || 75;
        if (opp.confidenceScore < minScore) return false;

        // 2. Cooldown Check
        const lastTime = this.lastAlertTime.get(opp.symbol) || 0;
        const now = Date.now();
        const cooldownMs = (TradingConfig.telegram.alertCooldown || 240) * 60 * 1000; // minutes to ms

        if (now - lastTime < cooldownMs) {
            // Already alerted recently. Only override if HUGE improvement or Direction Change (not tracked here yet)
            // Rule: If score improved by > 10 points or entered GOD MODE (>90), override cooldown
            const lastScore = this.lastAlertScore.get(opp.symbol) || 0;

            if (opp.confidenceScore > 90 && lastScore < 90) return true; // Upgrade to God Mode
            if (opp.confidenceScore > lastScore + 10) return true; // Significant improvement

            return false; // Suppress duplicate
        }

        return true;
    }

    /**
     * HTML Formatting & Sending
     */
    private async sendOpportunityAlert(opp: AIOpportunity) {
        if (!this.bot) return;

        const sideIcon = opp.side === 'LONG' ? '🟢' : '🔴';
        const scoreIcon = opp.confidenceScore >= 90 ? '💎 GOD MODE' : opp.confidenceScore >= 80 ? '🔥 HOT' : '⚡';
        const tierIcon = opp.tier === 'S' ? '🏆' : opp.tier === 'A' ? '🅰️' : '🅱️';

        let strategyName = opp.strategy; // Fixed property access logic

        let message = `<b>${sideIcon} SEÑAL INSTITUCIONAL: ${opp.symbol} ${sideIcon}</b>\n`;
        message += `<b>${scoreIcon} Confianza: ${opp.confidenceScore}/100</b> | ${tierIcon} Tier ${opp.tier || 'N/A'}\n`;
        message += `<i>Estrategia: ${strategyName}</i>\n\n`;

        // --- DCA LADDER (ENTRADAS) ---
        if (opp.dcaPlan && opp.dcaPlan.entries.length > 0) {
            message += `📚 <b>PLAN DE ENTRADA (DCA)</b>\n`;
            opp.dcaPlan.entries.forEach(e => {
                const discount = e.distanceFromCurrent !== undefined ? `(${Math.abs(e.distanceFromCurrent).toFixed(2)}%)` : '';
                message += `🔹 <b>Entrada ${e.level}:</b> $${e.price} - <i>${e.positionSize}%</i> ${discount}\n`;
            });
            message += `📉 <b>Precio Promedio (WAP):</b> $${opp.dcaPlan.averageEntry.toFixed(4)}\n\n`;

            // --- SALIDAS (TAKE PROFITS) ---
            const tps = opp.dcaPlan.takeProfits;
            message += `💰 <b>OBJETIVOS (SALIDAS)</b>\n`;
            message += `✅ <b>TP1:</b> $${tps.tp1.price.toFixed(4)} (Asegurar ${tps.tp1.exitSize}%)\n`;
            message += `✅ <b>TP2:</b> $${tps.tp2.price.toFixed(4)} (Gestión ${tps.tp2.exitSize}%)\n`;
            message += `🚀 <b>TP3:</b> $${tps.tp3.price.toFixed(4)} (Moonbag ${tps.tp3.exitSize}%)\n\n`;

            // --- STOP LOSS ---
            message += `🛡️ <b>GESTIÓN DE RIESGO</b>\n`;
            message += `🛑 <b>STOP LOSS:</b> $${opp.dcaPlan.stopLoss.toFixed(4)}\n`;
            message += `⚠️ <b>Riesgo Total:</b> ${opp.dcaPlan.totalRisk.toFixed(2)}% de la cuenta\n\n`;
        } else {
            message += `⚠️ <i>Sin Plan DCA detectado. Revisar Chart.</i>\n\n`;
        }

        // --- EDUCATIONAL REASONING ---
        if (opp.reasoning && Array.isArray(opp.reasoning)) {
            message += `🧠 <b>ANÁLISIS DE IA (Tesis)</b>\n`;
            opp.reasoning.forEach(r => {
                // Clean markdown for Telegram HTML (remove **, __, and leading dashes)
                const cleanR = r.replace(/\*\*/g, '').replace(/__/g, '').replace(/^[-*]\s*/, '');
                message += `• ${cleanR}\n`;
            });
        }

        const disclaimer = `\n<i>⚠️ Criptodamus AI no asesora financieramente. DYOR.</i>`;
        message += disclaimer;

        // RETRY LOGIC (Resilience against ETIMEDOUT)
        const MAX_RETRIES = 3;
        let attempt = 0;
        let success = false;

        while (attempt < MAX_RETRIES && !success) {
            try {
                attempt++;
                await this.bot.sendMessage(TradingConfig.telegram.chatId, message, { parse_mode: 'HTML' });
                console.log(`[Telegram] Sent alert for ${opp.symbol} (Attempt ${attempt})`);
                success = true;
            } catch (error: any) {
                const isTimeout = error.code === 'ETIMEDOUT' || error.message?.includes('ETIMEDOUT') || error.message?.includes('network timeout');

                if (attempt < MAX_RETRIES) {
                    const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
                    console.warn(`[Telegram] Warning: Failed to send ${opp.symbol} (Attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delay}ms... Error: ${error.message}`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error(`[Telegram] FINAL FAILURE: Could not send message for ${opp.symbol} after ${MAX_RETRIES} attempts.`, error);
                }
            }
        }
    }
}

// Singleton Export
export const telegramService = new TelegramService();
