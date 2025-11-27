#!/bin/bash

# 🚀 Script de Inicialización del Backend Comercial
# NO ROMPE NADA - Crea una capa adicional sobre el frontend existente

echo "🔧 Inicializando Backend Comercial para Criptodamus..."

# Crear estructura del backend
mkdir -p backend
cd backend

# Inicializar package.json
cat > package.json << 'EOF'
{
  "name": "criptodamus-backend",
  "version": "0.1.0",
  "description": "Backend comercial para Criptodamus Trading Platform",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:seed": "tsx src/utils/seed.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1",
    "prisma": "^5.7.0",
    "@prisma/client": "^5.7.0",
    "redis": "^4.6.11",
    "ioredis": "^5.3.2",
    "socket.io": "^4.6.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "stripe": "^14.10.0",
    "axios": "^1.6.2",
    "express-rate-limit": "^7.1.5",
    "winston": "^3.11.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.10.4",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/bcryptjs": "^2.4.6",
    "typescript": "^5.3.3",
    "tsx": "^4.6.2",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.11",
    "ts-jest": "^29.1.1",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "prettier": "^3.1.1",
    "nodemon": "^3.0.2"
  }
}
EOF

echo "📦 Instalando dependencias..."
npm install

# Crear estructura de carpetas
mkdir -p src/{api/{routes,middlewares,controllers},services,utils,config,types,models}
mkdir -p prisma
mkdir -p tests

# Crear archivo de configuración TypeScript
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "node",
    "types": ["node", "jest"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
EOF

# Crear archivo de variables de entorno
cat > .env.example << 'EOF'
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/criptodamus?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# Stripe (cuando esté listo)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# External APIs
BINANCE_API_URL=https://data-api.binance.vision/api/v3
COINCAP_API_URL=https://api.coincap.io/v2

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
EOF

cp .env.example .env

# Crear esquema de Prisma
cat > prisma/schema.prisma << 'EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String?
  plan          Plan      @default(FREE)
  isActive      Boolean   @default(true)

  // Limits tracking
  scansToday    Int       @default(0)
  lastScanReset DateTime  @default(now())

  // Relations
  signals       Signal[]
  strategies    Strategy[]
  backtests     Backtest[]

  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Signal {
  id            String    @id @default(uuid())
  userId        String
  symbol        String
  strategy      String
  side          String
  entryPrice    Float
  stopLoss      Float
  takeProfit1   Float
  takeProfit2   Float?
  takeProfit3   Float?
  confidence    Float
  status        SignalStatus @default(ACTIVE)

  // Performance tracking
  actualEntry   Float?
  actualExit    Float?
  profit        Float?

  user          User      @relation(fields: [userId], references: [id])

  createdAt     DateTime  @default(now())
  closedAt      DateTime?
}

model Strategy {
  id            String    @id @default(uuid())
  userId        String
  name          String
  description   String?
  rules         Json      // Condiciones de la estrategia
  isActive      Boolean   @default(true)
  isPublic      Boolean   @default(false)

  // Performance metrics
  winRate       Float?
  avgReturn     Float?

  user          User      @relation(fields: [userId], references: [id])
  backtests     Backtest[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Backtest {
  id            String    @id @default(uuid())
  userId        String
  strategyId    String
  symbol        String
  startDate     DateTime
  endDate       DateTime
  initialCapital Float
  finalCapital  Float

  // Results
  totalReturn   Float
  winRate       Float
  sharpeRatio   Float
  maxDrawdown   Float
  totalTrades   Int
  results       Json      // Detailed trade-by-trade results

  user          User      @relation(fields: [userId], references: [id])
  strategy      Strategy  @relation(fields: [strategyId], references: [id])

  createdAt     DateTime  @default(now())
}

enum Plan {
  FREE
  BASIC
  PRO
  INSTITUTIONAL
}

enum SignalStatus {
  ACTIVE
  WIN
  LOSS
  CANCELLED
}
EOF

# Crear el servidor principal
cat > src/index.ts << 'EOF'
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

// Load environment variables
dotenv.config();

// Initialize services
const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      redis: redis.status,
      websocket: io.engine.clientsCount,
    }
  });
});

// Import routes (to be created)
// app.use('/api/v1/market', marketRoutes);
// app.use('/api/v1/trading', tradingRoutes);
// app.use('/api/v1/auth', authRoutes);

// Example proxy endpoint for Binance
app.get('/api/v1/market/:mode', async (req, res) => {
  try {
    // This is where we'll add caching, rate limiting, etc.
    const { mode } = req.params;

    // Check Redis cache first
    const cached = await redis.get(`market:${mode}`);
    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true
      });
    }

    // If not cached, fetch from Binance (we'll import the original function)
    // const data = await fetchCryptoData(mode);

    // For now, return mock data
    res.json({
      success: true,
      data: [],
      cached: false,
      message: 'Backend proxy ready - connect to real APIs next',
    });

  } catch (error) {
    console.error('Market fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// WebSocket handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe', (symbols: string[]) => {
    // Join rooms for each symbol
    symbols.forEach(symbol => {
      socket.join(`price:${symbol}`);
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Criptodamus Backend running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket ready on ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  redis.disconnect();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
EOF

# Crear middleware de cache
cat > src/api/middlewares/cache.middleware.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const cacheMiddleware = (ttl: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `cache:${req.originalUrl}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        res.locals.cached = true;
        return res.json(JSON.parse(cached));
      }

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = (body: any) => {
        redis.setex(key, ttl, JSON.stringify(body));
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('Cache error:', error);
      next(); // Continue without cache if error
    }
  };
};
EOF

# Crear middleware de rate limiting
cat > src/api/middlewares/rateLimit.middleware.ts << 'EOF'
import rateLimit from 'express-rate-limit';

export const createRateLimiter = (maxRequests: number = 100, windowMs: number = 60000) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: res.getHeader('Retry-After'),
      });
    },
  });
};

// Different limiters for different endpoints
export const apiLimiter = createRateLimiter(100, 60000); // 100 req per minute
export const authLimiter = createRateLimiter(5, 60000); // 5 req per minute
export const heavyLimiter = createRateLimiter(10, 60000); // 10 req per minute for heavy operations
EOF

# Crear Docker files
cat > Dockerfile << 'EOF'
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
RUN npx prisma generate

EXPOSE 3001
CMD ["npm", "start"]
EOF

cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/criptodamus
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./src:/app/src
      - ./prisma:/app/prisma

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=criptodamus
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
EOF

echo "✅ Backend inicializado con éxito!"
echo ""
echo "📝 Próximos pasos:"
echo "1. cd backend"
echo "2. Configurar .env con tus credenciales"
echo "3. docker-compose up -d (o npm run dev para desarrollo local)"
echo "4. npm run db:migrate (para crear las tablas)"
echo "5. Visitar http://localhost:3001/health"
echo ""
echo "🔗 Para conectar el frontend:"
echo "1. Crear archivo .env en el frontend:"
echo "   VITE_API_URL=http://localhost:3001"
echo "   VITE_WS_URL=ws://localhost:3001"
echo "2. El frontend automáticamente usará el backend si está disponible"
echo ""
echo "🎉 ¡Listo para escalar a nivel mundial!"