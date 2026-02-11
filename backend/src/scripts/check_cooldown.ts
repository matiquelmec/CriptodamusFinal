
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Polyfill fetch for node
import fetch from 'node-fetch';
if (!global.fetch) {
    (global as any).fetch = fetch;
    (global as any).Headers = (fetch as any).Headers;
    (global as any).Request = (fetch as any).Request;
    (global as any).Response = (fetch as any).Response;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Faltan credenciales de Supabase en .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCooldownLogic() {
    console.log("🔍 [Diagnóstico] Verificando Lógica de Cooldown...");

    // 1. Simular cierre de trade
    const symbol = "SOL/USDT";
    const side = "SHORT";
    const cooldownKey = `${symbol.replace('/', '').toUpperCase()}-${side}`;

    console.log(`🔑 Clave Esperada: ${cooldownKey}`);

    // 2. Revisar si hay trades cerrados recientemente de SOL/USDT SHORT
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const { data: recentClosed, error } = await supabase
        .from('signals_audit')
        .select('*')
        .eq('symbol', symbol)
        .eq('side', side)
        .in('status', ['WIN', 'LOSS', 'BREAKEVEN', 'EXPIRED'])
        .gt('closed_at', oneHourAgo)
        .order('closed_at', { ascending: false });

    if (error) {
        console.error("❌ Error consultando DB:", error.message);
        return;
    }

    if (recentClosed && recentClosed.length > 0) {
        console.log(`⚠️ Se encontraron ${recentClosed.length} trades cerrados recientemente ( < 1h ).`);
        recentClosed.forEach(t => {
            const closedDate = new Date(t.closed_at).toISOString();
            console.log(`   - ID: ${t.id} | Status: ${t.status} | Closed: ${closedDate}`);

            // Calcular tiempo restante
            const remainingMs = (t.closed_at + (60 * 60 * 1000)) - Date.now();
            const remainingMins = (remainingMs / 60000).toFixed(1);
            console.log(`     👉 Debería tener Cooldown activo por: ${remainingMins} min más.`);
        });

        // 3. Verificar si hay señales NUEVAS creadas *después* de ese cierre (Machine Gun)
        const lastClosedTime = recentClosed[0].closed_at;
        const { data: machineGunEntries } = await supabase
            .from('signals_audit')
            .select('*')
            .eq('symbol', symbol)
            .eq('side', side)
            .gt('created_at', lastClosedTime);

        if (machineGunEntries && machineGunEntries.length > 0) {
            console.log(`🚨 FALLO CONFIRMADO: Se abrieron ${machineGunEntries.length} trades EN PERIODO DE COOLDOWN.`);
            machineGunEntries.forEach(t => {
                const createdDate = new Date(t.created_at).toISOString();
                console.log(`   - 🔫 Machine Gun Specimen: ${t.id} | Created: ${createdDate}`);
            });
        } else {
            console.log("✅ No se detectaron entradas 'Machine Gun' en la DB (El filtro podría estar funcionando en memoria pero se perdió al reiniciar).");
        }

    } else {
        console.log("ℹ️ No hay trades cerrados recientemente para analizar en DB.");
    }
}

checkCooldownLogic();
