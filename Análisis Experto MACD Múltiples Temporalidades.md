# **Manual de Ingeniería Financiera y Estrategia Avanzada: El Oscilador MACD como Sistema Integral de Inversión Multitemporal**

## **Resumen Ejecutivo**

Este documento constituye un tratado exhaustivo sobre la aplicación profesional de la Convergencia/Divergencia de Medias Móviles (MACD) en la gestión de carteras e inversión especulativa. Lejos de ser una introducción superficial, este informe está diseñado para traders institucionales, analistas cuantitativos y gestores de patrimonio que buscan optimizar la eficiencia de sus entradas y salidas mediante el análisis técnico avanzado. A lo largo de este análisis, desglosaremos la arquitectura matemática del indicador, exploraremos su comportamiento bajo regímenes de volatilidad variable y estableceremos protocolos estrictos para la operativa en múltiples marcos temporales (Multi-Timeframe Analysis). Se integran conceptos de microestructura de mercado, psicología del trading y filtrado algorítmico para elevar el MACD de un simple indicador a un sistema de trading completo y robusto. La premisa central de este informe es que el MACD, cuando se ajusta correctamente a la fractalidad del mercado y se filtra mediante métricas de volumen y volatilidad, ofrece una ventaja estadística asimétrica explotable tanto en el trading de alta frecuencia como en la inversión posicional a largo plazo.

## ---

**1\. Arquitectura Matemática y Fundamentos del Momentum**

Para comprender la aplicación experta del MACD, es imperativo trascender su representación gráfica y comprender la ingeniería subyacente que genera sus señales. A diferencia de los osciladores estocásticos que están limitados entre 0 y 100, el MACD es un oscilador no acotado, lo que le permite rastrear tendencias de precios de magnitud teóricamente infinita, haciéndolo superior en activos de alta beta o crecimiento parabólico.1

### **1.1. La Derivada del Precio: Construcción de Componentes**

El MACD opera bajo el principio de que el momentum precede al precio. Matemáticamente, mide la velocidad a la que el precio se aleja de su valor medio. El indicador se construye sobre tres vectores de datos críticos, cada uno con una función específica en la detección de la estructura del mercado.

#### **1.1.1. La Línea MACD (El Vector de Velocidad)**

El núcleo del indicador es la **Línea MACD**. Esta no es una media móvil en sí misma, sino la diferencia entre dos Medias Móviles Exponenciales (EMA). La configuración estándar institucional utiliza la resta de la EMA de 26 periodos (lenta) de la EMA de 12 periodos (rápida).2

$$MACD \= EMA\_{12}(P\_{cierre}) \- EMA\_{26}(P\_{cierre})$$  
La elección de la EMA sobre la Media Móvil Simple (SMA) no es trivial. La SMA asigna el mismo peso a todos los datos en la ventana de tiempo, lo que introduce un retraso inaceptable en mercados modernos dominados por algoritmos de alta frecuencia. La EMA, por el contrario, aplica un factor de suavizado que asigna un peso exponencialmente mayor a los precios más recientes. Esto permite que la Línea MACD reaccione a los cambios en la microestructura de órdenes con una latencia reducida.4 Cuando la EMA rápida se aleja de la lenta, indica que la presión de compra o venta actual está superando la media histórica, una representación directa de la aceleración del precio.

#### **1.1.2. La Línea de Señal (El Filtro de Ruido)**

La **Línea de Señal** es una derivada de segunda orden; es una EMA de la propia Línea MACD, típicamente de 9 periodos. Su función es suavizar la volatilidad inherente de la Línea MACD y proporcionar un umbral de activación para las decisiones de trading. El cruce de la Línea MACD sobre la Línea de Señal no es simplemente un evento visual; representa el momento matemático en que la aceleración del precio supera su propia media móvil reciente, validando un cambio en la dinámica de corto plazo.4

#### **1.1.3. El Histograma MACD (El Diferencial de Fuerza)**

A menudo ignorado por los novatos, el **Histograma** es quizás el componente más vital para el trader profesional. Representa la diferencia entre la Línea MACD y la Línea de Señal.

$$Histograma \= Línea MACD \- Línea de Señal$$  
El histograma actúa como un "indicador líder" (leading indicator) dentro de un sistema que es inherentemente retardado. Antes de que ocurra un cruce de líneas (señal retardada), el histograma mostrará una disminución en su altura (convergencia), indicando que el momentum se está agotando. Un histograma que se aplana o cambia de dirección anticipa reversiones de precios mucho antes que la acción del precio sea evidente a simple vista.5

### **1.2. Análisis de Retraso y Naturaleza Oscilatoria**

