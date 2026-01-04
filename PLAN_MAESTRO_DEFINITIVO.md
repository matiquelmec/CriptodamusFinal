# 🏆 PLAN MAESTRO DEFINITIVO: Criptodamus "Singularity"
**Objetivo:** Unificar la inteligencia, eliminar deuda técnica y lograr el 100% del potencial.

Este plan reemplaza a todos los anteriores. Es la hoja de ruta final.

---

## 🏛️ Fase 1: Limpieza & Cimientos (Immediate Action)
*Objetivo: Dejar el código impecable y estable.*

### 1. Eliminación de Código Legacy (The Purge)
- [ ] **Migrar `backend/src/services/binanceStream.js` a TypeScript (`.ts`)**:
    - Tipado estricto de WebSockets.
    - Manejo de errores robusto.
    - **Acción:** Reescribir y borrar el `.js`.
- [ ] **Eliminar Código Muerto:**
    - Buscar y destruir archivos no usados en `backend/src` (ej. tests viejos).

### 2. Unificación de "Risk Engine" (One Truth)
- [ ] **Centralizar en Backend:**
    - Asegurar que `backend/src/core/riskEngine.ts` sea la única fuente de verdad.
    - El Frontend debe consultar riesgos vía API, no calcularlos por su cuenta (o importar el mismo módulo si es shared, pero preferiblemente API para ocultar lógica).

---

## 🧠 Fase 2: La Gran Unificación (The Brain Transplant)
*Objetivo: Que el Scanner (Telegram) sea tan inteligente como la UI.*

### 1. Mover `VolumeExpert` al Backend
- [ ] **Portar `src/services/volumeExpertService.ts` a `backend/src/services/`**:
    - Esto permitirá que el Scanner no solo vea precios, sino también **CVD, Absorciones y Coinbase Premium**.
- [ ] **Integrar en Scanner:**
    - Actualizar `scanner.ts` para usar `VolumeExpert` antes de emitir una señal.
    - **Resultado:** Alertas de Telegram que dicen "🐋 Absorción de Ballena Detectada" en lugar de solo "RSI bajo".

---

## 🤖 Fase 3: Evolución Neuronal (AI Level Up)
*Objetivo: Darle "ojos" reales a la IA.*

### 1. Feature Engineering Avanzado
- [ ] **Conectar Volume a ML:**
    - Ahora que `VolumeExpert` estará en el backend, pasar el dato `cvdTrend` al modelo LSTM.
    - Entrenar la IA para reconocer cuando el CVD diverge del precio.

---

## 📅 Ejecución Inmediata (Hoy)
Procederé inmediatamente con la **Fase 1 (Limpieza)** para cumplir con tu orden de "dejar todo limpio y funcionando".

1.  Reescritura de `binanceStream.js` a TypeScript.
2.  Verificación de limpieza del directorio backend.

¿Procedo?
