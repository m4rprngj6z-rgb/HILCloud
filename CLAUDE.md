# HILCloud — Harvey AI x Gentera, pipeline de reportes DJ

Repo privado. Contiene datos de personal de la Direccion Juridica (DJ) de Gentera/Banco
Compartamos: roster, vacaciones, incapacidades. **Nunca lo hagas publico. Nunca subas los
exports semanales crudos (harvey-usage-*.xlsx, vaults_export_*.xlsx) a este repo**: son
demasiado grandes y cambian cada semana, se procesan desde /mnt/user-data/uploads/ en cada
sesion, no se versionan aqui.

## Que es esto

Tony Bueno (jbueno) es Harvey AI Champion de Champions en la DJ (~70 personas, 6
sub-direcciones: ENN, CN, PLD, GC, JC, RL). Cada semana ("corte") se generan 14 reportes
docx (6 SD x Ejecutivo+Champion, 1 para su jefa Fibi y 1 de Gobierno de Licencias) a partir de exports de uso de
Harvey. Antes de este repo, el pipeline (roster, scripts de generacion) vivia solo en la
memoria de cada sesion de Claude y se perdia con cada reinicio de sandbox. Este repo es la
fuente de verdad versionada para que eso deje de pasar.

## Fuente de verdad para METODOLOGIA y EXCEPCIONES: Notion, no este repo

El HIL (Harvey Intelligence Layer) en Notion sigue siendo la fuente de verdad operativa:
- Pagina principal (metodologia, semaforo, excepciones activas, gobierno de licencias):
  notion.so/37df66a17162812a9f53e15cb031792d
- Base de Usuarios (roster oficial): notion.so/376f66a1716281c5a12fd8385313d6e7
- KPIs: notion.so/384f66a1716281c4a244e5c15cb28bf2

`data/roster.py` es una COPIA sincronizada del roster de Notion para uso en scripts Python/
Node. Si hay conflicto entre este archivo y Notion, Notion gana: corrige alla primero, luego
sincroniza aqui.

## Estructura

- `data/roster.json` — roster completo (SD, nombre, puesto, nivel, fortaleza esperada, a quien
  reporta, altas). Lo regenera `scripts/sync_notion.py` desde el HIL, no a mano. `data/roster.py`
  solo lo carga. `data/roster_correcciones.json`: diferencias deliberadas contra Notion.
- `data/excepciones.json` — copia de la tabla "Excepciones activas" del HIL, con rangos de fecha.
- `scripts/etl.py` — exports crudos -> JSON por SD. Todo el calculo vive aqui.
- `scripts/dj.py` (vista DJ para el Fibi), `scripts/licencias.py` (Gobierno de Licencias): calculo.
- `scripts/generate_{champion,ejecutivo,fibi,licencias}.js` + `scripts/helpers.js` — JSON -> docx.
  No calculan.
- `scripts/correr_corte.sh` — corre el corte completo (14 docx).
- `narrativa/<fecha>/<SD>.json` — texto redactado por corte (Recomendacion, Accion...).
  `scripts/validar_narrativa.py` lo revisa contra el ETL antes de generar.
- `tests/test_regresion_26sep.py` — reproduce los reportes aprobados del 26 sep. Correrlo
  despues de cualquier cambio al ETL.
- `docs/REGLAS_ETL.md` — TODAS las reglas de calculo y formato, con su origen. Leerlo antes de
  tocar el ETL o el generador.
- `out/` — salidas (ignorado por git).

## Correr un corte

0. Sincronizar con Notion: fetch del HIL (37df66a17162812a9f53e15cb031792d) con el conector,
   guardarlo FUERA del repo (scratchpad) y `python3 scripts/sync_notion.py <archivo>`; revisar
   las diferencias y aplicar con `--escribir`. Si cambia algo, correr las pruebas del paso 5.
1. Correr el ETL de las 6 SD para ver los datos: `python3 scripts/etl.py --corte-fin <viernes> --sd <SD>`
2. Redactar la narrativa del corte en `narrativa/<viernes>/`: `<SD>.json` (ejecutivo: recomendacion,
   accion) y `DJ.json` (fibi: casos, puntos; licencias: notas opcionales). Usar las del corte
   anterior como modelo. El revisor rechaza cifras que no salen del ETL.
