/**
 * generate_subdirectores.js: comparativo de uso entre las cabezas de las 6 SD (docx).
 * Pedido de Karla Mendez, 29 sep 2026. No calcula: todo viene de scripts/subdirectores.py.
 *
 * Uso: node scripts/generate_subdirectores.js out/SUB_2026-09-25.json out/Comparativo_Subdirectores_25sep2026.docx [--fecha "..."]
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, TableRow, TableCell, Paragraph, TextRun, AlignmentType, WidthType, ImageRun,
  VerticalAlign, Footer, PageNumber, ShadingType, LevelFormat,
} = require('docx');
const H = require('./helpers');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (d = new Date()) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
const n = (v) => (v === null || v === undefined ? '-' : String(v));
const S = 16;

function vistazo(d) {
  const W = [520, 2900, 1350, 1300, 1150, 1300, 1560];
  const cols = ['#', 'Persona', 'Promedio semanal', 'Últimas 4 semanas', 'Esta semana', 'Semanas con uso', 'Firma'];
  const trs = d.personas.map((p, i) => {
    const fill = i % 2 === 1 ? H.C.filaAlterna : undefined;
    const c = (v, w, o = {}) => H.cell(v, { width: w, fill, align: AlignmentType.CENTER, size: S, tight: true, ...o });
    return new TableRow({
      cantSplit: true,
      children: [
        c(String(p.lugar), W[0], { bold: true }),
        H.cell([H.run(p.nombre, { bold: true, size: S }), H.run(`  ${p.sd}`, { size: 14, color: H.C.gris })], { width: W[1], fill }),
        c(n(p.promedio), W[2], { bold: true, color: H.C.navy }),
        c(`${n(p.promedio_4)}${p.promedio_4_en_excepcion ? ' *' : ''}`, W[3]),
        c(String(p.esta_semana), W[4]),
        c(`${p.semanas_con_uso} de ${p.semanas_utiles}`, W[5]),
        c(p.firma, W[6], { size: 15 }),
      ],
    });
  });
  return H.table(W, [H.headerRow(cols, W, new Set([0, 2, 3, 4, 5, 6])), ...trs]);
}

function tendencia(d) {
  const W = [2300, 900, 3500, 3380];
  const trs = d.personas.map((p, i) => {
    const fill = i % 2 === 1 ? H.C.filaAlterna : undefined;
    const img = new TableCell({
      width: { size: W[2], type: WidthType.DXA },
      shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 20, bottom: 20, left: 60, right: 60 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: 'png', data: fs.readFileSync(p.grafica), transformation: { width: 164, height: 46 } })],
      })],
    });
    const mezcla = ['A', 'Wo', 'V', 'W', 'O'].filter((t) => p.mezcla[t]).sort((a, b) => p.mezcla[b] - p.mezcla[a]);
    const runs = mezcla.length ? mezcla.flatMap((t, j) => [
      ...(j ? [H.run('   ', { size: S })] : []),
      H.run(t, { bold: true, size: S, color: H.TOOL_COLOR[t] }),
      H.run(` ${p.mezcla_pct[t]}%`, { size: S }),
    ]) : [H.run('Sin actividad', { size: S, italics: true, color: H.C.gris })];
    return new TableRow({
      cantSplit: true,
      children: [
        H.cell(p.nombre, { width: W[0], fill, bold: true, size: S }),
        H.cell(String(p.total_periodo), { width: W[1], fill, align: AlignmentType.CENTER, size: S }),
        img,
        H.cell(runs, { width: W[3], fill }),
      ],
    });
  });
  const primera = d.semanas[0].replace(/^(\d+)-\d+ /, '$1 ').replace(/ \d{4}$/, '');
  return H.table(W, [H.headerRow(['Persona', 'Acciones', `Tendencia semanal (${primera} a ${d.semanas[d.semanas.length - 1].replace(/^\d+-/, '')})`, 'Mezcla de herramientas'], W, new Set([1, 2])), ...trs]);
}

function buildDocument(d, fecha) {
  const nSem = d.semanas.length;
  const bullet = (t) => new Paragraph({ numbering: { reference: 'vi', level: 0 }, spacing: { after: 60 }, children: [H.run(t, { size: 18 })] });
  const children = [
    H.para(H.run('Harvey AI × Gentera', { size: 28, bold: true, color: H.C.navy }), { after: 40 }),
    H.para(H.run('Comparativo de Subdirectores', { size: 24, bold: true }), { after: 40 }),
    H.para(H.run(`Uso personal de Harvey de quienes encabezan las 6 SD  |  ${nSem} semanas al corte ${d.corte}  |  ${fecha}`, { size: 18, color: H.C.gris }), { after: 180 }),

    H.h2('De un vistazo'),
    vistazo(d),
    H.nota(`Orden por promedio semanal de acciones (cada pregunta y cada seguimiento cuenta 1) en las semanas útiles de las últimas ${nSem}. Firma: herramientas del periodo, de mayor a menor uso.`, { after: 60 }),
    ...d.notas_excepcion.map((t) => H.nota(`* ${t}`, { after: 60 })),

    H.h2('Lectura', 180),
    ...d.lectura.map(bullet),

    H.h2(`Tendencia de ${nSem} semanas`, 180),
    tendencia(d),
    H.nota('Cada gráfica tiene su propia escala (la columna Acciones da la magnitud). Punto hueco gris = semana en excepción documentada, fuera del promedio. A = Assistant  |  Wo = Word Add-in  |  V = Vault  |  W = Workflow  |  O = Outlook.', { after: 60 }),

    H.para(H.run('Elaboró: José Antonio Bueno Díaz  |  Gerente Contratos TI & AI, Dirección Jurídica', { size: 16, color: H.C.gris }), { before: 220 }),
  ];
  return new Document({
    styles: { default: { document: { run: { font: H.FONT } } } },
    numbering: { config: [{ reference: 'vi', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
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
  const [inp, outp] = args;
  const fi = args.indexOf('--fecha');
  if (!inp || !outp) {
    console.error('Uso: node scripts/generate_subdirectores.js <SUB.json> <salida.docx> [--fecha "..."]');
    process.exit(1);
  }
  const d = JSON.parse(fs.readFileSync(inp, 'utf8'));
  Packer.toBuffer(buildDocument(d, fi > -1 ? args[fi + 1] : fechaLarga())).then((buf) => {
    fs.mkdirSync(path.dirname(outp), { recursive: true });
    fs.writeFileSync(outp, buf);
    console.log('OK:', outp);
  });
}

module.exports = { buildDocument };
