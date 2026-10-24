// Recap para Jorge Belloc (Champion CN) de su tiempo fuera, 9 al 23 oct 2026. Pedido por Tony, 23 oct 2026.
// Datos: estado/<viernes>/CN_<viernes>.json de los cortes 2, 9, 16 y 23 oct; hechos de docs/HANDOFF_2026-10-20.md.
// Uso: node presentaciones/recap_belloc.js <salida.docx>
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..');
const docxPath = require.resolve('docx', { paths: [path.join(REPO, 'scripts'), '/opt/npm-tools/node_modules'] });
const { Document, Packer, TableRow, Paragraph, TextRun, AlignmentType, Footer, PageNumber, LevelFormat } = require(docxPath);
const H = require(path.join(REPO, 'scripts', 'helpers'));

const cn = (v) => JSON.parse(fs.readFileSync(path.join(REPO, 'estado', v, `CN_${v}.json`), 'utf8'));
const cortes = ['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23'].map((v) => ({ v, d: cn(v) }));
const cuenta = (d, s) => d.rows.filter((r) => r.semaforo === s).length;
const fila = ({ d }, etiqueta) => [etiqueta, d.corte, d.totales.acciones, `${d.totales.personas_activas} de ${d.totales.personas}`,
  cuenta(d, 'verde'), cuenta(d, 'amarillo') + cuenta(d, 'rojo'), d.totales.atencion_alta, d.totales.workflows];
const ult = cortes[3].d;
const p = (nombre) => ult.rows.find((r) => r.nombre === nombre);
const pct = (r) => `${Math.round(r.ratio * 100)}%`;

const S = 16;
const t = (s, o = {}) => H.para(H.run(s, { size: 18, ...o }), { after: o.after ?? 80 });
const b = (s) => H.run(s, { size: 18, bold: true });
const bullet = (parts) => new Paragraph({ numbering: { reference: 'kp', level: 0 }, spacing: { after: 40 },
  children: (Array.isArray(parts) ? parts : [parts]).map((x) => (typeof x === 'string' ? H.run(x, { size: 18 }) : x)) });
function tabla(W, cols, filas, centrar = new Set()) {
  return H.table(W, [H.headerRow(cols, W, centrar), ...filas.map((f, i) => new TableRow({
    cantSplit: true,
    children: f.map((v, j) => H.cell(String(v), { width: W[j], size: S, bold: j === 0, fill: i % 2 === 1 ? H.C.filaAlterna : undefined, align: centrar.has(j) ? AlignmentType.CENTER : undefined })),
  }))]);
}
const sp = () => H.para('', { after: 40 });

