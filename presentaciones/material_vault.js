// Material para la sesion de Vault (jue 29 oct 2026, 13:00). Pedido por Tony con Jorge Belloc, 27 oct 2026.
// Datos: vaults_export_2026-10-23.xlsx (proyectos, consultas, compartido con) y estado/2026-10-23/<SD>.json (uso de Vault, 5 semanas).
// Uso: node presentaciones/material_vault.js <salida.docx>
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..');
const docxPath = require.resolve('docx', { paths: [path.join(REPO, 'scripts'), '/opt/npm-tools/node_modules'] });
const { Document, Packer, TableRow, Paragraph, TextRun, AlignmentType, Footer, PageNumber, LevelFormat } = require(docxPath);
const H = require(path.join(REPO, 'scripts', 'helpers'));

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

const children = [
  H.para(H.run('Harvey AI × Gentera', { size: 28, bold: true, color: H.C.navy }), { after: 40 }),
  H.para(H.run('Sesión de Vault: casos, expertos y salas', { size: 24, bold: true }), { after: 40 }),
  H.para(H.run('Jueves 29 de octubre de 2026, 13:00  |  Coordina: Jorge Belloc  |  Para Gerentes y Subdirectores  |  27 de octubre de 2026', { size: 18, color: H.C.gris }), { after: 140 }),

  H.h2('De un vistazo', 100),
  tabla([2600, 7480], ['Tema', 'Propuesta'], [
    ['Objetivo', 'Que cada persona salga con un vault propio con documentos reales y compartido con alguien de su equipo.'],
    ['Formato', '60 minutos: 15 de casos en plenaria, 35 de práctica en 4 salas con un experto cada una y 10 de cierre.'],
    ['Audiencia', '25 Gerentes y Subdirectores de las 6 Subdirecciones. 12 de ellos no han usado Vault en las últimas 5 semanas.'],
    ['Tarea previa', 'Cada persona trae de 5 a 10 documentos de una tarea que repite: contratos, oficios, resoluciones, minutas.'],
    ['No asisten', 'Leslie Espinoza, Cristian Fernández y Karla Zetina (vacaciones) y Ana Karen Martínez (incapacidad).'],
  ]),
  sp(),

  H.h2('Casos de uso de la DJ para la plenaria', 100),
  tabla([2500, 2200, 1100, 1300, 2980], ['Vault', 'Dueño', 'Consultas', 'Compartido', 'Qué enseña'], [
    ['SD Gobierno Corporativo', 'Gabriel Juárez (GC)', '149', '6 personas', 'La base de toda una Subdirección: 594 documentos que consulta el equipo entero.'],
    ['Legislación', 'Aaron Raya (CN)', '53', '5 personas', 'Repositorio normativo de 366 documentos, compartido con la Subdirectora y el equipo.'],
    ['Resoluciones Investigaciones', 'Jean Cub Nájera (RL)', '95', '2 personas', 'Criterio del área en un solo lugar: las resoluciones se consultan en lugar de buscarse.'],
    ['Base de Oficios', 'Janis Pérez (CN)', '56', '1 persona', 'Oficios anteriores como precedente para responder los nuevos.'],
    ['OFICIOS SITI AA', 'Cristian Fernández (JC)', '280', 'No', 'El vault más consultado de la DJ. Está de vacaciones: Jorge lo cuenta como referencia.'],
  ], new Set([2, 3])),
  H.nota('Fuente: export de vaults de Harvey al 23 oct 2026. Las consultas se atribuyen al dueño del vault, no a quien pregunta.', { after: 100 }),

  H.h2('Expertos y salas', 100),
  t('Cada sala mezcla personas que ya usan Vault con personas que empiezan, alrededor de un caso parecido a su trabajo. Javier García ya está confirmado. Gabriel Juárez, Jean Cub Nájera y Raquel Reyes Cubillo son propuesta: hay que invitarlos.'),
  tabla([1500, 2400, 2500, 3680], ['Sala', 'Experto', 'Caso guía', 'Participantes'], [
    ['1. Normativa', 'Javier García (CN), confirmado', 'Legislación y VIO 2026', 'Fehebell Arcos, Lucía Arrazola, Alonso Ixta, Armando de la Rosa, Alejandro Maqueda, Heriberto Falcón, Gabriela Mejía'],
    ['2. Base del equipo', 'Gabriel Juárez (GC), por invitar', 'SD Gobierno Corporativo', 'Luis Ricardo Robert, Juan Miguel Gálvez, Gabriela Cadena, Ana Lilia Ramírez, Carlos Reyes, Elisa Álvarez'],
    ['3. Resoluciones y litigio', 'Jean Cub Nájera (RL), por invitar', 'Resoluciones Investigaciones', 'Marcia Mora, Amed Hernández, Adriana Rodríguez, Oscar Monteverde, Christian Ramírez'],
    ['4. Contratos', 'Raquel Reyes Cubillo (ENN), por invitar', 'Sus vaults de contratos (24 proyectos)', 'Karla Méndez, Diana Fuentes, Rodolfo Osuna, Alfredo Duarte'],
  ]),
  H.nota('Criterio de expertos: más uso de Vault con vaults compartidos, sin ausencias el 29 oct. Raquel Reyes Cubillo: 34% de su uso es Vault, el más alto de los Gerentes. Jorge Belloc recorre las salas.', { after: 100 }),

  new Paragraph({ pageBreakBefore: true, children: [] }),
  H.h2('Ejercicio en sala (35 minutos)', 100),
  tabla([1300, 2400, 6380], ['Minutos', 'Paso', 'Qué hace cada persona'], [
    ['5', 'El experto muestra su vault', 'Qué subió, cómo lo organizó, con quién lo comparte y una pregunta real en vivo.'],
    ['10', 'Crear y cargar', 'Crea un vault con nombre claro (tema y año) y sube sus 5 a 10 documentos.'],
    ['15', 'Preguntar', 'Hace las 3 preguntas de su sala y revisa que cada respuesta cite el documento.'],
    ['5', 'Compartir', 'Comparte el vault con una persona de su equipo y anota qué tarea le resuelve.'],
  ], new Set([0])),
  sp(),
  t('Preguntas por sala (se ajustan a los documentos de cada quien):', { after: 60 }),
  bullet([b('Normativa: '), '¿Qué obligaciones con plazo establece esta disposición? ¿Qué cambió entre esta versión y la anterior? ¿Qué artículo fundamenta este requerimiento?']),
  bullet([b('Base del equipo: '), '¿Quién tiene facultades para firmar este acto? ¿En qué sesión se aprobó este acuerdo? Haz una tabla de documentos con fecha y órgano que lo emitió.']),
  bullet([b('Resoluciones y litigio: '), '¿Qué resolvimos en casos parecidos a este? ¿Qué argumentos se repiten en estas resoluciones? ¿Qué pruebas se ofrecieron en cada expediente?']),
  bullet([b('Contratos: '), 'Haz una tabla con partes, vigencia, monto y penalizaciones de estos contratos. ¿Cuáles vencen en los próximos 90 días? ¿Cuáles no tienen cláusula de terminación anticipada?']),
  sp(),

  H.h2('Antes del jueves', 100),
  tabla([2600, 2600, 4880], ['Qué', 'Quién', 'Cuándo'], [
    ['Invitar a Gabriel Juárez, Jean Cub Nájera y Raquel Reyes Cubillo como expertos', 'Jorge Belloc', 'Hoy, martes 27'],
    ['Pedir la tarea previa (5 a 10 documentos de una tarea que repiten)', 'Jorge Belloc, en la invitación', 'Miércoles 28'],
    ['Crear las 4 salas en Teams con sus participantes', 'Jorge Belloc', 'Miércoles 28'],
    ['Probar en vivo el caso de cada sala', 'Cada experto', 'Miércoles 28'],
    ['Encuesta de la sesión', 'Tony', 'Viernes 30'],
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
