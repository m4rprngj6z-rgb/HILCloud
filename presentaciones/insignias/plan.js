// Plan de trabajo: Coleccion Harvey DJ (insignias). Documento de trabajo para Tony.
const fs = require('fs');
const docxPath = require.resolve('docx', { paths: ['/home/claude/hilcloud/scripts', '/opt/npm-tools/node_modules'] });
const { Document, Packer, TableRow, Paragraph, TextRun, AlignmentType, Footer, PageNumber, LevelFormat } = require(docxPath);
const H = require('/home/claude/hilcloud/scripts/helpers');

const S = 16;
const t = (s, o = {}) => H.para(H.run(s, { size: 18, ...o }), { after: o.after ?? 80 });
const b = (s) => H.run(s, { size: 18, bold: true });
const bullet = (parts) => new Paragraph({ numbering: { reference: 'kp', level: 0 }, spacing: { after: 40 },
  children: (Array.isArray(parts) ? parts : [parts]).map((p) => (typeof p === 'string' ? H.run(p, { size: 18 }) : p)) });
function tabla(W, cols, filas) {
  return H.table(W, [H.headerRow(cols, W), ...filas.map((f, i) => new TableRow({
    cantSplit: true,
    children: f.map((v, j) => H.cell(String(v), { width: W[j], size: S, bold: j === 0, fill: i % 2 === 1 ? H.C.filaAlterna : undefined })),
  }))]);
}
const sp = () => H.para('', { after: 60 });

