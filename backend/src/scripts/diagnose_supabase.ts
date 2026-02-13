
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
// Cargar variables de entorno (Asumiendo ejecución desde root)
dotenv.config({ path: './backend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

console.log("🏥 [DIAGNOSTIC] Comprobando Salud de Supabase...");
console.log(`📡 URL: ${SUPABASE_URL}`);
console.log(`🔑 Key Available: ${!!SUPABASE_KEY}`);

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ ERROR CRÍTICO: Faltan variables de entorno.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'public' }
});

async function checkConnection() {
    try {
        console.log("⏳ Intentando conectar (SELECT 1)...");
        const start = Date.now();

        // Intenta una operación muy simple
        const { data, error } = await supabase.from('system_metadata').select('*').limit(1);

        const latency = Date.now() - start;

        if (error) {
            console.error("❌ ERROR DE CONEXIÓN:");
            console.error(error);
            console.log("\n⚠️ CONCLUSIÓN: El código funciona, pero Supabase rechaza la conexión.");
        } else {
            console.log(`✅ CONEXIÓN EXITOSA (${latency}ms)`);
            console.log("📊 Datos recibidos:", data ? data.length : 0);
            console.log("\n✅ CONCLUSIÓN: La base de datos responde correctamente.");
        }

    } catch (err: any) {
        console.error("❌ EXCEPCIÓN DE RED:");
        console.error(err.message);
        if (err.cause) console.error("Causa:", err.cause);
    }
}

checkConnection();
