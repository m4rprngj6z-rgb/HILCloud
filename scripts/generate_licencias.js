/**
 * generate_licencias.js: Reporte de Gobierno de Licencias (docx), solo para Tony.
 *
 * Uso: node scripts/generate_licencias.js out/GL_2026-09-25.json narrativa/2026-09-25/DJ.json out/GobiernoDeLicencias_25sep2026.docx [--fecha "..."]
 *
 * No calcula (todo viene de scripts/licencias.py). Estructura = GobiernoDeLicencias_25sep2026.docx
 * aprobado: ranking juridico top 10, ranking no juridico completo, radar de 8 semanas con
 * grafica, notas, jbueno y zmanzur aparte. Agregados: seccion de candidatos del mes y la regla de
 * empates en el lugar 10. Sin emoji dentro de texto Arial (el aprobado traia uno).
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, TableRow, TableCell, Paragraph, TextRun, AlignmentType, WidthType, ImageRun,
  VerticalAlign, Footer, PageNumber, ShadingType,
} = require('docx');
const H = require('./helpers');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (d = new Date()) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
const corteLargo = (c) => c.replace(/^(\d+)-(\d+) (\w+) (\d+)$/, (_, a, b, m, y) => `${a}–${b} ${({ ene: 'enero', feb: 'febrero', mar: 'marzo', abr: 'abril', may: 'mayo', jun: 'junio', jul: 'julio', ago: 'agosto', sep: 'septiembre', oct: 'octubre', nov: 'noviembre', dic: 'diciembre' })[m] || m} ${y}`);
const SD_NOMBRE = { ENN: 'ENN', CN: 'CN', PLD: 'PLD', GC: 'GC', JC: 'JC', RL: 'RL' };

const nota = (t, after = 140) => H.para(H.run(t, { size: 15, italics: true, color: H.C.gris }), { after });
const texto = (t, after = 120) => H.para(H.run(t, { size: 18 }), { after });

function contexto(p) {
  if (p.sd === 'EXTERNO' || p.sd === 'SIN MAPEAR') {
    return `${p.area || 'Área sin confirmar'} (${p.sd === 'SIN MAPEAR' ? 'sin mapear en el roster' : 'cortesía'})${p.nota_licencia ? `. ${p.nota_licencia}` : ''}`;
  }
  const base = `${SD_NOMBRE[p.sd] || p.sd}, ${p.nivel}`;
  return p.excepcion ? `${base} (excepción: ${(p.tipo_excepcion || '').toLowerCase()})` : base;
}

function rankingJuridico(d) {
  const W = [3200, 1200, 1900, 3200];
  const trs = d.ranking_juridico_top.map((p, i) => {
    const fill = i % 2 === 1 ? H.C.filaAlterna : undefined;
    const ap = p.excepcion ? '0 (excepción, no cuenta)' : String(p.apariciones_mes);
    return new TableRow({
      cantSplit: true,
      children: [
        H.cell(p.nombre, { width: W[0], fill, bold: true }),
        H.cell(p.sd, { width: W[1], fill, align: AlignmentType.CENTER }),
        H.cell(String(p.total), { width: W[2], fill, align: AlignmentType.CENTER }),
        H.cell(ap, { width: W[3], fill, align: AlignmentType.CENTER, bold: p.apariciones_mes >= 2 }),
      ],
    });
  });
  return H.table(W, [H.headerRow(['Persona', 'SD', 'Acciones (semana)', 'Apariciones este mes'], W, new Set([1, 2, 3])), ...trs]);
}

function rankingNoJuridico(d) {
  const W = [5000, 2000, 2500];
  const trs = d.ranking_no_juridico.map((p, i) => {
    const fill = i % 2 === 1 ? H.C.filaAlterna : undefined;
    return new TableRow({
      cantSplit: true,
      children: [
        H.cell([H.run(`${p.nombre} (${p.area || 'área sin confirmar'})`, { bold: true }), ...(p.nota_licencia ? [H.run(`  ${p.nota_licencia}`, { size: 15, italics: true, color: H.C.gris })] : [])], { width: W[0], fill }),
        H.cell(String(p.total), { width: W[1], fill, align: AlignmentType.CENTER }),
        H.cell(p.salto_atipico ? 'Salto al alza' : (p.excepcion ? 'Excepción' : String(p.apariciones_mes)), { width: W[2], fill, align: AlignmentType.CENTER }),
      ],
    });
  });
  return H.table(W, [H.headerRow(['Persona', 'Acciones (semana)', 'Apariciones este mes'], W, new Set([1, 2])), ...trs]);
}

function radar(d) {
  const W = [2400, 900, 3300, 2900];
  const trs = d.radar.map((p, i) => {
    const fill = i % 2 === 1 ? H.C.filaAlterna : undefined;
    const img = new TableCell({
      width: { size: W[2], type: WidthType.DXA },
      shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 40, bottom: 40, left: 60, right: 60 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: 'png', data: fs.readFileSync(p.grafica), transformation: { width: 192, height: 54 } })],
      })],
    });
    return new TableRow({
      cantSplit: true,
      children: [
        H.cell(p.nombre, { width: W[0], fill, bold: true }),
        H.cell(String(p.total_8s), { width: W[1], fill, align: AlignmentType.CENTER }),
        img,
        H.cell(contexto(p), { width: W[3], fill, size: 16 }),
      ],
    });
  });
  const primera = d.semanas[0].split(' ').slice(0, 2).join(' ').replace(/^(\d+)-\d+/, '$1');
  const ultima = d.semanas[d.semanas.length - 1];
  return [
    H.table(W, [H.headerRow(['Persona', 'Total', `Tendencia (8 semanas: ${primera} a ${ultima.replace(/^\d+-/, '')})`, 'Contexto'], W, new Set([1, 2])), ...trs]),
    nota('Cada gráfica tiene su propia escala (el Total da la magnitud). Punto hueco gris = semana de excepción documentada.', 100),
  ];
}

function aparte(d) {
  const W = [4000, 2700, 2800];
  const trs = d.aparte.map((p, i) => new TableRow({
    children: [
      H.cell(p.nombre, { width: W[0], fill: i % 2 === 1 ? H.C.filaAlterna : undefined, bold: true }),
      H.cell(String(p.total), { width: W[1], fill: i % 2 === 1 ? H.C.filaAlterna : undefined, align: AlignmentType.CENTER }),
      H.cell(String(p.total_8s), { width: W[2], fill: i % 2 === 1 ? H.C.filaAlterna : undefined, align: AlignmentType.CENTER }),
    ],
  }));
  return H.table(W, [H.headerRow(['Persona', 'Acciones (semana)', 'Total 8 semanas'], W, new Set([1, 2])), ...trs]);
}

const NOMBRE_T = { A: 'Assistant', Wo: 'Word', V: 'Vault', W: 'Workflow', O: 'Outlook' };
const mezclaTxt = (m) => ['A', 'Wo', 'V', 'W', 'O'].map((t) => `${t} ${m[t]}%`).join('   ');

function tablaSimple(W, cols, filas, centrar = new Set()) {
  const trs = filas.map((f, i) => new TableRow({
    cantSplit: true,
    children: f.map((v, j) => H.cell(String(v), {
      width: W[j], fill: i % 2 === 1 ? H.C.filaAlterna : undefined, size: 16, tight: true, bold: j === 0,
      align: centrar.has(j) ? AlignmentType.CENTER : undefined,
    })),
  }));
  return H.table(W, [H.headerRow(cols, W, centrar), ...trs]);
}

function seccionCapacitacion(c) {
  const out = [
    new Paragraph({ pageBreakBefore: true, keepNext: true, spacing: { after: 100 }, children: [H.run('Capacitación: fortalezas, rangos y calendario', { size: 24, bold: true, color: H.C.navy })] }),
    nota(`Últimas ${c.semanas} semanas útiles de cada persona (${c.personas} personas de las 6 SD). Mezcla = % de acciones por herramienta: A Assistant, Wo Word, V Vault, W Workflow, O Outlook.`, 100),
    H.h2('Calendario de capacitaciones por necesidad y rango', 120),
    tablaSimple([1250, 1850, 1450, 2450, 1300, 800, 980], ['Fecha', 'Tema', 'Coordina', 'Expertos (más uso)', 'Para quién', 'Sin uso / público', 'Estado'],
      c.calendario.map((s) => [s.fecha_txt, s.tema, s.coordina, Array.isArray(s.expertos) ? s.expertos.join('; ') : (s.expertos || '-'), s.niveles.join(', '), `${s.publico_sin_uso} / ${s.publico}`, s.estado]), new Set([5, 6])),
    nota('Coordina: quien sabe llevar una capacitación (lo decides tú). Expertos: las 3 personas con más uso de la herramienta; en Assistant, sin señales de calidad. Sin uso / público: personas de esos rangos que no la usaron en sus últimas semanas útiles (en Assistant: con instrucciones mínimas).', 100),
    H.h2('Top 3: a quién le urge cada capacitación', 120),
    tablaSimple([2300, 2600, 5180], ['Sesión', 'Persona', 'Por qué'],
      c.calendario.flatMap((s) => (s.urgentes || []).map((u, i) => [i === 0 ? s.tema : '', `${u.nombre} (${u.nivel}, ${u.sd})`, u.motivo]))),
    nota('Workflow: primero quien repite la misma tarea en Assistant, luego quien no usa Workflow, por volumen total. Otras herramientas: quien no la usa, por volumen total (los más activos son los que más ganan).', 100),
    H.h2('Por rango: necesidad', 120),
    tablaSimple([1500, 900, 1300, 3400, 1100, 1880], ['Rango', 'Personas', 'Acciones por persona por semana', 'Mezcla', 'Esperada', 'Necesidad'],
      c.rangos.map((r) => [r.nivel, r.personas, r.acc_ppw, mezclaTxt(r.mezcla), r.esperada, `${NOMBRE_T[r.necesidad]}: ${r.sin_necesidad} sin uso`]), new Set([1, 2, 4])),
    nota(`Necesidad = la primera herramienta de la fortaleza esperada del rango que no es Assistant (Playbook, sección 6). Outlook: ${c.sin_outlook} de ${c.personas} personas sin uso. Subdirectores solo en agregado.${c.rangos_fuera ? ` Rangos con menos de 3 personas fuera del análisis: ${c.rangos_fuera} personas.` : ''}`, 100),
    H.h2('Calidad de uso de Assistant (provisional)', 120),
    nota(`Más uso de Assistant no siempre es más valor. Revisión de la primera consulta de cada hilo (la instrucción de la tarea) de ${c.assistant_calidad.evaluadas} personas, últimas ${c.semanas} semanas.`, 60),
    tablaSimple([2700, 1900, 5480], ['Persona', 'Señal', 'Detalle'], [
      ...c.assistant_calidad.tarea_repetida.map((r) => [`${r.nombre} (${r.nivel}, ${r.sd})`, 'Tarea repetida: candidata a Workflow', `${r.hilos_repetidos} de ${r.hilos} hilos arrancan igual: "${r.plantilla}..."`]),
      ...c.assistant_calidad.instrucciones_minimas.map((r) => [`${r.nombre} (${r.nivel}, ${r.sd})`, 'Instrucciones mínimas', `La instrucción inicial tiene ${r.pal_inicial} palabras en promedio (${r.hilos} hilos)`]),
    ]),
    nota('Tarea repetida: la mitad o más de sus hilos (mínimo 10) arrancan con la misma instrucción; no cuentan los prefijos de rol ("actúa como...") ni las llamadas a workflows. Su volumen de Assistant no se lee como ritmo de valor. Instrucciones mínimas: menos de 15 palabras para arrancar una tarea (mínimo 5 hilos). Regla provisional, por validar con más cortes.', 100),
    H.h2('Champions', 120),
    tablaSimple([2300, 700, 1300, 1400, 4380], ['Champion', 'SD', 'Acciones por semana', 'Fortaleza', 'Mezcla'],
      c.champions.map((x) => [x.nombre, x.sd, x.acc_semana, NOMBRE_T[x.fortaleza], mezclaTxt(x.mezcla)]), new Set([1, 2])),
    H.h2('Referentes por herramienta', 120),
    tablaSimple([1400, 3300, 3880, 1500], ['Herramienta', 'Champion con más uso (por semana)', 'Persona de la DJ con más uso (por semana)', 'Personas sin uso'],
      c.herramientas.map((h) => [h.nombre, `${h.champion.nombre}, ${h.champion.sd} (${h.champion.por_semana})`, `${h.referente.nombre}, ${h.referente.nivel} ${h.referente.sd} (${h.referente.por_semana})${h.referente.es_champion ? ', Champion' : ''}`, `${h.sin_uso} de ${c.personas}`]), new Set([3])),
    H.h2('Equipos', 120),
    tablaSimple([900, 1500, 1400, 1300, 4980], ['SD', 'Acciones por persona por semana', 'Fortaleza', 'Hueco', 'Mezcla'],
      c.equipos.map((e) => [e.sd, e.acc_ppw, NOMBRE_T[e.fortaleza], NOMBRE_T[e.hueco], mezclaTxt(e.mezcla)]), new Set([1])),
    nota('Hueco = la herramienta de menor uso entre Word, Vault, Workflow y Outlook (Assistant lo usan todos).', 100),
  ];
  return out;
}

function buildDocument(d, narr, fecha, cap) {
  const notas = (narr.licencias && narr.licencias.notas) || [];
  const nCorte = d.cortes_del_mes.length;
  const children = [
    H.para(H.run('Harvey AI × Gentera', { size: 28, bold: true, color: H.C.navy }), { after: 60 }),
    H.para(H.run('Gobierno de Licencias', { size: 24, bold: true }), { after: 60 }),
    H.para(H.run(`Dirección Jurídica  |  Corte: ${corteLargo(d.corte)}  |  Corte ${nCorte} del mes${d.primer_corte_del_sistema ? ' (primer corte del sistema)' : ''}  |  ${fecha}`, { size: 18, color: H.C.gris }), { after: 180 }),
    texto('Universo completo, sin filtros de exclusión: nadie queda fuera por rol, cortesía, cabeza de SD o alta reciente. Tú decides qué excluir. Las excepciones documentadas no cuentan como aparición.'),

    H.h2(`Ránking Jurídico: menor uso de la semana (de ${d.ranking_juridico_universo} personas)`),
    rankingJuridico(d),
    nota(`Top 10 de menor uso; si hay empate en el lugar 10, entran todos los empatados (esta semana: ${d.ranking_juridico_top.length}). Apariciones este mes: veces en el top 10 en los cortes de ${MESES[Number(d.corte_viernes.slice(5, 7)) - 1]} desde el inicio del sistema. Candidato a reasignación = 2 o más apariciones en el mismo mes calendario.`),

    H.h2('Ránking No Jurídico: universo completo'),
    rankingNoJuridico(d),
    nota('Cortesías y cuentas externas a la DJ con licencia activa. "Salto al alza" = esta semana 20 acciones o más y al menos el triple de su promedio de las 7 semanas previas: no es candidato, es una anomalía en sentido contrario.'),

    H.h2('Candidatos del mes (2 o más apariciones)'),
  ];
  if (d.candidatos.length) {
    children.push(...d.candidatos.map((c) => texto(`${c.nombre} (${c.sd === 'EXTERNO' ? 'no jurídico' : c.sd}): ${c.apariciones_mes} apariciones este mes.`, 60)));
  } else {
    children.push(texto(`Ninguno todavía: ${nCorte === 1 ? 'es el primer corte del mes, nadie puede tener 2 apariciones' : 'nadie llega a 2 apariciones este mes'}. La decisión de reasignar se toma una vez al mes, en la sesión de KPIs.`));
  }
  children.push(
    H.h2('Radar: tendencia de 8 semanas'),
    nota('Quien está en el top 10 de cualquiera de los dos ránkings esta semana, quien ya apareció este mes y cualquier salto al alza. La ventana de 8 semanas evita que un cambio real reciente se lea como ruido de 2 o 3 semanas.', 100),
    ...radar(d),
  );
  if (notas.length) {
    children.push(H.h2('Notas'));
    notas.forEach((n) => {
      children.push(H.para([H.run(`${n.titulo}: `, { size: 18, bold: true }), H.run(n.texto, { size: 18 })], { after: 100 }));
    });
  }
  if (cap) children.push(...seccionCapacitacion(cap));
  children.push(
    H.h2('jbueno y zmanzur'),
    nota('Fuera de ambos ránkings y de la lógica de candidato y reasignación, por instrucción permanente (sus roles no son de consumo jurídico normal). Solo como referencia.', 100),
    aparte(d),
    H.para(H.run('Elaboró: José Antonio Bueno Díaz  |  Gerente Contratos TI & AI', { size: 16, color: H.C.gris }), { before: 220 }),
  );
  return new Document({
    styles: { default: { document: { run: { font: H.FONT } } } },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080, header: 708, footer: 708 } } },
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
  if (!inp || !narrPath || !outp) {
    console.error('Uso: node scripts/generate_licencias.js <GL.json> <narrativa.json> <salida.docx> [--fecha "..."]');
    process.exit(1);
  }
  const d = JSON.parse(fs.readFileSync(inp, 'utf8'));
  const narr = JSON.parse(fs.readFileSync(narrPath, 'utf8'));
  const ci = args.indexOf('--cap');
  const cap = ci > -1 && fs.existsSync(args[ci + 1]) ? JSON.parse(fs.readFileSync(args[ci + 1], 'utf8')) : null;
  Packer.toBuffer(buildDocument(d, narr, fi > -1 ? args[fi + 1] : fechaLarga(), cap)).then((buf) => {
    fs.mkdirSync(path.dirname(outp), { recursive: true });
    fs.writeFileSync(outp, buf);
    console.log('OK:', outp);
  });
}

module.exports = { buildDocument };
