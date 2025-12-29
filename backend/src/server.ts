/**
 * Criptodamus Backend Server
 * API Gateway + WebSocket + Monetización
 * 
 * Migrated to TypeScript
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import crypto from 'crypto';

// Import Routes (TypeScript)
import marketRoutes from './api/market';
import donationRoutes from './api/donation';
import proxyRoutes from './api/proxy';

// Import Services
// @ts-ignore
import { binanceStream } from './services/binanceStream.js';
import { scannerService } from './services/scanner';
import { AIOpportunity } from './core/types';

// Configuración
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de seguridad
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());

// Rate limiting global
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    message: 'Demasiadas solicitudes, por favor intenta de nuevo más tarde.'
});
app.use('/api', limiter);

// Rate limiting estricto para donaciones
const donationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5
});
app.use('/api/donation', donationLimiter);

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Root Endpoint
app.get('/', (req, res) => {
    res.json({
        message: '🚀 Criptodamus Backend is Live (TS Mode)',
        service: 'Market Data & WebSocket API + AI Scanner',
        status: 'running',
        endpoints: {
            health: '/health',
            market: '/api/v1/market'
        }
    });
});

// Rutas API
app.use('/api/v1/market', marketRoutes);
app.use('/api/donation', donationRoutes);
app.use('/api/proxy', proxyRoutes);

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

// Iniciar conexión con Binance (Legacy Stream)
try {
    binanceStream.start();
} catch (e) {
    console.error("Failed to start Binance Stream:", e);
}

// Iniciar Scanner Service (AI)
scannerService.start();

// Crear servidor HTTP
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

// Iniciar servidor
server.listen(PORT, () => {
    console.log(`
    🚀 Criptodamus Backend Server (TypeScript / Smart Microservice)
    📍 Running on http://localhost:${PORT}
    🔌 WebSocket on ws://localhost:${PORT}/ws
    🧠 AI Scanner Active: 15m Interval
  `);
});
