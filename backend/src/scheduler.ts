// @ts-ignore
import cron from 'node-cron';
import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM Polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function initScheduler() {
    console.log('⏰ [Scheduler] Inicializando Cron Jobs...');

    // Job: Entrenamiento Semanal de IA (Domingo 00:00 UTC)
    // Run at minute 0 past hour 0 on Sunday
    cron.schedule('0 0 * * 0', () => {
        console.log('⏰ [Scheduler] Ejecutando Tarea Programada: Re-entrenamiento IA...');
        runTrainingJob();
    });

    // Job: Ingestión de Datos Semanal (Sábado 23:00 UTC) - Preparación para entreno
    cron.schedule('0 23 * * 6', () => {
        console.log('⏰ [Scheduler] Ejecutando Tarea Programada: Ingestión de Datos...');
        runIngestionJob();
    });

    console.log('   ✅ Job registrado: Weekly Data Ingestion (Sábados 23:00 UTC)');
}

export function runIngestionJob() {
    const ingestScript = path.join(__dirname, 'ml', 'ingest.ts');
    console.log(`🚀 [Scheduler] Spawning Ingestion Process: ${ingestScript}`);

    const isTs = __filename.endsWith('.ts');
    const child = fork(ingestScript, [], {
        execArgv: isTs ? ['--import', 'tsx'] : []
    });

    child.on('message', (msg) => {
        console.log(`[Data Ingest]:`, msg);
    });

    child.on('exit', (code) => {
        if (code === 0) {
            console.log('✅ [Scheduler] Ingestión Finalizada Exitosamente.');
        } else {
            console.error(`❌ [Scheduler] Ingestión falló con código ${code}`);
        }
    });
}

export function runTrainingJob() {
    // Usamos fork para correr el entrenamiento en otro proceso y NO bloquear el Event Loop de Express
    // Esto es vital para que la API no deje de responder mientras la IA "piensa"
    const trainingScript = path.join(__dirname, 'ml', 'train.ts');

    console.log(`🚀 [Scheduler] Spawning Training Process: ${trainingScript}`);

    // Detectamos si estamos corriendo con tsx (ts-node environment)
    const isTs = __filename.endsWith('.ts');

    // Si es TS, necesitamos registrar el loader 'tsx' o 'ts-node' en el proceso hijo
    const child = fork(trainingScript, [], {
        execArgv: isTs ? ['--import', 'tsx'] : []
    });

    child.on('message', (msg) => {
        console.log(`[AI Trainer]:`, msg);
    });

    child.on('exit', async (code) => {
        if (code === 0) {
            console.log('✅ [Scheduler] Entrenamiento Finalizado Exitosamente.');

            // HOT-RELOAD LOGIC
            // Importamos dinámicamente para no causar dependencias circulares al inicio
            try {
                const { reloadModel } = await import('./ml/inference');
                reloadModel();
                console.log('🔄 [Scheduler] Cerebro recargado automáticamente.');
            } catch (e) {
                console.error('⚠️ [Scheduler] Falló Hot-Reload:', e);
            }

        } else {
            console.error(`❌ [Scheduler] Entrenamiento falló con código ${code}`);
        }
    });
}
