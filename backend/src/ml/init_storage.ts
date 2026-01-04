import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ESM Polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; // MUST BE SERVICE ROLE KEY for bucket creation usually
const BUCKET_NAME = 'models';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ ERROR: Credenciales de Supabase no encontradas.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function initStorage() {
    console.log(`🏗️ Inicializando Storage Bucket: '${BUCKET_NAME}'...`);

    // 1. Create Bucket
    const { data: bucketData, error: bucketError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true, // Models download needs to be accessible? Or authenticated? 
        // Inference script uses same key, so private is fine if authenticated.
        // But let's make it public for easier debugging if needed, or stick to private defaults.
        // Inference script uses download() which works with auth.
        fileSizeLimit: 104857600 // 100MB Limit
    });

    if (bucketError) {
        if (bucketError.message.includes('already exists')) {
            console.log(`✅ Bucket '${BUCKET_NAME}' ya existe.`);
        } else {
            console.error(`❌ Error creando bucket: ${bucketError.message}`);
            console.warn("⚠️ Es probable que necesites crear el bucket 'models' MANUALMENTE en el Dashboard de Supabase.");
            return;
        }
    } else {
        console.log(`✅ Bucket '${BUCKET_NAME}' creado exitosamente.`);
    }

    // 2. Run Migration Logic directly here
    console.log("🧠 Re-intentando Migración de Cerebro...");
    const sourceDir = path.join(__dirname, 'temp_model');
    const files = ['model.json', 'weights.bin'];

    for (const file of files) {
        const filePath = path.join(sourceDir, file);
        if (!fs.existsSync(filePath)) {
            console.error(`❌ Archivo faltante localmente: ${filePath}`);
            continue;
        }

        const fileContent = fs.readFileSync(filePath);
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(file, fileContent, { upsert: true });

        if (uploadError) {
            console.error(`❌ Fallo subida ${file}: ${uploadError.message}`);
        } else {
            console.log(`✅ ${file} subido a la nube.`);
        }
    }
}

initStorage();
