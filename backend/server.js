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

// Crear servidor HTTP
const server = createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

// Manejo de conexiones WebSocket
const clients = new Map();

wss.on('connection', (ws, req) => {
  const clientId = crypto.randomUUID();
  clients.set(clientId, {
    ws,
    subscriptions: new Set(),
    ip: req.socket.remoteAddress
  });

  console.log(`WebSocket client connected: ${clientId}`);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleWebSocketMessage(clientId, data);
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`WebSocket client disconnected: ${clientId}`);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });

  // Enviar mensaje de bienvenida
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    timestamp: Date.now()
  }));
});

// Manejo de mensajes WebSocket
function handleWebSocketMessage(clientId, data) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (data.type) {
    case 'subscribe':
      if (data.symbols && Array.isArray(data.symbols)) {
        data.symbols.forEach(symbol => client.subscriptions.add(symbol));
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

    default:
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Unknown message type'
      }));
  }
}

// Broadcast de precios (simulado - en producción vendría de un feed real)
setInterval(() => {
  const priceUpdate = {
    type: 'price_update',
    data: {
      BTC: Math.random() * 1000 + 40000,
      ETH: Math.random() * 100 + 2800,
      SOL: Math.random() * 10 + 100
    },
    timestamp: Date.now()
  };

  clients.forEach((client) => {
    if (client.ws.readyState === 1) { // WebSocket.OPEN
      // Filtrar solo los símbolos suscritos
      const subscribedData = {};
      client.subscriptions.forEach(symbol => {
        if (priceUpdate.data[symbol]) {
          subscribedData[symbol] = priceUpdate.data[symbol];
        }
      });

      if (Object.keys(subscribedData).length > 0) {
        client.ws.send(JSON.stringify({
          ...priceUpdate,
          data: subscribedData
        }));
      }
    }
  });
}, 5000); // Actualizar cada 5 segundos

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`
    🚀 Criptodamus Backend Server
    📍 Running on http://localhost:${PORT}
    🔌 WebSocket on ws://localhost:${PORT}/ws
    🏥 Health check: http://localhost:${PORT}/health

    Available endpoints:
    - GET  /api/v1/market/prices
    - GET  /api/v1/market/signals
    - POST /api/donation/create-preference
    - GET  /api/proxy/binance/*
    - GET  /api/proxy/coincap/*
  `);
});