const aaron = p('Aaron Raya'), leslie = p('Leslie Espinoza');
const children = [
  H.para(H.run('Harvey AI × Gentera', { size: 28, bold: true, color: H.C.navy }), { after: 40 }),
  H.para(H.run('Lo que pasó en CN mientras estuviste fuera', { size: 24, bold: true }), { after: 40 }),
  H.para(H.run('Para Jorge Belloc, Champion CN  |  Del 9 al 23 de octubre de 2026  |  23 de octubre de 2026', { size: 18, color: H.C.gris }), { after: 140 }),

  H.h2('De un vistazo', 100),
  tabla([2500, 7580], ['Tema', 'Qué pasó'], [
    ['CN siguió creciendo', `De ${cortes[0].d.totales.acciones} acciones la semana antes de tu salida a ${ult.totales.acciones} esta semana. En verde frente a su propio ritmo: de ${cuenta(cortes[0].d, 'verde')} a ${cuenta(ult, 'verde')} personas; en atención alta: de ${cortes[0].d.totales.atencion_alta} a ${ult.totales.atencion_alta}.`],
    ['Workflows', '5 workflows nuevos de CN en uso desde la sesión del 15 oct. Los de las carpetas de los arts. 326 y 328 se aprobaron y publicaron (los aprobó Tony en tu ausencia).'],
    ['Caso Estrella', 'Carpetas 326 y 328: 77% menos tiempo de revisión según los tiempos de Leslie (hasta 81% contando las dos revisiones por carpeta).'],
    ['KPIs 3 y 4', 'Octubre se cargó a Wave sin cambios por tu ausencia; los dos ya estaban en meta.'],
    ['Tu semana', 'Coordinas la sesión de Vault el jueves 29 de octubre, 13:00, con Javier García.'],
  ]),
  sp(),

  H.h2('CN semana a semana', 100),
  tabla([1700, 1900, 1000, 1100, 900, 1300, 1080, 1100],
    ['Corte', 'Semana', 'Acciones', 'Activas', 'Verde', 'Amarillo o rojo', 'Atención alta', 'Workflow'],
    [fila(cortes[0], 'Antes de salir'), fila(cortes[1], 'Saliste el 9'), fila(cortes[2], 'Fuera'), fila(cortes[3], 'Fuera')],
    new Set([2, 3, 4, 5, 6, 7])),
  H.nota('Semáforo frente al propio promedio de 5 semanas de cada persona. Tu propia cuenta queda en excepción por vacaciones. Javier García fue tu suplente y recibió los reportes Champion.', { after: 100 }),

  H.h2('Personas a destacar', 100),
  bullet([b('Aaron Raya: '), `${aaron.total} acciones esta semana (${pct(aaron)} de su ritmo), con su workflow de Notas Informativas Regulatorias; la semana anterior había bajado.`]),
  bullet([b('Leslie Espinoza: '), `${leslie.total} acciones (${pct(leslie)}); estrenó workflows de Matrices de Cumplimiento y del art. 318 (cartas de subcontratados) y llevó el Caso Estrella. Sale de vacaciones del 26 oct al 3 nov.`]),
  bullet([b('Alonso Ixta, Armando de la Rosa y Ana Karen Salinas: '), 'estrenaron workflows propios en la sesión del 15 oct (contratos de adhesión, pólizas de seguro y materiales publicitarios).']),
  sp(),

  H.h2('Lo que cambió en la DJ', 100),
  tabla([2500, 7580], ['Tema', 'Cambio'], [
    ['Aprobación de workflows', 'Desde la sesión del 15 oct, al publicar un workflow pasa al Champion para revisión. Aprobar lo publica, pero el equipo solo lo puede usar si se le da acceso de ejecución (Access, Manage run access).'],
    ['Capacitaciones', 'Workflow práctico (15 oct, coordinó Tony) y Word (22 oct, coordinó Karime Sotelo). Ya no hay rotación de coordinadores: se elige por dominio de la herramienta, disponibilidad y carga. Por eso Vault es tuya.'],
    ['Outlook', 'Infografía paso a paso enviada a los asistentes. Problema conocido: al abrir Harvey hay que elegir "Continuar sin acceso completo a la bandeja de entrada".'],
    ['Encuesta de Workflow', 'Enviada esta semana a los asistentes de la sesión del 15 oct; cerró el 23 oct.'],
  ]),
  sp(),

  H.h2('Licencias de CN', 100),
  t('César Berelleza estuvo propuesto como baja de licencia por bajo uso (15 oct) y la Dirección lo aprobó (20 oct). El 22 oct, Tony y Fibi decidieron que la conserve y se liberó otra licencia. Sigue entre los candidatos de octubre por menor uso; esta semana subió a 11 acciones. La lista se revisa con el cierre de mes del 30 oct, y conviene que lo platiques con él.'),

  H.h2('KPIs 3 y 4', 100),
  tabla([2600, 2500, 2600, 2380], ['KPI', 'Cargado en Wave (oct)', 'Metas', 'Estado'], [
    ['KPI 3: oficios', '7.79 días (mismo real de septiembre)', '6 meses: 15 días  |  1 año: 10 días', 'En meta'],
    ['KPI 4: productos', '28 días (mismo real de septiembre)', '6 meses: 50 días  |  1 año: 45 días', 'En meta'],
  ]),
  H.nota('Octubre se cargó sin cambios por tu ausencia (decisión de Tony, 16 oct). Para la carga de reales de noviembre hace falta tu medición.', { after: 100 }),

  H.h2('Tus pendientes', 100),
  tabla([2300, 7780], ['Cuándo', 'Qué'], [
    ['Lunes 26 oct', 'Revisar y aprobar los workflows de CN que Leslie envió a aprobación, y dar acceso de ejecución al equipo de Elisa Álvarez mientras Leslie está de vacaciones.'],
    ['Miércoles 28 oct', 'Confirmar a Tony qué vault vas a mostrar en la sesión.'],
    ['Jueves 29 oct, 13:00', 'Coordinar la sesión de Vault con Javier García (borrador de 5 láminas en tu correo).'],
    ['Viernes 30 oct', 'Retomar tu respuesta a "Antes del próximo corte" en el reporte Champion.'],
    ['Noviembre', 'Enviar la medición de los KPIs 3 y 4 antes de la carga de reales.'],
  ]),
  H.para(H.run('Elaboró: José Antonio Bueno Díaz  |  Gerente Contratos TI & AI', { size: 16, color: H.C.gris }), { before: 140 }),
];

const doc = new Document({
  styles: { default: { document: { run: { font: H.FONT } } } },
  numbering: { config: [{ reference: 'kp', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 900, right: 1080, bottom: 800, left: 1080 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Página ', font: H.FONT, size: 14, color: H.C.gris }), new TextRun({ children: [PageNumber.CURRENT], font: H.FONT, size: 14, color: H.C.gris })] })] }) },
    children,
  }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(process.argv[2], buf); console.log('OK'); });
