/**
 * Criptodamus Backend Server
 * API Gateway + WebSocket + Monetización
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import crypto from 'crypto';

// Importar rutas
import marketRoutes from './api/market.js';
import donationRoutes from './api/donation.js';
import proxyRoutes from './api/proxy.js';

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
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // 60 requests por minuto
  message: 'Demasiadas solicitudes, por favor intenta de nuevo más tarde.'
});
app.use('/api', limiter);

// Rate limiting estricto para donaciones
const donationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5 // 5 intentos por 15 minutos
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

// Root Endpoint (Welcome)
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Criptodamus Backend is Live',
    service: 'Market Data & WebSocket API',
    status: 'running',
    endpoints: {
      health: '/health',
      docs: '/api/docs (Not Implemented)'
    }
  });
});

// Rutas API
app.use('/api/v1/market', marketRoutes);
app.use('/api/donation', donationRoutes);
app.use('/api/proxy', proxyRoutes);

// Error handler
app.use((err, req, res, next) => {
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

// Importar servicio de Binance
import { binanceStream } from './services/binanceStream.js';

// Iniciar conexión con Binance
binanceStream.start();

// Crear servidor HTTP
const server = createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

// Manejo de conexiones WebSocket
const clients = new Map();

// Suscribirse a eventos de Binance y retransmitir a todos los clientes conectados
binanceStream.subscribe((event) => {
  const msgStr = JSON.stringify({ type: event.type, data: event.data });

  clients.forEach((client) => {
    if (client.ws.readyState === 1) { // OPEN
      // Lógica de filtrado:
      // - Liquidaciones: Enviar a todos (Global)
      // - CVD/AggTrade: Enviar solo si está suscrito al símbolo

      if (event.type === 'liquidation') {
        client.ws.send(msgStr);
      } else if (event.type === 'cvd_update') {
        // Verificar si el cliente está suscrito a este símbolo
        const symbol = event.data.symbol; // e.g. BTCUSDT
        // Normalizar para check
        if (client.subscriptions.has(symbol) || client.subscriptions.has(symbol.toUpperCase())) {
          client.ws.send(msgStr);
        }
      }
    }
  });
});

wss.on('connection', (ws, req) => {
  const clientId = crypto.randomUUID();
  clients.set(clientId, {
    ws,
    subscriptions: new Set(['BTCUSDT']), // Default subscription
    ip: req.socket.remoteAddress
  });

  console.log(`WebSocket client connected: ${clientId}`);

  // Enviar Snapshot Inicial (Liquidaciones recientes + Estado CVD)
  const snapshot = binanceStream.getSnapshot();
  ws.send(JSON.stringify({
    type: 'snapshot',
    data: snapshot
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleWebSocketMessage(clientId, data);
    } catch (error) {
      // Ignore parse errors
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

// Manejo de mensajes WebSocket del Cliente
function handleWebSocketMessage(clientId, data) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (data.type) {
    case 'subscribe':
      if (data.symbols && Array.isArray(data.symbols)) {
        data.symbols.forEach(symbol => {
          client.subscriptions.add(symbol);
          // Pedir al servicio que escuche este símbolo si no lo hace aún
          // Nota: aggTrade es costoso, usar con cuidado.
          // Por eficiencia, binanceStream.js debería tener un método para añadir dinámicamente.
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
        data.symbols.forEach(symbol => client.subscriptions.delete(symbol));
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
    🚀 Criptodamus Backend Server (REAL DATA MODE)
    📍 Running on http://localhost:${PORT}
    🔌 WebSocket on ws://localhost:${PORT}/ws
    🌊 Connected to Binance Futures Stream
  `);
});