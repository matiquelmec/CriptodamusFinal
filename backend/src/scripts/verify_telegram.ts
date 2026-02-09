import { telegramService } from '../services/telegramService';
import { AIOpportunity } from '../core/types';

// Mock High Quality Opportunity
const mockOpp: AIOpportunity = {
    id: 'test-alert-1',
    symbol: 'TEST/USDT',
    confidenceScore: 92, // God Mode
    side: 'LONG',
    timeframe: '15m',
    session: 'LONDON_OPEN',
    riskRewardRatio: 3,
    strategy: 'GOD_MODE_TEST',
    tier: 'S',
    reasoning: ['✅ Prueba de Sistema', '🚀 Señal de Alta Convicción', '🤖 Bot Operativo'],
    timestamp: Date.now(),
    dcaPlan: {
        entries: [
            { price: 100, level: 1, positionSize: 40, factors: ['Muro de Compra'], distanceFromCurrent: 0 }
        ],
        averageEntry: 97.9,
        stopLoss: 93,
        takeProfits: {
            tp1: { price: 105, exitSize: 40 },
            tp2: { price: 110, exitSize: 30 },
            tp3: { price: 150, exitSize: 30 }
        },
        totalRisk: 2
    },
    metrics: {} as any
};

console.log("🚀 Enviando Alerta de Prueba...");
telegramService.broadcastSignals([mockOpp]).then(() => {
    console.log("✅ Alerta enviada (Revisa tu Telegram)");
    // process.exit(0); // Optional, let it finish naturally
});
