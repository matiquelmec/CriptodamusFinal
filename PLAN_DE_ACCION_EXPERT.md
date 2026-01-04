# 🛠️ Plan de Acción Experto: Criptodamus "God Mode"
**Estado Actual:** Funcional pero Frágil (Riesgo de pérdida de datos ML y fallos silenciosos).
**Objetivo:** Robusteza Institucional + Persistencia Real de IA.

---

## 🚨 Fase 0: Emergencia & Persistencia (Prioridad Absoluta)
*El sistema ML actual pierde su "memoria" cada vez que Render reinicia. Esto es inaceptable.*

### 1. Persistencia de IA en la Nube (Fix "Amnesia Bug")
- [ ] **Modificar `backend/src/ml/train.ts`:**
    - Dejar de usar `fs.writeFileSync` para guardar el modelo.
    - Implementar `supabase.storage.from('models').upload(...)` para guardar `model.json` y `weights.bin`.
- [ ] **Modificar `backend/src/ml/inference.ts`:**
    - Hacer que descargue el modelo desde Supabase Storage al iniciar, en lugar de buscarlo en disco local.
    - Implementar caché local inteligente (solo descargar si la versión en nube es más nueva).

### 2. Automatización Real (The missing Cron)
- [ ] **Instalar `node-cron`:** `npm install node-cron @types/node-cron`
- [ ] **Crear `backend/src/scheduler.ts`:**
    - Configurar job para correr el domingo a las 00:00 UTC.
    - Ejecutar la función `train()` (refactorizada para ser exportable).
- [ ] **Integrar en `server.ts`:** Importar e iniciar el scheduler al arrancar el servidor.

---

## 🛡️ Fase 1: Hardening (Blindaje del Código)
*Eliminar el código "spaghetti" legado que pone en riesgo la estabilidad.*

### 1. Migración de `binanceStream.js` a TypeScript
- [ ] **Eliminar `backend/src/services/binanceStream.js`**.
- [ ] **Crear `backend/src/services/binanceStream.ts`:**
    - Tipar estrictamente los eventos de Binance (`AggTrade`, `ForceOrder`).
    - Implementar reconexión exponencial (backoff) para mayor estabilidad.
    - **Mejora:** Guardar liquidaciones y CVD en Redis (o en memoria con dump periódico a DB) para no perder datos en reinicios.

### 2. Centralización de Lógica (Single Source of Truth)
- [ ] **Eliminar duplicidad de `riskEngine`:**
    - Borrar la versión del Frontend.
    - Exponer la lógica del Backend vía API (`/api/risk/evaluate`).
- [ ] **Refactorizar `geminiService.ts`:**
    - Mover el cálculo de scores pesados al Backend (`backend/src/services/aiScoring.ts`).
    - El Frontend solo recibe el objeto `AnalysisResult` final.

---

## 🧠 Fase 2: Alpha Boost (Mejoras Neuronal & Trading)
*Hacer que el bot sea realmente inteligente, no solo estadístico.*

### 1. ML Feature Injection (Cirugía Cerebral)
- [ ] **Expandir el input del LSTM:**
    - Pasar de 2 features (`Return`, `Range`) a 5 features mínimos:
        1. `RSI_14` (Momento)
        2. `CVD_Delta` (Flujo de órdenes - **Clave Institucional**)
        3. `Distance_to_EMA200` (Tendencia)
- [ ] **Re-entrenar modelo:** Ejecutar entrenamiento manual inicial con nuevas features.

### 2. Sniper UX
- [ ] **Frontend:** Agregar indicador visual "AI Training Status" (conectado al scheduler).
- [ ] **Frontend:** Agregar botón "Force Retrain" en panel admin (para emergencias).

---

## 📅 Ejecución Sugerida (Próximas 24 Horas)
1. **Paso 1:** Configurar Supabase Storage para el modelo (Yo lo hago).
2. **Paso 2:** Reescribir `binanceStream` a TS.
3. **Paso 3:** Implementar Scheduler + Training Script Fix.

¿Autorizas el inicio de la **Fase 0 y 1**?
