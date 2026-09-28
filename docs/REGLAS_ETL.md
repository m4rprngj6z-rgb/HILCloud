# Reglas del ETL (scripts/etl.py)

Todo lo que el ETL calcula está aquí, en español, con su origen. Si cambias una regla en el
código, cámbiala aquí en el mismo commit. Nada de esto depende del criterio de un LLM: mismo
input, mismo output.

**Verificación:** `python3 tests/test_regresion_26sep.py` reproduce los 6 reportes Champion
aprobados del 26 sep 2026 (65 personas): 313 comparaciones idénticas, 0 fallas, y solo las
diferencias documentadas en la sección 9. Además, un recuento independiente (script distinto,
sin ver este código) cuadró exacto las 9 personas de ENN del corte 21-25 sep.

## 1. Fuentes

| Qué | Dónde | Quién manda |
|---|---|---|
| Uso de Harvey | `harvey-usage-start_*.xlsx` en `/mnt/user-data/uploads/` (no se versionan) | Harvey |
| Roster (SD, nombre, nivel, fortaleza esperada, a quién reporta) | `data/roster.json` | Notion HIL (tabla maestra + organigramas) |
| Excepciones (vacaciones, incapacidades, eventos) | `data/excepciones.json` | Notion HIL, tabla "Excepciones activas" |

Si Notion y el repo difieren, Notion gana: re-sincronizar aquí.

## 2. Carga

- Se leen **todos** los exports (son ventanas móviles de ~30 días que se traslapan) y se
  deduplica por `ID de uso único`.
- Dos esquemas: hasta jul 2026 Harvey exportó en inglés (`Time`, `User`, `Product Surface Area`,
  `ASSISTANT`, `DRAFT`); después en español. El ETL normaliza ambos. **Antes se descartaban en
  silencio las filas en inglés** (junio-julio), lo que acortaba el historial.
- Persona = parte del correo antes de la @, en minúsculas. Fusiona dominios
  (`compartamos.com`, `genteraservicios.com`, `gentera.com.mx`).

## 3. Herramienta de cada acción (regla confirmada por Tony, 28 sep 2026)

La columna "Superficie del producto" trae combinaciones. Precedencia, gana la primera:

1. contiene WORKFLOW → **W**
2. contiene VAULT, **o la fila trae proyecto Vault** (columna "Nombre del proyecto Vault") → **V**
3. contiene WORD o PLAYBOOK → **Wo**
4. contiene OUTLOOK → **O** (desde el corte del 26 sep; antes se contaba en A)
5. contiene ASISTENTE → **A** (incluye BORRADOR y CENTRO_DE_COMANDO)

**Vault fuera de la superficie** (hallazgo 28 sep 2026, caso Diana Fuentes): cuando alguien
consulta un Vault desde Assistant o Word, Harvey registra la superficie ASISTENTE/WORD y pone el
proyecto en otra columna. En la DJ, de 1,864 acciones sobre proyectos Vault solo 168 traían VAULT
en la superficie; el resto se contaba como A (1,293) o Wo (143). Desde el 28 sep cuentan como V.
Con la precedencia, una acción de Workflow sobre un Vault sigue siendo W. No cambia totales,
semáforos ni urgencias: solo el reparto entre herramientas (y por eso Firma, Motivo y Fortaleza).
Los reportes aprobados hasta el 26 sep subcontaban V; la prueba de regresión usa
`vault_solo_superficie=True` para reproducirlos.

Filas de W cuyo nombre de workflow es genérico (`Assist`, `Word Add-In Assistant`) cuentan en W
pero no se nombran como workflow ni cuentan para Diversidad.

## 4. Cortes y excepciones

- Corte = **lunes 00:00 a viernes 23:59** hora CDMX (Context Prompt en Notion). Actividad de fin
  de semana no cuenta (el JSON reporta cuántas acciones se excluyeron).
- Una semana es **de excepción** para una persona si: tiene cualquier día de incapacidad, o 3 o
  más días hábiles cubiertos por una excepción personal o de su SD. Los días inhábiles de toda la
  DJ (ej. 16 sep) reducen los días hábiles pero no cuentan como ausencia.
- Si la persona tiene excepción personal y además hay una de su SD, la etiqueta muestra la
  personal.
- **Ausencia parcial (1 o 2 días) o día inhábil** (decisión Tony, 28 sep 2026): la regla de 3
  días no se mueve, la semana se califica normal. Si sale amarillo o rojo, el Motivo empieza con
  la razón: "Semana con 2 días de vacaciones (17-18 sep) y 1 día inhábil (16 sep): explica parte
  de la baja, pero no alcanza los 3 días hábiles para excepción." Si solo hubo día inhábil:
  "Semana de 4 días hábiles (16 sep inhábil): explica parte de la baja."
