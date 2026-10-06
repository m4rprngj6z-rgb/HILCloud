/**
 * casos_estrella.js: reporte externo de Casos Estrella de la DJ (para Ilham, Harvey; 6 oct 2026).
 * Narrativa: Catalogo de Casos Estrella del HIL (Notion), adaptada para lectura externa (sin
 * hallazgos internos ni notas de trabajo). Cifras: out/casos_estrella.json (casos_estrella.py).
 *
 * Uso: node presentaciones/casos_estrella.js out/casos_estrella.json out/Casos_Estrella_DJ_06oct2026.docx
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, TableRow, Paragraph, TextRun, AlignmentType, Footer, PageNumber, LevelFormat,
} = require('docx');
const H = require('../scripts/helpers');

const S = 17;
const n = (v) => Number(v).toLocaleString('es-MX');
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fc = (iso) => { const [y, m, dd] = iso.split('-').map(Number); return `${dd} ${MES[m - 1]} ${y}`; };
const t = (s, o = {}) => H.para(H.run(s, { size: 18, ...o }), { after: o.after ?? 80 });
const b = (s) => H.run(s, { size: 18, bold: true });
const lab = (k, v) => H.para([b(`${k}: `), H.run(v, { size: 18 })], { after: 70 });
const bullet = (s) => new Paragraph({ numbering: { reference: 'ce', level: 0 }, spacing: { after: 50 }, children: [H.run(s, { size: 18 })] });

function tabla(W, cols, filas, centrar = new Set()) {
  const trs = filas.map((f, i) => new TableRow({
    cantSplit: true,
    children: f.map((v, j) => H.cell(String(v), {
      width: W[j], fill: i % 2 === 1 ? H.C.filaAlterna : undefined, size: S, bold: j === 0,
      align: centrar.has(j) ? AlignmentType.CENTER : undefined,
    })),
  }));
  return H.table(W, [H.headerRow(cols, W, centrar), ...trs]);
}

function ficha(datos) {
  return tabla([2400, 7680], ['Campo', 'Detalle'], datos);
}

function caso(codigo, titulo, campos, situacion, accion, resultado, porque, salto = false) {
  return [
    salto ? new Paragraph({ pageBreakBefore: true, keepNext: true, spacing: { after: 100 }, children: [H.run(`${codigo}  |  ${titulo}`, { size: 22, bold: true, color: H.C.navy })] }) : H.h2(`${codigo}  |  ${titulo}`, 220),
    ficha(campos),
    H.para('', { after: 60 }),
    lab('Situación', situacion),
    lab('Qué se hizo con Harvey', accion),
    ...(resultado ? [resultado, H.para('', { after: 60 })] : []),
    H.para(b('Por qué importa'), { after: 40 }),
    ...porque.map(bullet),
  ];
}

function buildDocument(d, fecha) {
  const v = d.validador;
  const mesesN = { '2026-06': 'Junio (desde el 10)', '2026-07': 'Julio', '2026-08': 'Agosto', '2026-09': 'Septiembre' };
  const children = [
    H.para(H.run('Harvey AI × Gentera', { size: 28, bold: true, color: H.C.navy }), { after: 40 }),
    H.para(H.run('Casos Estrella de la Dirección Jurídica', { size: 24, bold: true }), { after: 40 }),
    H.para(H.run(`Preparado para el equipo de Harvey  |  Cifras al ${fc(d.datos_al)}  |  ${fecha}`, { size: 18, color: H.C.gris }), { after: 160 }),
    t('Casos de uso real de Harvey en la Dirección Jurídica de Gentera, documentados con evidencia: quién, con qué herramienta, sobre qué trabajo y con qué resultado. Complementan los indicadores de adopción con lo que el número por sí solo no muestra.', { after: 140 }),

    H.h2('De un vistazo', 120),
    tabla([900, 2200, 1600, 3880, 1500], ['Caso', 'Área', 'Herramienta', 'Evidencia clave', 'Tipo'], [
      ['GC-01', 'Gobierno Corporativo', 'Assistant y Vault', '600 reactivos regulatorios en 3 cuestionarios ante autoridad, con comparativos e informes ejecutivos', 'Caso estrella'],
      ['JC-01', 'Jurídico Contencioso', 'Vault', `${n(d.jc.total)} consultas en ${d.jc.proyectos.length} proyectos; el proyecto más consultado de la DJ (${n(d.jc.proyectos[0].consultas)})`, 'Caso estrella'],
      ['RL-01', 'Relaciones Laborales', 'Vault compartido', `${n(d.rl.total)} consultas en ${d.rl.proyectos.length} bases de conocimiento compartidas con el equipo`, 'Caso estrella'],
      ['EE-01', 'Expansión Nuevos Negocios y Cumplimiento Normativo', 'Workflow', `${n(v.ejecuciones)} ejecuciones de un mismo workflow por ${v.usuarios} personas; el workflow propio más usado de la DJ`, 'Escalabilidad'],
      ['UA-01', 'Expansión Nuevos Negocios', 'Vault, Workflow y Word', `${d.isis.proyectos_vault} proyectos de Vault y ${d.isis.consultas} consultas, encadenados con Workflow y Word`, 'Uso avanzado'],
      ['UA-02', 'Cumplimiento Normativo', 'Workflow', `${d.leslie.workflows_distintos} workflows distintos y ${d.leslie.ejecuciones} ejecuciones desde agosto`, 'Uso avanzado'],
    ], new Set([0])),
    H.nota('Caso estrella: impacto puntual con evidencia. Escalabilidad: un proceso que se replica entre personas y áreas. Uso avanzado: personas cuyo uso sirve de referencia para capacitar al resto.', { after: 60 }),

    ...caso('GC-01', 'Cuestionarios regulatorios para autoridades', [
      ['Responsable', 'Gabriel Juárez, Gerente de Gobierno Corporativo'],
      ['Fecha', 'Mayo de 2026'],
      ['Herramienta', 'Assistant y Vault (análisis documental y generación)'],
      ['Impacto', 'Análisis masivo, entregable regulatorio de cara a autoridad, adopción por el equipo'],
    ],
    'Había que responder 3 cuestionarios para autoridades de 200 preguntas cada uno (600 en total). Cada respuesta requería sustento en diversos documentos, además de comparativos e informes ejecutivos sobre el nivel de cumplimiento.',
    'Harvey analizó el acervo documental, apoyó el llenado de los 600 reactivos y generó los comparativos y los informes ejecutivos de cumplimiento. El abogado conservó la revisión de control de cada respuesta.',
    tabla([2300, 3000, 4780], ['Métrica', 'Alcance', 'Aporte de Harvey'], [
      ['Reactivos', '3 cuestionarios × 200 = 600', 'Análisis documental y prellenado de respuestas'],
      ['Entregables', 'Comparativos e informes ejecutivos', 'Generación de comparativos y resúmenes de cumplimiento'],
      ['Control', 'Revisión del abogado', 'Harvey acelera el análisis; el abogado valida'],
    ]),
    [
      'Escala: 600 reactivos con sustento documental es el tipo de trabajo masivo donde Harvey aporta más.',
      'El entregable va dirigido a una autoridad, con consecuencias de cumplimiento: no es un documento interno.',
      'Ilustra el modelo de uso correcto: Harvey acelera y el abogado valida.',
    ]),

    ...caso('JC-01', 'Repositorio de producción para Oficios SITI AA', [
      ['Responsable', 'Cristian Fernández, Abogado de Jurídico Contencioso'],
      ['Herramienta', 'Vault'],
      ['Impacto', 'Repositorio de consulta intensiva y sostenida: herramienta de producción, no exploración'],
    ],
    'El área atiende oficios de autoridad de forma recurrente. Su valor con Harvey no aparecía en la lectura por Workflow: estaba en Vault.',
    'Construyó un proyecto de Vault para los Oficios SITI AA y lo consulta de forma recurrente; después abrió una segunda instancia del mismo repositorio y un Vault para oficios de pensión alimenticia.',
    tabla([5000, 2000], ['Proyecto de Vault', 'Consultas'], d.jc.proyectos.map((p) => [p.proyecto, n(p.consultas)]).concat([['Total', n(d.jc.total)]]), new Set([1])),
    [
      `${n(d.jc.proyectos[0].consultas)} consultas en un solo proyecto: la cifra más alta de los ${n(d.vault_total_proyectos)} proyectos de Vault de la DJ.`,
      `Sus ${d.jc.proyectos.length} proyectos suman ${n(d.jc.total)} de las ${n(d.vault_total_consultas)} consultas a Vault de toda la DJ.`,
      'El usuario de mayor impacto no siempre es el de mayor jerarquía.',
    ], true),

    ...caso('RL-01', 'Bases de conocimiento compartidas de Resoluciones', [
      ['Responsable', 'Jean Cub Nájera, Líder de Relaciones Laborales y Champion de su área'],
      ['Herramienta', 'Vault (proyectos compartidos)'],
      ['Impacto', 'Orquestación del equipo a través de Vault'],
    ],
    'El valor de Harvey en el área no estaba en Workflow, sino en bases de conocimiento de uso común.',
    `Creó dos proyectos de Vault y los compartió con ${d.rl.proyectos[0].compartido_con.join(' y ')}, de su equipo, en lugar de mantenerlos de uso individual.`,
    tabla([4000, 1400, 3600], ['Proyecto de Vault', 'Consultas', 'Compartido con'], d.rl.proyectos.map((p) => [p.proyecto, n(p.consultas), p.compartido_con.join(', ')]), new Set([1])),
    [
      'El Champion no solo usa Harvey: arma recursos que su equipo consulta.',
      'Muestra que la orquestación del equipo no depende de una sola herramienta.',
    ]),

    ...caso('EE-01', 'Validador de Expedientes Legales', [
      ['Origen', 'Expansión Nuevos Negocios'],
      ['Herramienta', 'Workflow'],
      ['Impacto', 'Escalabilidad: uso sostenido por varias personas y adopción fuera del área que lo creó'],
    ],
    'Validar expedientes legales es una tarea recurrente y estandarizable.',
    'El área lo convirtió en un workflow que hoy usan personas de varias áreas.',
    tabla([3800, 1800, 1800], ['Mes', 'Ejecuciones', 'Personas'], Object.entries(v.meses).filter(([m]) => mesesN[m]).map(([m, x]) => [mesesN[m], n(x.ejecuciones), x.usuarios]), new Set([1, 2])),
    [
      `${n(v.ejecuciones)} ejecuciones y ${v.usuarios} personas: el workflow propio más usado de la DJ.`,
      `Cruzó de área: su usuario con más ejecuciones es ${v.principal_fuera_enn.nombre}, de Cumplimiento Normativo (${n(v.principal_fuera_enn.ejecuciones)}).`,
      'Es el candidato natural a estandarizarse de forma transversal.',
    ], true),

    H.h2('Uso avanzado: referentes para capacitar', 220),
    tabla([900, 2600, 6580], ['Caso', 'Persona', 'Patrón'], [
      ['UA-01', 'Isis Rodríguez, Coordinadora de Contratos (ENN)', `Crea un proyecto de Vault, lo invoca dentro del workflow Validador de Expedientes Legales y vuelve a usarlo desde Word para poblar el Playbook. ${d.isis.proyectos_vault} proyectos de Vault y ${d.isis.consultas} consultas. Es el tipo de flujo que otros usuarios no descubren solos.`],
      ['UA-02', 'Leslie Espinoza, Líder de Cumplimiento Normativo', `${d.leslie.workflows_distintos} workflows distintos y ${d.leslie.ejecuciones} ejecuciones desde el 3 de agosto, la mayor diversidad de la DJ: elige el workflow según la tarea en lugar de depender de uno solo.`],
    ], new Set([0])),

    H.h2('En documentación', 220),
    bullet('GC-02, conciliación de listados de accionistas (Gobierno Corporativo).'),
    bullet('GC-03, actualización de 36 tarjetas de admisión para asambleas (Gobierno Corporativo).'),

    H.h2('Notas de medición', 220),
    bullet('Vault: el export atribuye las consultas al dueño del proyecto, no a quien pregunta. En proyectos compartidos (RL-01) no se puede separar cuánto uso viene de cada persona.'),
    bullet('GC-01 documenta alcance y entregables; todavía no tiene medición de tiempo antes y después.'),
    bullet(`Cifras de Workflow del ${fc(d.datos_desde)} al ${fc(d.datos_al)}; cifras de Vault al ${fc(d.vault_al)}.`),

    H.para(H.run('Elaboró: José Antonio Bueno Díaz  |  Gerente Contratos TI & AI', { size: 16, color: H.C.gris }), { before: 200 }),
  ];
  return new Document({
    styles: { default: { document: { run: { font: H.FONT } } } },
    numbering: { config: [{ reference: 'ce', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
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
  const [inp, outp] = process.argv.slice(2);
  const fecha = process.argv[4] || '6 de octubre de 2026';
  const d = JSON.parse(fs.readFileSync(inp, 'utf8'));
  Packer.toBuffer(buildDocument(d, fecha)).then((buf) => {
    fs.mkdirSync(path.dirname(outp), { recursive: true });
    fs.writeFileSync(outp, buf);
    console.log('OK:', outp);
  });
}