const children = [
  H.para(H.run('Harvey AI × Gentera', { size: 28, bold: true, color: H.C.navy }), { after: 40 }),
  H.para(H.run('Colección Harvey DJ: plan de trabajo para el deployment de insignias', { size: 24, bold: true }), { after: 40 }),
  H.para(H.run('Documento de trabajo  |  Versión para marinar  |  21 de octubre de 2026', { size: 18, color: H.C.gris }), { after: 160 }),

  H.h2('De un vistazo', 120),
  tabla([2600, 7480], ['Tema', 'Propuesta'], [
    ['Qué es', 'Insignias por hitos de calidad en el uso de Harvey, reveladas en vivo y entregadas como imagen personal. Temporada de noviembre a diciembre de 2026, con cierre en el Harvey Wrapped.'],
    ['Qué no es', 'No es un ránking, no compara Subdirecciones, no premia volumen de acciones, no vive en los reportes semanales ni en un tablero permanente.'],
    ['Por qué', 'El semáforo mide ritmo; las insignias celebran saltos de calidad: construir, compartir, dominar. Es el reconocimiento que acordamos en junio, ahora con objeto y momento.'],
    ['Lanzamiento propuesto', 'Viernes 27 de noviembre (corte de cierre de mes), con primera revelación en vivo en la junta mensual de la DJ de diciembre.'],
    ['Decisiones abiertas', '8, en la sección final. La primera: elegir una de las 3 direcciones visuales.'],
  ]),
  sp(),

  H.h2('Catálogo inicial de insignias', 120),
  tabla([2200, 4100, 1700, 2080], ['Insignia', 'Cómo se gana', 'Rareza', 'Detección'], [
    ['Primera instancia', 'Primer workflow propio en uso', 'Común', 'Automática (export de uso)'],
    ['Sienta precedente', 'Otra persona usa un workflow tuyo', 'Rara', 'Automática; requiere regla de autoría'],
    ['Jurisprudencia', '5 personas usan tu workflow (guiño al art. 222 de la Ley de Amparo, jurisprudencia por reiteración)', 'Legendaria', 'Automática; requiere regla de autoría'],
    ['Pleno', 'Usaste las 5 herramientas (A, Wo, V, W, O) en un mismo mes calendario', 'Rara', 'Automática (export de uso)'],
    ['Caso Estrella', 'Tu caso entra al catálogo de Casos Estrella del HIL', 'Legendaria', 'Manual: la otorga Tony'],
    ['Secreta', 'Se revela cuando alguien la desbloquea', 'Por definir', 'Por definir'],
    ['Primero de la DJ', 'Versión dorada de cualquier insignia para quien la desbloquea antes que nadie', 'Edición única', 'Automática (registro de desbloqueos)'],
  ]),
  sp(),

  H.h2('Plan de trabajo', 120),
  tabla([1900, 2000, 3900, 2280], ['Fase', 'Fechas', 'Qué se hace', 'Entregable'], [
    ['1. Marinar y decidir', '21 oct al 6 nov', 'Elegir dirección visual, cerrar catálogo y reglas, definir la secreta, validar con Karla.', 'Catálogo final de 1 página y dirección visual aprobada'],
    ['2. Construir el motor', '9 al 20 nov', 'Script que detecta desbloqueos cada corte y los registra; se prueba con los exports reales de los cortes del 6 y 13 nov antes de dar una sola insignia.', 'scripts/insignias.py, registro de desbloqueos y pruebas en el repo'],
    ['3. Producción gráfica', '9 al 20 nov (en paralelo)', 'Diseño final de las insignias y generador de la imagen personal por desbloqueo.', 'Set de insignias en PNG y plantilla de tarjeta personal'],
    ['4. Lanzamiento', 'Vie 27 nov', 'Mensaje de lanzamiento y primeras tarjetas por Teams. La lista de desbloqueos sale en tu Corte de Caja, no en los reportes.', 'Mensaje de Teams y tarjetas de los primeros desbloqueos'],
    ['5. Revelación en vivo', 'Junta mensual de diciembre', 'Lámina con los desbloqueos del mes y la revelación de la secreta, sin ránking.', '1 o 2 láminas en la presentación de la junta'],
    ['6. Cierre de temporada', 'Vie 11 dic', 'La colección de cada persona aparece en su Harvey Wrapped.', 'Sección de insignias en el Wrapped'],
  ]),
  sp(),

  H.h2('Insumos', 120),
  tabla([2700, 2400, 1500, 3480], ['Insumo', 'Fuente', 'Quién', 'Estado'], [
    ['Export de uso semanal', 'Harvey (harvey-usage)', 'Tony', 'Ya existe; llega cada viernes'],
    ['Historial semanal por persona', 'Repo (estado/)', 'Claude', 'Ya existe desde el 25 sep'],
    ['Autoría de cada workflow', 'Export de workflows y agentes', 'Tony', 'Por validar: el export solo trae workflows creados en su ventana de 30 días (lección del 16 oct). Alternativa: quien lo corre primero, marcada como inferencia'],
    ['Catálogo de Casos Estrella', 'HIL (Notion)', 'Tony', 'Ya existe'],
    ['Visto bueno de Karla', 'Conversación con ella', 'Tony', 'Pendiente; antes del 6 nov'],
    ['Fecha de la junta de diciembre', 'Agenda de la DJ', 'Tony', 'Pendiente'],
    ['Canal y lista de envío', 'Teams', 'Tony', 'Pendiente: chat grupal o mensaje personal'],
  ]),
  sp(),

  H.h2('Riesgos y cómo se cubren', 120),
  tabla([3300, 6780], ['Riesgo', 'Cómo se cubre'], [
    ['Que la gente infle acciones', 'Ninguna insignia premia volumen; solo construir, compartir o dominar.'],
    ['Una insignia mal otorgada', 'El motor se prueba con exports reales antes del lanzamiento y cada lista pasa por ti antes de enviarse.'],
    ['Que Dirección lo lea como "demasiado juego"', 'Validación previa con Karla; la dirección "Sello y lacre" es la opción sobria.'],
    ['Que alguien se sienta fuera', 'Nadie pierde nada: las ausencias y excepciones no afectan, y no hay lista de quién no tiene.'],
    ['Carga operativa para Tony', 'Detección y tarjetas automáticas; tu parte es revisar la lista y otorgar Caso Estrella.'],
  ]),
  sp(),

  H.h2('Decisiones para Tony', 120),
  tabla([600, 5200, 4280], ['#', 'Decisión', 'Propuesta'], [
    ['1', 'Dirección visual: Sello y lacre, Pin esmaltado o Carta coleccionable', 'Carta coleccionable con el material del sello en la versión dorada (inferencia: une thrill y sobriedad)'],
    ['2', '¿Cuentan los hitos desde el 10 jun o solo desde el lanzamiento?', 'Desde el 10 jun: el lanzamiento arranca con desbloqueos reales'],
    ['3', 'Quién participa', 'Las 65 personas de las 6 SD; sin cortesías y sin Tony'],
    ['4', '¿Los Champions compiten?', 'Sí, con las mismas reglas'],
    ['5', 'La insignia secreta', 'Por definir contigo'],
    ['6', 'Nombre de la colección', '"Colección Harvey DJ" como nombre de trabajo'],
    ['7', 'Variante de Pleno para no depender solo de Workflow', 'Por definir contigo'],
    ['8', '¿Aparecen en algún reporte?', 'No (Tony, 21 oct): viven en la revelación, las tarjetas y el Wrapped'],
  ]),
  H.para(H.run('Elaboró: José Antonio Bueno Díaz  |  Gerente Contratos TI & AI', { size: 16, color: H.C.gris }), { before: 160 }),
];

const doc = new Document({
  styles: { default: { document: { run: { font: H.FONT } } } },
  numbering: { config: [{ reference: 'kp', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1000, right: 1080, bottom: 900, left: 1080 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Página ', font: H.FONT, size: 14, color: H.C.gris }), new TextRun({ children: [PageNumber.CURRENT], font: H.FONT, size: 14, color: H.C.gris })] })] }) },
    children,
  }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(process.argv[2], buf); console.log('OK'); });
