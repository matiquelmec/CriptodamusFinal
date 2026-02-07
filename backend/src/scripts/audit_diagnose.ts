import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { scannerService } from './services/scanner';
import { telegramService } from './services/telegramService';
import { AIOpportunity } from './core/types';
import { fetchGlobalMarketData } from './services/globalMarketService';
import { TradingConfig } from './core/config/tradingConfig';

// ESM Polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Env
dotenv.config();

async function runAudit() {
    console.log("\n🕵️‍♂️ INICIANDO AUDITORÍA PROFUNDA DE SISTEMA V3.0 (MODO EXPERTO)");
    console.log("=================================================================");

    // 1. ENVIRONMENT & CONFIG CHECK
    console.log("\n🔍 [1/5] Verificación de Entorno y Configuración:");
    const requiredVars = ['SUPABASE_URL', 'SUPABASE_KEY', 'BINANCE_API_KEY', 'BINANCE_API_SECRET'];
    const missingVars = requiredVars.filter(v => !process.env[v]);

    if (missingVars.length > 0) {
        console.error(`❌ CRÍTICO: Faltan variables de entorno: ${missingVars.join(', ')}`);
    } else {
        console.log("✅ Variables de Entorno Clave: DETECTADAS");
    }

    // Telegram Config
    if (TradingConfig.telegram.enabled && TradingConfig.telegram.botToken && TradingConfig.telegram.chatId) {
        console.log(`✅ Configuración Telegram: OK (Chat ID: ${TradingConfig.telegram.chatId.substring(0, 4)}...)`);
    } else {
        console.warn("⚠️ Configuración Telegram: INCOMPLETA o DESHABILITADA");
    }

    // Tournament Mode
    if (TradingConfig.TOURNAMENT_MODE) {
        console.log(`🏆 MODO TORNEO: ACTIVO (Solo monitoreando ${TradingConfig.assets.tournament_list.length} activos Elite)`);
    } else {
        console.log("🌍 MODO GLOBAL: ACTIVO (Monitoreando mercado completo)");
    }

    // 2. CONNECTIVITY PROBE
    console.log("\n📡 [2/5] Prueba de Conectividad (Ping):");

    // Supabase Ping
    try {
        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
        const startDb = Date.now();
        const { data, error } = await supabase.from('system_metadata').select('count', { count: 'exact', head: true });
        const dbLatency = Date.now() - startDb;

        if (error) throw error;
        console.log(`✅ Supabase DB: CONECTADO (${dbLatency}ms)`);
    } catch (e: any) {
        console.error(`❌ Supabase DB: FALLÓ - ${e.message}`);
    }

    // External API Ping (Global Market)
    try {
        const startApi = Date.now();
        await fetchGlobalMarketData();
        const apiLatency = Date.now() - startApi;
        console.log(`✅ API Externa (Macro): CONECTADO (${apiLatency}ms)`);
    } catch (e: any) {
        console.error(`⚠️ API Externa (Macro): FALLÓ/LENTO - ${e.message}`);
    }

    // 3. SYNTHETIC SIGNAL INJECTION (THE PIPE TEST)
    console.log("\n💉 [3/5] INYECCIÓN DE SEÑAL SINTÉTICA (Prueba de Tubería):");
    console.log("   Intentando inyectar una señal de prueba 'TEST_SIGNAL' para verificar DB, Telegram y Frontend...");

    const syntheticSignal: AIOpportunity = {
        id: 'SYNTHETIC_TEST_' + Date.now(),
        symbol: 'TEST/' + 'USDT', // Split to avoid real tickers
        timestamp: Date.now(),
        timeframe: '1m',
        session: 'AUDIT_TEST',
        strategy: 'SYSTEM_AUDIT_PROBE',
        side: 'LONG',
        confidenceScore: 99, // Force God Mode to bypass filters
        tier: 'S',
        entryZone: { min: 100, max: 101, currentPrice: 100.5 },
        stopLoss: 95,
        takeProfits: { tp1: 105, tp2: 110, tp3: 120 },
        technicalReasoning: "PRUEBA DE AUDITORÍA: Esta es una señal sintética para verificar que las alertas llegan a tu celular y al frontend.",
        reasoning: ["✅ Prueba de Sistema", "✅ Verificación de Telegram", "✅ Verificación de WebSocket"],
        metrics: {
            adx: 50, volume24h: 1000000, rsi: 50,
            volumeExpert: {
                cvd: { trend: 'BULLISH', value: 1000 },
                coinbasePremium: { gap: 10, gapPercent: 0.1, signal: 'NEUTRAL' },
                liquidity: { orderBook: {}, liquidationClusters: [] }
            }
        } as any,
        dcaPlan: {
            averageEntry: 100.5, totalRisk: 1,
            entries: [{ level: 1, price: 100.5, positionSize: 100, distanceFromCurrent: 0 }]
        } as any
    };

    try {
        // A. Inject to Telegram
        // A. Inject to Telegram
        console.log("   📨 Enviando a Telegram (Vía Servicio)...");
        await telegramService.broadcastSignals([syntheticSignal]);
        console.log("   ✅ Telegram: Inyección completada (Servicio).");

        // A.2 RAW PROBE (To rule out Service Logic)
        console.log("   📨 Enviando a Telegram (Vía RAW API Probe)...");
        const TelegramBot = (await import('node-telegram-bot-api')).default;
        if (TradingConfig.telegram.botToken && TradingConfig.telegram.chatId) {
            const rawBot = new TelegramBot(TradingConfig.telegram.botToken, { polling: false });
            try {
                await rawBot.sendMessage(TradingConfig.telegram.chatId, "🧪 <b>PRUEBA DE CONECTIVIDAD FINAL</b>\nSi lees esto, tu Bot Token y ChatID son correctos.\nEl problema estaría en la lógica de filtrado.", { parse_mode: 'HTML' });
                console.log("   ✅ Telegram RAW: Mensaje enviado exitosamente.");
            } catch (rawErr: any) {
                console.error(`   ❌ Telegram RAW FALLÓ: ${rawErr.message} (Code: ${rawErr.code})`);
            }
        } else {
            console.warn("   ⚠️ Telegram RAW: No se pudo probar (Faltan credenciales)");
        }

        // B. Inject to Scanner Event (WebSocket Broadcast)
        console.log("   📡 Emitiendo evento WebSocket 'scan_complete'...");
        scannerService.emit('scan_complete', [syntheticSignal]);
        console.log("   ✅ WebSocket: Evento emitido (Revisa el Frontend 'Oportunidades')");

        // C. Inject to DB via Audit Service
        console.log("   💾 Registrando en Supabase (signals_audit)...");
        const { signalAuditService } = await import('./services/signalAuditService');
        await signalAuditService.registerSignals([syntheticSignal]);
        console.log("   ✅ Base de Datos: Intento de escritura enviado");

    } catch (e: any) {
        console.error(`❌ ERROR EN INYECCIÓN SINTÉTICA: ${e.message}`, e);
    }

    // 4. FULL SYSTEM SCAN (REAL MARKET)
    console.log("\n⚔️ [4/5] ESCANEO DE MERCADO REAL (Forzado):");
    console.log("   Ejecutando scannerService.runFullScan()...");

    // Hook into the event to see what comes back
    const scanPromise = new Promise<void>((resolve) => {
        scannerService.once('scan_complete', (opportunities) => {
            console.log(`\n🎉 RESULTADOS DEL ESCANEO REAL:`);
            console.log(`   Oportunidades Encontradas: ${opportunities.length}`);

            if (opportunities.length === 0) {
                console.log("   ℹ️ Nota: 0 oportunidades es normal en 'Modo Torneo' si el mercado está lateral.");
            } else {
                opportunities.forEach(op => {
                    console.log(`   - ${op.symbol} (${op.side}): Score ${op.confidenceScore} | Strat: ${op.strategy}`);
                });
            }
            resolve();
        });
    });

    // Run the scan
    try {
        await scannerService.runFullScan('SCALP_AGRESSIVE');
        // Wait a bit for the event
        await Promise.race([scanPromise, new Promise(r => setTimeout(r, 30000))]); // 30s timeout
    } catch (e: any) {
        console.error(`❌ ERROR EN ESCANEO REAL: ${e.message}`);
    }

    console.log("\n🏁 [5/5] AUDITORÍA DIAGNÓSTICA FINALIZADA.");
    process.exit(0);
}

runAudit();
