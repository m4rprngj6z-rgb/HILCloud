/**
 * generate_champion.js: arma el Reporte Semanal Champion (docx) de UNA SD a partir del JSON
 * que produce scripts/etl.py. No calcula nada: todo numero, color, urgencia, motivo y
 * fortaleza ya viene resuelto por el ETL. Este archivo solo acomoda.
 *
 * Uso: node scripts/generate_champion.js out/ENN_2026-09-25.json out/ENN_Champion_25sep2026.docx [--fecha "28 de septiembre de 2026"]
 *
 * Estructura = reporte aprobado ENN_Champion_26sep2026.docx, mas lo acordado el 26 sep:
 * columna O (Outlook), Racha, Diversidad de Workflows y la tabla de codigos autocontenida.
 */
const fs = require('fs');
const path = require('path');
const { Document, Packer, TableRow, AlignmentType, Footer, PageNumber, TextRun, Paragraph } = require('docx');
const H = require('./helpers');

const ORDEN_URG = { Alta: 0, Media: 1, Baja: 2, 'Sin acción': 3 };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLarga(d = new Date()) {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function corteConGuion(corte) {
  // "21-25 sep 2026" -> "21–25 sep 2026" (guion corto tipografico, como el aprobado; nunca raya larga)
  return corte.replace(/^(\d+)-(\d+)/, '$1–$2');
}

function ordenar(rows) {
  return [...rows].sort((a, b) => (ORDEN_URG[a.urgencia] - ORDEN_URG[b.urgencia])
    || ((a.ratio ?? 99) - (b.ratio ?? 99))
    || a.nombre.localeCompare(b.nombre, 'es'));
}

function usoTable(rows) {
  const W = [1100, 1000, 820, 340, 340, 340, 340, 340, 820, 590, 560, 700, 1430, 1360];
  const S = 16;   // 8 pt en el cuerpo de esta tabla (14 columnas)
  const cols = ['Persona', 'Nivel', 'Urgencia', 'A', 'Wo', 'V', 'W', 'O', 'Sem.', 'Racha', 'Div. Wf', 'Firma', 'Motivo del semáforo', 'Fortaleza actual'];
  const centered = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const trs = rows.map((r, i) => {
    const fill = i % 2 === 1 ? H.C.filaAlterna : undefined;
    const num = (v, w) => H.cell(String(v), { width: w, fill, align: AlignmentType.CENTER, tight: true, size: S });
    return new TableRow({
      cantSplit: true,
      children: [
        H.cell(r.champion ? `★ ${r.nombre}` : r.nombre, { width: W[0], fill, bold: r.champion, size: S }),
        H.cell(r.nivel, { width: W[1], fill, size: S, tight: true }),
        H.estadoCell(r.urgencia, W[2], H.URGENCIA, 15),
        num(r.a, W[3]), num(r.wo, W[4]), num(r.v, W[5]), num(r.w, W[6]), num(r.o, W[7]),
        H.estadoCell(r.semaforo, W[8]),
        num(r.naCiclo ? 'N/A' : `${r.racha}/5`, W[9]),
        num(r.diversidadWf == null ? '-' : r.diversidadWf.toFixed(1), W[10]),
        H.cell(r.firma, { width: W[11], fill, size: S, tight: true }),
        H.cell(H.richRuns(r.motivo, { italics: true, size: S }), { width: W[12], fill }),
        H.cell(H.richRuns(r.fortaleza, { italics: true, size: S }), { width: W[13], fill }),
      ],
    });
  });
  return H.table(W, [H.headerRow(cols, W, centered), ...trs]);
}

function codigosTable() {
  const W = [1400, 8220];
  const filas = [
    [{ code: 'A', color: H.TOOL_COLOR.A }, 'Assistant: consulta, análisis, redacción libre, criterio.'],
    [{ code: 'Wo', color: H.TOOL_COLOR.Wo }, 'Word Add-in: redacción y revisión dentro de documentos (incluye Playbooks en Word).'],
    [{ code: 'V', color: H.TOOL_COLOR.V }, 'Vault: trabajo sobre repositorios documentales.'],
    [{ code: 'W', color: H.TOOL_COLOR.W }, 'Workflow: procesos repetibles y estandarizables.'],
    [{ code: 'O', color: H.TOOL_COLOR.O }, 'Outlook: uso de Harvey dentro del correo. Se cuenta aparte de A desde el corte del 26 sep 2026.'],
    [{ estado: 'verde' }, 'La persona igualó o superó su propio promedio de las últimas 5 semanas.'],
    [{ estado: 'amarillo' }, 'Entre 40% y 99% de su propio promedio.'],
    [{ estado: 'rojo' }, 'Menos de 40% de su propio promedio.'],
    [{ estado: 'excepcion' }, 'Ausencia documentada (vacaciones, incapacidad, evento de toda la SD). No cuenta en el promedio.'],
    [{ estado: 'sin_historial' }, 'Alta reciente: menos de 5 semanas de historial, el promedio todavía no es confiable.'],
    [{ code: 'Racha', color: H.C.navy }, 'Cortes consecutivos (de los últimos 5) en verde o amarillo con más de 5 interacciones. Las excepciones se saltan sin romperla.'],
    [{ code: 'Div. Wf', color: H.C.navy }, 'Promedio semanal de workflows distintos en las últimas 5 semanas: mide exploración, no volumen.'],
    [{ code: 'Firma', color: H.C.navy }, 'Herramientas usadas esta semana, de mayor a menor uso.'],
  ];
  const trs = filas.map(([k, txt], i) => {
    const fill = i % 2 === 1 ? H.C.filaAlterna : undefined;
    const first = k.estado
      ? H.estadoCell(k.estado, W[0])
      : H.cell([H.run(k.code, { bold: true, color: k.color })], { width: W[0], fill, align: AlignmentType.CENTER });
    return new TableRow({ cantSplit: true, children: [first, H.cell(txt, { width: W[1], fill })] });
  });
  return H.table(W, [H.headerRow(['Código', 'Qué significa'], W, new Set([0])), ...trs]);
}

function buildDocument(d, fecha) {
  const rows = ordenar(d.rows);
  const cuenta = (u) => rows.filter((r) => r.urgencia === u).length;
  const prioridad = ['Alta', 'Media', 'Baja', 'Sin acción']
    .filter((u) => cuenta(u)).map((u) => `${cuenta(u)} ${u}`).join(', ');
  const t = d.totales;
  const delta = t.acciones_anterior ? Math.round(((t.acciones - t.acciones_anterior) / t.acciones_anterior) * 100) : null;
  const deltaTxt = delta === null ? '' : ` (vs ${t.acciones_anterior} la semana anterior; ${delta >= 0 ? '+' : ''}${delta}%)`;

  const children = [
    ...H.docHeader(d.sdNombre, 'Reporte Semanal Champion', corteConGuion(d.corte), fecha, d.champion),
    H.h2('Resumen del corte'),
    H.para(H.run(`${t.acciones} acciones totales esta semana${deltaTxt}. ${t.personas_activas} de ${t.personas} personas con actividad. Prioridad de atención: ${prioridad}.`,
      { size: 18 }), { after: 100 }),
  ];

  const exc = rows.filter((r) => r.semaforo === 'excepcion');
  if (exc.length) {
    children.push(H.para(H.run(`Con excepción documentada esta semana: ${exc.map((r) => r.nombre).join(', ')}. No se califican ni cuentan en su promedio.`,
      { size: 18 }), { after: 100 }));
  }
  const post = rows.filter((r) => r.post_excepcion);
  if (post.length) {
    children.push(H.para(H.run(`Primera semana completa de regreso: ${post.map((r) => r.nombre).join(', ')}. Su cifra todavía no se lee como ritmo sostenido.`,
      { size: 18 }), { after: 100 }));
  }
  children.push(
    H.nota('Cada persona se compara contra su propio promedio de las últimas 5 semanas (sin contar semanas de vacaciones o incapacidad). El semáforo es consecuencia, no sentencia: la forma más directa de cambiarlo es resolver lo que dice su Motivo.',
      { size: 18 }),

    H.h2('Reporte de uso, ordenado por prioridad de atención'),
    H.nota('No es un ranking de desempeño. El orden es de triage: primero quién necesita tu atención esta semana, no quién produjo más.', { size: 15, after: 100 }),
    usoTable(rows),
    H.nota('A = Assistant  |  Wo = Word Add-in  |  V = Vault  |  W = Workflow  |  O = Outlook  |  ★ Champion: uso contaminado por rol HAI. Significado completo al final.', { after: 160 }),

    H.h2('Antes del próximo corte'),
    H.cajaVerde('Antes del próximo corte',
      'Responde con una línea por persona que hayas trabajado esta semana: ¿de qué hablaron, y qué le ofreciste? Lo que me mandes se cruza con su siguiente corte para ver si el gap se cerró.',
      '[Persona]  |  [Conversación]  |  [Seguimiento propuesto]'),

    H.h2('Tabla de códigos'),
    H.nota('Incluida para que no dependas de tener acceso a Notion para leer tu propio reporte.', { after: 100 }),
    codigosTable(),
    H.firma(),
  );

  return new Document({
    styles: { default: { document: { run: { font: H.FONT } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080, header: 708, footer: 708 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: 'Página ', font: H.FONT, size: 14, color: H.C.gris }),
              new TextRun({ children: [PageNumber.CURRENT], font: H.FONT, size: 14, color: H.C.gris }),
            ],
          })],
        }),
      },
      children,
    }],
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const [inp, outp] = args;
  const fi = args.indexOf('--fecha');
  if (!inp || !outp) {
    console.error('Uso: node scripts/generate_champion.js <etl.json> <salida.docx> [--fecha "28 de septiembre de 2026"]');
    process.exit(1);
  }
  const d = JSON.parse(fs.readFileSync(inp, 'utf8'));
  const fecha = fi > -1 ? args[fi + 1] : fechaLarga();
  Packer.toBuffer(buildDocument(d, fecha)).then((buf) => {
    fs.mkdirSync(path.dirname(outp), { recursive: true });
    fs.writeFileSync(outp, buf);
    console.log('OK:', outp);
  });
}

module.exports = { buildDocument };