Es crucial reconocer que el MACD es un indicador "lagging" (retardado) porque se deriva de datos pasados. Sin embargo, su construcción diferencial lo convierte en uno de los indicadores de seguimiento de tendencia más efectivos. No intenta predecir el futuro, sino confirmar la realidad actual de la estructura del mercado. El análisis cuantitativo demuestra que el MACD reduce el ruido del mercado, filtrando fluctuaciones aleatorias y permitiendo al trader centrarse en la prevalencia de la tendencia subyacente.1

La interacción con la línea cero es otro aspecto fundamental. La línea cero representa el punto de equilibrio donde la EMA de 12 periodos es idéntica a la EMA de 26 periodos. Un cruce de la línea cero no es solo una señal de compra o venta, sino una indicación de un cambio de régimen en el mercado: de un entorno dominado por vendedores a uno dominado por compradores, o viceversa.9

## ---

**2\. Optimización de Parámetros: Adaptación a la Volatilidad y Temporalidad**

La aplicación rígida de la configuración estándar (12, 26, 9\) es un error común. Los mercados financieros no son homogéneos; la volatilidad de una criptomoneda en un gráfico de 5 minutos es radicalmente diferente a la de un bono del tesoro en un gráfico semanal. El trader de élite ajusta los parámetros del MACD para sincronizarlos con el ciclo dominante del activo que está operando.

### **2.1. Matriz de Configuración para Scalping y Trading Intradía (M1 \- M15)**

En las temporalidades bajas, el ruido del mercado es el enemigo principal. Los algoritmos de trading de alta frecuencia (HFT) generan fluctuaciones que pueden activar señales falsas en un MACD estándar.

#### **2.1.1. El Protocolo de Reacción Rápida (3, 10, 16\)**

Esta configuración es altamente agresiva y se utiliza para capturar movimientos de momentum explosivos en gráficos de 1 a 5 minutos.

* **Fast EMA (3):** Reacciona casi instantáneamente a cada tick de precio.  
* **Slow EMA (10):** Proporciona un contexto de tendencia muy corto.  
* **Signal Line (16):** Un periodo de señal más largo es esencial aquí para suavizar la naturaleza errática de la línea MACD resultante.

Esta configuración es ideal para el trading de ruptura (breakout) en la apertura de sesiones volátiles (como la apertura de Nueva York), donde la velocidad de entrada es crítica. Sin embargo, su tasa de falsos positivos es alta, requiriendo una gestión de riesgos estricta.11

#### **2.1.2. El Equilibrio Intradía (5, 13, 8\) y (8, 17, 9\)**

Para traders que buscan un equilibrio entre velocidad y fiabilidad en gráficos de 5 a 15 minutos, estas configuraciones ofrecen una mejor relación señal-ruido.

* **Configuración (5, 13, 8):** Preferida por scalpers que buscan capturar fluctuaciones rápidas pero necesitan un mínimo de confirmación de tendencia. Es menos propensa al ruido que la 3-10-16 pero más rápida que la estándar.13  
* **Configuración (8, 17, 9):** Utilizada frecuentemente en pares de divisas mayores (EUR/USD, GBP/USD) durante la sesión de Londres. Ofrece una respuesta más suave, filtrando los "latigazos" (whipsaws) menores mientras mantiene la capacidad de entrar en tendencias intradía emergentes.13

### **2.2. La Estándar Institucional y Swing Trading (H1 \- D1)**

Para operaciones que duran desde unas horas hasta varios días, la configuración clásica de Gerald Appel (12, 26, 9\) sigue siendo la referencia. Su omnipresencia crea una profecía autocumplida: dado que la mayoría de los bots institucionales y traders técnicos observan estas métricas, las reacciones de precios tienden a ocurrir en los cruces de esta configuración específica.8

#### **2.2.1. Ajustes para Mercados Volátiles vs. Estables**

* **Mercados Volátiles (Cripto, Tech Stocks):** En activos con alta beta, algunos traders profesionales amplían los periodos (ej. 19, 39, 9\) para evitar ser sacados del mercado por correcciones violentas que no alteran la tendencia principal. Una configuración más lenta filtra la "espuma" de la volatilidad.12  
* **Mercados Estables (Utilities, Bonos):** Aquí, una configuración más rápida puede ser necesaria para identificar cambios de tendencia que, de otro modo, el MACD estándar tardaría demasiado en señalar debido a la baja varianza del precio.8

### **2.3. Tabla Comparativa de Configuraciones Óptimas**

A continuación, se presenta una guía estructurada para la selección de parámetros basada en el perfil del trader y el activo:

