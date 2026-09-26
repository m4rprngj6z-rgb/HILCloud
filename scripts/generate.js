/**
 * generate.js — arma un reporte Champion (docx) para UNA sub-direccion (SD).
 *
 * Uso: node generate.js <input.json> <output.docx>
 *
 * input.json shape:
 * {
 *   "sd": "ENN",
 *   "sdNombre": "Expansión Nuevos Negocios",
 *   "champion": "Karime Sotelo",
 *   "corte": "22-25 sep 2026",
 *   "fecha": "26 de septiembre de 2026",
 *   "resumen": "texto libre del resumen del corte",
 *   "casosMontessori": "texto libre, opcional",
 *   "rows": [
 *     {
 *       "usuario": "kmendez", "nombre": "Karla Méndez", "nivel": "Subdirectora",
 *       "a": 12, "w": 3, "v": 0, "wo": 0, "o": 60, "total": 75,
 *       "semaforo": "amarillo",              // verde | amarillo | rojo | excepcion | sin_historial
 *       "urgencia": "Media",                 // Alta | Media | Baja | Sin acción
 *       "racha": 5,                          // 0-5, o null si naCiclo=true
 *       "naCiclo": false,
 *       "diversidadWf": 1.4,                 // promedio de workflows distintos, ultimas 5 semanas
 *       "motivo": [ {"text": "Sube "}, {"text": "60% ", "bold": true, "color": "2F6F62"}, {"text": " por Outlook."} ],
 *       "fortaleza": "Outlook sobre correspondencia diaria",
 *       "champion": false
 *     }
 *   ],
 *   "planSesion": { "objetivo": "...", "duracion": "60 minutos", "agenda": [["0-10 min","Apertura..."]] },
 *   "preguntas": ["¿...?", "¿...?"]
 * }
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, HeadingLevel, AlignmentType,
} = require('docx');
const H = require('./helpers');

function buildUsageTable(rows) {
  const widths = [1500, 1450, 550, 550, 550, 550, 550, 650, 1950];
  const header = H.headerRow(['Usuario', 'Nivel', 'A', 'W', 'V', 'Wo', 'O', 'Total', 'Semáforo'], widths);
  const trs = rows.map(r => new TableRow({
    children: [
      H.cell(r.champion ? `★ ${r.nombre}` : r.nombre, { width: widths[0], bold: r.champion }),
      H.cell(r.nivel, { width: widths[1] }),
      H.cell(r.a, { width: widths[2], align: AlignmentType.CENTER }),
      H.cell(r.w, { width: widths[3], align: AlignmentType.CENTER }),
      H.cell(r.v, { width: widths[4], align: AlignmentType.CENTER }),
      H.cell(r.wo, { width: widths[5], align: AlignmentType.CENTER }),
      H.cell(r.o, { width: widths[6], align: AlignmentType.CENTER }),
      H.cell(r.total, { width: widths[7], bold: true, align: AlignmentType.CENTER }),
      H.semaforoCell(r.semaforo, { width: widths[8] }),
    ],
  }));
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, rows: [header, ...trs] });
}

function buildDiagnosticoTable(rows) {
  const widths = [1500, 1100, 900, 1300, 2200, 1800];
  const header = H.headerRow(['Usuario', 'Urgencia', 'Racha', 'Div. Wf (5s)', 'Motivo del semáforo', 'Fortaleza actual'], widths);
  const trs = rows.map(r => new TableRow({
    children: [
      H.cell(r.nombre, { width: widths[0] }),
      H.urgenciaCell(r.urgencia, { width: widths[1], align: AlignmentType.CENTER }),
      H.cell(r.naCiclo ? 'N/A' : String(r.racha), { width: widths[2], align: AlignmentType.CENTER }),
      H.cell(r.diversidadWf != null ? r.diversidadWf.toFixed(1) : '-', { width: widths[3], align: AlignmentType.CENTER }),
      H.tdRich(Array.isArray(r.motivo) ? r.motivo : [{ text: r.motivo || '' }], { width: widths[4] }),
      H.cell(r.fortaleza || '', { width: widths[5] }),
    ],
  }));
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, rows: [header, ...trs] });
}

function buildCodigosTable() {
  const widths = [900, 1800, 5100];
  const header = H.headerRow(['Código', 'Herramienta', 'Qué mide'], widths);
  const data = [
    ['A', 'Assistant', 'Conversación libre con Harvey: redacción, dudas, resúmenes puntuales.'],
    ['W', 'Workflow', 'Ejecución de un flujo prediseñado y repetible.'],
    ['V', 'Vault', 'Consulta o proyecto documental en un repositorio de Vault.'],
    ['Wo', 'Word Add-in', 'Uso de Harvey directamente dentro de un documento de Word.'],
    ['O', 'Outlook', 'Uso de Harvey dentro del correo. Se cuenta aparte de Assistant desde el corte 26 sep 2026.'],
  ];
  const trs = data.map(row => new TableRow({
    children: [
      H.cell(row[0], { width: widths[0], bold: true }),
      H.cell(row[1], { width: widths[1] }),
      H.cell(row[2], { width: widths[2] }),
    ],
  }));
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, rows: [header, ...trs] });
}

function buildPlanTable(agenda) {
  const widths = [1400, 7300];
  const header = H.headerRow(['Tiempo', 'Actividad'], widths);
  const trs = agenda.map(([t, act]) => new TableRow({
    children: [H.cell(t, { width: widths[0], bold: true }), H.cell(act, { width: widths[1] })],
  }));
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, rows: [header, ...trs] });
}

function p(text, opts = {}) {
  return new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 120 } });
}

function buildDocument(data) {
  const children = [
    p('Harvey AI × Gentera', { bold: true, size: 20 }),
    new Paragraph({ text: `Reporte Semanal Champion | SD ${data.sdNombre}`, heading: HeadingLevel.TITLE }),
    p(`Corte: ${data.corte}  |  ${data.fecha}  |  Champion: ${data.champion}`, { color: H.COLORS.grey, italics: true }),

    new Paragraph({ text: 'Resumen del corte', heading: HeadingLevel.HEADING_1 }),
    p(data.resumen || ''),
  ];

  if (data.casosMontessori) {
    children.push(p(data.casosMontessori, { italics: true, color: H.COLORS.teal }));
  }

  children.push(
    new Paragraph({ text: 'Reporte de uso', heading: HeadingLevel.HEADING_1 }),
    buildUsageTable(data.rows),
    p('A = Assistant | W = Workflow | V = Vault | Wo = Word Add-in | O = Outlook | ★ Champion: uso contaminado por rol HAI.', { size: 18, color: H.COLORS.greyLight }),

    new Paragraph({ text: 'Diagnóstico y seguimiento', heading: HeadingLevel.HEADING_1 }),
    p('Ordenado por urgencia. Racha: cortes consecutivos en verde/amarillo con más de 5 interacciones, dentro del ciclo de 5 semanas. N/A = ciclo cubierto por una excepción documentada de toda la SD.'),
    buildDiagnosticoTable([...data.rows].sort((a, b) => {
      const order = { Alta: 0, Media: 1, Baja: 2, 'Sin acción': 3 };
      return (order[a.urgencia] ?? 9) - (order[b.urgencia] ?? 9);
    })),
  );

  if (data.planSesion) {
    children.push(
      new Paragraph({ text: 'Plan de sesión', heading: HeadingLevel.HEADING_1 }),
      p(`Objetivo: ${data.planSesion.objetivo}  Duración: ${data.planSesion.duracion}`),
      buildPlanTable(data.planSesion.agenda),
    );
  }

  if (data.preguntas && data.preguntas.length) {
    children.push(
      new Paragraph({ text: 'Preguntas diagnósticas', heading: HeadingLevel.HEADING_1 }),
      ...data.preguntas.map(q => new Paragraph({ children: [new TextRun({ text: `• ${q}` })], spacing: { after: 80 } })),
    );
  }

  children.push(
    new Paragraph({ text: 'Tabla de códigos', heading: HeadingLevel.HEADING_1 }),
    p('Incluida para que el Champion no dependa de tener acceso a Notion para leer su propio reporte.'),
    buildCodigosTable(),
    p(' '),
    p(`Elaboró: José Antonio Bueno Díaz | Harvey AI Champion de Champions, DJ`, { size: 18, color: H.COLORS.greyLight }),
  );

  return new Document({
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 } } }, children }],
  });
}

if (require.main === module) {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Uso: node generate.js <input.json> <output.docx>');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const doc = buildDocument(data);
  Packer.toBuffer(doc).then(buf => {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buf);
    console.log('OK:', outputPath);
  });
}

module.exports = { buildDocument };
