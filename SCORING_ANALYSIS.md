# 🕵️‍♂️ Análisis de Scoring: ¿Por qué Confianza 6?

La "Confianza 6" (o Score 5.6 en tu sistema) no es un error, es un **síntoma de conflicto** entre lo Macro y lo Micro.

## 1. La Matemática detrás del "Empate"
El agente calculó:
- **Fuerza Bulls:** 5.6
- **Fuerza Bears:** 5.6

**Resultado:** Empate Técnico.
Cuando hay un empate, la confianza es baja porque el sistema no tiene una "ventaja estadística clara" en el timeframe de **15 minutos**, aunque la tendencia Semanal sea bajista.

## 2. Los Culpables (Penalizaciones)
He revisado el código y encontré qué está bajando los puntajes:

1.  **ASIA Session Penalty:**
    ```typescript
    if (activeSession.session === 'ASIA' && rvol < 2.5) {
        bullishScore *= 0.8;
        bearishScore *= 0.8;
    }
    ```
    Como es sesión ASIA y el volumen es bajo (0.59x), el sistema reduce **ambos** puntajes en un 20%. Esto explica por qué los números son bajos (5.6 en lugar de 8 o 9).

2.  **Range Market Kill Switch:**
    El reporte indica `ADX: 29.7`. Si el ADX fuera menor a 25, habría una penalización del 50%. Aquí estamos a salvo, pero cerca.

3.  **Conflictos Locales:**
    - Estructura 15m: "Debilidad estructural" (Favorece Bears).
    - Bollinger Squeeze: "Breakout probable hacia ALCISTA" (Favorece Bulls).
    - **Resultado:** El sistema técnico de 15m está "confundido" (una señal dice baja, la otra sube), anulándose mutuamente.

## 3. Propuesta de Calibración
Para que el agente sea más decisivo y confíe en su análisis Macro (Semanal/Diario) cuando el Micro (15m) está indeciso, sugiero agregar un **"Tie-Breaker Institucional"**:

> *Si hay empate técnico en 15m, usar la tendencia Semanal (1W) para desempatar agresivamente.*

**Cambio propuesto en `geminiService.ts`:**
Si `isGodMode` o `isAlignedCycle` es verdadero, y la diferencia de score es menor a 2 puntos, **sumar +3 puntos** a la dirección de la tendencia semanal.

¿Deseas implementar este "Desempate por Jerarquía"?
