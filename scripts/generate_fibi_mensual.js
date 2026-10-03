/**
 * generate_fibi_mensual.js: Fibi mensual (docx, 1 pagina). Sustituye al Fibi semanal del ultimo
 * viernes del mes (Tony, 2 oct 2026). No calcula: todo viene de scripts/fibi_mensual.py.
 *
 * Uso: node scripts/generate_fibi_mensual.js out/FM_2026-10-30.json narrativa/2026-10-30/DJ.json out/FibiDJ_Mensual_oct2026.docx [--fecha "..."]
 *
 * Secciones: metricas del mes, tendencia semanal de la DJ, tabla por SD, Lo que destaca (max 3),
 * Decisiones (max 3, opcional). Narrativa en DJ.json -> fibi_mensual {destacados, decisiones};
 * maximo 2 personas nombradas (regla Fibi).
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, TableRow, TableCell, Paragraph, TextRun, AlignmentType, WidthType, ShadingType,
  VerticalAlign, ImageRun, Footer, PageNumber, LevelFormat,
} = require('docx');
const H = require('./helpers');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (d = new Date()) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const signo = (v) => (v === null || v === undefined ? '-' : `${v > 0 ? '+' : ''}${v}%`);
const S = 17;
const f1 = (v) => (v === null || v === undefined ? '-' : Number(v).toFixed(1));

function cajaMetricas(d) {
  const W = [2520, 2520, 2520, 2520];
  const m = d.dj.mes;
  const p = d.dj.anterior || {};
  const L = d.licencias;
  const num = (v, w) => new TableCell({
    width: { size: w, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: H.C.navy, color: 'auto' },
    verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 40, left: 80, right: 80 },
    children: [H.para(H.run(v, { bold: true, size: 34, color: H.C.blanco }), { align: AlignmentType.CENTER })],
  });
  const lab = (v, w) => new TableCell({
    width: { size: w, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: 'D6E4F0', color: 'auto' },
    verticalAlign: VerticalAlign.CENTER, margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [H.para(H.run(v, { size: 15 }), { align: AlignmentType.CENTER })],
  });
  const ant = d.mes_anterior;
  return H.table(W, [
    new TableRow({ children: [num(f1(m.acc_ppw), W[0]), num(`${m.activas_pct}%`, W[1]), num(String(Math.round(m.wf_semana)), W[2]), num(String(L.candidatos), W[3])] }),
    new TableRow({
      children: [
        lab(`Acciones por persona por semana (${ant}: ${f1(p.acc_ppw)}, ${signo(d.dj.delta_pct)})`, W[0]),
        lab(`Personas activas por semana (${ant}: ${p.activas_pct ?? '-'}%)`, W[1]),
        lab(`Ejecuciones de Workflow por semana (${ant}: ${p.wf_semana !== undefined ? Math.round(p.wf_semana) : '-'})`, W[2]),
        lab(`Candidatos a liberar licencia en ${d.mes}`, W[3]),
      ],
    }),
  ]);
}

function grafica(d) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 0 },
    children: [new ImageRun({ type: 'png', data: fs.readFileSync(d.grafica), transformation: { width: 620, height: 146 } })],
  });
}

function tablaSD(d) {
  const W = [2900, 2000, 1100, 1300, 1400, 1380];
  const cols = ['SD', `Acciones por persona por semana (${d.mes_anterior.slice(0, 3)} → ${d.mes.slice(0, 3)})`, 'Cambio', 'Activas por semana', 'Workflow por semana', 'Candidatos licencia'];
  const trs = d.sds.map((s, i) => {
    const fill = i % 2 === 1 ? H.C.filaAlterna : undefined;
    const c = (v, w, o = {}) => H.cell(String(v), { width: w, fill, align: AlignmentType.CENTER, size: S, ...o });
    const m = s.mes || {};
    const p = s.anterior || {};
    const marca = s.comparable ? '' : ' *';
    const cambio = s.delta_pct === null ? '-' : signo(s.delta_pct);
    return new TableRow({
      cantSplit: true,
      children: [
        H.cell(`${s.sd} (${s.nombre})${marca}`, { width: W[0], fill, bold: true, size: S }),
        c(`${f1(p.acc_ppw)} → ${f1(m.acc_ppw)}`, W[1]),
        c(cambio, W[2], s.delta_pct === null ? {} : { bold: true, color: s.delta_pct >= 0 ? H.ESTADO.verde.color : H.ESTADO.rojo.color }),
        c(m.activas_pct !== undefined ? `${m.activas_pct}%` : '-', W[3]),
        c(f1(m.wf_semana), W[4]),
        c(s.candidatos_licencia, W[5], s.candidatos_licencia ? { bold: true } : {}),
      ],
    });
  });
  return H.table(W, [H.headerRow(cols, W, new Set([1, 2, 3, 4, 5])), ...trs]);
}

function buildDocument(d, narr, fecha) {
  const n = narr.fibi_mensual || {};
  const nota = (t, after = 140) => H.para(H.run(t, { size: 15, italics: true, color: H.C.gris }), { after });
  const bullet = (t) => new Paragraph({ numbering: { reference: 'vinetas', level: 0 }, spacing: { after: 60 }, children: [H.run(t, { size: 18 })] });
  const rango = `${d.cortes_mes[0].replace(/ \d{4}$/, '')} a ${d.cortes_mes[d.cortes_mes.length - 1]}`;
  const sinComp = d.sds.filter((s) => !s.comparable);
  const children = [
    H.para(H.run('Harvey AI × Gentera', { size: 28, bold: true, color: H.C.navy }), { after: 60 }),
    H.para(H.run(`Dirección Jurídica: ${cap(d.mes)} ${d.anio} en Harvey AI`, { size: 24, bold: true }), { after: 60 }),
    H.para(H.run(`Reporte mensual para Dirección  |  ${d.cortes_mes.length} cortes: ${rango}  |  ${fecha}`, { size: 18, color: H.C.gris }), { after: 160 }),
    cajaMetricas(d),
    nota(`${d.personas} personas de las 6 SD. Promedios por persona en sus semanas útiles: las ausencias documentadas no cuentan como baja. Comparación contra ${d.mes_anterior} (${d.cortes_mes_anterior.length} cortes).`, 100),
    H.h2('Tendencia de la DJ'),
    grafica(d),
    nota(`Acciones por persona por semana, últimas ${d.serie.length} semanas (viernes de cada corte). En azul, ${d.mes}.`, 100),
    H.h2(`${cap(d.mes)} por SD`),
    tablaSD(d),
  ];
  if (sinComp.length) {
    children.push(nota(sinComp.map((s) => `* ${s.sd}: sin comparativo; menos de 2 semanas útiles en uno de los dos meses.`).join(' '), 60));
  }
  children.push(nota('Candidatos a licencia: 2 o más apariciones en el top 10 de menor uso de la DJ en el mes. La lista se revisa en la sesión de KPIs.', 100));
  if ((n.destacados || []).length) {
    children.push(H.h2('Lo que destaca del mes'), ...n.destacados.slice(0, 3).map((c, i) => H.para(H.run(`${i + 1}. ${c}`, { size: 18 }), { after: 80 })));
  }
  if ((n.decisiones || []).length) {
    children.push(H.h2('Decisiones para Dirección'), ...n.decisiones.slice(0, 3).map(bullet));
  }
  children.push(
    H.para(H.run('Elaboró: José Antonio Bueno Díaz  |  Gerente Contratos TI & AI', { size: 16, color: H.C.gris }), { before: 200, after: 0 }),
    H.para(H.run('Notion HIL: notion.so/37df66a17162812a9f53e15cb031792d', { size: 16, color: H.C.gris })),
  );
  return new Document({
    styles: { default: { document: { run: { font: H.FONT } } } },
    numbering: { config: [{ reference: 'vinetas', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }] },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1000, right: 1080, bottom: 900, left: 1080, header: 600, footer: 600 } } },
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
    console.error('Uso: node scripts/generate_fibi_mensual.js <FM.json> <narrativa.json> <salida.docx> [--fecha "..."]');
    process.exit(1);
  }
  const d = JSON.parse(fs.readFileSync(inp, 'utf8'));
  const narr = JSON.parse(fs.readFileSync(narrPath, 'utf8'));
  const n = narr.fibi_mensual || {};
  if ((n.destacados || []).length > 3 || (n.decisiones || []).length > 3) {
    console.error('Fibi mensual: máximo 3 destacados y 3 decisiones.');
    process.exit(1);
  }
  Packer.toBuffer(buildDocument(d, narr, fi > -1 ? args[fi + 1] : fechaLarga())).then((buf) => {
    fs.mkdirSync(path.dirname(outp), { recursive: true });
    fs.writeFileSync(outp, buf);
    console.log('OK:', outp);
  });
}

module.exports = { buildDocument };