| Perfil de Trading | Temporalidad Sugerida | Configuración (Rápida, Lenta, Señal) | Objetivo Estratégico | Activos Recomendados |
| :---- | :---- | :---- | :---- | :---- |
| **HFT / Scalping** | 1 min \- 5 min | **3, 10, 16** | Captura de momentum puro, rupturas de rango inmediatas. | Futuros de Índices, Cripto (alta liquidez). |
| **Day Trading Agresivo** | 5 min \- 15 min | **5, 13, 8** | Entradas rápidas en tendencias intradía, reversiones en niveles clave. | Forex Majors, Acciones volátiles (Tesla, NVDA). |
| **Day Trading Conservador** | 15 min \- 1H | **8, 17, 9** | Filtrado de ruido de mercado, enfoque en la estructura horaria. | Forex Crosses, Commodities (Oro, Crudo). |
| **Swing Trading** | 4H \- Diario | **12, 26, 9** (Estándar) | Alineación con flujos institucionales, captura de tendencias semanales. | ETFs, Acciones Blue Chip, Forex Swing. |
| **Position Trading** | Semanal \- Mensual | **19, 39, 9** | Inversión a largo plazo, ignorar volatilidad de corto plazo. | Índices Globales, Ciclos de materias primas. |

8

## ---

**3\. Análisis Multitemporal (MTF): La Ventaja Competitiva**

El análisis de un solo marco temporal es unidimensional y peligroso. Los "Smart Money" (dinero institucional) operan basándose en tendencias macroeconómicas y estructurales que solo son visibles en marcos temporales superiores. El trader experto utiliza el concepto de **Análisis Multitemporal (MTF)** para alinear sus operaciones tácticas con los flujos estratégicos de capital.16

### **3.1. La Regla del Factor de Cinco (Sistema Elder)**

Alexander Elder, una autoridad en psicología del trading y análisis técnico, propone una regla de oro para la selección de temporalidades: el marco temporal superior debe ser aproximadamente cinco veces mayor que el marco temporal de ejecución.

* **Si operas en Gráfico Diario (D1):** Tu tendencia debe definirse en el Gráfico Semanal (W1). (5 días de trading \= 1 semana).  
* **Si operas en Gráfico de 1 Hora (H1):** Tu tendencia debe definirse en el Gráfico de 4 o 5 Horas.  
* **Si operas en Gráfico de 10 Minutos:** Tu tendencia se define en el Gráfico de 1 Hora (H1).19

#### **3.1.1. Matriz de Decisión del Sistema Elder**

Este sistema utiliza el MACD para imponer disciplina y evitar operar contra la marea dominante.

1. **Identificación de Tendencia (Timeframe Superior):** Se observa la pendiente del Histograma MACD o de la Línea MACD en el marco superior. Si el histograma semanal está subiendo (barras verdes), la "marea" es alcista.  
2. **Permiso de Operación:** Si la marea es alcista, el trader tiene prohibido vender en corto en el marco temporal inferior, sin importar la señal. Solo se permiten señales de compra.  
3. **Ejecución Táctica (Timeframe Inferior):** Se espera a que el MACD en el marco inferior se alinee con el superior. Por ejemplo, en una tendencia semanal alcista, se espera un retroceso en el diario (MACD bajando) y se compra cuando el MACD diario gira nuevamente al alza.19

### **3.2. Estrategia de Alineación Fractal**

El mercado es fractal; los patrones se repiten en todas las escalas. Una estrategia avanzada implica buscar la confluencia de señales MACD a través de tres marcos temporales:

1. **Marco Mayor (Tendencia):** MACD por encima de cero y líneas separadas (Tendencia fuerte).  
2. **Marco Medio (Estructura):** Histograma retrocediendo hacia cero (Corrección técnica).  
3. **Marco Menor (Entrada):** MACD cruza al alza o rompe una línea de tendencia en el histograma.

Esta alineación asegura que el trader está entrando en el final de una corrección (buy the dip) impulsado por la fuerza de la tendencia mayor. El uso de indicadores MTF personalizados puede visualizar esta alineación superponiendo, por ejemplo, el MACD diario sobre un gráfico de 1 hora.16

## ---

**4\. Estrategias Avanzadas de Ejecución y Señalización**

Más allá del cruce básico de líneas, que a menudo resulta en entradas tardías o falsas en mercados laterales, el trader profesional despliega un arsenal de interpretaciones sofisticadas del MACD.

### **4.1. Divergencia Oculta: La Herramienta del Profesional**

Mientras que la divergencia regular (precio sube, MACD baja) señala una posible reversión y es arriesgada (contratendencia), la **Divergencia Oculta** es una señal de continuación de tendencia. Es el "santo grial" para incorporarse a tendencias establecidas con un ratio riesgo/beneficio superior.23

#### **4.1.1. Identificación y Mecánica**

* **Divergencia Oculta Alcista:** Ocurre durante una tendencia alcista. El precio realiza un mínimo más alto (Higher Low) en un retroceso, manteniendo la estructura alcista. Sin embargo, el oscilador MACD cae hasta un mínimo más bajo (Lower Low) que el anterior.  
  * *Interpretación:* Esto indica que el momentum bajista (venta) ha sido inusualmente fuerte para empujar el oscilador tan bajo, pero el precio ha resistido caer por debajo de su soporte anterior. Muestra una "fortaleza oculta" subyacente y una absorción de la oferta. Es una señal de compra potente.9  
