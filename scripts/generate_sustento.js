// Sustento de valor 2027 por Subdireccion, para que el Champion lo revise y enriquezca (Tony, 9 nov 2026).
// Uso: node scripts/generate_sustento.js out/SV_<SD>_<v>.json <salida.docx> "<fecha limite>" "<fecha datos>"
const fs = require('fs');
const path = require('path');
const docxPath = require.resolve('docx', { paths: [__dirname, '/opt/npm-tools/node_modules'] });
const { Document, Packer, TableRow, Paragraph, TextRun, AlignmentType, Footer, PageNumber, LevelFormat } = require(docxPath);
const H = require(path.join(__dirname, 'helpers'));
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const OUT = process.argv[3]; const LIMITE = process.argv[4]; const FECHA = process.argv[5];
const S = 16;
const t = (s, o = {}) => H.para(H.run(s, { size: 18, ...o }), { after: o.after ?? 80 });
const b = (s) => H.run(s, { size: 18, bold: true });
const num = (parts) => new Paragraph({ numbering: { reference: 'num', level: 0 }, spacing: { after: 50 },
  children: (Array.isArray(parts) ? parts : [parts]).map((x) => (typeof x === 'string' ? H.run(x, { size: 18 }) : x)) });
function tabla(W, cols, filas, centrar = new Set(), opts = {}) {
  return H.table(W, [H.headerRow(cols, W, centrar), ...filas.map((f, i) => new TableRow({
    cantSplit: true,
    children: f.map((v, j) => H.cell(String(v), { width: W[j], size: opts.size || S, bold: j === 0,
      fill: (opts.blank && j === f.length - 1) ? 'FFF9E6' : (i % 2 === 1 ? H.C.filaAlterna : undefined),
      align: centrar.has(j) ? AlignmentType.CENTER : undefined })),
  }))]);
}
const sp = () => H.para('', { after: 40 });
const mil = (n) => Number(n).toLocaleString('en-US');
const dm = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
const enMeta = d.kpis.filter((k) => /Cumple|Supera|En meta/.test(k.estado)).length;
const oct = d.mes.oct, sep = d.mes.sep;
const signo = d.mes.delta_pct > 0 ? '+' : '';

const children = [
  H.para(H.run('Harvey AI × Gentera', { size: 28, bold: true, color: H.C.navy }), { after: 40 }),
  H.para(H.run(`Sustento de valor 2027: ${d.nombre}`, { size: 24, bold: true }), { after: 40 }),
  H.para(H.run(`Para ${d.champion}, Champion ${d.sd}  |  Datos al ${FECHA}  |  Revisar y completar antes del ${LIMITE}`, { size: 18, color: H.C.gris }), { after: 120 }),
  t('Estamos sustentando el valor de Harvey para 2027. Estos son los datos que ya tenemos de tu Subdirección. Revísalos, corrige lo que no cuadre y completa lo que está en amarillo: lo que más pesa es el resultado concreto y, cuando exista, el valor en pesos.', { after: 120 }),

  H.h2('De un vistazo', 100),
  tabla([3000, 7080], ['Tema', 'Dato'], [
    ['Uso en octubre', `${oct.acc_ppw} acciones por persona por semana (${signo}${d.mes.delta_pct}% vs septiembre, ${sep.acc_ppw}); ${oct.activas_pct}% de las personas activas cada semana`],
    ['Personas que lo usaron', `${d.activas_mes} de ${d.personas_total} entre el ${dm(d.ventana[0])} y el ${dm(d.ventana[1])}`],
    ['Workflows', `${d.workflows_distintos} workflows distintos, ${mil(d.ejecuciones_wf)} ejecuciones en el mismo periodo`],
    ['Vault', `${d.vaults.proyectos} proyectos con ${mil(d.vaults.consultas)} consultas acumuladas; ${d.vaults.compartidos} compartidos con el equipo`],
    ['KPIs de Wave', `${enMeta} de ${d.kpis.length} en meta o por encima`],
    ['Casos Estrella', d.casos.length ? d.casos.map((c) => c.caso).join('; ') : 'Ninguno documentado todavía'],
  ]),
  sp(),

  H.h2('KPIs de tu Subdirección en Wave', 100),
  tabla([2500, 1700, 2000, 1900, 1980], ['KPI', 'Punto de partida', 'Real', 'Meta', 'Estado'], d.kpis.map((k) => [k.kpi, k.base, k.real, k.meta, k.estado])),
  sp(),

  H.h2('Workflows que usa tu equipo', 100),
  d.workflows.length
    ? tabla([6280, 1900, 1900], ['Workflow', 'Ejecuciones', 'Personas'], d.workflows.map((w) => [w.nombre, w.veces, w.personas]), new Set([1, 2]))
    : t('Sin ejecuciones de workflow en el periodo.'),
  sp(),
  ...(d.vaults_top.length ? [
    H.h2('Vaults más consultados', 100),
    tabla([6280, 1900, 1900], ['Vault', 'Consultas', 'Compartido con'], d.vaults_top.map((v) => [v.nombre, v.consultas, v.compartido ? `${v.compartido} ${v.compartido === 1 ? 'persona' : 'personas'}` : 'Nadie']), new Set([1, 2])),
    sp()] : []),

  H.h2('Casos Estrella', 100),
  tabla([3400, 6680], ['Caso', 'Dato'], [...d.casos.map((c) => [c.caso, c.dato]), ['Otro caso de tu equipo (completa)', 'Tarea, tiempo antes, tiempo con Harvey, cuántas veces al mes']], new Set(), { blank: true }),
  sp(),

  new Paragraph({ pageBreakBefore: true, children: [] }),
  H.h2('Tu equipo', 100),
  t('Lo que más ayuda a sostener cada licencia es un resultado concreto, sobre todo en quienes usan poco Harvey: qué entregó, cuánto tiempo ahorró o qué evitó.', { after: 60 }),
  tabla([2300, 1100, 1100, 1200, 2080, 2300], ['Persona', 'Nivel', 'Acciones por semana', 'Usa sobre todo', 'Su workflow', 'Resultado concreto con Harvey (completa)'],
    d.personas.map((p) => [p.nombre, p.nivel, p.prom_semana, p.principal, p.workflow || 'Sin workflow', '']), new Set([2]), { blank: true, size: 15 }),
  H.nota('Acciones por semana: promedio de las últimas 8 semanas con datos, sin contar semanas de vacaciones o incapacidad.', { after: 100 }),

  H.h2('Lo que necesitamos de ti', 100),
  num([b('Valor en pesos: '), 'despachos externos que ya no se contratan, horas ahorradas o costos evitados, con su fuente.']),
  num([b('Resultado concreto por persona: '), 'la columna en amarillo, empezando por quienes tienen menos acciones por semana.']),
  num([b('Un caso nuevo con antes y después: '), 'tarea, tiempo antes, tiempo con Harvey y frecuencia al mes.']),
  num([b('Correcciones: '), 'cualquier dato que no corresponda con lo que ves en tu equipo.']),
  H.para(H.run('Elaboró: José Antonio Bueno Díaz  |  Gerente Contratos TI & AI', { size: 16, color: H.C.gris }), { before: 140 }),
];

const doc = new Document({
  styles: { default: { document: { run: { font: H.FONT } } } },
  numbering: { config: [{ reference: 'num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 900, right: 1080, bottom: 800, left: 1080 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Página ', font: H.FONT, size: 14, color: H.C.gris }), new TextRun({ children: [PageNumber.CURRENT], font: H.FONT, size: 14, color: H.C.gris })] })] }) },
    children,
  }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('OK', OUT); });
