# Legacy Backup - CriptodamusFinal

## Propósito
Esta carpeta contiene código valioso de la versión anterior (`CriptodamusFinal/`) que fue **archivado por referencia** antes de eliminar la carpeta legacy completa.

**Fecha de archivo:** 2026-02-02  
**Razón:** Limpieza del proyecto / Consolidación de código

---

## Archivos Archivados

### 1. `cryptoService_OLD.ts` (42KB)
**Origen:** `CriptodamusFinal/services/cryptoService.ts`

**Contenido valioso:**
- Motor de análisis técnico v4.0 completo
- Estrategias específicas:
  - **MEME_SCALP**: Lógica para detectar pumps en memecoins
  - **ICHIMOKU_CLOUD**: Implementación completa de Ichimoku
  - **SWING_INSTITUTIONAL**: SMC con Golden Pockets de Fibonacci
- Detector de riesgo de mercado (análisis de volumen BTC)
- Sistema de fetching con fallbacks (Binance → CoinCap)

**Por qué se preservó:**  
Contiene reglas de trading "de calle" y lógica hardcodeada que puede ser útil para referencia.

---

### 2. `OpportunityFinder_OLD.tsx` (15KB)
**Origen:** `CriptodamusFinal/components/OpportunityFinder.tsx`

**Contenido valioso:**
- UI para controlar el "Motor v4.0"
- Selectores de estrategia (Scalp, Swing, Breakout, Meme Hunter)
- Visualización de señales con "Tickets" detallados:
  - TP1, TP2, TP3
  - Stop Loss
  - Explicaciones de señales
- Integración con `cryptoService.ts`

**Por qué se preservó:**  
UI personalizada para el motor de análisis técnico viejo. Puede tener ideas de UX útiles.

---

### 3. `SettingsPanel_OLD.tsx` (3KB)
**Origen:** `CriptodamusFinal/components/SettingsPanel.tsx`

**Contenido valioso:**
- Panel de configuración local
- Gestión de riesgo con `localStorage`
- Funciones de limpieza de caché

**Por qué se preservó:**  
Panel de settings simple pero funcional que no existe en la versión moderna.

---

## Uso de este Backup

### ⚠️ NO usar directamente
Este código es **solo para referencia**. No está integrado con el proyecto moderno.

### ✅ Cómo usar
1. **Consulta:** Ver lógica específica de estrategias
2. **Migración selectiva:** Copiar reglas específicas si se necesitan
3. **Ideas de UX:** Ver cómo se mostraban señales antes

### ❌ No hacer
- No importar estos archivos en el proyecto moderno
- No copiar código sin adaptar a la arquitectura actual

---

## Estado del Proyecto Moderno

La versión actual (`src/`) tiene:
- ✅ Backend robusto con WebSocket
- ✅ Estrategias modulares en `backend/src/core/services/strategies/`
- ✅ Frontend limpio con React Router
- ✅ Sistema de auditoría de señales en Supabase

**La lógica de estos archivos legacy ya fue reemplazada o mejorada.**

---

## Eliminación Futura

Si en 6 meses no se ha consultado este backup, puede ser eliminado de forma segura.
