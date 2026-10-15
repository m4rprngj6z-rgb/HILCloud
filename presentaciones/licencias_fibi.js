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
  if (sepUids.has(c.usuario)) notas.push('También fue candidato en septiembre.');
  if (c.serie.some((x) => x.excepcion)) notas.push('Puntos huecos: semanas con ausencia documentada, no cuentan.');
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
      H.cell(notas.join(' ') || 'Sin notas', { width: W[5], size: 14, fill }),
    ],
  });
});

const children = [
  H.para(H.run('Harvey AI × Gentera', { size: 28, bold: true, color: H.C.navy }), { after: 40 }),
  H.para(H.run('Gobierno de Licencias: candidatos a liberar licencia', { size: 24, bold: true }), { after: 40 }),
  H.para(H.run(`Octubre 2026, al corte del ${G.corte}  |  Para aprobación de la Dirección Jurídica  |  15 de octubre de 2026`, { size: 18, color: H.C.gris }), { after: 140 }),

  H.h2('Decisión que se solicita', 100),
  H.para(H.run(`Aprobar la baja de ${cands.length} licencias de Harvey. Cada persona aparece en ${nCortes} de ${nCortes} cortes de octubre entre las 10 de menor uso de la Dirección Jurídica. Referencia: el promedio de la DJ es de ${promDJ} acciones por persona por semana.`, { size: 18 }), { after: 120 }),

  H.table(W, [H.headerRow(['Persona', 'SD', 'Apariciones en octubre', 'Acciones por semana, últimas 8 semanas', 'Promedio semanal', 'Notas'], W, new Set([1, 2, 3, 4])), ...filas]),
  H.para('', { after: 60 }),

  H.h2('Cómo se identifica a un candidato', 100),
  bullet('Cada semana se ordena a las 65 personas de las 6 Subdirecciones de menor a mayor uso; se toman las 10 de menor uso.'),
  bullet('Candidato: 2 o más apariciones en ese grupo dentro del mismo mes. Las semanas con ausencia documentada (vacaciones, incapacidad) no cuentan.'),
  bullet(`Octubre lleva ${nCortes} cortes; la lista del mes se cierra el 30 de octubre y puede crecer.`),

  H.h2('Aprobación', 100),
  ...cands.map((c) => H.para(H.run(`${c.nombre} (${c.sd}):   ☐ Dar de baja     ☐ Mantener`, { size: 18 }), { after: 60 })),

  H.para(H.run('Elaboró: José Antonio Bueno Díaz  |  Gerente Contratos TI & AI', { size: 16, color: H.C.gris }), { before: 200 }),
];

const doc = new Document({
  styles: { default: { document: { run: { font: H.FONT } } } },
  numbering: { config: [{ reference: 'lf', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 900, right: 1080, bottom: 800, left: 1080 } } }, children }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('OK', cands.map((c) => c.nombre).join(', ')); });
