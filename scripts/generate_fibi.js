/**
 * generate_fibi.js: Reporte Fibi DJ (docx), para la Directora Juridica.
 *
 * Uso: node scripts/generate_fibi.js out/DJ_2026-09-25.json narrativa/2026-09-25/DJ.json out/FibiDJ_25sep2026.docx [--fecha "..."]
 *
 * Estructura = FibiDJ_25sep2026.docx aprobado (igual en los 5 Fibi del 28 ago al 25 sep):
 * metricas DJ, Semaforo por SD, Casos de impacto (max 3), Puntos de atencion.
 * Cambios: sin raya larga en titulo y nombres de SD (preferencia de Tony); columna de excepcion
 * cuando alguna SD la tiene; nota de transicion (PLD 21-25 sep). Nivel area: el texto se valida
 * con maximo 2 personas nombradas (regla 11 jul 2026).
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, TableRow, TableCell, Paragraph, TextRun, AlignmentType, WidthType, ShadingType,
  VerticalAlign, TableLayoutType, Table, Footer, PageNumber, LevelFormat,
} = require('docx');
const H = require('./helpers');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (d = new Date()) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
const corteConGuion = (c) => c.replace(/^(\d+)-(\d+)/, '$1–$2');
const fmtPct = (v) => `${Number.isInteger(v) ? v : v.toFixed(1)}%`;

function cajaMetricas(d) {
  const W = [3260, 3260, 3544];
  const t = d.totales;
  const num = (v, w) => new TableCell({
    width: { size: w, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: H.C.navy, color: 'auto' },
    verticalAlign: VerticalAlign.CENTER, margins: { top: 120, bottom: 60, left: 90, right: 90 },
    children: [H.para(H.run(v, { bold: true, size: 36, color: H.C.blanco }), { align: AlignmentType.CENTER })],
  });
  const lab = (v, w) => new TableCell({
    width: { size: w, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: 'D6E4F0', color: 'auto' },
    verticalAlign: VerticalAlign.CENTER, margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [H.para(H.run(v, { size: 15 }), { align: AlignmentType.CENTER })],
  });
  return H.table(W, [
    new TableRow({ children: [num(String(t.acciones), W[0]), num(`${t.personas_activas} / ${t.personas}`, W[1]), num(String(t.atencion_alta), W[2])] }),
    new TableRow({ children: [lab(`Acciones DJ (vs ${t.acciones_anterior})`, W[0]), lab(`Personas activas (${d.wau_pct}%)`, W[1]), lab(`Personas en atención alta (de ${t.evaluadas} calificadas)`, W[2])] }),
  ]);
}

function semaforoSD(d) {
  const conExc = d.sds.some((s) => s.semaforo.excepcion || s.semaforo.sin_historial);
  const W = conExc ? [2500, 900, 1000, 800, 2100, 1000, 1100] : [2900, 1300, 1300, 1300, 1300, 1400];
  const cols = ['SD', 'Verde', 'Amarillo', 'Rojo', ...(conExc ? ['Sin calificar'] : []), 'WAU %', 'Tendencia'];
  const trs = d.sds.map((s, i) => {
    const fill = i % 2 === 1 ? H.C.filaAlterna : undefined;
    const c = (v, w, o = {}) => H.cell(String(v), { width: w, fill, align: AlignmentType.CENTER, ...o });
    const k = s.semaforo;
    const tend = s.delta_pct === null ? '-' : `${s.delta_pct >= 0 ? '+' : ''}${s.delta_pct}%`;
    const cells = [
      H.cell(`${s.sd} (${s.nombre})${(s.transicion || s.base_previa_info) ? ' *' : ''}`, { width: W[0], fill, bold: true }),
      c(k.verde, W[1]), c(k.amarillo, W[2]),
      c(k.rojo, W[3], k.rojo ? { bold: true, color: H.ESTADO.rojo.color } : {}),
    ];
    let j = 4;
    if (conExc) {
      const partes = [k.excepcion ? `${k.excepcion} en excepción` : '', k.sin_historial ? `${k.sin_historial} ${k.sin_historial > 1 ? 'altas recientes' : 'alta reciente'}` : ''].filter(Boolean).join(', ');
      cells.push(c(partes || '-', W[j])); j += 1;
    }
    cells.push(c(fmtPct(s.wau_pct), W[j]));
    cells.push(c(tend, W[j + 1], { bold: true, color: (s.delta_pct ?? 0) >= 0 ? H.ESTADO.verde.color : H.ESTADO.rojo.color }));
    return new TableRow({ cantSplit: true, children: cells });
  });
  return H.table(W, [H.headerRow(cols, W, new Set(cols.map((_, i) => i).filter((i) => i > 0))), ...trs]);
}

function buildDocument(d, narr, fecha) {
  const n = narr.fibi;
  const nota = (t, after = 160) => H.para(H.run(t, { size: 15, italics: true, color: H.C.gris }), { after });
  const trans = d.sds.filter((s) => s.transicion);
  const children = [
    H.para(H.run('Harvey AI × Gentera', { size: 28, bold: true, color: H.C.navy }), { after: 60 }),
    H.para(H.run('Dirección Jurídica: Snapshot Harvey AI', { size: 24, bold: true }), { after: 60 }),
    H.para(H.run(`Reporte Ejecutivo para Dirección  |  Corte: ${corteConGuion(d.corte)}  |  ${fecha}`, { size: 18, color: H.C.gris }), { after: 180 }),
    cajaMetricas(d),
    nota(`Corte actual: ${d.corte}. Tendencia contra el corte anterior (lunes a viernes).`),
    H.h2('Semáforo por SD'),
    semaforoSD(d),
    nota('Vista de una sola mirada para dirigir a cada Subdirección: dónde escalar primero. Cada persona se compara contra su propio promedio de 5 semanas. Sin calificar: personas en ausencia documentada (vacaciones, incapacidad) o con alta reciente (menos de 5 semanas de historial propio); no cuentan en verde, amarillo ni rojo.', 60),
  ];
  const previa = d.sds.filter((s) => s.base_previa_info);
  if (previa.length) {
    children.push(nota(previa.map((s) => `* ${s.sd}: ${H.fraseBasePrevia(s.base_previa_info)}`).join(' ')));
  }
  if (trans.length) {
    children.push(nota(trans.map((s) => `* ${s.sd}: semana de cierre de una excepción de toda la SD; los colores son de referencia y no se escala. ${H.fraseTransicion(s.transicion_info)}`).join(' ')));
  }
  children.push(
    H.h2('Casos de impacto del corte'),
    ...n.casos.slice(0, 3).map((c, i) => H.para(H.run(`${i + 1}. ${c}`, { size: 18 }), { after: 100 })),
    H.h2('Puntos de atención'),
    ...n.puntos.map((p) => new Paragraph({
      numbering: { reference: 'vinetas', level: 0 },
      spacing: { after: 60 },
      children: [H.run(p, { size: 18 })],
    })),
    H.para(H.run('Elaboró: José Antonio Bueno Díaz  |  Gerente Contratos TI & AI', { size: 16, color: H.C.gris }), { before: 220, after: 0 }),
    H.para(H.run('Notion HIL: notion.so/37df66a17162812a9f53e15cb031792d', { size: 16, color: H.C.gris })),
  );
  return new Document({
    styles: { default: { document: { run: { font: H.FONT } } } },
    numbering: {
      config: [{
        reference: 'vinetas',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }],
      }],
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080, header: 708, footer: 708 } } },
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
  const [inp, narrPath, outp] = args;
  const fi = args.indexOf('--fecha');
  if (!inp || !narrPath || !outp) {
    console.error('Uso: node scripts/generate_fibi.js <DJ.json> <narrativa.json> <salida.docx> [--fecha "..."]');
    process.exit(1);
  }
  const d = JSON.parse(fs.readFileSync(inp, 'utf8'));
  const narr = JSON.parse(fs.readFileSync(narrPath, 'utf8'));
  if (!narr.fibi || !Array.isArray(narr.fibi.casos) || !Array.isArray(narr.fibi.puntos)) {
    console.error('La narrativa no trae fibi.casos y fibi.puntos.');
    process.exit(1);
  }
  if (narr.fibi.casos.length > 3) {
    console.error('Casos de impacto: máximo 3 (Estándar).');
    process.exit(1);
  }
  Packer.toBuffer(buildDocument(d, narr, fi > -1 ? args[fi + 1] : fechaLarga())).then((buf) => {
    fs.mkdirSync(path.dirname(outp), { recursive: true });
    fs.writeFileSync(outp, buf);
    console.log('OK:', outp);
  });
}

module.exports = { buildDocument };
