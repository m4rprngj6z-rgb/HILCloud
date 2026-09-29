/**
 * generate_playbook.js: Playbook de Lectura para Champions, v3 (29 sep 2026).
 * Reemplaza al Playbook de junio 2026 (semaforo por umbrales fijos y gaps). Describe el reporte
 * Champion que hoy genera el pipeline; las reglas vienen de docs/REGLAS_ETL.md.
 *
 * Uso: node scripts/generate_playbook.js out/Playbook_Champion_v3.docx
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, TableRow, Paragraph, TextRun, AlignmentType, Footer, PageNumber, LevelFormat,
} = require('docx');
const H = require('./helpers');

const t = (s, o = {}) => H.para(H.run(s, { size: 18, ...o }), { after: o.after ?? 100 });
const bullet = (parts) => new Paragraph({
  numbering: { reference: 'pb', level: 0 }, spacing: { after: 60 },
  children: (Array.isArray(parts) ? parts : [parts]).map((p) => (typeof p === 'string' ? H.run(p, { size: 18 }) : p)),
});
const b = (s) => H.run(s, { size: 18, bold: true });

function tabla(W, cols, filas, first = 'texto') {
  const trs = filas.map((f, i) => {
    const fill = i % 2 === 1 ? H.C.filaAlterna : undefined;
    return new TableRow({
      cantSplit: true,
      children: f.map((v, j) => {
        if (j === 0 && v && v.estado) return H.estadoCell(v.estado, W[0], v.map, 14);
        if (j === 0 && v && v.code) return H.cell([H.run(v.code, { bold: true, size: 17, color: v.color })], { width: W[0], fill, align: AlignmentType.CENTER });
        return H.cell(String(v), { width: W[j], fill, size: 17, bold: j === 0 && first === 'negrita' });
      }),
    });
  });
  return H.table(W, [H.headerRow(cols, W), ...trs]);
}

function buildDocument() {
  const children = [
    H.para(H.run('Harvey AI × Gentera', { size: 28, bold: true, color: H.C.navy }), { after: 40 }),
    H.para(H.run('Playbook de Lectura para Champions', { size: 24, bold: true }), { after: 40 }),
    H.para(H.run('Cómo leer el reporte semanal Champion  |  Versión 3, vigente desde el corte del 21-25 sep 2026', { size: 18, color: H.C.gris }), { after: 180 }),

    H.h2('Qué cambió respecto al Playbook de junio'),
    tabla([2600, 3500, 3980], ['Tema', 'Antes (junio)', 'Ahora'], [
      ['Semáforo', 'Umbral fijo igual para todos: 20+ verde, 5-19 amarillo, <5 rojo.', 'Cada persona contra su propio promedio de las últimas 5 semanas.'],
      ['Orden de la tabla', 'Por nivel o por volumen.', 'Por Urgencia: primero a quién atender esta semana.'],
      ['Herramientas', 'A, W, V, Wo.', 'A, W, V, Wo y O (Outlook, aparte de Assistant).'],
      ['Gap', 'Columna de gap (alineado, gap activo, gap crítico) contra la fortaleza esperada.', 'Se retira. Lo reemplazan Motivo del semáforo y Fortaleza actual.'],
      ['Ausencias', 'Se anotaban al margen.', 'Semana de Excepción: no se califica y no cuenta en el promedio.'],
      ['Nuevas columnas', '', 'Urgencia, Últimas 5 semanas, Div. Wf y Firma.'],
    ], 'negrita'),

    H.h2('1. La idea central'),
    t('El reporte no evalúa a las personas ni las compara entre sí. Compara a cada quien contra su propio ritmo para detectar cambios a tiempo y decidir dónde una conversación tuya genera más valor.'),
    t('El semáforo es consecuencia, no destino: el objetivo nunca es "pasar a verde", sino que el uso real crezca. Si alguien empuja por el color sin cambiar cómo trabaja, esa es la señal de alarma.', { italics: true, color: H.C.gris }),

    H.h2('2. Cómo se cuenta'),
    bullet([b('Acción: '), 'cada pregunta y cada seguimiento cuenta 1. Tres follow-ups sobre el mismo Vault son 4 acciones.']),
    bullet([b('Semana (corte): '), 'lunes a viernes, hora de Ciudad de México.']),
    bullet([b('Herramienta de cada acción: '), 'si una acción toca varias, gana la primera de este orden: Workflow > Vault > Word > Outlook > Assistant. Una consulta a un Vault hecha desde Assistant o Word cuenta como Vault.']),

    H.h2('3. Semáforo: contra su propio ritmo'),
    tabla([1700, 8380], ['Estado', 'Qué significa'], [
      [{ estado: 'verde' }, 'Igualó o superó su propio promedio de las últimas 5 semanas.'],
      [{ estado: 'amarillo' }, 'Entre 40% y 99% de su promedio.'],
      [{ estado: 'rojo' }, 'Menos de 40% de su promedio.'],
      [{ estado: 'excepcion' }, 'Ausencia documentada: vacaciones, incapacidad o evento de toda la SD. No se califica y esa semana no entra a su promedio.'],
      [{ estado: 'sin_historial' }, 'Menos de 5 semanas de historial propio: todavía no hay un ritmo contra el cual comparar.'],
    ]),
    H.nota('Semana de excepción: una incapacidad cualquier día, o 3 días hábiles o más de ausencia. Con 1 o 2 días se califica normal, y el Motivo explica la baja.', { after: 100 }),

    H.h2('4. Urgencia: a quién atender primero'),
    tabla([1700, 4300, 4080], ['Urgencia', 'Cuándo', 'Qué haces'], [
      [{ estado: 'Alta', map: H.URGENCIA }, 'Rojo, o 5 acciones o menos, o menos de la mitad de su ritmo.', 'Conversación antes del próximo corte. Pregunta primero (sección 7).'],
      [{ estado: 'Media', map: H.URGENCIA }, 'Amarillo, o verde por debajo de 120% de su ritmo.', 'Seguimiento ligero: un mensaje o un caso de uso concreto.'],
      [{ estado: 'Baja', map: H.URGENCIA }, 'Verde con margen.', 'Reconocer y aprovechar como referente para el equipo.'],
      [{ estado: 'Sin acción', map: H.URGENCIA }, 'Semana de excepción.', 'Nada. No se escala.'],
    ]),

    H.h2('5. Las columnas del reporte'),
    tabla([1700, 8380], ['Columna', 'Qué te dice'], [
      [{ code: 'A', color: H.TOOL_COLOR.A }, 'Assistant: consulta, análisis, redacción libre, criterio.'],
      [{ code: 'Wo', color: H.TOOL_COLOR.Wo }, 'Word Add-in: redacción y revisión dentro de documentos (incluye Playbooks en Word).'],
      [{ code: 'V', color: H.TOOL_COLOR.V }, 'Vault: trabajo sobre repositorios documentales.'],
      [{ code: 'W', color: H.TOOL_COLOR.W }, 'Workflow: procesos repetibles y estandarizables.'],
      [{ code: 'O', color: H.TOOL_COLOR.O }, 'Outlook: Harvey dentro del correo.'],
      [{ code: 'Últimas 5', color: H.C.navy }, 'Acciones de cada una de las últimas 5 semanas, de la más antigua a esta, con el color del semáforo de cada semana (gris = excepción). Se lee de un vistazo si la persona es constante, viene bajando o tuvo una semana atípica.'],
      [{ code: 'Div. Wf', color: H.C.navy }, 'Workflows distintos por semana, promedio de 5 semanas. Mide exploración, no volumen: 4 workflows distintos valen más que 1 repetido.'],
      [{ code: 'Firma', color: H.C.navy }, 'Herramientas de la semana, de mayor a menor uso (A>W = más Assistant que Workflow).'],
      [{ code: 'Motivo', color: H.C.navy }, 'Por qué salió ese color: si el cambio es leve, parejo en todas las herramientas o concentrado en una. Ahí está la conversación.'],
      [{ code: 'Fortaleza', color: H.C.navy }, 'Su workflow más usado de la semana o, si no usó ninguno, la herramienta en la que tiene más ritmo.'],
    ]),

    H.h2('6. Fortaleza esperada por nivel'),
    t('Es una hipótesis, no un mandato. Sirve para decidir qué proponerle a cada persona cuando su uso se concentra en una sola herramienta.'),
    tabla([2400, 1500, 6180], ['Nivel', 'Esperada', 'Razonamiento'], [
      ['Subdirector', 'A>V', 'Trabajo analítico y de supervisión, no ejecución repetible.'],
      ['Gerente', 'A>W', 'Mezcla de análisis propio y coordinación de procesos recurrentes.'],
      ['Líder / Coordinador', 'W>A', 'Ejecución operativa frecuente: el workflow multiplica su capacidad.'],
      ['Analista', 'W>V>A', 'Ejecución, búsqueda documental y análisis estructurado.'],
    ], 'negrita'),
    H.nota('Champions (★): su Assistant es más alto de lo que su nivel sugiere porque lo usan para diseñar y acompañar a otros.', { after: 100 }),

    H.h2('7. Antes de actuar: pregunta'),
    t('Ante una Urgencia Alta, primero pregunta. El dato dice qué pasó, no por qué.'),
    bullet('¿Hubo algo distinto en tu operación esta semana?'),
    bullet('¿Cuál fue la tarea que más tiempo te tomó? ¿Intentaste apoyarte en Harvey?'),
    bullet('¿Hay algo que haces repetidamente que todavía no tienes en workflow?'),
    bullet('Cuando usas Harvey en Word o en el correo, ¿qué tipo de tareas haces?'),
    bullet('Si pudieras quitarte una hora de trabajo repetitivo a la semana, ¿cuál sería?'),

    H.h2('8. Qué necesito de ti cada semana'),
    bullet([b('Ausencias: '), 'avísame vacaciones, incapacidades o eventos del equipo, con fechas, en cuanto las sepas. Sin aviso, la semana se califica normal.']),
    bullet([b('La caja "Antes del próximo corte": '), 'es tu tarea de la semana; ciérrala antes del viernes.']),
    bullet([b('Si un número no cuadra con lo que ves en tu equipo, '), 'dímelo: se revisa el dato antes de discutir el color.']),

    H.para(H.run('Este playbook es un documento vivo: se actualiza cuando cambia la metodología.', { size: 16, italics: true, color: H.C.gris }), { before: 220, after: 20 }),
    H.firma(),
  ];
  return new Document({
    styles: { default: { document: { run: { font: H.FONT } } } },
    numbering: { config: [{ reference: 'pb', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
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
  const outp = process.argv[2] || 'out/Playbook_Champion_v3.docx';
  Packer.toBuffer(buildDocument()).then((buf) => {
    fs.mkdirSync(path.dirname(outp), { recursive: true });
    fs.writeFileSync(outp, buf);
    console.log('OK:', outp);
  });
}
