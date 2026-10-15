// Candidatos a liberar licencia para aprobacion de Fibi (Tony, 15 oct 2026).
// Datos: out/GL_<corte>.json (licencias.py), out/DJ_<corte>.json (promedio de referencia) y, opcional,
// el GL retroactivo de septiembre para marcar quien repite.
// Uso: node presentaciones/licencias_fibi.js out/GL_2026-10-09.json out/DJ_2026-10-09.json <GL_sep.json|-> notas.json out.docx
const fs = require('fs');
const { Document, Packer, TableRow, TableCell, Paragraph, AlignmentType, WidthType, ImageRun, LevelFormat, TextRun, BorderStyle } = require('docx');
const H = require('../scripts/helpers');

const [gPath, djPath, sepPath, notasPath, OUT] = process.argv.slice(2);
const G = JSON.parse(fs.readFileSync(gPath, 'utf8'));
const DJ = JSON.parse(fs.readFileSync(djPath, 'utf8'));
const SEP = sepPath && sepPath !== '-' ? JSON.parse(fs.readFileSync(sepPath, 'utf8')) : null;
const NOTAS = JSON.parse(fs.readFileSync(notasPath, 'utf8'));
const R = JSON.parse(fs.readFileSync(require('path').join(__dirname, '..', 'data', 'roster.json'), 'utf8')).personas;

const cands = G.candidatos.filter((c) => !c.nota_licencia && c.sd !== 'EXTERNO');
const sepUids = new Set((SEP ? SEP.candidatos : []).map((c) => c.usuario));
const nCortes = G.cortes_del_mes.length;
const tot = DJ.totales || DJ;
const promDJ = (tot.acciones / tot.personas).toFixed(0);
const S = 16;
const B = { style: BorderStyle.SINGLE, size: 4, color: H.C.grisBorde || 'BFBFBF' };
const W = [2300, 1250, 1150, 2900, 1000, 1480];

const bullet = (parts) => new Paragraph({ numbering: { reference: 'lf', level: 0 }, spacing: { after: 40 },
  children: (Array.isArray(parts) ? parts : [parts]).map((p) => (typeof p === 'string' ? H.run(p, { size: 18 }) : p)) });

const filas = cands.map((c, i) => {
  const fill = i % 2 === 1 ? H.C.filaAlterna : undefined;
  const prom = (c.total_8s / c.serie.filter((s) => s.con_datos).length).toFixed(1);
  const notas = [];
  if (sepUids.has(c.usuario)) notas.push('También en septiembre.');
  if (c.serie.some((x) => x.excepcion)) notas.push('Puntos grises: ausencia documentada.');
  if (NOTAS[c.usuario]) notas.push(NOTAS[c.usuario]);
  const p = R[c.usuario] || {};
  return new TableRow({
    cantSplit: true,
    children: [
      H.cell([H.run(c.nombre, { size: S, bold: true }), new TextRun({ text: p.puesto || c.nivel, font: H.FONT, size: 14, color: H.C.gris, break: 1 })], { width: W[0], fill }),
      H.cell(c.sd, { width: W[1], size: S, fill, align: AlignmentType.CENTER }),
      H.cell(`${c.apariciones_mes} de ${nCortes}`, { width: W[2], size: S, fill, align: AlignmentType.CENTER }),
      new TableCell({ width: { size: W[3], type: WidthType.DXA }, shading: fill ? { fill } : undefined, verticalAlign: 'center', borders: { top: B, left: B, bottom: B, right: B },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: fs.readFileSync(c.grafica), transformation: { width: 180, height: 51 } })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [H.run(c.serie.map((s) => s.total).join(' · '), { size: 13, color: H.C.gris })] })] }),
      H.cell(prom, { width: W[4], size: S, fill, align: AlignmentType.CENTER, bold: true }),
      H.cell(notas.join(' ') || '', { width: W[5], size: 14, fill }),
    ],
  });
});

const ESPERA = process.argv[7] ? JSON.parse(fs.readFileSync(process.argv[7], 'utf8')) : [];
const libres = cands.length - ESPERA.length;
const WE = [4600, 5480];

const children = [
  H.para(H.run('Harvey AI × Gentera', { size: 28, bold: true, color: H.C.navy }), { after: 40 }),
  H.para(H.run('Licencias de Harvey: bajas y lista de espera', { size: 24, bold: true }), { after: 40 }),
  H.para(H.run(`Octubre 2026  |  Para aprobación de la Dirección Jurídica  |  ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`, { size: 18, color: H.C.gris }), { after: 140 }),

  H.para([H.run('Se solicita: ', { size: 20, bold: true, color: H.C.navy }),
    H.run(`liberar ${cands.length} licencias de bajo uso y asignar ${ESPERA.length} a la lista de espera${libres > 0 ? `; ${libres} queda${libres > 1 ? 'n' : ''} disponible${libres > 1 ? 's' : ''}` : ''}.`, { size: 20 })], { after: 160 }),

  H.h2('Bajas propuestas', 80),
  H.table(W, [H.headerRow(['Persona', 'SD', 'Semanas en bajo uso (oct)', 'Acciones por semana, últimas 8', 'Promedio semanal', 'Nota'], W, new Set([1, 2, 3, 4])), ...filas]),
  H.para(H.run(`Promedio de la DJ: ${promDJ} acciones por persona por semana. Bajo uso: entre las 10 personas de menor uso de la semana, 2 o más veces en el mes; las ausencias documentadas no cuentan.`, { size: 14, color: H.C.gris }), { before: 60, after: 160 }),

  H.h2('Lista de espera', 80),
  H.table(WE, [H.headerRow(['Persona', 'Correo'], WE), ...ESPERA.map((e, i) => new TableRow({ children: [
    H.cell(e.nombre, { width: WE[0], size: S, bold: true, fill: i % 2 ? H.C.filaAlterna : undefined }),
    H.cell(e.correo, { width: WE[1], size: S, fill: i % 2 ? H.C.filaAlterna : undefined })] }))]),
  H.para('', { after: 120 }),

  H.h2('Aprobación', 80),
  ...cands.map((c) => H.para(H.run(`Baja: ${c.nombre} (${c.sd})     ☐ Sí     ☐ No`, { size: 18 }), { after: 50 })),
  ...ESPERA.map((e) => H.para(H.run(`Alta: ${e.nombre}     ☐ Sí     ☐ No`, { size: 18 }), { after: 50 })),

  H.para(H.run('Elaboró: José Antonio Bueno Díaz  |  Gerente Contratos TI & AI', { size: 16, color: H.C.gris }), { before: 200 }),
];

const doc = new Document({
  styles: { default: { document: { run: { font: H.FONT } } } },
  numbering: { config: [{ reference: 'lf', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 900, right: 1080, bottom: 800, left: 1080 } } }, children }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('OK', cands.map((c) => c.nombre).join(', ')); });
