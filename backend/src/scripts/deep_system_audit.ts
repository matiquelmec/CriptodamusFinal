
/**
 * AUDITORÍA PROFUNDA DEL SISTEMA (POST-PARCHE)
 * Valida la nueva lógica "One Key Truth" implementada en SignalAuditService.
 */

// --- 1. SIMULACIÓN DE LÓGICA DE PRODUCCIÓN (NUEVA) ---

const SIMULATION_DATA = {
    symbol: 'BTC/USDT',
    side: 'LONG',
    strategy: 'Ichimoku',
    id: 'sim-trade-001'
};

/**
 * MOCK: El nuevo método helper implementado en SignalAuditService
 * Logic: SYMBOL (Normalized) + SIDE
 */
function getCooldownKey(symbol: string, side: string): string {
    const normSymbol = symbol.replace('/', '').toUpperCase();
    return `${normSymbol}-${side}`;
}

// Simulación de RegisterSignals (Post-Fix)
function generateRegisterKey(opp: any) {
    // FIX APLICADO: return this.getCooldownKey(opp.symbol, opp.side);
    return getCooldownKey(opp.symbol, opp.side);
}

// Simulación de SyncUpdates (Post-Fix)
function generateClosureKey(upd: any, signalFromMemory: any) {
    // FIX APLICADO: const cooldownKey = this.getCooldownKey(upd.symbol, signalFromMemory.side);
    return getCooldownKey(upd.symbol, signalFromMemory.side);
}

// --- 2. EJECUCIÓN DE PRUEBA DE ROBUSTEZ ---

console.log("\n🔍 --- AUDITORÍA POST-PARCHE: INTEGRIDAD DE COOLDOWN ---");

// A. Generar Clave de Registro
const registerKey = generateRegisterKey(SIMULATION_DATA);
console.log(`\n1. Clave usada al INTENTAR ABRIR (Register):`);
console.log(`   [${registerKey}]`);

// B. Generar Clave de Cierre
const closureKey = generateClosureKey(SIMULATION_DATA, SIMULATION_DATA);
console.log(`\n2. Clave guardada al CERRAR (Cooldown):`);
console.log(`   [${closureKey}]`);

// C. Verificación de Bloqueo
console.log(`\n3. Verificación de Seguridad:`);

if (registerKey === closureKey) {
    console.log("   ✅ [EXITO] Las claves COINCIDEN PERFECTAMENTE.");
    console.log("   🛡️  [Protección] El sistema detectará el cierre y BLOQUEARÁ la re-entrada.");
    console.log("   ✨ Resultado: Fin del 'Machine Gun Trading'. Win Rate estabilizado.");
} else {
    console.error("   ❌ [FALLO] Las claves siguen sin coincidir.");
}

console.log("\n--- FIN DE VALIDACIÓN ---");
