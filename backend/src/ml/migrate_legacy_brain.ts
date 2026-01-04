import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ESM Polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BUCKET_NAME = 'models';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ ERROR: Credenciales de Supabase no encontradas.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrateBrain() {
    console.log("🧠 Iniciando Migración de Cerebro Legado a la Nube...");

    const sourceDir = path.join(__dirname, 'temp_model'); // Ya copiamos aquí
    const files = ['model.json', 'weights.bin'];

    for (const file of files) {
        const filePath = path.join(sourceDir, file);
        if (!fs.existsSync(filePath)) {
            console.error(`❌ Archivo faltante: ${filePath}`);
            continue;
        }

        console.log(`☁️ Subiendo ${file}...`);
        const fileContent = fs.readFileSync(filePath);

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(file, fileContent, {
                contentType: file.endsWith('.json') ? 'application/json' : 'application/octet-stream',
                upsert: true
            });

        if (error) {
            console.error(`❌ Error subiendo ${file}:`, error.message);
        } else {
            console.log(`✅ ${file} subido exitosamente.`);
        }
    }
    console.log("🚀 Migración Completada. El cerebro ahora vive en la nube.");
}

migrateBrain();
