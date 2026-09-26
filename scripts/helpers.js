/**
 * helpers.js — utilidades de armado para los reportes docx Champion.
 *
 * Reconstruido 26 sep 2026 tras perderse la version anterior en un reset de sandbox.
 * Consolida: tablas con columnas fijas, celdas de color (semaforo / urgencia), y el
 * bloque de CTA. Pensado para usarse desde generate.js, uno por SD.
 */
const {
  Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, ShadingType, BorderStyle, AlignmentType, HeadingLevel,
} = require('docx');

const COLORS = {
  navy: '1B2A45',
  teal: '2F6F62',
  amber: 'C98A3E',
  red: 'B23A3A',
  grey: '4A5568',
  greyLight: '8A94A6',
  bgLight: 'F1EEE6',
  white: 'FFFFFF',
};

const SEMAFORO = {
  verde: { label: '🟢 Verde', color: COLORS.teal },
  amarillo: { label: '🟡 Amarillo', color: COLORS.amber },
  rojo: { label: '🔴 Rojo', color: COLORS.red },
  excepcion: { label: '⚪ Excepción', color: COLORS.greyLight },
  sin_historial: { label: '? Sin historial', color: COLORS.greyLight },
};

const URGENCIA_COLOR = {
  Alta: COLORS.red,
  Media: COLORS.amber,
  Baja: COLORS.greyLight,
  'Sin acción': COLORS.teal,
};

/** Clasifica ratio (actividad / baseline propio) al color de semaforo self-relative. */
function classifySemaforo(actions, baseline, { hasHistory = true, isException = false } = {}) {
  if (isException) return 'excepcion';
  if (!hasHistory) return 'sin_historial';
  if (baseline === 0) return actions > 0 ? 'verde' : 'rojo';
  const ratio = actions / baseline;
  if (ratio >= 1.0) return 'verde';
  if (ratio >= 0.4) return 'amarillo';
  return 'rojo';
}

/** Racha: cortes consecutivos (desde el mas reciente) en verde/amarillo con >5 acciones.
 *  weeklyData: array ordenado ASC [{actions, baseline, isException, hasHistory}], normalmente
 *  las ultimas 5 semanas (un ciclo). Las semanas de excepcion se saltan sin romper la racha. */
function computeRacha(weeklyData) {
  let racha = 0;
  let broken = false;
  let allException = true;
  for (let i = weeklyData.length - 1; i >= 0; i--) {
    const wk = weeklyData[i];
    const color = classifySemaforo(wk.actions, wk.baseline, wk);
    if (!wk.isException) allException = false;
    if (broken) continue;
    if (wk.isException) continue; // se salta, no rompe, no cuenta
    const active = (color === 'verde' || color === 'amarillo') && wk.actions > 5;
    if (active) racha += 1;
    else broken = true;
  }
  return { racha, naCiclo: allException };
}

function cell(text, opts = {}) {
  const children = Array.isArray(text)
    ? text
    : [new TextRun({ text: String(text), bold: !!opts.bold, color: opts.color, italics: !!opts.italics })];
  return new TableCell({
    width: { size: opts.width || 1000, type: WidthType.DXA },
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [new Paragraph({ alignment: opts.align, children })],
  });
}

/** Franjas alternas (zebra striping) para que una tabla larga se lea sin perder la fila. */
function zebraFill(rowIndex, opts = {}) {
  if (opts.fill) return opts.fill; // respeta un fill explicito (p.ej. semaforo/urgencia)
  return rowIndex % 2 === 1 ? COLORS.bgLight : undefined;
}

/** Titulo del reporte como banner de color, en vez de texto plano sobre fondo blanco. */
function titleBanner({ kicker, title, subtitle, widthDXA = 8800 }) {
  const paras = [
    new Paragraph({
      children: [new TextRun({ text: kicker, bold: true, color: COLORS.amber, size: 20 })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, color: COLORS.white, size: 44 })],
      spacing: { after: 60 },
    }),
  ];
  if (subtitle) {
    paras.push(new Paragraph({
      children: [new TextRun({ text: subtitle, color: 'D7DCE5', size: 20, italics: true })],
    }));
  }
  return new Table({
    width: { size: widthDXA, type: WidthType.DXA },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: widthDXA, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: COLORS.navy },
        margins: { top: 260, bottom: 260, left: 320, right: 320 },
        children: paras,
      })],
    })],
  });
}

/** Encabezado de seccion: color navy + linea inferior, en vez del Heading1 negro por defecto. */
function sectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.amber, space: 4 } },
    children: [new TextRun({ text, bold: true, color: COLORS.navy })],
  });
}

/** Caja de resumen con fondo suave, para que el texto del corte no se pierda en parrafo plano. */
function calloutBox(text, { color = COLORS.grey, fill = COLORS.bgLight, italics = false, widthDXA = 8800 } = {}) {
  return new Table({
    width: { size: widthDXA, type: WidthType.DXA },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: widthDXA, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill },
        margins: { top: 160, bottom: 160, left: 200, right: 200 },
        children: [new Paragraph({ children: [new TextRun({ text, color, italics })] })],
      })],
    })],
  });
}

/** Celda con varios "tokens" de texto en distinto color/negrita, para citar codigos
 *  de herramienta (A/W/V/Wo/O) en negrita+color dentro de una frase (Motivo del semaforo). */
function tdRich(parts, opts = {}) {
  const runs = parts.map(p =>
    typeof p === 'string'
      ? new TextRun({ text: p })
      : new TextRun({ text: p.text, bold: !!p.bold, color: p.color })
  );
  return cell(runs, opts);
}

function urgenciaCell(urgencia, opts = {}) {
  const color = URGENCIA_COLOR[urgencia] || COLORS.grey;
  return cell(urgencia, { ...opts, bold: true, color });
}

function semaforoCell(colorKey, opts = {}) {
  const s = SEMAFORO[colorKey] || { label: colorKey, color: COLORS.grey };
  return cell(s.label, { ...opts, bold: true, color: s.color });
}

function headerRow(cols, widths, fill = COLORS.navy) {
  return new TableRow({
    children: cols.map((c, i) => cell(c, { width: widths[i], fill, bold: true, color: COLORS.white })),
  });
}

/** Bloque de llamado a la accion (CTA), usado al cierre de los reportes Champion. */
function ctaBox(title, lines, widthDXA = 8800) {
  return new Table({
    width: { size: widthDXA, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: widthDXA, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: COLORS.bgLight },
            children: [
              new Paragraph({ children: [new TextRun({ text: title, bold: true, color: COLORS.navy })] }),
              ...lines.map(l => new Paragraph({ children: [new TextRun({ text: `• ${l}`, color: COLORS.grey })] })),
            ],
          }),
        ],
      }),
    ],
  });
}

module.exports = {
  COLORS, SEMAFORO, URGENCIA_COLOR,
  classifySemaforo, computeRacha,
  cell, tdRich, urgenciaCell, semaforoCell, headerRow, ctaBox,
  zebraFill, titleBanner, sectionHeading, calloutBox,
};
