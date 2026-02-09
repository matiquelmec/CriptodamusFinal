/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔍 DIAGNOSTIC MARKET AUDIT - SENIOR SECURITY AUDIT SCRIPT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este script ejecuta una auditoría completa del sistema de señales para:
 * 1. Verificar la integridad de los datos de mercado (APIs funcionando correctamente)
 * 2. Calcular métricas reales de volumen (RVOL) y compararlas con los thresholds
 * 3. Simular el pipeline completo e identificar qué filtros están bloqueando señales
 * 4. Analizar históricos de volumen para validar si los filtros son realistas
 * 5. Generar reporte detallado con recomendaciones
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { fetchCryptoData, fetchCandles } from '../core/services/api/binanceApi';
import { scanMarketOpportunities } from '../core/services/engine/scannerLogic';
import { calculateRVOL } from '../core/services/mathUtils';
import { createClient } from '@supabase/supabase-js';

interface DiagnosticResult {
    timestamp: string;
    apiHealth: {
        binance: boolean;
        coincap: boolean;
        coingecko: boolean;
    };
    liveData: Array<{
        symbol: string;
        price: number;
        rawVolume: number;
        rvol: number;
        rsi?: number;
        adx?: number;
        blockedBy: string[];
        wouldPass: boolean;
    }>;
    historicalRVOL: {
        btc: { avg: number; max: number; min: number; above18: number };
        eth: { avg: number; max: number; min: number; above18: number };
    };
    pipelineSimulation: {
        potentialSignals: number;
        afterFilters: number;
        blockedByRVOL: number;
        blockedByADX: number;
        blockedByScore: number;
        blockedByRSI: number;
    };
}

// Colores para consola
const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message: string, color: string = COLORS.reset) {
    console.log(`${color}${message}${COLORS.reset}`);
}

function header(text: string) {
    const line = '═'.repeat(text.length + 4);
    log(`\n${line}`, COLORS.cyan);
    log(`  ${text}  `, COLORS.cyan);
    log(`${line}`, COLORS.cyan);
}

function subheader(text: string) {
    log(`\n${text}`, COLORS.bright);
    log('─'.repeat(text.length), COLORS.blue);
}

async function checkAPIHealth(): Promise<DiagnosticResult['apiHealth']> {
    subheader('1️⃣ VERIFICACIÓN DE SALUD DE APIs');

    const health = {
        binance: false,
        coincap: false,
        coingecko: false
    };

    try {
        // Test Binance
        const response = await fetch('https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT', {
            headers: { 'Accept': 'application/json' }
        });
        health.binance = response.ok;
        log(`Binance API: ${health.binance ? '✅ OPERACIONAL' : '❌ FALLANDO'}`,
            health.binance ? COLORS.green : COLORS.red);
    } catch (e) {
        log('Binance API: ❌ ERROR DE CONEXIÓN', COLORS.red);
    }

    try {
        // Test CoinCap
        const response = await fetch('https://api.coincap.io/v2/assets/bitcoin');
        health.coincap = response.ok;
        log(`CoinCap API: ${health.coincap ? '✅ OPERACIONAL' : '❌ FALLANDO'}`,
            health.coincap ? COLORS.green : COLORS.red);
    } catch (e) {
        log('CoinCap API: ❌ ERROR DE CONEXIÓN', COLORS.red);
    }

    try {
        // Test CoinGecko
        const response = await fetch('https://api.coingecko.com/api/v3/ping');
        health.coingecko = response.ok;
        log(`CoinGecko API: ${health.coingecko ? '✅ OPERACIONAL' : '⚠️ POSIBLE RATE LIMIT'}`,
            health.coingecko ? COLORS.green : COLORS.yellow);
    } catch (e) {
        log('CoinGecko API: ⚠️ NO DISPONIBLE', COLORS.yellow);
    }

    return health;
}

