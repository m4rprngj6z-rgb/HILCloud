// Planeacion de la sesion de Workflow (jue 15 oct 2026) para aprobacion de Karla Mendez.
// Cifras: out/WF_sesion_2026-10-09.json (presentaciones/datos_workflow.py).
// Uso: node presentaciones/planeacion_workflow.js out/WF_sesion_2026-10-09.json out/Planeacion_Sesion_Workflow.docx
const fs = require('fs');
const { Document, Packer, TableRow, Paragraph, AlignmentType, LevelFormat } = require('docx');
const H = require('../scripts/helpers');

const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const S = 17;
const t = (s, o = {}) => H.para(H.run(s, { size: 18, ...o }), { after: o.after ?? 80 });
const b = (s) => H.run(s, { size: 18, bold: true });
const bullet = (parts) => new Paragraph({ numbering: { reference: 'pw', level: 0 }, spacing: { after: 40 },
  children: (Array.isArray(parts) ? parts : [parts]).map((p) => (typeof p === 'string' ? H.run(p, { size: 18 }) : p)) });
function tabla(W, cols, filas, centrar = new Set()) {
  return H.table(W, [H.headerRow(cols, W, centrar), ...filas.map((f, i) => new TableRow({
    cantSplit: true,
    children: f.map((v, j) => H.cell(String(v), { width: W[j], size: S, bold: j === 0, fill: i % 2 === 1 ? H.C.filaAlterna : undefined, align: centrar.has(j) ? AlignmentType.CENTER : undefined })),
  }))]);
}
const cr = D.creados_dj;

const children = [
  H.para(H.run('Harvey AI × Gentera', { size: 28, bold: true, color: H.C.navy }), { after: 40 }),
  H.para(H.run('Planeación: sesión práctica de Workflow', { size: 24, bold: true }), { after: 40 }),
  H.para(H.run('Jueves 15 de octubre de 2026  |  Para aprobación de Karla Méndez  |  13 de octubre de 2026', { size: 18, color: H.C.gris }), { after: 140 }),

  H.h2('De un vistazo', 100),
  tabla([2500, 7580], ['Tema', 'Planeación'], [
    ['Objetivo', 'Que cada participante identifique una tarea repetible, la convierta en workflow y salga con él publicado y compartido con su equipo.'],
    ['Por qué ahora', `La DJ ya construye workflows, pero no los comparte: ${cr.workflows_borrador} de ${cr.workflows} creados en la DJ siguen en borrador y ${D.workflows_una_persona} de ${D.workflows_en_uso} workflows en uso los usa una sola persona (últimos 30 días).`],
    ['Formato', '60 minutos, práctica. Cada quien trae su laptop con Harvey y un documento real de su tarea.'],
    ['Convocatoria', 'Abierta, enviada por la Asistente de la DJ. Incluye 4 preguntas sobre la tarea de cada quien; con las respuestas se arman las mesas.'],
    ['Coordina', 'José Antonio Bueno Díaz, con Karime Sotelo (Champion ENN) de apoyo.'],
    ['Meta medible', `Workflows usados por 2 o más personas: hoy ${D.compartidos.length}. Se mide en el corte del 30 de octubre.`],
  ]),
  H.para('', { after: 40 }),

  H.h2('Agenda', 100),
  tabla([1100, 2700, 6280], ['Min', 'Bloque', 'Qué pasa'], [
    ['5', 'El número duro', 'Dónde está la DJ en Workflow y por qué lo que se construye no llega al equipo.'],
    ['5', 'Qué es automatizable', '4 señales de una tarea que ya es workflow: se repite, empieza igual, misma entrada, salida con forma fija.'],
    ['4', 'Un workflow que viaja', 'Isis Rodríguez (ENN) presenta el Validador de Expedientes Legales: 10 personas de 3 Subdirecciones lo usan.'],
    ['6', 'Los 4 pasos', 'Elegir el mejor hilo, separar lo fijo de lo variable, probar con 3 casos reales, publicar y compartir.'],
    ['5', 'Tu tarea en una hoja', 'Cada quien aterriza su tarea: qué entra, qué es fijo, qué sale y con quién lo comparte.'],
    ['30', 'Mesas', 'Construcción guiada por quienes ya construyen workflows.'],
    ['5', 'Publicar y compromiso', 'Publicación en vivo. Compromiso: un workflow compartido y en uso antes del 30 de octubre.'],
  ], new Set([0])),
  H.para('', { after: 40 }),

  H.h2('Mesas', 100),
  tabla([3400, 1200, 5480], ['Guía de mesa', 'SD', 'Workflows propios en uso (30 días)'], [
    ['Leslie Espinoza', 'CN', `${Object.keys(D.workflows_por_persona['Leslie Espinoza'] || {}).length}, entre ellos respuestas a requerimientos de la CNBV`],
    ['Ana Karen Salinas', 'CN', `${Object.keys(D.workflows_por_persona['Ana Karen Salinas'] || {}).length}, entre ellos seguimiento de Términos y Condiciones de campañas`],
    ['Karla Stephanie Aparicio', 'PLD', 'Extractores de requerimientos y denuncias'],
  ]),
  H.para('', { after: 40 }),

  H.h2('Por confirmar', 100),
  bullet([b('Hora y sala o liga de Teams: '), 'con la Asistente de la DJ.']),
  bullet([b('Guías de mesa e Isis Rodríguez: '), 'confirmación de asistencia y de que llevan un workflow propio para mostrar.']),
  bullet([b('Número de mesas: '), '3 o 4, según las respuestas a la convocatoria.']),
  bullet([b('Invitación directa adicional: '), 'a quienes repiten la misma instrucción en Assistant o tienen workflows que solo ellos usan, sin importar su nivel.']),

  H.para(H.run('Elaboró: José Antonio Bueno Díaz  |  Gerente Contratos TI & AI', { size: 16, color: H.C.gris }), { before: 160 }),
];

const doc = new Document({
  styles: { default: { document: { run: { font: H.FONT } } } },
  numbering: { config: [{ reference: 'pw', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 900, right: 1080, bottom: 800, left: 1080 } } }, children }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(process.argv[3], buf); console.log('OK'); });