* **Divergencia Oculta Bajista:** En una tendencia bajista, el precio hace un máximo más bajo (Lower High), pero el MACD registra un máximo más alto (Higher High).  
  * *Interpretación:* Un rebote con mucho momentum (entusiasmo) no logró romper la estructura de precios bajista. Indica debilidad estructural y es una oportunidad ideal para vender en corto.25

### **4.2. Estrategia de "Squeeze" (Contracción) y Ruptura**

Los mercados alternan entre periodos de baja volatilidad (consolidación) y alta volatilidad (expansión). El MACD puede utilizarse junto con las Bandas de Bollinger o canales Keltner para identificar estos momentos explosivos, conocidos como "Squeezes".27

#### **4.2.1. El Setup TTM Squeeze con MACD**

Esta estrategia busca capitalizar la liberación de energía acumulada.

1. **Condición de Squeeze:** Las Bandas de Bollinger se estrechan y se introducen dentro de los Canales Keltner, indicando una volatilidad históricamente baja.  
2. **Papel del MACD:** Durante el squeeze, el Histograma MACD tiende a aplanarse cerca de la línea cero, oscilando con amplitudes mínimas.  
3. **El Disparador (Breakout):** Se busca una expansión del Histograma MACD. Si el histograma comienza a imprimir barras crecientes por encima de cero simultáneamente con la ruptura del precio fuera de las Bandas de Bollinger, se confirma una ruptura alcista válida. El MACD actúa aquí como el validador del momentum de la ruptura, filtrando falsas rupturas que carecen de fuerza inercial.28

### **4.3. Agotamiento del Histograma y Reentradas**

El histograma sirve como un sistema de alerta temprana. Una técnica utilizada por traders de swing es la **estrategia de agotamiento**.

* **Escenario:** En una fuerte tendencia alcista, el histograma alcanza un pico alto. Luego, el precio continúa subiendo lentamente o se lateraliza, pero el histograma comienza a descender hacia la línea cero.  
* **La Señal (Re-Hook):** Si el histograma no cruza la línea cero (no se vuelve negativo) y comienza a crecer nuevamente (un "gancho" o hook), esto se conoce como un patrón de continuación de alta probabilidad. Indica que los tomadores de ganancias han salido, y los compradores están retomando el control sin permitir una reversión completa de la tendencia.30

## ---

**5\. Protocolos de Filtrado y Gestión de Falsos Positivos**

El talón de Aquiles del MACD es su rendimiento en mercados laterales (Ranging Markets). En ausencia de tendencia, las medias móviles convergen y se cruzan repetidamente, generando señales falsas constantes que pueden destruir una cuenta de trading mediante pérdidas consecutivas (death by a thousand cuts). Para operar a nivel profesional, es obligatorio implementar filtros de confluencia.9

### **5.1. El Filtro de Fuerza de Tendencia (ADX)**

El Índice Direccional Medio (ADX) es el compañero matemático ideal para el MACD. Mientras el MACD mide la dirección y el momentum, el ADX mide puramente la fuerza de la tendencia, sin importar la dirección.

* **Regla Operativa Institucional:**  
  * **Si ADX \< 20 (o 25):** El mercado está en rango o "dormido". Se ignoran todas las señales de cruce del MACD destinadas a rupturas. Se asume que cualquier señal de tendencia fallará.  
  * **Si ADX \> 25 y subiendo:** La tendencia es robusta. Las señales de cruce del MACD a favor de la tendencia tienen una probabilidad de éxito estadísticamente superior.  
* **Estrategia Combinada:** Entrar largo solo si: MACD cruza al alza \+ Línea MACD \> 0 \+ ADX \> 25 \+ Línea DI+ \> Línea DI-. Esta combinación filtra la gran mayoría de las entradas fallidas en mercados erráticos.9

### **5.2. Confluencia con Estructura de Mercado y Volumen**

Un trader experto nunca opera un indicador en el vacío; el precio es el rey.

* **Soporte y Resistencia:** Una señal de compra del MACD (cruce alcista o divergencia) que ocurre *exactamente* en un nivel de soporte mayor (soporte horizontal clave, media móvil de 200 periodos o nivel de Fibonacci) tiene una validez mucho mayor que una señal en "tierra de nadie".1  
* **Validación por Volumen:** En una señal de ruptura alcista del MACD, el volumen debe acompañar el movimiento. Si el MACD cruza al alza pero el volumen es decreciente o bajo, es probable que sea una divergencia bajista en formación o una trampa de mercado. El volumen confirma la participación institucional necesaria para sostener el movimiento.10

