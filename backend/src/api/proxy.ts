/**
 * Proxy API Routes (TypeScript Version)
 * Proxy seguro para APIs externas
 */

import express, { Request, Response } from 'express';
import axios from 'axios';
import NodeCache from 'node-cache';

const router = express.Router();
const cache = new NodeCache({ stdTTL: 10 }); // Cache de 10 segundos para proxy

interface ApiConfig {
    baseURL: string;
    rateLimit: number; // requests por minuto
    endpoints: string[];
}

// Configuración de APIs permitidas
const ALLOWED_APIS: Record<string, ApiConfig> = {
    binance: {
        baseURL: 'https://api.binance.com',
        rateLimit: 100, // requests por minuto
        endpoints: [
            '/api/v3/ticker/price',
            '/api/v3/ticker/24hr',
            '/api/v3/klines',
            '/api/v3/exchangeInfo'
        ]
    },
    coincap: {
        baseURL: 'https://api.coincap.io',
        rateLimit: 200,
        endpoints: [
            '/v2/assets',
            '/v2/rates',
            '/v2/exchanges'
        ]
    },
    coingecko: {
        baseURL: 'https://api.coingecko.com',
        rateLimit: 50,
        endpoints: [
            '/api/v3/simple/price',
            '/api/v3/coins/markets',
            '/api/v3/trending'
        ]
    }
};

/**
 * Proxy genérico para APIs permitidas
 */
router.get('/:api/*', async (req: Request, res: Response) => {
    try {
        const { api } = req.params;
        const path = '/' + req.params[0];

        // Fix: Use req.query properly or use raw query string (less safe but keeps compat)
        // In TS, req.query is ParsedQs. We can serialize it.
        const queryString = new URLSearchParams(req.query as any).toString();

        // Verificar si la API está permitida
        if (!ALLOWED_APIS[api]) {
            return res.status(403).json({ error: 'API not allowed' });
        }

        const apiConfig = ALLOWED_APIS[api];

        // Verificar si el endpoint está permitido
        const isAllowed = apiConfig.endpoints.some(endpoint =>
            path.startsWith(endpoint)
        );

        if (!isAllowed) {
            return res.status(403).json({ error: 'Endpoint not allowed' });
        }

        // Construir URL
        const url = `${apiConfig.baseURL}${path}${queryString ? '?' + queryString : ''}`;
        const cacheKey = `proxy:${api}:${path}:${queryString}`;

        // Verificar caché
        const cached = cache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        // Hacer request
        const response = await axios.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Criptodamus/1.0'
            }
        });

        // Guardar en caché
        cache.set(cacheKey, response.data);

        // Añadir headers de caché para el cliente
        res.set('Cache-Control', 'public, max-age=10');
        res.json(response.data);

    } catch (error: any) {
        console.error('Proxy error:', error.message);

        if (error.response) {
            res.status(error.response.status).json({
                error: error.response.data || 'External API error',
                api: req.params.api,
                path: req.params[0]
            });
        } else {
            res.status(500).json({
                error: 'Proxy request failed',
                message: error.message
            });
        }
    }
});

/**
 * POST proxy (solo para APIs específicas que lo requieran)
 */
router.post('/:api/*', async (req: Request, res: Response) => {
    // Por ahora no permitimos POST a través del proxy
    res.status(405).json({ error: 'POST not allowed through proxy' });
});

export default router;
