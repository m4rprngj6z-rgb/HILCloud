# Pendientes del pipeline

## Hecho (28 sep 2026)

- [x] `scripts/etl.py`: exports crudos -> JSON por SD. Normaliza los dos esquemas de Harvey,
      deduplica, fusiona dominios, clasifica W>V>Wo>O>A, cortes lunes-viernes, excepciones desde
      `data/excepciones.json`, linea base sin semanas de excepcion, semaforo, racha, diversidad,
      urgencia, firma, motivo y fortaleza. Incluye a todo el roster evaluable, tenga o no actividad.
- [x] `data/roster.json` generado desde el HIL (nombre, nivel, F. esperada, reporta a, altas).
- [x] `tests/test_regresion_26sep.py`: 313 comparaciones iguales contra los 6 Champion aprobados
      del 26 sep, 0 fallas. Recuento independiente de ENN: exacto.
- [x] `scripts/generate_champion.js`: replica el Champion aprobado del 26 sep + O, Racha, Div. Wf
      y tabla de codigos.

## Falta

- [ ] **Reporte Ejecutivo** (6): portar la estructura de `{SD}_Ejecutivo_25sep2026.docx`
      (semaforo de la semana, metricas, Vista por Gerencia, usos clave, recomendacion, caja de
      accion). Los datos ya estan en el JSON del ETL (`reporta_a` para gerencias, workflow_top).
- [ ] **Reporte Fibi DJ** (1): nivel area, maximo 1-2 personas nombradas, trayectoria 5 semanas.
      Requiere un modo del ETL que junte las 6 SD.
- [ ] **Gobierno de Licencias** (1, para Tony): rankings y conteo mensual (reglas en el HIL).
- [ ] Textos narrativos (Recomendacion del Ejecutivo, casos, lectura del Fibi): decidir si se
      escriben a mano sobre datos del ETL o se generan con plantillas deterministas.
- [ ] Decisiones abiertas de Tony: ver docs/REGLAS_ETL.md seccion 10.
- [ ] `sync_notion.py`: regenerar roster.json y excepciones.json desde Notion sin copiar a mano.
