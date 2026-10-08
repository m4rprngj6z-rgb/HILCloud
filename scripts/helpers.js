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

function fraseBasePrevia(bi) {
  if (!bi) return '';
  const n = bi.semanas_nuevas || 0;
  const ref = bi.rango_referencia ? ` (${bi.rango_referencia})` : '';
  const partes = [n
    ? `Semanas posteriores a la excepción de la SD: cada persona se compara contra ${n > 1 ? `sus ${n} semanas desde la excepción, completadas` : 'su semana desde la excepción, completada'} con ${5 - n} previas a ella${ref}. Mientras la referencia incluya semanas anteriores a los roles actuales, los colores son de referencia y no se escala; ${5 - n > 1 ? `faltan ${5 - n} semanas` : 'falta 1 semana'} para tener 5 nuevas.`
    : `Primeras semanas después de la excepción de la SD: cada persona se compara contra sus 5 semanas previas a la excepción${ref}, porque las semanas de la excepción no cuentan. Como esas semanas son anteriores a los roles actuales, los colores son de referencia y no se escala hasta tener 5 semanas nuevas.`];
  const pl = bi.altas_sin_historial > 1;
  if (bi.altas_sin_historial) partes.push(`${bi.altas_sin_historial} ${pl ? 'altas recientes todavía no' : 'alta reciente todavía no'} ${n ? `${pl ? 'juntan' : 'junta'} 5 semanas propias` : `${pl ? 'tienen' : 'tiene'} semanas previas`} y no se ${pl ? 'califican' : 'califica'}.`);
  return partes.join(' ');
}

const SENAL_CORTA = {
  'Tarea repetida en Assistant': 'tarea repetida en Assistant',
  'Instrucciones mínimas': 'instrucciones mínimas',
  'Escribe el nombre del workflow en Assistant': 'invoca workflows escribiendo su nombre',
  'Respuestas calificadas como negativas': 'respuestas calificadas negativas',
};

/** Seccion del Champion: alertas amarillas y capacitaciones de su equipo (Tony, 7 oct 2026). */
function seccionCapacitacionSD(c, W = 13680) {
  if (!c) return [];
  const out = [h2('Alertas y capacitación de tu equipo')];
  if (c.alerta_sd) {
    out.push(para([
      run('ALERTA AMARILLA DE LA SD  ', { size: 17, bold: true, color: ESTADO.amarillo.color }),
      run(`${c.alerta_sd.personas} de ${c.alerta_sd.de} personas con prácticas de uso deficiente${c.alerta_sd.champion ? `, incluido el Champion (${c.alerta_sd.champion})` : ''}.`, { size: 18, bold: true }),
    ], { after: 80 }));
  }
  if (c.alertas.length) {
    const w = [Math.round(W * 0.2), Math.round(W * 0.18), Math.round(W * 0.32)];
    w.push(W - w[0] - w[1] - w[2]);
    const filas = c.alertas.flatMap((p) => p.senales.map((x, i) => [i === 0 ? `${p.nombre}${p.champion ? ' (Champion)' : ''}` : '', x.senal, x.detalle, x.follow_up]));
    out.push(table(w, [headerRow(['Persona', 'Alerta amarilla', 'Detalle', 'Follow-up'], w),
      ...filas.map((f, i) => new (require('docx').TableRow)({ cantSplit: true, children: f.map((v, j) => cell(String(v), { width: w[j], size: 16, bold: j === 0, fill: i % 2 === 1 ? C.filaAlterna : undefined })) }))]));
    out.push(nota('Prácticas de uso deficiente detectadas en las últimas 8 semanas (revisión de la instrucción con la que arranca cada tarea en Assistant y de las calificaciones a las respuestas). Señales provisionales: confírmalas con la persona antes de actuar.', { after: 120 }));
  } else {
    out.push(para(run('Sin alertas de uso deficiente en tu equipo.', { size: 18 }), { after: 100 }));
  }
  const ses = c.sesiones.filter((s) => s.sin_uso);
  if (ses.length) {
    const w = [Math.round(W * 0.14), Math.round(W * 0.26), Math.round(W * 0.18), Math.round(W * 0.12)];
    w.push(W - w[0] - w[1] - w[2] - w[3]);
    out.push(table(w, [headerRow(['Fecha', 'Capacitación', 'Coordina', 'Tu equipo sin uso', 'Convocar primero'], w, new Set([3])),
      ...ses.map((s, i) => new (require('docx').TableRow)({ cantSplit: true, children: [
        cell(s.fecha_txt, { width: w[0], size: 16, bold: true, fill: i % 2 === 1 ? C.filaAlterna : undefined }),
        cell(s.tema, { width: w[1], size: 16, fill: i % 2 === 1 ? C.filaAlterna : undefined }),
        cell(s.coordina, { width: w[2], size: 16, fill: i % 2 === 1 ? C.filaAlterna : undefined }),
        cell(`${s.sin_uso} de ${s.publico}`, { width: w[3], size: 16, align: require('docx').AlignmentType.CENTER, fill: i % 2 === 1 ? C.filaAlterna : undefined }),
        cell(s.prioridad.join(', '), { width: w[4], size: 16, fill: i % 2 === 1 ? C.filaAlterna : undefined }),
      ] }))]));
    out.push(nota('Capacitaciones abiertas por necesidad y rango. "Sin uso": personas de los rangos convocados que no usan esa herramienta (en Assistant: con instrucciones mínimas). Convocar primero: quien más gana con la sesión.', { after: 120 }));
  }
  return out;
}

/** Ejecutivo: version de una linea por bloque. */
function lineasCapacitacionSD(c, size = 16) {
  if (!c) return [];
  const out = [];
  if (c.alertas.length) {
    const grupos = {};
    c.alertas.forEach((p) => p.senales.forEach((x) => {
      const k = SENAL_CORTA[x.senal] || x.senal;
      (grupos[k] = grupos[k] || []).push(`${p.nombre.split(' ').slice(0, 2).join(' ')}${p.champion ? ' (Champion)' : ''}`);
    }));
    const quien = Object.entries(grupos).map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v.join(', ')}`).join('. ');
    out.push(para([
      run(c.alerta_sd ? 'Alerta amarilla de la SD: ' : 'Alerta amarilla: ', { size, bold: true, color: ESTADO.amarillo.color }),
      run(`${c.alerta_sd ? `${c.alerta_sd.personas} de ${c.alerta_sd.de} personas con uso deficiente. ` : ''}${quien}.`, { size }),
    ], { after: 40 }));
  }
  const ses = c.sesiones.filter((s) => s.prioridad.length).slice(0, 2);
  if (ses.length) {
    out.push(para([
      run('Capacitaciones para su equipo: ', { size, bold: true, color: C.navy }),
      run(ses.map((s) => `${s.tema.split(':')[0]} (${s.fecha_txt}): ${s.prioridad.slice(0, 2).map((n) => n.split(' ').slice(0, 2).join(' ')).join(', ')}`).join('; ') + '. Detalle en el reporte del Champion.', { size }),
    ], { after: 40 }));
  }
  return out;
}

module.exports = {
  seccionCapacitacionSD, lineasCapacitacionSD,
  fraseTransicion, fraseBasePrevia,
  C, ESTADO, URGENCIA, TOOL_COLOR, FONT,
  run, para, cell, headerRow, table, estadoCell, richRuns, docHeader, h2, nota, cajaVerde, firma,
};
