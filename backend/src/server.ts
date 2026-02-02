/**
 * Criptodamus Backend Server
 * API Gateway + WebSocket + Monetización
 * 
 * Migrated to TypeScript
 */

import express from 'express';
// @ts-ignore
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import crypto from 'crypto';
import { predictNextMove } from './ml/inference';
import { signalAuditService } from './services/signalAuditService';

// Import Routes (TypeScript)
import marketRoutes from './api/market';
import donationRoutes from './api/donation';
import proxyRoutes from './api/proxy';

// Import Services
import { binanceStream } from './services/binanceStream';
import { scannerService } from './services/scanner';
import { AIOpportunity } from './core/types';

// Configuración
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

// Render/Proxy Trust (Fix Rate Limit Validation Error)
app.set('trust proxy', 1);

// Middleware de seguridad
app.use(helmet());
app.use(cors({
    origin: '*', // TEMPORARY DEBUG: Allow ALL origins to rule out CORS config issues
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));
app.use(express.json());

// --- RAW ROUTES MOUNTING (Restored) ---
app.use('/api/market', marketRoutes);
app.use('/api/donation', donationRoutes);
app.use('/api/proxy', proxyRoutes);

// ... (Rate Limits)

// Basic Root Route to avoid 404 on home
app.get('/', (req, res) => {
    res.json({
        message: 'Criptodamus Backend API is Online',
        version: '1.0.0',
        docs: '/health'
    });
});

// Health check to verify server is ALIVE
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// SERVICE INITIALIZATION WRAPPER
async function startServices() {
    try {
        console.log("🚀 Starting Core Services...");

        // 0. Scheduler (Cron Jobs)
        try {
            initScheduler();
            console.log("   • Scheduler Active");
        } catch (e) {
            console.error("   ❌ Scheduler Failed:", e);
        }

        // 1. Scanner (AI/ML)
        try {
            console.log("   • Initializing Scanner...");
            scannerService.start();
        } catch (e) {
            console.error("   ❌ Scanner Failed to Start (Non-Fatal):", e);
        }

        // 2. Binance Stream
        try {
            console.log("   • Initializing Binance Stream...");
            binanceStream.start();
        } catch (e) {
            console.error("   ❌ Stream Failed to Start (Non-Fatal):", e);
        }

        // 3. Signal Auditor (Win Rate)
        try {
            console.log("   • Initializing Signal Auditor...");
            const { signalAuditService } = await import('./services/signalAuditService');
            signalAuditService.start();

            // NEW: Connect Signal Auditor to WebSocket (Live Panel)
            signalAuditService.on('active_trades_update', (activeSignals: any[]) => {
                const msg = JSON.stringify({
                    type: 'active_trades', // The message type frontend will listen for
                    data: activeSignals
                });

                // Broadcast to all clients
                clients.forEach((client) => {
                    if (client.ws.readyState === WebSocket.OPEN) {
                        client.ws.send(msg);
                    }
                });
            });
        } catch (e) {
            console.error("   ❌ Auditor Failed to Start:", e);
        }

    } catch (e) {
        console.error("🔥 Critical Service Failure:", e);
    }
}

// GLOBAL ERROR HANDLERS (Prevent Crash)
process.on('uncaughtException', (err) => {
    console.error('💥 UNCAUGHT EXCEPTION:', err);
    // process.exit(1); // DO NOT EXIT - Keep server alive for logs/health check
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 UNHANDLED REJECTION:', reason);
});

// --- ML PREDICTION ENDPOINT ---
app.get('/api/ml/predict', async (req, res) => {
    try {
        const symbol = (req.query.symbol as string) || 'BTCUSDT';
        const prediction = await predictNextMove(symbol);

        if (!prediction) {
            return res.status(503).json({ error: 'Brain not ready or training in progress' });
        }
        res.json(prediction);
    } catch (error) {
        console.error('ML Diagnosis Error:', error);
        res.status(500).json({ error: 'Internal Brain Error' });
    }
});

app.get('/api/ml/stats', async (req, res) => {
    try {
        const stats = await signalAuditService.getAdvancedMLMetrics();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch ML stats' });
    }
});

import { fetchCryptoSentiment, fetchMarketNews } from './services/newsService';
app.get('/api/v1/market/sentiment', async (req, res) => {
    try {
        const symbol = (req.query.symbol as string) || 'BTC';
        const sentiment = await fetchCryptoSentiment(symbol);
        res.json(sentiment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sentiment' });
    }
});

app.get('/api/v1/market/news', async (req, res) => {
    try {
        const currency = (req.query.currency as string) || 'BTC';
        const news = await fetchMarketNews(currency);
        res.json(news);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

// NEW: Global Macro Endpoint (Restored)
import { fetchGlobalMarketData } from './services/globalMarketService';
app.get('/api/macro/global', async (req, res) => {
    try {
        const data = await fetchGlobalMarketData();
        res.json(data);
    } catch (error) {
        console.error("Macro Fetch Error:", error);
        res.status(500).json({ error: 'Failed to fetch global data' });
    }
});


// --- PERFORMANCE & AUDIT ENDPOINT ---
// --- PERFORMANCE & AUDIT ENDPOINT ---
app.get('/api/performance/stats', async (req, res) => {
    try {
        const stats = await signalAuditService.getPerformanceStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch performance stats' });
    }
});

app.get('/api/performance/audit-pass', async (req, res) => {
    try {
        console.log("⚡ [Diagnostic] Triggering Manual Audit Pass...");
        const result = await signalAuditService.forceAuditPass();
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});


app.get('/api/performance/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const history = await signalAuditService.getRecentSignals(limit);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch performance history' });
    }
});

app.get('/api/performance/stream-status', (req, res) => {
    try {
        const snapshot = binanceStream.getSnapshot();
        res.json({
            isAlive: binanceStream.isAlive,
            bufferSize: (binanceStream as any).liquidationBuffer?.length || 0,
            recentLiquidationsCount: snapshot.liquidations.length,
            cvdPairsCount: Object.keys(snapshot.cvd).length,
            timestamp: Date.now()
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stream status' });
    }
});


// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path,
        timestamp: new Date().toISOString()
    });
});

