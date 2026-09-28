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

- [x] **Reporte Ejecutivo** (6): formato aprobado por Tony 28 sep; los 6 del corte 21-25 sep generados.
- [x] **Reporte Fibi DJ** (1): generado para 21-25 sep, pendiente de revision de Tony.
- [x] **Gobierno de Licencias** (1): generado para 21-25 sep; pendiente de revision de Tony.
- [x] `scripts/correr_corte.sh`: los 14 docx de un corte con un comando.
- [x] Texto narrativo: lo redacta Claude por corte en narrativa/ y lo revisa validar_narrativa.py.
- [ ] Decisiones abiertas de Tony: ver docs/REGLAS_ETL.md seccion 10.
- [x] `scripts/sync_notion.py`: regenera roster.json y excepciones.json desde el HIL (28 sep).

## Operación (28 sep 2026)

- Solo Tony corre el pipeline, hasta nuevo aviso. Jorge queda en pausa.
- [ ] Antes de las vacaciones de Tony: traspaso a Alejandra Mireles (Champion GC). Definir si
      trabaja con acceso al repo o con una sesión preparada, y actualizar el Context Prompt de
      Notion para ella.
