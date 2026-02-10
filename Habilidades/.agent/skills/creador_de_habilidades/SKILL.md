---
name: Creador de Habilidades
description: Una guía paso a paso para que el agente cree nuevas habilidades (skills) en el espacio de trabajo, asegurando que sigan el formato y las mejores prácticas de Antigravity.
---

# Creador de Habilidades

Esta habilidad te guía en el proceso de creación de nuevas habilidades para el usuario. Sigue estos pasos rigurosamente para asegurar calidad y consistencia.

## Paso 1: Entender el Propósito
Si el usuario no ha especificado claramente qué hace la nueva habilidad, PREGUNTA:
- "¿Cómo quieres llamar a esta nueva habilidad?"
- "¿Cuál es el objetivo principal o qué problema resuelve?"
- "¿Hay algún comando o flujo de trabajo específico que te gustaría que automatice?"

## Paso 2: Definir la Estructura
Una habilidad reside en `.agent/skills/<nombre_de_la_habilidad>/`.
1.  **Nombre del directorio**: Convierte el nombre de la habilidad a `snake_case` (ej: "Análisis de Datos" -> `analisis_de_datos`).
2.  **Archivos necesarios**:
    - `SKILL.md` (Obligatorio): Contiene las instrucciones para el agente.
    - `scripts/` (Opcional): Si la habilidad requiere scripts complejos (Python, Node.js, Shell).
    - `resources/` (Opcional): Si la habilidad necesita plantillas o archivos estáticos.

## Paso 3: Generar el Contenido de SKILL.md
El archivo `SKILL.md` es el "cerebro" de la habilidad. Debe contener:
1.  **Frontmatter YAML**:
    ```yaml
    ---
    name: Nombre Legible
    description: Breve descripción de lo que hace.
    ---
    ```
2.  **Instrucciones Claras**: Escribe en Markdown cómo debe comportarse el agente cuando use esta habilidad.
    - Usa encabezados claros.
    - Define pasos numerados si es un proceso secuencial.
    - Si la habilidad implica ejecutar comandos, usa bloques de código.

## Paso 4: Creación (Acción)
Una vez tengas la información:
1.  Crea el directorio: `.agent/skills/<nombre_snake_case>`.
2.  Crea el archivo `.agent/skills/<nombre_snake_case>/SKILL.md` con el contenido generado.
3.  (Opcional) Crea otros archivos necesarios dentro de esa carpeta.

## Paso 5: Checklist de Calidad
Antes de finalizar, verifica que la nueva habilidad cumpla con estos estándares:
- [ ] **Frontmatter Válido**: ¿Tiene `name` y `description` en el YAML del inicio?
- [ ] **Nombre de Carpeta**: ¿Está en `snake_case` sin espacios ni caracteres especiales?
- [ ] **Claridad**: ¿Las instrucciones en `SKILL.md` están dirigidas al AGENTE (no al usuario)?
- [ ] **Autonomía**: ¿La habilidad incluye toda la información necesaria para funcionar sin depender excesivamente de preguntar al usuario?

## Paso 6: Confirmación
Informa al usuario:
- "¡Habilidad '[Nombre]' creada exitosamente!"
- Indícale que para usarla, simplemente debe invocarla o pedir ayuda relacionada con su tema.
- Muestra la ruta donde se creó.

---
**Nota para el Agente**: Cuando uses esta habilidad, TU eres el experto en crear herramientas. Asegúrate de que las instrucciones que escribas para la nueva habilidad sean precisas y fáciles de seguir para una futura instancia de ti mismo.
