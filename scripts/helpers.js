/**
 * helpers.js: primitivas de formato para los reportes docx.
 *
 * TODO lo visual de aqui se tomo del XML de los reportes aprobados por Tony
 * ({SD}_Champion_26sep2026.docx) y del "Estandar de Diseno y QA de Entregables" en Notion
 * (notion.so/38bf66a171628106af37eb6098e6ee82). No inventar colores ni tamanos: si algo cambia,
 * cambia primero el estandar o un reporte aprobado, y luego esto.
 *
 * Reglas del estandar que viven aqui:
 *  - Arial en todo el documento.
 *  - Encabezado de tabla #1F3864, filas alternas #EBF3FB.
 *  - Semaforo con relleno de celda + etiqueta en texto. Nunca emoji dentro de texto Arial
 *    (se rompe en Word; regla 25 sep 2026).
 *  - "Persona", no "Usuario", en encabezados.
 *  - Nunca raya larga (em dash) en ningun texto.
 */
const {
  Table, TableRow, TableCell, Paragraph, TextRun, WidthType, ShadingType, BorderStyle,
  AlignmentType, VerticalAlign, TableLayoutType,
} = require('docx');

const FONT = 'Arial';

const C = {
  navy: '1F3864',
  negro: '000000',
  gris: '595959',
  grisBorde: 'BFBFBF',
  filaAlterna: 'EBF3FB',
  blanco: 'FFFFFF',
  cajaVerde: 'E2EFDA',
  verdeTexto: '375623',
};

// Relleno + texto para semaforo y urgencia (tomado de los aprobados)
const ESTADO = {
  verde: { fill: 'C6EFCE', color: '375623', label: 'VERDE' },
  amarillo: { fill: 'FFEB9C', color: '9C5700', label: 'AMARILLO' },
  rojo: { fill: 'FFC7CE', color: '9C0006', label: 'ROJO' },
  excepcion: { fill: 'F2F2F2', color: '666666', label: 'EXCEPCIÓN' },
  sin_historial: { fill: 'F2F2F2', color: '666666', label: 'ALTA RECIENTE' },   // antes '?': Tony 28 sep, poco claro
};
const URGENCIA = {
  Alta: ESTADO.rojo, Media: ESTADO.amarillo, Baja: ESTADO.verde, 'Sin acción': ESTADO.excepcion,
};

// Color de los codigos de herramienta dentro del texto (A, Wo, W de los aprobados; V y O
// no aparecieron en ningun aprobado: V toma el verde de la paleta; O usa morado estandar de Office
// para no confundirse con el texto gris).
const TOOL_COLOR = { A: '1F3864', Wo: '9C5700', W: '9C0006', V: '375623', O: '7030A0' };

function run(text, o = {}) {
  if (/—/.test(text)) throw new Error(`Raya larga (em dash) prohibida en: ${text}`);
  return new TextRun({
    text, font: FONT, size: o.size || 17, bold: !!o.bold, italics: !!o.italics, color: o.color || C.negro,
  });
}

function para(children, o = {}) {
  return new Paragraph({
    alignment: o.align,
    keepNext: !!o.keepNext,
    spacing: { before: o.before || 0, after: o.after === undefined ? 0 : o.after },
    children: Array.isArray(children) ? children : [children],
  });
}

const BORDE = { style: BorderStyle.SINGLE, size: 4, color: C.grisBorde };

function cell(content, o = {}) {
  const runs = Array.isArray(content) ? content : [run(String(content ?? ''), o)];
  return new TableCell({
    width: { size: o.width, type: WidthType.DXA },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    borders: { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE },
    margins: { top: 60, bottom: 60, left: o.tight ? 40 : 90, right: o.tight ? 40 : 90 },
    children: [para(runs, { align: o.align || AlignmentType.LEFT })],
  });
}

function headerRow(cols, widths, centered = new Set()) {
  return new TableRow({
    tableHeader: true,
    children: cols.map((c, i) => cell(c, {
      width: widths[i], fill: C.navy, bold: true, color: C.blanco, size: 16,
      align: centered.has(i) ? AlignmentType.CENTER : AlignmentType.LEFT, tight: centered.has(i),
    })),
  });
}

