
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

// Cargar .env desde la raíz del backend
dotenv.config({ path: path.join(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ ERROR: Faltan SUPABASE_URL o SUPABASE_KEY en el archivo .env');
    process.exit(1);
}

// Cliente Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Configuración
const SYMBOL = process.argv[2] || 'BTCUSDT';
const TIMEFRAME = '15m'; // Timeframe óptimo para ML
const LIMIT = 1000; // Máximo por request de Binance
const TOTAL_CANDLES = 75000; // ~2 Años de data (70,080 + buffer)

async function fetchBinanceCandles(symbol: string, interval: string, startTime?: number, endTime?: number) {
    let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${LIMIT}`;
    if (startTime) url += `&startTime=${startTime}`;
    if (endTime) url += `&endTime=${endTime}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance Error: ${res.statusText}`);
    const data: any = await res.json();
    return data; // [time, open, high, low, close, vol, closeTime, ...]
}

async function ingestHistory() {
    console.log(`🚀 INICIANDO INGESTIÓN CEREBRAL PARA: ${SYMBOL} (${TIMEFRAME})`);
    console.log(`🎯 Objetivo: Guardar últimas ${TOTAL_CANDLES} velas en Supabase...`);

    let candlesCollected = 0;
    let endTime = Date.now(); // Empezamos desde hoy hacia atrás

    while (candlesCollected < TOTAL_CANDLES) {
        try {
            console.log(`📡 Descargando lote terminando en ${new Date(endTime).toISOString()}...`);

            // Binance devuelve del más viejo al más nuevo. 
            // Para ir hacia atrás, pedimos el bloque que termina en 'endTime'.
            // Pero la API de klines usa 'endTime' como limite derecho inclusivo.
            const rawCandles = await fetchBinanceCandles(SYMBOL, TIMEFRAME, undefined, endTime);

            if (!rawCandles || rawCandles.length === 0) {
                console.log("⚠️ No más datos disponibles.");
                break;
            }

            // Mapear a formato DB
            const formattedCandles = rawCandles.map((c: any[]) => ({
                symbol: SYMBOL,
                timeframe: TIMEFRAME,
                timestamp: c[0],
                open: parseFloat(c[1]),
                high: parseFloat(c[2]),
                low: parseFloat(c[3]),
                close: parseFloat(c[4]),
                volume: parseFloat(c[5])
            }));

            // Insertar en Supabase
            const { error } = await supabase
                .from('market_candles')
                .upsert(formattedCandles, { onConflict: 'symbol, timeframe, timestamp' });

            if (error) {
                console.error('❌ Error insertando en Supabase:', error.message);
            } else {
                console.log(`✅ Guardadas ${formattedCandles.length} velas.`);
            }

            candlesCollected += formattedCandles.length;

            // Actualizar endTime para el siguiente loop (hacia el pasado)
            // El primer elemento del array es el más antiguo. 
            // Restamos 1ms para no duplicarlo en la siguiente query.
            endTime = rawCandles[0][0] - 1;

            // Rate Limit
            await new Promise(r => setTimeout(r, 300));

        } catch (e) {
            console.error("❌ Fallo en el loop:", e);
            break;
        }
    }

    console.log(`\n🎉 PROCESO COMPLETADO. Total velas: ${candlesCollected}`);
    console.log("🧠 La memoria a largo plazo ha sido actualizada.");
}

ingestHistory();