3. `scripts/correr_corte.sh <viernes> "<fecha larga>"`: genera y valida los 14 docx en `out/`.
4. Pasar a PDF y revisarlo visualmente (Estandar): al menos 1 Champion, 1 Ejecutivo, Fibi y Licencias.
5. Si tocaste el ETL: `python3 tests/test_regresion_26sep.py`, `..._ejecutivo_25sep.py`,
   `..._fibi_25sep.py`, `..._licencias_25sep.py`. Todas deben dar 0 fallas.

## Lo que NO se hace

- No calcular metricas a mano en la sesion de chat: si una regla falta, se agrega al ETL y a
  docs/REGLAS_ETL.md. Ese fue el problema original que este repo resuelve.
- No inventar formato: replicar los reportes aprobados (estan en /mnt/user-data/outputs/ de las
  sesiones donde Tony los adjunta) y el Estandar de Diseno de Notion.

## Metodologia clave (resumen; el detalle completo vive en Notion)

- **Semaforo (self-relative, desde 26 sep 2026)**: cada persona se compara contra su propio
  promedio movil de 5 semanas, no contra su SD. 🟢 >=100% de su ritmo, 🟡 40-99%, 🔴 <40%,
  ⚪ excepcion documentada (se excluye del calculo de baseline, no solo se anota), ? <5
  semanas de historial.
- **Ultimas 5 semanas** (reemplaza a Racha desde el 29 sep 2026): acciones de cada una de las
  ultimas 5 semanas con el color de su semaforo; gris = excepcion. Racha ya no se reporta.
- **Diversidad de Workflows**: cuantos workflows DISTINTOS ejecuta cada persona (no cuantas
  veces), promedio semanal en las ultimas 5 semanas.
- **Outlook**: se cuenta aparte de Assistant desde el corte del 26 sep 2026 en adelante.
- **Codigos de herramienta**: A=Assistant, W=Workflow, V=Vault, Wo=Word add-in (incluye Playbook),
  O=Outlook. Precedencia cuando una accion trae varias superficies: W > V > Wo > O > A.
- **Corte**: lunes a viernes, hora CDMX.

## Al iniciar una sesion nueva sobre este repo

1. Lee este archivo (ya lo hiciste si estas viendo esto).
2. Si vas a tocar metodologia o excepciones, confirma contra Notion antes de asumir que
   `data/roster.py` o `docs/` estan al dia: pudieron cambiar entre sesiones.
3. Los exports semanales (xlsx) llegan como adjuntos de la conversacion, no viven aqui.
   Procesalos desde `/mnt/user-data/uploads/` cada vez.

## Decisiones vigentes que no estan en el codigo (al 2 oct 2026)

- Firma de todos los documentos: "Jose Antonio Bueno Diaz | Gerente Contratos TI & AI". Nunca
  "Champion de Champions" como titulo en un documento.
- Nunca raya larga. Entregables en .docx (presentaciones en .pptx), nunca HTML.
- Fibi/Direccion: maximo 2 personas nombradas; nunca admitir errores metodologicos pasados; nunca
  tratamiento politico. Nunca comparar Subdirectores con semaforo (pidio Karla Mendez; ver 8f).
- Acciones = cada pregunta y cada follow-up. "Conversaciones" se probo y se retiro.
- Universo de los reportes semanales: 65 personas de las 6 SD. En la junta mensual con la DJ se
  usa toda la DJ (67: + Fibi y Tony).
- Cortesias a cargo de Karla Mendez (George Chirinos, Control Interno; Diana Gabriela Castillo,
  Compras): una linea informativa en el Ejecutivo de ENN, sin sumar a nada (REGLAS 8g).
- Licencias: candidato = 2+ apariciones en el top 10 de menor uso del mismo mes calendario. Octubre
  es el primer mes completo; primera lista real para la sesion de KPIs de noviembre.
- Pendientes abiertos: cuenta duplicada glosanchez@compartamos.com (sin uso desde 14 ago, liberable);
  Juan Miguel Galvez (GC) en trabajo presencial, Alejandra Mireles lo esta resolviendo (no registrar
  excepcion hasta que Tony de fechas); caso GC-01 (600 reactivos) sin tiempos antes/despues.