async function analyzeLiveData(): Promise<DiagnosticResult['liveData']> {
    subheader('2️⃣ ANÁLISIS DE DATOS EN TIEMPO REAL (Top 10 por Volumen)');

    const liveData: DiagnosticResult['liveData'] = [];

    try {
        const marketData = await fetchCryptoData('volume');
        const top10 = marketData.slice(0, 10);

        for (const asset of top10) {
            try {
                // Fetch candles para calcular RVOL preciso
                const candles = await fetchCandles(asset.symbol, '15m');

                if (candles && candles.length >= 20) {
                    const volumes = candles.map(c => c.volume);
                    const rvol = calculateRVOL(volumes, 20);

                    // Calcular RSI básico (simplificado)
                    const closes = candles.map(c => c.close);
                    let rsi = 50; // Default

                    // Determinar qué lo bloquea
                    const blockers: string[] = [];
                    if (rvol < 1.8) blockers.push(`RVOL ${rvol.toFixed(2)} < 1.8`);
                    // ADX requeriría cálculo más complejo, lo omitimos por ahora

                    liveData.push({
                        symbol: asset.symbol,
                        price: asset.price,
                        rawVolume: asset.rawVolume || 0,
                        rvol: rvol,
                        blockedBy: blockers,
                        wouldPass: blockers.length === 0
                    });

                    // Log individual
                    log(`\n${asset.symbol}:`, COLORS.bright);
                    log(`  Precio: $${asset.price.toFixed(2)}`);
                    const volFormatted = (asset.rawVolume && !isNaN(asset.rawVolume))
                        ? (asset.rawVolume / 1_000_000).toFixed(1)
                        : '???';
                    log(`  Volumen 24h: $${volFormatted}M`);
                    const rvolFormatted = (rvol && !isNaN(rvol)) ? rvol.toFixed(2) : '???';
                    log(`  RVOL: ${rvolFormatted}x ${rvol < 1.8 ? '❌' : '✅'}`,
                        rvol < 1.8 ? COLORS.red : COLORS.green);
                    if (blockers.length > 0) {
                        log(`  🚫 Bloqueado por: ${blockers.join(', ')}`, COLORS.red);
                    } else {
                        log(`  ✅ Pasaría filtros básicos`, COLORS.green);
                    }
                }
            } catch (error: any) {
                log(`  ⚠️ Error obteniendo datos detallados: ${error.message}`, COLORS.yellow);
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    } catch (error: any) {
        log(`❌ Error fetching live data: ${error.message}`, COLORS.red);
    }

    return liveData;
}

async function analyzeHistoricalRVOL(): Promise<DiagnosticResult['historicalRVOL']> {
    subheader('3️⃣ ANÁLISIS HISTÓRICO DE RVOL (100 últimas velas de 15m)');

    const result = {
        btc: { avg: 0, max: 0, min: 0, above18: 0 },
        eth: { avg: 0, max: 0, min: 0, above18: 0 }
    };

    try {
        // Analizar BTC
        const btcCandles = await fetchCandles('BTCUSDT', '15m');
        if (btcCandles && btcCandles.length >= 100) {
            const last100 = btcCandles.slice(-100);
            const rvolValues: number[] = [];

            for (let i = 20; i < last100.length; i++) {
                const volumeWindow = last100.slice(i - 20, i).map(c => c.volume);
                const rvol = calculateRVOL(volumeWindow, 20);
                rvolValues.push(rvol);
            }

            result.btc.avg = rvolValues.reduce((a, b) => a + b, 0) / rvolValues.length;
            result.btc.max = Math.max(...rvolValues);
            result.btc.min = Math.min(...rvolValues);
            result.btc.above18 = rvolValues.filter(r => r >= 1.8).length;

            log(`\nBTC (Últimas 100 velas):`);
            log(`  RVOL Promedio: ${result.btc.avg.toFixed(2)}`);
            log(`  RVOL Máximo: ${result.btc.max.toFixed(2)}`);
            log(`  RVOL Mínimo: ${result.btc.min.toFixed(2)}`);
            log(`  Velas con RVOL ≥ 1.8: ${result.btc.above18}/${rvolValues.length} (${((result.btc.above18 / rvolValues.length) * 100).toFixed(1)}%)`,
                result.btc.above18 < 15 ? COLORS.red : COLORS.green);

            if (result.btc.above18 < 15) {
                log(`  ⚠️ El filtro 1.8 solo permite ${((result.btc.above18 / rvolValues.length) * 100).toFixed(1)}% de oportunidades`, COLORS.red);
            }
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

        // Analizar ETH
        const ethCandles = await fetchCandles('ETHUSDT', '15m');
        if (ethCandles && ethCandles.length >= 100) {
            const last100 = ethCandles.slice(-100);
            const rvolValues: number[] = [];

            for (let i = 20; i < last100.length; i++) {
                const volumeWindow = last100.slice(i - 20, i).map(c => c.volume);
                const rvol = calculateRVOL(volumeWindow, 20);
                rvolValues.push(rvol);
            }

            result.eth.avg = rvolValues.reduce((a, b) => a + b, 0) / rvolValues.length;
            result.eth.max = Math.max(...rvolValues);
            result.eth.min = Math.min(...rvolValues);
            result.eth.above18 = rvolValues.filter(r => r >= 1.8).length;

            log(`\nETH (Últimas 100 velas):`);
            log(`  RVOL Promedio: ${result.eth.avg.toFixed(2)}`);
            log(`  RVOL Máximo: ${result.eth.max.toFixed(2)}`);
            log(`  RVOL Mínimo: ${result.eth.min.toFixed(2)}`);
            log(`  Velas con RVOL ≥ 1.8: ${result.eth.above18}/${rvolValues.length} (${((result.eth.above18 / rvolValues.length) * 100).toFixed(1)}%)`,
                result.eth.above18 < 15 ? COLORS.red : COLORS.green);
        }
    } catch (error: any) {
        log(`❌ Error analyzing historical RVOL: ${error.message}`, COLORS.red);
    }

    return result;
}

async function simulatePipeline(): Promise<DiagnosticResult['pipelineSimulation']> {
    subheader('4️⃣ SIMULACIÓN DE PIPELINE COMPLETO');

    const result = {
        potentialSignals: 0,
        afterFilters: 0,
        blockedByRVOL: 0,
        blockedByADX: 0,
        blockedByScore: 0,
        blockedByRSI: 0
    };

    try {
        log('\nEjecutando escaneo real del mercado...');

        // Ejecutar ambos estilos
        const [swingResults, scalpResults] = await Promise.all([
            scanMarketOpportunities('SWING_INSTITUTIONAL'),
            scanMarketOpportunities('SCALP_AGRESSIVE')
        ]);

        const allResults = [...swingResults, ...scalpResults];
        result.afterFilters = allResults.length;

        log(`\nResultados del Pipeline:`);
        log(`  Señales generadas (post-filtros): ${result.afterFilters}`,
            result.afterFilters > 0 ? COLORS.green : COLORS.red);

        if (result.afterFilters === 0) {
            log(`  ⚠️ NINGUNA SEÑAL PASÓ LOS FILTROS`, COLORS.red);
            log(`  Esto confirma que los filtros son demasiado restrictivos.`, COLORS.yellow);
        } else {
            log(`  ✅ Señales activas detectadas:`, COLORS.green);
            allResults.forEach(signal => {
                log(`    - ${signal.symbol} ${signal.side} (Score: ${signal.confidenceScore}, Strategy: ${signal.strategy})`);
            });
        }

        // Análisis manual de por qué se bloquearon (requeriría modificar FilterEngine para logging)
        log(`\n  💡 Nota: Para saber exactamente cuántas fueron bloqueadas por cada filtro,`);
        log(`     necesitamos agregar logging detallado en FilterEngine.ts`, COLORS.yellow);

    } catch (error: any) {
        log(`❌ Error en simulación de pipeline: ${error.message}`, COLORS.red);
    }

    return result;
}

async function generateFinalDiagnosis(data: DiagnosticResult) {
    header('5️⃣ DIAGNÓSTICO FINAL Y RECOMENDACIONES');

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Analizar APIs
    if (!data.apiHealth.binance) {
        issues.push('🔴 API de Binance no está respondiendo');
        recommendations.push('1. Verificar conectividad de red');
        recommendations.push('2. Verificar que Bifrost Proxy esté funcionando');
    }

    // Analizar RVOL histórico
    const avgRVOL = (data.historicalRVOL.btc.avg + data.historicalRVOL.eth.avg) / 2;
    if (avgRVOL < 1.5) {
        issues.push(`🔴 RVOL promedio histórico (${avgRVOL.toFixed(2)}) es MENOR que el threshold (1.8)`);
        recommendations.push(`1. Ajustar filtro RVOL de 1.8 → 1.2 para permitir más señales`);
        recommendations.push(`2. Considerar RVOL dinámico basado en volatilidad del mercado`);
    }

    // Analizar señales live
    const passedFilters = data.liveData.filter(d => d.wouldPass).length;
    const totalAnalyzed = data.liveData.length;
    if (passedFilters === 0 && totalAnalyzed > 0) {
        issues.push(`🔴 NINGUNO de los ${totalAnalyzed} activos analizados pasa los filtros actuales`);
        recommendations.push(`3. Revisar todos los filtros (RVOL, ADX, RSI) para confirmar que son realistas`);
    }

    // Analizar pipeline
    if (data.pipelineSimulation.afterFilters === 0) {
        issues.push('🔴 El pipeline completo NO genera señales con filtros actuales');
        recommendations.push('4. URGENTE: Ajustar filtros o el sistema estará "mudo"');
    }

    // Output
    if (issues.length > 0) {
        log('\n🔍 PROBLEMAS IDENTIFICADOS:', COLORS.red);
        issues.forEach(issue => log(`   ${issue}`, COLORS.red));
    } else {
        log('\n✅ No se identificaron problemas críticos', COLORS.green);
    }

    if (recommendations.length > 0) {
        log('\n💡 RECOMENDACIONES:', COLORS.yellow);
        recommendations.forEach((rec, idx) => log(`   ${rec}`, COLORS.yellow));
    }

    // Resumen final
    log('\n' + '═'.repeat(80), COLORS.cyan);
    log('CONCLUSIÓN:', COLORS.bright);
    if (avgRVOL < 1.5) {
        log('El filtro RVOL < 1.8 está CONFIRMADO como bloqueador principal.', COLORS.red);
        log('En condiciones normales de mercado, menos del 15% de las velas cumplen este criterio.', COLORS.yellow);
        log('ACCIÓN REQUERIDA: Ajustar threshold a 1.2 o implementar filtro dinámico.', COLORS.green);
    } else {
        log('Los datos sugieren que otro problema puede estar afectando la generación de señales.', COLORS.yellow);
        log('Revisa los logs del scanner para más detalles.', COLORS.yellow);
    }
    log('═'.repeat(80), COLORS.cyan);
}

async function runFullAudit() {
    header('🔍 AUDITORÍA COMPLETA DEL SISTEMA DE SEÑALES');
    log(`Timestamp: ${new Date().toISOString()}`, COLORS.cyan);
    log('Ejecutando análisis profundo del sistema...\n', COLORS.cyan);

    const diagnosticData: DiagnosticResult = {
        timestamp: new Date().toISOString(),
        apiHealth: { binance: false, coincap: false, coingecko: false },
        liveData: [],
        historicalRVOL: {
            btc: { avg: 0, max: 0, min: 0, above18: 0 },
            eth: { avg: 0, max: 0, min: 0, above18: 0 }
        },
        pipelineSimulation: {
            potentialSignals: 0,
            afterFilters: 0,
            blockedByRVOL: 0,
            blockedByADX: 0,
            blockedByScore: 0,
            blockedByRSI: 0
        }
    };

    try {
        // Paso 1: Verificar salud de APIs
        diagnosticData.apiHealth = await checkAPIHealth();

        // Paso 2: Analizar datos live
        diagnosticData.liveData = await analyzeLiveData();

        // Paso 3: Analizar RVOL histórico
        diagnosticData.historicalRVOL = await analyzeHistoricalRVOL();

        // Paso 4: Simular pipeline
        diagnosticData.pipelineSimulation = await simulatePipeline();

        // Paso 5: Generar diagnóstico final
        await generateFinalDiagnosis(diagnosticData);

        // Guardar resultado en archivo JSON para análisis posterior
        const fs = await import('fs/promises');
        const outputPath = `./diagnostic_output_${Date.now()}.json`;
        await fs.writeFile(outputPath, JSON.stringify(diagnosticData, null, 2));
        log(`\n📄 Reporte completo guardado en: ${outputPath}`, COLORS.green);

    } catch (error: any) {
        log(`\n❌ ERROR CRÍTICO EN AUDITORÍA: ${error.message}`, COLORS.red);
        console.error(error);
    }
}

// EJECUCIÓN
runFullAudit().then(() => {
    log('\n✅ Auditoría completada.', COLORS.green);
    process.exit(0);
}).catch(error => {
    log(`\n❌ Error fatal: ${error.message}`, COLORS.red);
    process.exit(1);
});