### **5.3. RSI como Árbitro de Sobreextensión**

El Índice de Fuerza Relativa (RSI) ayuda a determinar si es demasiado tarde para entrar en una señal del MACD.

* **Filtro de Entrada:** Si el MACD da señal de compra, pero el RSI ya está por encima de 70 (sobrecompra), el riesgo de un retroceso inmediato es alto. El trader profesional espera a que el RSI se "enfríe" (retroceda) o busca una señal donde el RSI esté saliendo de sobreventa (cruzando 30 hacia arriba) en sincronía con el MACD.37

## ---

**6\. Lógica Algorítmica y Trading Cuantitativo con MACD**

En la era moderna, las instituciones utilizan sistemas algorítmicos para ejecutar estas estrategias. Para el trader discrecional, pensar como un algoritmo (basado en reglas estrictas) es vital para la consistencia.

### **6.1. Diseño de un Sistema Robusto**

El backtesting (pruebas con datos históricos) revela que el MACD "crudo" tiene un rendimiento subóptimo. Sin embargo, al codificar reglas lógicas, el rendimiento mejora drásticamente. Un algoritmo robusto basado en MACD podría seguir esta pseudo-lógica 35:

SI (Precio \> EMA\_200\_Diaria) Y (ADX\_14 \> 25\) ENTONCES:  
Tendencia \= ALCISTA  
SI (MACD\_H1 cruza sobre Señal\_H1) Y (MACD\_H1 \< 0\) ENTONCES:  
Señal\_Entrada \= COMPRA (Buy on Dip)  
SI (Histograma\_MACD\_H1 comienza a decrecer durante 3 velas) ENTONCES:  
Señal\_Salida \= CIERRE PARCIAL  
Esta lógica incorpora:

1. **Filtro de Tendencia Macro:** (Precio \> EMA 200).  
2. **Filtro de Volatilidad:** (ADX).  
3. **Optimización de Entrada:** Comprar cuando el MACD está bajo cero (oversold) dentro de una tendencia alcista ofrece mejor recorrido.  
4. **Gestión Activa:** Usar el histograma para salidas tempranas antes de que la tendencia se revierta completamente.39

### **6.2. Riesgos de "Curve Fitting" (Sobreajuste)**

Un peligro en el análisis cuantitativo del MACD es ajustar los parámetros (ej. cambiar 12-26-9 a 10-22-7) hasta que la estrategia sea perfecta en el pasado. Esto se llama *curve fitting* y suele fallar en el trading en vivo. Los estudios sugieren que las configuraciones estándar o ampliamente utilizadas son más robustas a lo largo del tiempo porque no dependen de las idiosincrasias de un periodo de datos específico, sino de la dinámica general del mercado.40

## ---

**7\. Gestión de Riesgos y Psicología del Trader**

El uso del MACD conlleva desafíos psicológicos específicos, principalmente debido a su naturaleza retardada.

### **7.1. La Disciplina del Retraso**

Los traders novatos a menudo sienten ansiedad al ver que el precio se mueve antes de que el MACD confirme la señal. Intentan "anticiparse" al cruce, entrando antes de tiempo. El trader profesional entiende que el "costo" de entrar un poco tarde (esperando la confirmación del MACD) es la prima de seguro que se paga para evitar falsas rupturas. La paciencia para esperar el cierre de la vela que confirma el cruce o el patrón de histograma es lo que separa a los profesionales de los aficionados.32

### **7.2. Gestión de Stop Loss con MACD**

No se debe colocar el Stop Loss basándose en el indicador, sino en la estructura del precio.

* **Regla:** Si se entra por una señal alcista del MACD, el Stop Loss debe ir debajo del último "Swing Low" (mínimo relevante) del precio, no cuando el MACD cruce a la baja. El MACD puede cruzarse a la baja brevemente durante una consolidación sin que la tendencia alcista termine. Usar el precio como invalidez técnica es más seguro.36

### **7.3. Matriz de Decisión ante Conflictos**

¿Qué hacer cuando el MACD Diario es alcista pero el MACD de 4 Horas es bajista?

* **Decisión Profesional:** Se prioriza la tendencia superior. El conflicto se interpreta como un "retroceso" en la tendencia principal. No se vende (porque la diaria es alcista), pero tampoco se compra inmediatamente. Se espera a que el MACD de 4 Horas termine su ciclo bajista y gire al alza, alineándose nuevamente con el Diario. Esta paciencia estratégica evita operar en la "zona de conflicto".17

## ---

**8\. Conclusiones y Recomendaciones Finales**

El análisis experto confirma que el MACD es una herramienta indispensable para la inversión, siempre que se utilice dentro de un ecosistema de trading estructurado y no como una "bola de cristal" aislada.

Para implementar este conocimiento a nivel profesional, se recomienda:

1. **Estandarización Flexible:** Utilice la configuración estándar (12, 26, 9\) para análisis estructural y Swing Trading, pero no dude en emplear configuraciones rápidas (ej. 5, 13, 8\) para la ejecución táctica intradía.  
2. **Multitemporalidad Obligatoria:** Nunca ejecute una operación sin consultar el MACD del marco temporal superior (Factor x5). La alineación de tendencias es su mayor ventaja estadística.  
3. **Filtrado Riguroso:** Integre el ADX y la acción del precio (Soporte/Resistencia) para filtrar los periodos de consolidación donde el MACD es matemáticamente propenso a fallar.  
4. **Divergencia Oculta:** Entrene su ojo para detectar divergencias ocultas; son las oportunidades de menor riesgo y mayor beneficio en mercados de tendencia.  
5. **Mentalidad Probabilística:** Acepte que el MACD fallará. Utilice una gestión de riesgos sólida (Stop Loss estructurales y dimensionamiento de posición) para sobrevivir a las rachas de pérdidas inevitables y capitalizar las grandes tendencias que el MACD identifica con excelencia.

Este enfoque integral transforma al MACD de un simple indicador en un marco operativo completo para la toma de decisiones de inversión de alto nivel.

#### **Obras citadas**

1. Moving Average Convergence Divergence (MACD) | Learn to Trade | OANDA | US, fecha de acceso: diciembre 22, 2025, [https://www.oanda.com/us-en/learn/indicators-oscillators/determining-entry-and-exit-points-with-macd/](https://www.oanda.com/us-en/learn/indicators-oscillators/determining-entry-and-exit-points-with-macd/)  
2. fecha de acceso: diciembre 22, 2025, [https://www.mathworks.com/help/finance/macd.html\#:\~:text=The%20MACD%20is%20calculated%20by,as%20the%20%22signal%22%20line.](https://www.mathworks.com/help/finance/macd.html#:~:text=The%20MACD%20is%20calculated%20by,as%20the%20%22signal%22%20line.)  
3. What is MACD? \- Understanding How To Use, Read, And Calculate It \- Earn2Trade, fecha de acceso: diciembre 22, 2025, [https://www.earn2trade.com/blog/what-is-macd/](https://www.earn2trade.com/blog/what-is-macd/)  
4. How to Calculate the MACD \- Fairmont Equities, fecha de acceso: diciembre 22, 2025, [https://fairmontequities.com/how-to-calculate-the-macd/](https://fairmontequities.com/how-to-calculate-the-macd/)  
5. \[Must Read for Beginners\] Understand the Three Core Concepts of MACD\! \- Binance, fecha de acceso: diciembre 22, 2025, [https://www.binance.com/en/square/post/29008254648201](https://www.binance.com/en/square/post/29008254648201)  
6. MACD Oscillator \- Formula, Examples in Technical Analysis \- Corporate Finance Institute, fecha de acceso: diciembre 22, 2025, [https://corporatefinanceinstitute.com/resources/career-map/sell-side/capital-markets/macd-oscillator-technical-analysis/](https://corporatefinanceinstitute.com/resources/career-map/sell-side/capital-markets/macd-oscillator-technical-analysis/)  
7. Understanding MACD Histogram: Key to Spotting Stock Trend Changes \- Investopedia, fecha de acceso: diciembre 22, 2025, [https://www.investopedia.com/articles/technical/091001.asp](https://www.investopedia.com/articles/technical/091001.asp)  
8. Best MACD Settings for Swing Trading \- VectorVest, fecha de acceso: diciembre 22, 2025, [https://www.vectorvest.com/blog/swing-trading/best-macd-settings-for-swing-trading/](https://www.vectorvest.com/blog/swing-trading/best-macd-settings-for-swing-trading/)  
9. Master MACD Trading Strategies for Predicting Market Trends \- Investopedia, fecha de acceso: diciembre 22, 2025, [https://www.investopedia.com/articles/forex/05/macddiverge.asp](https://www.investopedia.com/articles/forex/05/macddiverge.asp)  
10. Timothy Sykes Unveils Expert MACD Day Trading Strategies for Smarter Market Moves, fecha de acceso: diciembre 22, 2025, [https://www.barchart.com/story/news/30706910/timothy-sykes-unveils-expert-macd-day-trading-strategies-for-smarter-market-moves](https://www.barchart.com/story/news/30706910/timothy-sykes-unveils-expert-macd-day-trading-strategies-for-smarter-market-moves)  
11. BEST MACD Trading Strategy (+TradingView Settings), fecha de acceso: diciembre 22, 2025, [https://www.youtube.com/watch?v=6hpKxY5PaqE\&vl=en](https://www.youtube.com/watch?v=6hpKxY5PaqE&vl=en)  
12. Best MACD Settings for Day Trading: Your Ultimate Guide \- ePlanet Brokers, fecha de acceso: diciembre 22, 2025, [https://eplanetbrokers.com/en-US/training/best-macd-settings-for-day-trading](https://eplanetbrokers.com/en-US/training/best-macd-settings-for-day-trading)  
13. MACD Settings: Parameters for Day Trading & Scalping \- 2026 Guide, fecha de acceso: diciembre 22, 2025, [https://admiralmarkets.com/education/articles/forex-indicators/macd-indicator-in-depth](https://admiralmarkets.com/education/articles/forex-indicators/macd-indicator-in-depth)  
14. MACD Trading Strategies and Best MACD Settings | Capital.com, fecha de acceso: diciembre 22, 2025, [https://capital.com/en-int/learn/technical-analysis/macd-trading-strategy](https://capital.com/en-int/learn/technical-analysis/macd-trading-strategy)  
15. MACD: The Ultimate Trading Indicator That Actually Works \- ePlanet Brokers, fecha de acceso: diciembre 22, 2025, [https://eplanetbrokers.com/en-US/training/macd-indicator-explained](https://eplanetbrokers.com/en-US/training/macd-indicator-explained)  
16. TradingView Multi Time Frame MACD, fecha de acceso: diciembre 22, 2025, [https://www.youtube.com/watch?v=pVqMTdKgTl0](https://www.youtube.com/watch?v=pVqMTdKgTl0)  
17. Using MACD in Multiple Timeframes, fecha de acceso: diciembre 22, 2025, [https://www.youtube.com/watch?v=znQrlZMrIm4](https://www.youtube.com/watch?v=znQrlZMrIm4)  
18. What Is an MACD Time Frame & How You Can Use It To Your ..., fecha de acceso: diciembre 22, 2025, [https://elitecurrensea.com/education/the-magic-of-the-multiple-time-frame-trading-with-macd/](https://elitecurrensea.com/education/the-magic-of-the-multiple-time-frame-trading-with-macd/)  
19. Elder Impulse System \- ChartSchool \- StockCharts.com, fecha de acceso: diciembre 22, 2025, [https://chartschool.stockcharts.com/table-of-contents/chart-analysis/chart-types/elder-impulse-system](https://chartschool.stockcharts.com/table-of-contents/chart-analysis/chart-types/elder-impulse-system)  
20. Elder Impulse \- GoCharting, fecha de acceso: diciembre 22, 2025, [https://gocharting.com/docs/charting/chart-types/time-aggregation](https://gocharting.com/docs/charting/chart-types/time-aggregation)  
21. Elder Impulse System \- Strategy And Rules \- QuantifiedStrategies.com, fecha de acceso: diciembre 22, 2025, [https://www.quantifiedstrategies.com/elder-impulse-system/](https://www.quantifiedstrategies.com/elder-impulse-system/)  
22. Multi-timeframe MACD Indicator Crossover Trading Strategy | by Sword Red | Medium, fecha de acceso: diciembre 22, 2025, [https://medium.com/@redsword\_23261/multi-timeframe-macd-indicator-crossover-trading-strategy-c6821366a1fe](https://medium.com/@redsword_23261/multi-timeframe-macd-indicator-crossover-trading-strategy-c6821366a1fe)  
23. MACD Trading Strategies Guide \- TradersPost Blog, fecha de acceso: diciembre 22, 2025, [https://blog.traderspost.io/article/macd-trading-strategies-guide](https://blog.traderspost.io/article/macd-trading-strategies-guide)  
24. MACD Hidden Divergence Trading Strategy \- Trading Setups Review, fecha de acceso: diciembre 22, 2025, [https://www.tradingsetupsreview.com/macd-hidden-divergence-trading-strategy/](https://www.tradingsetupsreview.com/macd-hidden-divergence-trading-strategy/)  
25. The Moving Average Convergence Divergence (MACD) An Introduction | FP Markets, fecha de acceso: diciembre 22, 2025, [https://www.fpmarkets.com/education/trading-courses/course-3-beginner/the-moving-average-convergence-divergence-macd-an-introduction/](https://www.fpmarkets.com/education/trading-courses/course-3-beginner/the-moving-average-convergence-divergence-macd-an-introduction/)  
26. Understanding Hidden Divergence in Trading \- MarketBulls, fecha de acceso: diciembre 22, 2025, [https://market-bulls.com/hidden-divergence/](https://market-bulls.com/hidden-divergence/)  
27. Bollinger Bands and MACD: Entry Rules Explained \- LuxAlgo, fecha de acceso: diciembre 22, 2025, [https://www.luxalgo.com/blog/bollinger-bands-and-macd-entry-rules-explained/](https://www.luxalgo.com/blog/bollinger-bands-and-macd-entry-rules-explained/)  
28. Top 5 Ways to Master the TTM Squeeze Trading Strategy | EBC Financial Group, fecha de acceso: diciembre 22, 2025, [https://www.ebc.com/forex/top-ways-to-master-the-ttm-squeeze-trading-strategy](https://www.ebc.com/forex/top-ways-to-master-the-ttm-squeeze-trading-strategy)  
29. The Complete Guide to MACD Indicator, fecha de acceso: diciembre 22, 2025, [https://www.tradingwithrayner.com/macd-indicator/](https://www.tradingwithrayner.com/macd-indicator/)  
30. MACD Trading Strategy \- How to set up MACD Indicator? \- AvaTrade Australia, fecha de acceso: diciembre 22, 2025, [https://www.avatrade.com.au/education/technical-analysis-indicators-strategies/macd-trading-strategies](https://www.avatrade.com.au/education/technical-analysis-indicators-strategies/macd-trading-strategies)  
31. Hidden Power of MACD Histogram (90% Traders Miss This) \- YouTube, fecha de acceso: diciembre 22, 2025, [https://www.youtube.com/watch?v=ctH45oEyXUo](https://www.youtube.com/watch?v=ctH45oEyXUo)  
32. Would it theoretically be a bad idea to only trade using the macd? I say not. \- Reddit, fecha de acceso: diciembre 22, 2025, [https://www.reddit.com/r/Daytrading/comments/1d3mk60/would\_it\_theoretically\_be\_a\_bad\_idea\_to\_only/](https://www.reddit.com/r/Daytrading/comments/1d3mk60/would_it_theoretically_be_a_bad_idea_to_only/)  
33. MACD and ADX strategy: how to ride the trend \- Forex Tester Online, fecha de acceso: diciembre 22, 2025, [https://forextester.com/blog/macd-adx-strategy/](https://forextester.com/blog/macd-adx-strategy/)  
34. ADX Indicator Trading Strategies \- AvaTrade, fecha de acceso: diciembre 22, 2025, [https://www.avatrade.com/education/technical-analysis-indicators-strategies/adx-indicator-trading-strategies](https://www.avatrade.com/education/technical-analysis-indicators-strategies/adx-indicator-trading-strategies)  
35. Backtest results for an ADX trading strategy : r/algotrading \- Reddit, fecha de acceso: diciembre 22, 2025, [https://www.reddit.com/r/algotrading/comments/1irhrcw/backtest\_results\_for\_an\_adx\_trading\_strategy/](https://www.reddit.com/r/algotrading/comments/1irhrcw/backtest_results_for_an_adx_trading_strategy/)  
36. Best practices to avoid fake breakouts : r/Daytrading \- Reddit, fecha de acceso: diciembre 22, 2025, [https://www.reddit.com/r/Daytrading/comments/1iagfyl/best\_practices\_to\_avoid\_fake\_breakouts/](https://www.reddit.com/r/Daytrading/comments/1iagfyl/best_practices_to_avoid_fake_breakouts/)  
37. MACD Indicator Installation \+ Trading Strategies | AvaTrade, fecha de acceso: diciembre 22, 2025, [https://www.avatrade.com/education/technical-analysis-indicators-strategies/macd-trading-strategies](https://www.avatrade.com/education/technical-analysis-indicators-strategies/macd-trading-strategies)  
38. MACD and RSI Strategy: 73% Win Rate \- Rules, Settings \- QuantifiedStrategies.com, fecha de acceso: diciembre 22, 2025, [https://www.quantifiedstrategies.com/macd-and-rsi-strategy/](https://www.quantifiedstrategies.com/macd-and-rsi-strategy/)  
39. MACD Algorithmic Trading Strategy: Simplified Theory and Python Implementation \- Medium, fecha de acceso: diciembre 22, 2025, [https://medium.com/@patelsaadn/macd-algorithmic-trading-strategy-simplified-theory-and-python-implementation-d366d39ed351](https://medium.com/@patelsaadn/macd-algorithmic-trading-strategy-simplified-theory-and-python-implementation-d366d39ed351)  
40. Algorithmic trading using MACD signals \- DiVA portal, fecha de acceso: diciembre 22, 2025, [https://www.diva-portal.org/smash/get/diva2:721625/FULLTEXT01.pdf](https://www.diva-portal.org/smash/get/diva2:721625/FULLTEXT01.pdf)  
41. What is the MACD indicator in trading and how to read/use it? \- Axi, fecha de acceso: diciembre 22, 2025, [https://www.axi.com/int/blog/education/macd-indicator](https://www.axi.com/int/blog/education/macd-indicator)  
42. MACD Trading Strategy (2025): A Complete Guide for Beginners, fecha de acceso: diciembre 22, 2025, [https://highstrike.com/macd-trading-strategy/](https://highstrike.com/macd-trading-strategy/)