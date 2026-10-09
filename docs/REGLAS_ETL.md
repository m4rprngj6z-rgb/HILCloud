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

Si Notion y el repo difieren, Notion gana: re-sincronizar aquí con `scripts/sync_notion.py`.

**Sincronización (`scripts/sync_notion.py <hil.md> [--escribir]`).** La sesión trae la página del
HIL con el conector de Notion, la guarda fuera del repo y se la pasa al script. Sin `--escribir`
solo lista diferencias.
- De Notion: quién existe en las 6 tablas maestras, y por persona sd, nombre, puesto, nivel, rol
  HAI, F. esperada, Champion (rol con ★), reporta a (organigrama de la SD) y alta ("Alta DD mmm
  AAAA" en Flags). Excepciones: la tabla completa, con las columnas "Fecha inicio/Fecha fin
  (AAAA-MM-DD)"; la primera palabra de Persona es el usuario, "Toda la SD XXX" o "Toda la DJ".
- Se conserva del repo: campos que Notion no tiene (gerencia, area, nota_licencia, baja_ejecutada,
  fuera_de_semaforo, excluido_metricas, orden_gerencias...), las cuentas de "DJ y cortesías" y
  "Cuentas especiales", y el tipo/nota cortos de una excepción que ya existía con las mismas
  fechas (ese texto sale en los reportes). Una excepción nueva toma el Tipo de Notion sin el
  paréntesis final.
- `data/roster_correcciones.json`: diferencias deliberadas contra Notion, cada una con su motivo
  (hoy solo lrobert = Luis Ricardo Robert).
- Avisa, sin inventar datos: altas y bajas de usuarios, personas fuera del organigrama, cuentas
  nuevas en cortesías (se dan de alta a mano) y excepciones sin fecha AAAA-MM-DD (se detiene).

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
  semanas después de la reestructuración. **Ratificada por Tony, 28 sep 2026**, con la condición
  de aclararlo en el reporte: cuántas semanas quedaron sin conteo y contra qué semanas previas se
  compara (ej. "Las 5 semanas anteriores quedaron sin conteo por la excepción. 12 personas se
  comparan contra sus 5 semanas previas a la excepción (29 jun-31 jul)"). Va en el Motivo de la
  persona, y en semana de transición en el resumen del Champion, la nota del Ejecutivo y el Fibi.
- Semanas anteriores a la fecha de alta de una persona no cuentan como historial (no son ceros
  reales).
- Verde ≥ 100% de su línea base; Amarillo 40-99%; Rojo < 40%. Sin piso absoluto.
- Línea base 0: verde si tuvo actividad, rojo si no.
- Excepción esta semana → EXCEPCIÓN (no se califica).
- `?` → alta documentada (`alta` en roster.json) hace menos de 5 semanas, o sin ninguna semana
  útil de línea base.

## 6. Racha y Diversidad

- **Acciones = todas las interacciones** (Tony, 28 sep 2026): cada pregunta y cada follow-up es
  una fila del export y cuenta 1. Se probó una columna de "conversaciones distintas" (hilos) y se
  retiró el mismo día: el Champion no tiene cómo interpretarla y en Word/Outlook cada acción es su
  propio hilo, así que casi no distingue nada.


- **Últimas 5 semanas** (Tony, 29 sep 2026; reemplaza a la columna Racha en el Champion, que no
  se entendía sin contexto): acciones de cada una de las últimas 5 semanas, de la más antigua a la
  actual, con el color del semáforo de esa semana; gris e itálica = semana de excepción. El ETL
  sigue calculando `racha` (queda en el JSON), pero ningún reporte la muestra.
- **Motivo** (29 sep 2026): "el resto se mantiene cerca de su ritmo" solo cuando las demás
  herramientas de verdad variaron menos de 2; con 0 acciones: "Sin actividad esta semana; su
  herramienta principal es X".
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
autocontenida. Desde el 28 sep, **página horizontal** (14 columnas no caben en vertical sin partir palabras).

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
- **W deja de ser métrica estelar** (Tony, 28 sep 2026): en Métricas (Ejecutivo y Fibi),
  "Workflows ejecutados" se reemplaza por **Personas en atención alta** (urgencia Alta, de las
  calificadas esta semana). W sigue visible en Fortaleza y Usos clave.
- **Qué pedirle a la gerencia** (reemplaza la columna W; Tony, 28 sep 2026). Reglas fijas,
  máximo 2 renglones por gerencia, una acción por persona:
  1. "Buscar a X (N% de su ritmo | sin actividad | solo N acciones en la semana)": personas en
     urgencia Alta. Se dice "solo N acciones" cuando la Alta es por volumen bajo, no por caída.
  2. "Proponer un primer uso de <herramienta> a X: su puesto lo espera y no lo usa": la primera
     herramienta de su F. esperada (HIL) no es Assistant, no la usó esta semana y su promedio en
     esa herramienta es menor a 1 (el Gap esperada vs. observada del HIL).
  3. Si no hay nada: "Sin pendiente: sostener el ritmo". En excepción o transición: no escalar.
  El Subdirector (destinatario) no aparece en su propia fila: su semana ya se ve en el semáforo.
- **"?" → "Alta reciente"** en todos los reportes (Tony: el "?" no se entendía). En el Fibi la
  columna es "Sin calificar", escrita en palabras (ej. "1 en excepción, 6 altas recientes").
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

## 8e. Gobierno de Licencias (scripts/licencias.py + scripts/generate_licencias.js)

Reglas del HIL (sección "Gobierno de Licencias", 25 sep 2026), aplicadas tal cual:
- Dos ránkings de menor a mayor uso semanal: Jurídico (roster de las 6 SD, sin ningún filtro) y
  No Jurídico (cortesías y externos con licencia activa; las bajas ejecutadas no entran). jbueno y
  zmanzur van aparte, solo como referencia.
- Top 10 por semana. **Empates en el lugar 10: entran todos los empatados** (ratificado por Tony,
  28 sep 2026; el aprobado del 25 sep dejó fuera a 2 personas con las mismas 3 acciones sin regla).
- Apariciones: veces en el top 10 en los cortes del mes calendario (mes del viernes), desde el
  primer corte del sistema (25 sep 2026). Una semana de excepción (misma regla del ETL) no cuenta.
- Candidato = 2 o más apariciones en el mismo mes. Se presenta; Tony decide.
- Radar: top 10 de ambos ránkings esta semana + quien ya apareció este mes + saltos al alza, con
  gráfica de 8 semanas (semana de excepción = punto hueco gris). "Salto al alza" solo en no
  jurídicos: esta semana 20+ acciones y al menos el triple de su promedio de las 7 previas.
- Notas al lado de la persona (ej. "Regulador"), nunca como razón para omitirla.
- Regresión: `tests/test_regresion_licencias_25sep.py` (24 comparaciones, 0 fallas).

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

Ninguna al 28 sep 2026 (respaldo de línea base y empates de Licencias, ratificados).

## 8f. Comparativo de Subdirectores (a pedido, no semanal)

Pedido por Karla Méndez el 29 sep 2026. `scripts/subdirectores.py --corte-fin <viernes>` (después
del ETL de las 6 SD) y `scripts/generate_subdirectores.js`. Solo agrega el historial por corte
que ya produjo el ETL para las cabezas de SD de `roster.json` (`subdirectores`, incluye al Director
Funcional de RL).
- Ventana: últimas 15 semanas completas (desde que hay datos). Semanas de excepción fuera del
  promedio y de la mezcla; si las últimas 4 son todas de excepción, ese promedio es crudo y va con *.
- Orden: promedio semanal en semanas útiles. Sin semáforo (Tony, 29 sep 2026): solo volumen,
  constancia, tendencia y mezcla de herramientas.
- La lectura se arma en código con los mismos números; no hay texto redactado a mano.
- Firma: "Gerente Contratos TI & AI" (título formal), no el rol de Champion de Champions.

## 8g. Cortesías bajo seguimiento de una Subdirección

Tony, 30 sep 2026 (casos: Diana Gabriela Castillo Luna, Compras, y George Chirinos, Control Interno; ambas licencias a cargo de
Karla Méndez). Son solo informativas. En `roster.json` la cortesía lleva `seguimiento_sd` (la SD cuyo Ejecutivo la muestra),
`solicito` y `alta`. El ETL la lista aparte en `cortesias`: acciones de la semana, las últimas
semanas (solo desde su alta) y firma. No entra a totales, semáforo, urgencia ni gerencias. El
Ejecutivo la muestra en una línea bajo la nomenclatura de Vista por Gerencia; con cortesías, Usos
clave muestra 5 filas para que quepa en una página. En Gobierno de Licencias entra al ránking no
jurídico desde su fecha de alta (antes de su alta no existe la cuenta).

## 8h. Ajustes del corte 28 sep-2 oct 2026

- **Semanas después de una excepción larga de toda la SD** (`base_previa_info`): mientras la mayoría
  del equipo se compare contra sus semanas previas a la excepción, el Champion, el Ejecutivo y el Fibi
  lo dicen una vez para toda la SD (rango usado y altas sin historial); la columna Motivo ya no lo
  repite por persona.
- **Motivo con 0 acciones**: siempre "Sin actividad esta semana; su herramienta principal es X",
  aunque el cambio contra su promedio sea leve.
- **Días de ausencia no consecutivos** se escriben "28 y 30 sep", no "28-30 sep".
- **Ejecutivo en una página**: `correr_corte.sh` mide las páginas y, si hace falta, lo regenera con
  `--compacto` 1 a 3 (Usos clave a 3 filas; letra 0.5 pt menor; Usos clave en una línea y márgenes
  menores). Si aun así no cabe, avisa para acortar la narrativa.
- **Ránking no jurídico (ratificado por Tony, 2 oct 2026)**: con menos de 10 cuentas el top 10 las
  incluye a todas; una aparición solo cuenta si la persona quedó igual o debajo del lugar 10 del
  ránking jurídico de esa semana.
- **No escalar tras una excepción larga de la SD (Tony, 2 oct 2026; caso PLD)**: mientras una
  persona se compare contra sus semanas previas a la excepción (`baseline_previa`), su urgencia es
  Sin acción, el color se marca "referencia", no cuenta en "calificadas" y Qué pedirle dice "Sin
  escalar". Se apaga solo cuando junta 5 semanas propias después de la excepción.
  Cómo se arma la base en esas semanas (`semanas_base`, 2 oct 2026): las semanas útiles desde la
  excepción, completadas hasta 5 con las previas a ella; mientras incluya alguna previa sigue siendo
  referencia. Solo aplica a excepciones de toda la SD (5+ semanas): tras una ausencia personal larga se
  compara contra las semanas nuevas, como siempre. Altas: sin calificar hasta tener 5 semanas útiles
  propias, aunque su alta tenga más de 5 semanas (las 6 altas de PLD del 22 ago entraron en la
  excepción).
- **Excepción con actividad (`cuenta_en_base_desde`, Tony, 2 oct 2026; caso PLD)**: si la SD sí trabajó
  durante su excepción, la excepción lleva una fecha desde la cual sus semanas entran a la línea base
  (siguen en gris en Últimas 5 semanas y no se califican en su momento). PLD: la reestructura del 3 ago
  al 24 sep cuenta desde el corte del 9 oct (lunes 5 oct). Efecto: sin escudo desde el 9 oct; todo PLD,
  altas incluidas, se compara contra sus últimas 5 semanas reales. El corte del 2 oct no cambia.
  Motivo: la reestructura fue en agosto, así que esas semanas reflejan los roles actuales mejor que
  junio y julio, y el uso de PLD (unas 12 acciones por persona a la semana) no mostraba crecimiento.
- `correr_corte.sh` acepta `UPLOADS=<carpeta>` cuando los exports no están en /mnt/user-data/uploads.

## 8i. Fibi mensual (Tony, 2 oct 2026)

- **Cuándo**: el último viernes de cada mes, el Fibi mensual sustituye al Fibi semanal (siguen siendo 14
  docx). `correr_corte.sh` lo detecta solo. Primero real: corte del 30 oct 2026 (octubre).
- **Mes**: cortes cuyo viernes cae en el mes calendario (misma regla que licencias; 28 sep-2 oct es de
  octubre). Se compara contra el mes anterior.
- **Métricas** (`scripts/fibi_mensual.py`), todas por persona por semana útil, para que meses de 4 y 5
  cortes se comparen parejo y las ausencias no cuenten como baja: acciones por persona por semana,
  % de personas activas por semana, ejecuciones de Workflow por semana. Las excepciones de SD con
  `cuenta_en_base_desde` (reestructura de PLD) sí cuentan: el equipo trabajó.
- **SD sin comparativo**: menos de 2 semanas útiles en alguno de los dos meses; se marca con *.
- **Candidatos a licencia** (Tony, 2 oct 2026): los del Gobierno de Licencias del último corte del mes,
  CON nombre (excepción a la regla de 2 nombres, solo en esta sección: la decisión es de Fibi). Mandos
  (Director y Subdirector) en su propia línea. Fuera: quien tenga `nota_licencia` en el roster (regulador,
  o "En revisión", como Juan Miguel Gálvez por trabajo presencial hasta tener fechas).
- **Septiembre 2026** se cerró retroactivo (`licencias.py --sistema-desde 2026-09-01`, `fibi_mensual.py --gl`):
  la regla aplicada a sus 4 cortes. Se entregó el 2 oct junto con el Fibi semanal, una sola vez.
- **Narrativa**: `narrativa/<viernes>/DJ.json` -> `fibi_mensual.destacados` (máx. 3) y
  `fibi_mensual.decisiones` (máx. 3, opcional). Máximo 2 personas nombradas, como el Fibi semanal.
- **Formato**: 1 página; métricas del mes, barras de las últimas 10 semanas (el mes en azul), tabla
  por SD en orden fijo (no es ránking), Lo que destaca, Decisiones para Dirección.

## 8j. Suplente del Champion (Tony, 5 oct 2026)

- Una excepción personal del Champion puede traer `"suplente": "<usuario>"` en `data/excepciones.json`
  (se conserva en el sync; en Notion va en la nota de la fila). Si el día de entrega del reporte (el mismo
  viernes del corte; corregido por Tony el 9 oct 2026) cae dentro de la ausencia, el encabezado del Champion dice "Champion: <suplente>
  (suplente de <Champion>)" y el reporte se envía al suplente.
- Caso vigente: Jorge Belloc (CN) fuera del 9 al 23 oct; Javier García recibe los cortes del 9, 16 y 23 oct.

## 8k. Capacitación por rango y necesidad (Tony, 7 oct 2026)

- Sección nueva al final del Gobierno de Licencias (solo para Tony): calendario, rangos, Champions,
  referentes por herramienta y equipos. Cálculo en `scripts/capacitacion.py` -> `out/CAP_<viernes>.json`.
- Ventana: últimas 8 semanas útiles de cada persona (las excepciones de SD con `cuenta_en_base_desde`
  sí cuentan). Mezcla = % de acciones por herramienta.
- Necesidad de un rango = primera herramienta de su fortaleza esperada que no es Assistant (Playbook,
  sección 6): Subdirector A>V, Gerente A>W, Líder y Coordinador W>A, Analista W>V>A. Se reporta cuántas
  personas del rango no la usaron. Rangos con menos de 3 personas quedan fuera. Subdirectores solo en
  agregado (8f).
- Fortaleza = herramienta con más uso; hueco de un equipo = la de menor uso entre Wo, V, W y O.
- Referente por herramienta: el Champion y la persona de la DJ con más acciones por semana útil.
- Calendario: `data/capacitaciones.json` (lo decide Tony; el script solo cuenta cuántos del público no
  usan la herramienta).
- **Coordina y expertos (Tony, 7 oct 2026)**: cada sesión separa a quien COORDINA (sabe llevar una
  capacitación: hoy solo Alejandra Mireles está probada; Karime Sotelo todavía no, primero su reporte) de
  los EXPERTOS (las 3 personas con más uso de la herramienta, calculado cada semana; en Assistant, sin
  señales de calidad).
- **Top 3 urgentes por sesión**: Workflow, primero quien repite la misma tarea en Assistant y luego quien
  no usa Workflow, por volumen total; otras herramientas, quien no la usa, por volumen total; Assistant,
  instrucciones mínimas.
- **Calidad de Assistant (provisional; Tony: "no asumir que un uso de Assistant es un uso de valor")**:
  sobre `harvey-queries-*.xlsx`, superficie ASISTENTE pura, primera consulta de cada hilo.
  Tarea repetida = 50% o más de sus hilos (mín. 10) arrancan con la misma instrucción (8 primeras palabras
  normalizadas, 3+ veces; sin prefijos de rol ni llamadas a workflows): candidata a Workflow, y su volumen
  de Assistant no se lee como ritmo de valor. Instrucciones mínimas = mediana < 15 palabras (mín. 5 hilos;
  sin contar llamadas a workflows por mención o nombre escrito). No adjuntar documentos NO es señal:
  en PLD se pegan los datos en la instrucción.
- **Alertas amarillas de uso deficiente (Tony, 7 oct 2026: "el pez se pudre desde la cabeza")**: por
  persona, cualquiera de estas señales en sus últimas 8 semanas: tarea repetida en Assistant; instrucciones
  mínimas; 2 o más hilos que arrancan solo con el nombre de un workflow; 5 o más calificaciones negativas.
  Por SD: 3 o más personas con señal, o su Champion con señal. Van como "Follow-ups" al inicio de la
  sección de Capacitación del Gobierno de Licencias, con la acción sugerida por señal. Provisionales.
- **Coordinación rotativa**: `rotacion` en `data/capacitaciones.json` (lista de Champions). Cada sesión
  con `"coordina": "rotacion"` toma al siguiente, saltando a quien coordinó la anterior, a quien está fuera
  esa semana (excepciones personales) y a quien tiene alerta amarilla. Quien tenga alerta tampoco es
  experto ni referente de ninguna herramienta.
- **Cada Champion y cada Subdirector ven lo de su equipo (Tony, 7 oct 2026)**: `capacitacion.py` arma
  `por_sd` (alerta de la SD, alertas por persona con follow-up, y por sesión cuántos de su equipo no usan la
  herramienta y a quién convocar primero). Champion: sección "Alertas y capacitación de tu equipo" antes de
  "Antes del próximo corte". Ejecutivo: dos líneas (alerta agrupada por señal; 2 sesiones con 2 nombres),
  dentro del auto-compacto de una página.

