/**
 * Market API Routes
 * Proxy con caché para APIs de crypto
 */

import express from 'express';
import axios from 'axios';
import NodeCache from 'node-cache';

const router = express.Router();
const cache = new NodeCache({ stdTTL: 30 }); // Cache de 30 segundos

/**
 * GET /api/v1/market/prices
 * Obtiene precios de múltiples criptomonedas
 */
router.get('/prices', async (req, res) => {
  try {
    const symbols = req.query.symbols?.split(',') || ['BTC', 'ETH', 'SOL'];
    const cacheKey = `prices:${symbols.join(',')}`;

    // Verificar caché
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ data: cached, cached: true });
    }

    // Obtener precios
    const prices = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          // Intentar Binance
          const response = await axios.get(
            `https://api.binance.com/api/v3/ticker/24hr`,
            {
              params: { symbol: `${symbol}USDT` },
              timeout: 3000
            }
          );

          return {
            symbol,
            price: parseFloat(response.data.lastPrice),
            change24h: parseFloat(response.data.priceChangePercent),
            volume24h: parseFloat(response.data.volume),
            high24h: parseFloat(response.data.highPrice),
            low24h: parseFloat(response.data.lowPrice),
            source: 'binance'
          };
        } catch (error) {
          // Fallback a CoinCap
          try {
            const response = await axios.get(
              `https://api.coincap.io/v2/assets/${symbol.toLowerCase()}`,
              { timeout: 3000 }
            );

            return {
              symbol,
              price: parseFloat(response.data.data.priceUsd),
              change24h: parseFloat(response.data.data.changePercent24Hr),
              volume24h: parseFloat(response.data.data.volumeUsd24Hr),
              marketCap: parseFloat(response.data.data.marketCapUsd),
              source: 'coincap'
            };
          } catch {
            return {
              symbol,
              price: 0,
              error: true,
              message: 'Unable to fetch price'
            };
          }
        }
      })
    );

    // Guardar en caché
    cache.set(cacheKey, prices);

    res.json({
      data: prices,
      timestamp: Date.now(),
      cached: false
    });

  } catch (error) {
    console.error('Market prices error:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

/**
 * GET /api/v1/market/signals
 * Genera señales de trading básicas
 */
router.get('/signals', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'BTC';
    const cacheKey = `signals:${symbol}`;

    // Verificar caché
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ data: cached, cached: true });
    }

    // Obtener datos de mercado
    const [priceData, klines] = await Promise.all([
      axios.get(`https://api.binance.com/api/v3/ticker/24hr`, {
        params: { symbol: `${symbol}USDT` }
      }),
      axios.get(`https://api.binance.com/api/v3/klines`, {
        params: {
          symbol: `${symbol}USDT`,
          interval: '1h',
          limit: 100
        }
      })
    ]);

    // Calcular indicadores básicos
    const closes = klines.data.map(k => parseFloat(k[4]));
    const volumes = klines.data.map(k => parseFloat(k[5]));

    // RSI simple
    const rsi = calculateRSI(closes, 14);

    // Media móvil
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;

    // Generar señal
    const currentPrice = parseFloat(priceData.data.lastPrice);
    let signal = 'NEUTRAL';
    let strength = 50;

    if (rsi < 30 && currentPrice > sma20) {
      signal = 'BUY';
      strength = 80;
    } else if (rsi > 70 && currentPrice < sma20) {
      signal = 'SELL';
      strength = 80;
    } else if (currentPrice > sma20 && sma20 > sma50) {
      signal = 'BUY';
      strength = 60;
    } else if (currentPrice < sma20 && sma20 < sma50) {
      signal = 'SELL';
      strength = 60;
    }

    const signalData = {
      symbol,
      signal,
      strength,
      price: currentPrice,
      indicators: {
        rsi,
        sma20,
        sma50,
        volume: volumes[volumes.length - 1]
      },
      timestamp: Date.now()
    };

    // Guardar en caché
    cache.set(cacheKey, signalData, 60); // Cache por 1 minuto

    res.json({
      data: signalData,
      cached: false
    });

  } catch (error) {
    console.error('Signals error:', error);
    res.status(500).json({ error: 'Failed to generate signals' });
  }
});

/**
 * GET /api/v1/market/trending
 * Obtiene las criptos trending
 */
router.get('/trending', async (req, res) => {
  try {
    const cached = cache.get('trending');
    if (cached) {
      return res.json({ data: cached, cached: true });
    }

    // Obtener top gainers de Binance
    const response = await axios.get(
      'https://api.binance.com/api/v3/ticker/24hr',
      { timeout: 5000 }
    );

    const usdtPairs = response.data
      .filter(t => t.symbol.endsWith('USDT'))
      .map(t => ({
        symbol: t.symbol.replace('USDT', ''),
        price: parseFloat(t.lastPrice),
        change24h: parseFloat(t.priceChangePercent),
        volume: parseFloat(t.volume)
      }))
      .sort((a, b) => b.change24h - a.change24h)
      .slice(0, 10);

    cache.set('trending', usdtPairs, 300); // Cache 5 minutos

    res.json({
      data: usdtPairs,
      cached: false,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ error: 'Failed to fetch trending' });
  }
});

// Función helper para calcular RSI
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export default router;