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
  WidthType, HeadingLevel, AlignmentType, TableLayoutType,
} = require('docx');
const H = require('./helpers');

function buildUsageTable(rows) {
  const widths = [1350, 1200, 500, 500, 500, 600, 500, 750, 2400];
  const header = H.headerRow(['Usuario', 'Nivel', 'A', 'W', 'V', 'Wo', 'O', 'Total', 'Semáforo'], widths);
  const trs = rows.map((r, i) => {
    const fill = H.zebraFill(i);
    return new TableRow({
      children: [
        H.cell(r.champion ? `★ ${r.nombre}` : r.nombre, { width: widths[0], bold: r.champion, fill }),
        H.cell(r.nivel, { width: widths[1], fill }),
        H.cell(r.a, { width: widths[2], align: AlignmentType.CENTER, fill }),
        H.cell(r.w, { width: widths[3], align: AlignmentType.CENTER, fill }),
        H.cell(r.v, { width: widths[4], align: AlignmentType.CENTER, fill }),
        H.cell(r.wo, { width: widths[5], align: AlignmentType.CENTER, fill }),
        H.cell(r.o, { width: widths[6], align: AlignmentType.CENTER, fill }),
        H.cell(r.total, { width: widths[7], bold: true, align: AlignmentType.CENTER, fill }),
        H.semaforoCell(r.semaforo, { width: widths[8], fill }),
      ],
    });
  });
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, rows: [header, ...trs] });
}

function buildDiagnosticoTable(rows) {
  const widths = [1500, 1100, 900, 1300, 2200, 1800];
  const header = H.headerRow(['Usuario', 'Urgencia', 'Racha', 'Div. Wf (5s)', 'Motivo del semáforo', 'Fortaleza actual'], widths);
  const trs = rows.map((r, i) => {
    const fill = H.zebraFill(i);
    return new TableRow({
      children: [
        H.cell(r.nombre, { width: widths[0], fill }),
        H.urgenciaCell(r.urgencia, { width: widths[1], align: AlignmentType.CENTER, fill }),
        H.cell(r.naCiclo ? 'N/A' : String(r.racha), { width: widths[2], align: AlignmentType.CENTER, fill }),
        H.cell(r.diversidadWf != null ? r.diversidadWf.toFixed(1) : '-', { width: widths[3], align: AlignmentType.CENTER, fill }),
        H.tdRich(Array.isArray(r.motivo) ? r.motivo : [{ text: r.motivo || '' }], { width: widths[4], fill }),
        H.cell(r.fortaleza || '', { width: widths[5], fill }),
      ],
    });
  });
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, rows: [header, ...trs] });
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
  const trs = data.map((row, i) => {
    const fill = H.zebraFill(i);
    return new TableRow({
      children: [
        H.cell(row[0], { width: widths[0], bold: true, fill }),
        H.cell(row[1], { width: widths[1], fill }),
        H.cell(row[2], { width: widths[2], fill }),
      ],
    });
  });
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, rows: [header, ...trs] });
}

function buildPlanTable(agenda) {
  const widths = [1400, 7300];
  const header = H.headerRow(['Tiempo', 'Actividad'], widths);
  const trs = agenda.map(([t, act], i) => {
    const fill = H.zebraFill(i);
    return new TableRow({
      children: [H.cell(t, { width: widths[0], bold: true, fill }), H.cell(act, { width: widths[1], fill })],
    });
  });
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, rows: [header, ...trs] });
}

function p(text, opts = {}) {
  return new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 120 } });
}

function buildDocument(data) {
  const children = [
    H.titleBanner({
      kicker: 'Harvey AI × Gentera',
      title: `Reporte Semanal Champion · ${data.sdNombre}`,
      subtitle: `Corte: ${data.corte}  ·  ${data.fecha}  ·  Champion: ${data.champion}`,
    }),
    p(' ', { size: 4 }),

    H.sectionHeading('Resumen del corte'),
    H.calloutBox(data.resumen || '', { color: H.COLORS.navy }),
  ];

  if (data.casosMontessori) {
    children.push(
      p(' ', { size: 8 }),
      H.calloutBox(data.casosMontessori, { italics: true, color: H.COLORS.teal, fill: 'E9F2EF' }),
    );
  }

  children.push(
    H.sectionHeading('Reporte de uso'),
    buildUsageTable(data.rows),
    p('A = Assistant | W = Workflow | V = Vault | Wo = Word Add-in | O = Outlook | ★ Champion: uso contaminado por rol HAI.', { size: 18, color: H.COLORS.greyLight }),

    H.sectionHeading('Diagnóstico y seguimiento'),
    p('Ordenado por urgencia. Racha: cortes consecutivos en verde/amarillo con más de 5 interacciones, dentro del ciclo de 5 semanas. N/A = ciclo cubierto por una excepción documentada de toda la SD.', { italics: true, color: H.COLORS.grey, size: 19 }),
    buildDiagnosticoTable([...data.rows].sort((a, b) => {
      const order = { Alta: 0, Media: 1, Baja: 2, 'Sin acción': 3 };
      return (order[a.urgencia] ?? 9) - (order[b.urgencia] ?? 9);
    })),
  );

  if (data.planSesion) {
    children.push(
      H.sectionHeading('Plan de sesión'),
      p(`Objetivo: ${data.planSesion.objetivo}  Duración: ${data.planSesion.duracion}`, { bold: true, color: H.COLORS.navy }),
      buildPlanTable(data.planSesion.agenda),
    );
  }

  if (data.preguntas && data.preguntas.length) {
    children.push(
      H.sectionHeading('Preguntas diagnósticas'),
      ...data.preguntas.map(q => new Paragraph({ children: [new TextRun({ text: `• ${q}` })], spacing: { after: 80 } })),
    );
  }

  children.push(
    H.sectionHeading('Tabla de códigos'),
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
