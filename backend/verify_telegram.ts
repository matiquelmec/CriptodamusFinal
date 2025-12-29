import { telegramService } from './src/services/telegramService';
import { AIOpportunity } from './src/core/types';

// Mock High Quality Opportunity
const mockOpp: AIOpportunity = {
    id: 'test-alert-1',
    symbol: 'TEST/USDT',
    confidenceScore: 92, // God Mode
    signalSide: 'LONG',
    signalType: 'SCALP',
    tier: 'S',
    primaryStrategy: 'GOD_MODE_TEST',
    strategyId: 'test_strategy',
    reasoning: ['✅ Prueba de Sistema', '🚀 Señal de Alta Convicción', '🤖 Bot Operativo'],
    timestamp: Date.now(),
    dcaPlan: {
        entries: [
            { price: 100, level: 1, positionSize: 40, confluenceScore: 5, factors: ['Muro de Compra'], distanceFromCurrent: 0 },
            { price: 98, level: 2, positionSize: 30, confluenceScore: 4, factors: ['Fib 0.618'], distanceFromCurrent: 2 },
            { price: 95, level: 3, positionSize: 30, confluenceScore: 5, factors: ['Soporte Diario'], distanceFromCurrent: 5 }
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
    indicators: {} as any
};

console.log("🚀 Enviando Alerta de Prueba...");
telegramService.broadcastSignals([mockOpp]).then(() => {
    console.log("✅ Alerta enviada (Revisa tu Telegram)");
    // process.exit(0); // Optional, let it finish naturally
});
