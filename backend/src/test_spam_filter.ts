
import { NotificationFilter } from './services/NotificationFilter';

console.log("🛡️ [TEST] Iniciando Prueba de Filtro Antispam (0.5%)...");

function test(caseName: string, updateType: any, data: any, expected: boolean) {
    const result = NotificationFilter.shouldNotifyUpdate('BTCUSDT', updateType, data);
    const passed = result.shouldNotify === expected;
    console.log(`\n🔹 CASO: ${caseName}`);
    console.log(`   Entrada: old=${data.oldValue}, new=${data.newValue}, reason="${data.reason}"`);
    console.log(`   Resultado: ${result.shouldNotify ? '✅ ENVIAR' : '❌ SUPRIMIR'} (${result.reason || result.suppressionReason})`);
    console.log(`   Veredicto: ${passed ? '✅ PASS' : '❌ FAIL'}`);
}

// 1. Caso Normal: Cambio Insignificante (0.1%)
NotificationFilter.clearCache('BTCUSDT');
test('Micro-Trailing (0.1%)', 'SL_MOVED', { oldValue: 50000, newValue: 50050, reason: 'Trailing Stop' }, false);

// 2. Caso Normal: Cambio Significativo (1.0%)
NotificationFilter.clearCache('BTCUSDT'); // Reset cooldown
test('Macro-Trailing (1.0%)', 'SL_MOVED', { oldValue: 50000, newValue: 50500, reason: 'Trailing Stop' }, true);

// 3. Caso Reinicio servidor
NotificationFilter.clearCache('BTCUSDT');
test('Server Restart + Micro Change', 'SL_MOVED', { oldValue: 50000, newValue: 50050, reason: 'Trailing Stop' }, false);

// 4. Caso Crítico: Breakeven
NotificationFilter.clearCache('BTCUSDT');
test('Forced Breakeven (Small)', 'SL_MOVED', { oldValue: 50000, newValue: 50020, reason: 'Moved to Breakeven' }, true);

// 5. Caso Crítico: Nuclear
NotificationFilter.clearCache('BTCUSDT');
test('Nuclear Guard', 'SL_MOVED', { oldValue: 50000, newValue: 50100, reason: 'Nuclear Shield Active' }, true);
