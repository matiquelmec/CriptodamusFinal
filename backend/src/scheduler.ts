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

    console.log('   ✅ Job registrado: Weekly AI Retraining (Domingos 00:00 UTC)');
}

export function runTrainingJob() {
    // Usamos fork para correr el entrenamiento en otro proceso y NO bloquear el Event Loop de Express
    // Esto es vital para que la API no deje de responder mientras la IA "piensa"
    const trainingScript = path.join(__dirname, 'ml', 'train.ts');

    console.log(`🚀 [Scheduler] Spawning Training Process: ${trainingScript}`);

    const child = fork(trainingScript);

    child.on('message', (msg) => {
        console.log(`[AI Trainer]:`, msg);
    });

    child.on('exit', (code) => {
        if (code === 0) {
            console.log('✅ [Scheduler] Entrenamiento Finalizado Exitosamente.');
        } else {
            console.error(`❌ [Scheduler] Entrenamiento falló con código ${code}`);
        }
    });
}