- **Semana de transición** (decisión Tony, 28 sep 2026, caso PLD 21-25 sep): si la semana es de
  excepción solo porque una excepción de toda la SD cierra dentro de ella (sin incapacidad y con
  menos de 3 días de ausencia personal), se **califica** como referencia (la celda dice "en
  excepción"), pero **sigue siendo excepción**: urgencia Sin acción, no rompe racha, no entra a
  la línea base de las semanas siguientes.

## 5. Semáforo (HIL, regla 26 sep 2026)

- Línea base = promedio de las 5 semanas anteriores **excluyendo semanas de excepción** (pueden
  quedar menos de 5). Aplica igual al total y a la línea base por herramienta.
- **Respaldo tras excepción larga** (decisión de Claude, 28 sep 2026, pendiente de ratificar): si
  no queda ninguna semana útil en la ventana de 5, se usan las últimas 5 semanas útiles antes de
  la excepción (el ETL carga 16 semanas de historial). Sin esto, PLD saldría "?" completo varias
  semanas después de la reestructuración. El Motivo lo indica.
- Semanas anteriores a la fecha de alta de una persona no cuentan como historial (no son ceros
  reales).
- Verde ≥ 100% de su línea base; Amarillo 40-99%; Rojo < 40%. Sin piso absoluto.
- Línea base 0: verde si tuvo actividad, rojo si no.
- Excepción esta semana → EXCEPCIÓN (no se califica).
- `?` → alta documentada (`alta` en roster.json) hace menos de 5 semanas, o sin ninguna semana
  útil de línea base.

## 6. Racha y Diversidad (agregadas 26 sep 2026)

- **Racha**: desde el corte actual hacia atrás, dentro de los últimos 5 cortes, cuántos seguidos
  en verde o amarillo con más de 5 acciones. Excepción se salta sin romper. Si los 5 cortes son
  excepción: `N/A` (N/A de ciclo, no 0).
- **Div. Wf**: promedio semanal de workflows distintos en los últimos 5 cortes, sin contar
  semanas de excepción ni nombres genéricos.

## 7. Columnas del reporte Champion

Reconstruidas del generador que se perdió, ajustadas contra los 65 casos aprobados del 26 sep.
Donde un umbral no quedó determinado de forma única por los datos, se anota el rango que
reproduce lo aprobado.

- **Urgencia**
  - Excepción → Sin acción
  - `?` → Media
  - Rojo, o 5 acciones o menos, o menos de 50% de su línea base → **Alta** (cualquier umbral
    entre 46% y 64% reproduce lo aprobado)
  - Amarillo, o verde por debajo de 120% → **Media** (cualquier umbral entre 112% y 123%)
  - Verde ≥ 120% con más de 5 acciones → **Baja**
- **Orden de la tabla**: Urgencia (Alta, Media, Baja, Sin acción), luego % de su línea base de
  menor a mayor.
- **Firma**: herramientas usadas esta semana, de mayor a menor. Empates: orden de la
  Nomenclatura del HIL (A, W, V, Wo, O).
- **Motivo del semáforo** (compara cada herramienta contra su propia línea base):
  - Si ninguna herramienta se movió 2 o más acciones → "Cambio leve y parejo entre herramientas".
  - Si no: verde = Aumento, amarillo/rojo = Caída. Se toman solo las herramientas que se
    movieron en esa dirección. Si la segunda se movió al menos la mitad que la primera →
    "pareja entre X y Y"; si no → "concentrada en X, el resto se mantiene cerca de su ritmo".
  - Primera semana completa tras una excepción: se antepone la nota obligatoria del HIL.
- **Fortaleza actual**: si usó workflows reales esta semana → el más usado ("su workflow más
  usado, Nx"; empate: más usado en el ciclo, luego alfabético). Si no → la herramienta con mayor
  promedio en su línea base ("es su herramienta más consistente históricamente").

## 8. Formato (scripts/helpers.js, scripts/generate_champion.js)

Replica el XML de `ENN_Champion_26sep2026.docx` aprobado: Arial, encabezados #1F3864, filas
alternas #EBF3FB, bordes #BFBFBF, estados con relleno (verde C6EFCE/375623, amarillo
FFEB9C/9C5700, rojo FFC7CE/9C0006, excepción F2F2F2/666666), códigos A #1F3864, Wo #9C5700,
W #9C0006. V (#375623) y O (#7030A0) no aparecían en ningún aprobado. Sin emoji dentro de texto
Arial. "Persona", no "Usuario". El generador lanza error si algún texto trae raya larga.

Agregado sobre el aprobado (acordado 26 sep): columnas O, Racha, Div. Wf y la tabla de códigos
autocontenida.

## 8b. Reporte Ejecutivo (scripts/generate_ejecutivo.js)

Replica `ENN_Ejecutivo_25sep2026.docx` aprobado. Cifras del ETL; texto de `narrativa/`.

- **Vista por Gerencia = totales de toda la gerencia** (decisión Tony, 28 sep 2026; el aprobado
  del 25 sep mostraba solo al responsable). Cada persona cae en la gerencia de su jefe inmediato
  bajo el Subdirector (organigrama del HIL); quien reporta directo al Subdirector sin gerencia
  propia cae en la fila de la Subdirección. Nombres y orden de gerencias: los del aprobado
  (`nombre gerencia` y `orden_gerencias` en roster.json). Semáforo de la gerencia: total del
  equipo contra la suma del promedio propio de sus integrantes, sin quienes están en excepción.
  El reporte lo aclara en una nota.
- **Regla 8 del HIL**: la gerencia de jbueno (Contratos TI & AI) aparece con sus integrantes
  (Isis) y la nota de reporte funcional; las métricas de jbueno siguen excluidas. El aprobado del
  25 sep la omitía.
- **Usos clave**: una fila por persona con workflow nombrado esta semana (su más usado), de más a
  menos veces; empate alfabético.
- **Semáforo de la semana**: celdas con relleno y texto ("3 VERDE"), sin emoji (Estándar).
- **Regresión**: `tests/test_regresion_ejecutivo_25sep.py` (37 comparaciones, 0 fallas).

## 8d. Reporte Fibi DJ (scripts/dj.py + scripts/generate_fibi.js)

- `dj.py` suma los JSON del ETL de las 6 SD: acciones, semana anterior, personas activas,
  workflows, WAU, tendencia y conteo de semáforo por SD. No agrega reglas.
- Estructura = los 5 Fibi aprobados del 28 ago al 25 sep (idéntica en los 5): métricas DJ,
  Semáforo por SD, Casos de impacto (máx. 3), Puntos de atención. El Context Prompt de Notion
  (julio) pide una tabla de trayectoria de 5 semanas que ningún Fibi aprobado reciente trae; se
  sigue lo aprobado.
- Cambios: sin raya larga en el título ni en los nombres de SD; columna "Exc. / ?" solo si
  alguna SD la necesita; nota de semana de transición (PLD 21-25 sep).
- Nivel área: el revisor rechaza el texto si nombra a más de 2 personas.
- Regresión: `tests/test_regresion_fibi_25sep.py` (12 comparaciones, 0 fallas).

## 8c. Texto redactado (narrativa/) y su revisor

El código no redacta. La Recomendación y la Acción del Ejecutivo (y los Casos y Puntos de
atención del Fibi) se escriben por corte en `narrativa/<fecha del viernes>/<SD>.json`.
`scripts/validar_narrativa.py` los rechaza si: citan un número que no sale del ETL (los
porcentajes deben coincidir con uno calculado), traen raya larga, usan frases prohibidas
(tratamiento político, "subir a verde", carga operativa), o el Fibi nombra a más de 2 personas.
Correrlo siempre antes de generar.

## 9. Diferencias conocidas contra los reportes del 26 sep (esperadas)

| Caso | Por qué |
|---|---|
| PLD completo | El 26 sep se calificó contra una línea base que incluía semanas de la reestructuración. Ahora es semana de transición (sección 4): se califica contra su ritmo previo a la reestructuración y con urgencia Sin acción. |
| Karime Sotelo, Motivo | El generador viejo usaba línea base por herramienta sin excluir vacaciones (inconsistente con su propia línea base total). |
| Alfredo Duarte, Motivo | El ETL agrega la nota post-excepción obligatoria del HIL; el reporte del 26 sep la omitió (el del 25 sí la traía). |
| Javier García, Firma | Empate Wo = W: el generador viejo desempataba por orden de aparición en el archivo (con Gabriel Juárez lo hizo al revés). |
| Gramática | "Caída parejo/concentrado" → "Caída pareja/concentrada". |

## 10. Decisiones abiertas (Tony)

- Respaldo de línea base tras excepción larga (sección 5): ratificar.
