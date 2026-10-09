/**
 * generate_ejecutivo.js: Reporte Ejecutivo (docx) de UNA SD, para su Subdirector(a).
 *
 * Uso: node scripts/generate_ejecutivo.js out/ENN_2026-09-25.json narrativa/2026-09-25/ENN.json out/ENN_Ejecutivo_25sep2026.docx [--fecha "..."]
 *
 * No calcula: numeros del ETL, texto de narrativa/ (validado antes con validar_narrativa.py).
 * Estructura = ENN_Ejecutivo_25sep2026.docx aprobado, con estos cambios acordados:
 *  - Vista por Gerencia con totales de toda la gerencia (Tony, 28 sep 2026) + nota aclaratoria.
 *  - Regla 8 del HIL: la gerencia del Champion de Champions aparece con su equipo y su nota.
 *  - Semaforo con relleno de celda y texto, sin emoji (Estandar, regla 25 sep 2026).
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, TableRow, TableCell, Paragraph, TextRun, AlignmentType, WidthType, ShadingType,
  BorderStyle, VerticalAlign, TableLayoutType, Table, Footer, PageNumber,
} = require('docx');
const H = require('./helpers');
H.h2E = (t) => H.h2(t, 110);   // Ejecutivo: una sola pagina
// Nivel de compactacion para que el Ejecutivo quepa en una pagina (lo sube correr_corte.sh si la
// version normal sale en 2 paginas): 1 = Usos clave a 3 filas; 2 = ademas letra 0.5 pt menor en
// Vista por Gerencia y texto; 3 = ademas Usos clave en una sola linea y margenes menores.
let COMPACTO = 0;
let CAP = null;   // out/CAP_<viernes>.json (capacitacion.py), opcional: --cap
const T = (n) => (COMPACTO >= 2 ? n - 1 : n);

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (d = new Date()) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
const corteConGuion = (c) => c.replace(/^(\d+)-(\d+)/, '$1–$2');
const LINEA = { style: BorderStyle.SINGLE, size: 4, color: 'auto' };
const BORDES_TABLA = { top: LINEA, bottom: LINEA, left: LINEA, right: LINEA, insideHorizontal: LINEA, insideVertical: LINEA };

function semaforoSemana(d) {
  const cuenta = (s) => d.rows.filter((r) => r.semaforo === s).length;
  const estados = ['verde', 'amarillo', 'rojo', 'excepcion', 'sin_historial'].filter((s) => ['verde', 'amarillo', 'rojo'].includes(s) || cuenta(s));
  const W0 = 1600;
  const Wr = Math.floor(7900 / estados.length);
  const W = [W0, ...estados.map(() => Wr)];
  const celdas = [
    H.cell(d.sd, { width: W0, fill: H.C.navy, bold: true, color: H.C.blanco, align: AlignmentType.CENTER }),
    ...estados.map((s) => {
      const e = H.ESTADO[s];
      return H.cell([H.run(`${cuenta(s)}  `, { bold: true, size: 20, color: e.color }), H.run(e.label, { bold: true, size: 16, color: e.color })],
        { width: Wr, fill: e.fill, align: AlignmentType.CENTER });
    }),
  ];
  return H.table(W, [new TableRow({ children: celdas })]);
}

function metricaCell(titulo, valor, pie, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [
      H.para(H.run(titulo, { bold: true, size: 18, color: H.C.gris }), { align: AlignmentType.CENTER }),
      H.para(H.run(valor, { bold: true, size: 36, color: H.C.navy }), { align: AlignmentType.CENTER, before: 40 }),
      H.para(H.run(pie || '', { italics: true, size: 15, color: H.C.gris }), { align: AlignmentType.CENTER }),
    ],
  });
}

function metricas(d) {
  const t = d.totales;
  const delta = t.acciones_anterior ? Math.round(((t.acciones - t.acciones_anterior) / t.acciones_anterior) * 100) : null;
  const wau = t.personas ? Math.round((t.personas_activas / t.personas) * 1000) / 10 : 0;
  const W = [3167, 3167, 3166];
  return new Table({
    width: { size: 9500, type: WidthType.DXA }, columnWidths: W, layout: TableLayoutType.FIXED, borders: BORDES_TABLA,
    rows: [new TableRow({
      children: [
        metricaCell('Acciones totales', String(t.acciones), delta === null ? '' : `vs ${t.acciones_anterior} (${delta >= 0 ? '+' : ''}${delta}%)`, W[0]),
        metricaCell('Personas en atención alta', String(t.atencion_alta), t.evaluadas ? `de ${t.evaluadas} calificadas esta semana` : (d.base_previa_info ? 'colores de referencia: sin escalar' : 'semana en excepción: sin escalar'), W[1]),
        metricaCell('Personas activas', `${t.personas_activas} / ${t.personas}`, `${wau}% WAU`, W[2]),
      ],
    })],
  });
}

function vistaGerencia(d) {
  // Columna W reemplazada por "Que pedirle" (Tony, 28 sep 2026): acciones concretas por gerencia.
  const W = [1600, 1350, 880, 1000, 1200, 1000, 2470];
  const cols = ['Gerencia', 'Responsable', 'Personas', 'Acciones', 'Fortaleza', 'Sem.', 'Qué pedirle'];
  const trs = d.gerencias.map((g, i) => {
    const fill = i % 2 === 1 ? H.C.filaAlterna : undefined;
    const c = (v, w, o = {}) => H.cell(String(v), { width: w, fill, align: AlignmentType.CENTER, ...o });
    const pedir = new TableCell({
      width: { size: W[6], type: WidthType.DXA },
      shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      children: g.que_pedir.map((t) => H.para(H.run(t, { size: T(16) }), { after: 20 })),
    });
    return new TableRow({
      cantSplit: true,
      children: [
        H.cell(g.gerencia, { width: W[0], fill, bold: true, size: T(16) }),
        H.cell(g.responsable + (g.responsable_excluido ? ' *' : ''), { width: W[1], fill, size: T(16) }),
        c(g.personas, W[2], { size: T(16) }), c(g.acciones, W[3], { size: T(16) }), c(g.firma, W[4], { bold: true, size: 15, tight: true }),
        H.estadoCell(g.semaforo, W[5], undefined, 14, undefined, g.en_transicion ? 'en excepción' : undefined),
        pedir,
      ],
    });
  });
  return H.table(W, [H.headerRow(cols, W, new Set([2, 3, 4, 5])), ...trs]);
}

function usosClave(d) {
  if (!d.usos_clave.length) {
    return [H.para(H.run('Sin ejecuciones de Workflow con nombre propio en este corte.', { size: 18, italics: true, color: H.C.gris }), { after: 100 })];
  }
  const W = [2500, 5500, 1500];
  // Con cortesias bajo seguimiento la pagina se llena: se muestran los 5 usos mas frecuentes.
  if (COMPACTO >= 3) {
    const top = d.usos_clave.slice(0, 3).map((u) => `${u.persona}: ${u.uso} (${u.veces}x)`).join('; ');
    return [H.para(H.run(`${top}.`, { size: T(17) }), { after: 80 })];
  }
  const usos = COMPACTO >= 1 ? d.usos_clave.slice(0, 3) : ((d.cortesias && d.cortesias.length) ? d.usos_clave.slice(0, 5) : d.usos_clave);
  const trs = usos.map((u, i) => {
    const fill = i % 2 === 1 ? H.C.filaAlterna : undefined;
    return new TableRow({
      cantSplit: true,
      children: [
        H.cell(u.persona, { width: W[0], fill, bold: true }),
        H.cell(u.uso, { width: W[1], fill }),
        H.cell(`${u.veces}x`, { width: W[2], fill, bold: true, align: AlignmentType.CENTER }),
      ],
    });
  });
  return [H.table(W, [H.headerRow(['Persona', 'Uso', 'Frecuencia'], W, new Set([2])), ...trs])];
}

function cajaAccion(texto) {
  return new Table({
    width: { size: 9500, type: WidthType.DXA }, columnWidths: [9500], layout: TableLayoutType.FIXED, borders: BORDES_TABLA,
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: 9500, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: 'FFF3CD', color: 'auto' },
        margins: { top: 100, bottom: 100, left: 130, right: 130 },
        children: [H.para([H.run('Acción   ', { bold: true, size: T(18) }), H.run(texto, { size: T(18) })])],
      })],
    })],
  });
}

// Cortesias cuyo uso sigue la Subdireccion (Tony, 30 sep 2026). Informativo: no suma a totales.
// Una linea por cortesia (una tabla aparte no cabe en la pagina unica del Ejecutivo).
function cortesias(d) {
  if (!d.cortesias || !d.cortesias.length) return [];
  return d.cortesias.map((c) => H.para([
    H.run('Cortesía bajo seguimiento: ', { size: 16, bold: true, color: H.C.navy }),
    H.run(`${c.nombre} (${c.area || 'área sin confirmar'}${c.solicito ? `, licencia a cargo de ${c.solicito}` : ''}). `, { size: 16, bold: true }),
    H.run(`${c.total} acciones esta semana${c.ultimas.length > 1 ? `; últimas semanas: ${c.ultimas.join(', ')}` : ''}; firma: ${c.firma}. No suma a los totales ni al semáforo.`, { size: 16 }),
  ], { after: 40 }));
}

function buildDocument(d, narr, fecha) {
  const n = narr.ejecutivo;
  const trans = d.rows.some((r) => r.transicion);
  const nota = (t) => H.para(H.run(t, { size: 15, color: H.C.gris }), { after: 60 });
  const excluido = d.gerencias.find((g) => g.responsable_excluido);

  const children = [
    H.para(H.run('Harvey AI × Gentera', { size: 28, bold: true, color: H.C.navy }), { after: 60 }),
    H.para(H.run(`${d.etiqueta_subdireccion === 'Dirección Funcional' ? 'Dirección Funcional' : 'Subdirección'} ${d.sdNombre}`, { size: 24, bold: true }), { after: 60 }),
    H.para(H.run(`Reporte Ejecutivo  |  Corte: ${corteConGuion(d.corte)}  |  ${fecha}`, { size: 18, color: H.C.gris }), { after: 180 }),

    H.h2E('Semáforo de la semana'),
    semaforoSemana(d),
  ];
  if (d.base_previa_info) {
    children.push(nota(H.fraseBasePrevia(d.base_previa_info)));
  }
  if (trans) {
    children.push(nota(`Semana de cierre de la excepción de la SD: los colores son de referencia y no se escala. ${H.fraseTransicion(d.transicion_info)}`));
  }
  children.push(
    H.h2E('Métricas'),
    metricas(d),

    H.h2E('Vista por Gerencia'),
    vistaGerencia(d),
    nota('Personas y Acciones suman a toda la gerencia. Semáforo: total del equipo contra la suma del promedio propio de cada integrante. Qué pedirle: a quién buscar (bajó de su ritmo o tuvo muy poca actividad) y a quién proponer una herramienta que su puesto espera y no usa.'),
  );
  if (excluido) {
    children.push(nota(`* ${excluido.gerencia} reporta funcionalmente a ${excluido.responsable} (Gerente Contratos TI & AI). ${excluido.integrantes.join(', ')} se incluye${excluido.integrantes.length > 1 ? 'n' : ''} aquí para visibilidad operativa de línea; las métricas personales de ${excluido.responsable} siguen excluidas de la DJ.`));
  }
  children.push(
    nota('A = Assistant  |  Wo = Word Add-in  |  V = Vault  |  W = Workflow  |  O = Outlook  |  Verde = igual o arriba de su propio promedio  |  Amarillo = 40% a 99%  |  Rojo = menos de 40%  |  Excepción = ausencia documentada  |  Alta reciente = menos de 5 semanas de historial'),

    ...cortesias(d),
    ...H.lineasCapacitacionSD(CAP && CAP.por_sd ? CAP.por_sd[d.sd] : null, T(16)),

    H.h2E('Usos clave observados'),
    ...usosClave(d),

    H.h2E('Recomendación'),
    H.para(H.run(n.recomendacion, { size: T(18) }), { after: 100 }),
    cajaAccion(n.accion),

    H.para(H.run('Elaboró: José Antonio Bueno Díaz  |  Gerente Contratos TI & AI  |  Notion HIL: notion.so/37df66a17162812a9f53e15cb031792d', { size: 16, color: H.C.gris }), { before: (COMPACTO || (d.cortesias && d.cortesias.length)) ? 40 : 140, after: 0 }),
  );

  return new Document({
    styles: { default: { document: { run: { font: H.FONT } } } },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: COMPACTO >= 3 ? 860 : 1080, right: 1080, bottom: COMPACTO >= 3 ? 860 : 1080, left: 1080, header: 708, footer: 708 } } },
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
  const args = process.argv.slice(2);
  const [inp, narrPath, outp] = args;
  const fi = args.indexOf('--fecha');
  const ci = args.indexOf('--compacto');
  if (ci > -1) COMPACTO = Number(args[ci + 1]) || 0;
  const ki = args.indexOf('--cap');
  if (ki > -1 && fs.existsSync(args[ki + 1])) CAP = JSON.parse(fs.readFileSync(args[ki + 1], 'utf8'));
  if (!inp || !narrPath || !outp) {
    console.error('Uso: node scripts/generate_ejecutivo.js <etl.json> <narrativa.json> <salida.docx> [--fecha "..."] [--compacto 0-3]');
    process.exit(1);
  }
  const d = JSON.parse(fs.readFileSync(inp, 'utf8'));
  const narr = JSON.parse(fs.readFileSync(narrPath, 'utf8'));
  if (!narr.ejecutivo || !narr.ejecutivo.recomendacion || !narr.ejecutivo.accion) {
    console.error('La narrativa no trae ejecutivo.recomendacion y ejecutivo.accion.');
    process.exit(1);
  }
  Packer.toBuffer(buildDocument(d, narr, fi > -1 ? args[fi + 1] : fechaLarga())).then((buf) => {
    fs.mkdirSync(path.dirname(outp), { recursive: true });
    fs.writeFileSync(outp, buf);
    console.log('OK:', outp);
  });
}

module.exports = { buildDocument };