function table(widths, rows) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows,
  });
}

function estadoCell(key, width, map = ESTADO, size = 14, fill, subtitulo) {
  const e = map[key] || ESTADO.sin_historial;
  const label = map === ESTADO ? e.label : key;
  const sz = label.length > 8 ? Math.min(size, 12) : size;   // EXCEPCIÓN no cabe a 7 pt
  const paras = [para([run(label, { bold: true, color: e.color, size: sz })], { align: AlignmentType.CENTER })];
  if (subtitulo) paras.push(para([run(subtitulo, { color: '666666', size: 12, italics: true })], { align: AlignmentType.CENTER }));
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: e.fill, color: 'auto' },
    verticalAlign: VerticalAlign.CENTER,
    borders: { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE },
    margins: { top: 60, bottom: 60, left: 40, right: 40 },
    children: paras,
  });
}

/** Fragmentos [{text, tool?}] -> runs, con los codigos de herramienta en negrita y color. */
function richRuns(parts, o = {}) {
  return parts.map((p) => (p.tool
    ? run(p.text, { ...o, bold: true, color: TOOL_COLOR[p.tool] || C.navy })
    : run(p.text, o)));
}

// Encabezado del documento, igual al aprobado
function docHeader(sdNombre, tipo, corte, fecha, champion) {
  return [
    para(run('Harvey AI × Gentera', { size: 28, bold: true, color: C.navy }), { after: 40 }),
    para(run(`SD ${sdNombre}`, { size: 24, bold: true }), { after: 40 }),
    para(run(`${tipo}  |  Corte: ${corte}  |  ${fecha}${champion ? `  |  Champion: ${champion}` : ''}`,
      { size: 18, color: C.gris }), { after: 160 }),
  ];
}

function h2(text, before = 200) {
  return para(run(text, { size: 22, bold: true, color: C.navy }), { before, after: 100, keepNext: true });
}

function nota(text, o = {}) {
  return para(run(text, { size: o.size || 14, italics: o.italics !== false, bold: !!o.bold, color: C.gris }), { after: o.after ?? 160 });
}

function cajaVerde(titulo, texto, plantilla, width = 9620) {
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [width],
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: width, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: C.cajaVerde, color: 'auto' },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 12, color: '70AD47' },
          left: { style: BorderStyle.SINGLE, size: 12, color: '70AD47' },
          bottom: { style: BorderStyle.SINGLE, size: 12, color: '70AD47' },
          right: { style: BorderStyle.SINGLE, size: 12, color: '70AD47' },
        },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: [
          para(run(titulo, { size: 20, bold: true, color: C.verdeTexto }), { after: 80 }),
          para(run(texto, { size: 17 }), { after: 100 }),
          para(run(plantilla, { size: 17, italics: true, color: C.gris })),
        ],
      })],
    })],
  });
}

function firma() {
  return para(run('Elaboró: José Antonio Bueno Díaz  |  Gerente Contratos TI & AI', { size: 16, color: C.gris }),
    { before: 220, after: 20 });
}

function fraseTransicion(ti) {
  if (!ti) return '';
  const partes = [`Las ${ti.sin_conteo} semanas anteriores quedaron sin conteo por la excepción.`];
  if (ti.personas_con_referencia) partes.push(`${ti.personas_con_referencia} personas se comparan contra sus 5 semanas previas a la excepción (${ti.rango_referencia}).`);
  if (ti.altas_sin_historial) partes.push(`${ti.altas_sin_historial} ${ti.altas_sin_historial > 1 ? 'altas recientes no tienen' : 'alta reciente no tiene'} semanas previas y no se ${ti.altas_sin_historial > 1 ? 'califican' : 'califica'}.`);
  return partes.join(' ');
}

module.exports = {
  fraseTransicion,
  C, ESTADO, URGENCIA, TOOL_COLOR, FONT,
  run, para, cell, headerRow, table, estadoCell, richRuns, docHeader, h2, nota, cajaVerde, firma,
};