// Iniciar Scheduler (Import Logic)
import { initScheduler, runTrainingJob } from './scheduler';

// Start Server
// (Remove duplicate server declaration if exists above this block in previous state, ensuring only one exists)
const server = createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

interface ClientState {
    ws: WebSocket;
    subscriptions: Set<string>;
    ip: string | undefined;
}

// Manejo de conexiones WebSocket
const clients = new Map<string, ClientState>();

// --- BROADCAST HANDLERS ---

// 1. Binance Stream (Legacy Liquidations/CVD)
binanceStream.subscribe((event: any) => {
    const msgStr = JSON.stringify({ type: event.type, data: event.data });

    clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
            if (event.type === 'liquidation') {
                client.ws.send(msgStr);
            } else if (event.type === 'cvd_update') {
                const symbol = event.data.symbol;
                if (client.subscriptions.has(symbol) || client.subscriptions.has(symbol.toUpperCase())) {
                    client.ws.send(msgStr);
                }
            }
        }
    });
});

// 2. AI Scanner Opportunities (NEW)
scannerService.on('scan_complete', (opportunities: AIOpportunity[]) => {
    const msg = JSON.stringify({
        type: 'ai_opportunities',
        data: opportunities
    });
    console.log(`📡 [WS] Broadcasting ${opportunities.length} AI Opportunities to ${clients.size} clients.`);

    clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(msg);
        }
    });
});

// 3. System Status (Nuclear Shield / Maintenance)
scannerService.on('system_status', (status: any) => {
    const msg = JSON.stringify({
        type: 'system_status',
        data: status
    });
    console.log(`🛡️ [WS] Broadcasting System Status: ${status.status} (${status.reason})`);

    clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(msg);
        }
    });
});

scannerService.on('golden_ticket', (opportunities: AIOpportunity[]) => {
    const msg = JSON.stringify({
        type: 'golden_ticket_alert',
        data: opportunities
    });

    clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(msg);
        }
    });
});


// WS Connection Logic
wss.on('connection', (ws, req) => {
    const clientId = crypto.randomUUID();
    clients.set(clientId, {
        ws,
        subscriptions: new Set(['BTCUSDT']),
        ip: req.socket.remoteAddress
    });

    console.log(`WebSocket client connected: ${clientId}`);

    // Send Initial Snapshot
    // 1. Legacy Snapshot
    const snapshot = binanceStream.getSnapshot();
    ws.send(JSON.stringify({ type: 'snapshot', data: snapshot }));

    // 2. AI Opportunities Snapshot
    const latestOps = scannerService.getLatestOpportunities();
    if (latestOps.length > 0) {
        ws.send(JSON.stringify({ type: 'ai_opportunities', data: latestOps }));
    }

    // 3. System Status Snapshot (Nuclear Shield)
    const currentStatus = scannerService.getLastStatus();
    ws.send(JSON.stringify({ type: 'system_status', data: currentStatus }));

    // 4. Active Trades Snapshot (Live Panel)
    // Note: signalAuditService is imported at top level now.
    if (signalAuditService?.getActiveSignalsSnapshot) {
        const activeTrades = signalAuditService.getActiveSignalsSnapshot();
        if (activeTrades.length > 0) {
            ws.send(JSON.stringify({ type: 'active_trades', data: activeTrades }));
        }
    }

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            handleWebSocketMessage(clientId, data);
        } catch (error) {
            // Ignore
        }
    });

    ws.on('close', () => {
        clients.delete(clientId);
        console.log(`WebSocket client disconnected: ${clientId}`);
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
    });
});

function handleWebSocketMessage(clientId: string, data: any) {
    const client = clients.get(clientId);
    if (!client) return;

    switch (data.type) {
        case 'subscribe':
            if (data.symbols && Array.isArray(data.symbols)) {
                data.symbols.forEach((symbol: string) => {
                    client.subscriptions.add(symbol);
                    binanceStream.addStream(`${symbol.toLowerCase()}@aggTrade`);
                });

                client.ws.send(JSON.stringify({
                    type: 'subscribed',
                    symbols: data.symbols
                }));
            }
            break;

        case 'unsubscribe':
            if (data.symbols && Array.isArray(data.symbols)) {
                data.symbols.forEach((symbol: string) => client.subscriptions.delete(symbol));
                client.ws.send(JSON.stringify({
                    type: 'unsubscribed',
                    symbols: data.symbols
                }));
            }
            break;

        case 'ping':
            client.ws.send(JSON.stringify({ type: 'pong' }));
            break;
    }
}

// --- ADMIN ENDPOINTS ---
app.post('/api/admin/retrain', (req, res) => {
    // Basic protection (TODO: Add proper Auth Middleware)
    const secret = req.headers['x-admin-secret'];
    if (secret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log("⚡ [Admin] Triggering Manual Retraining...");
    runTrainingJob();
    res.json({ status: 'ok', message: 'Training process spawned in background' });
});

// Iniciar servidor
server.listen(PORT, async () => {
    console.log(`
    🚀 Criptodamus Backend Server (TypeScript / Smart Microservice)
    📍 Running on http://localhost:${PORT}
    🔌 WebSocket on ws://localhost:${PORT}/ws
    🧠 AI Scanner Active: 15m Interval
  `);

    // Start Services AFTER server is listening (Prevent boot loop)
    await startServices();
});
