# Pendientes del pipeline

## Hecho (26 sep 2026)

- [x] `scripts/helpers.js` + `scripts/generate.js`: motor que arma UN reporte Champion (docx)
      a partir de un JSON de entrada. Incluye tabla de uso (A/W/V/Wo/O + Semáforo), tabla de
      Diagnóstico y seguimiento (Urgencia, Racha, Diversidad de Workflows, Motivo del
      semáforo, Fortaleza actual), plan de sesión, preguntas diagnósticas y la tabla de
      códigos autocontenida. Probado end-to-end con `data/sample_report_input_ENN.json`,
      valida limpio contra el validador oficial de docx.
- [x] `H.computeRacha()` en helpers.js: misma lógica ya validada a mano el 26 sep (salta
      excepciones sin romper racha, detecta ciclo N/A cuando toda la ventana es excepción).

## Falta

- [ ] **El paso que falta de verdad es el ETL**: nada arma todavía el JSON de entrada
      (`sample_report_input_*.json`) a partir de los xlsx crudos (`harvey-usage-*.xlsx`,
      `vaults_export_*.xlsx`, `workflows_export_*.xlsx`). Ese calculo (fusion de dominios
      duplicados, semaforo self-relative, racha, diversidad de workflows, outlook aparte) se
      hizo a mano en Python dentro de una sesion de chat; falta convertirlo en un script
      reutilizable (`scripts/etl.py` o similar) que lea `data/roster.py` + los exports y
      escriba el JSON que `generate.js` espera.
- [ ] Correr el ETL + generate.js para las 6 SD reales del corte vigente (no solo la muestra
      de ENN) y para el reporte FibiDJ (formato distinto, agregado a nivel DJ).
- [ ] Extender el semáforo self-relative (v3.0) a CN/PLD/GC/JC/RL en los reportes oficiales;
      por ahora solo corrió como piloto en ENN y como mocks para el resto.
- [ ] `scripts/narratives/`: por SD, texto de resumen/casos Montessori que hoy se escribe a
      mano en el `resumen` y `casosMontessori` del JSON de entrada. Ver si vale la pena
      generarlo con un LLM a partir de los datos, o si se sigue escribiendo a mano cada corte.
