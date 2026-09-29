/**
 * Junta mensual con Juridico, 1 oct 2026. Cifras de adopcion: out/junta_2026-09-25.json
 * (presentaciones/datos_junta.py). KPIs: Notion "KPIs de Negocio por SD" (18 sep 2026).
 * Harvey II: anuncio publico del 18 ago 2026 (Artificial Lawyer, Global Legal Post).
 * Uso: node presentaciones/junta_oct2026.js out/Harvey_Junta_Juridico_oct2026.pptx
 */
const fs = require('fs');
const pptxgen = require('pptxgenjs');

const D = JSON.parse(fs.readFileSync('out/junta_2026-09-25.json', 'utf8'));
const M = Object.fromEntries(D.meses.map((m) => [m.mes, m]));
const OUT = process.argv[2] || 'out/Harvey_Junta_Juridico_oct2026.pptx';

const C = {
  navy: '1F3864', navy2: '2B4A80', ice: 'EBF3FB', ice2: 'D6E4F0', ink: '1A1A1A', gris: '595959', grisClaro: 'BFBFBF',
  blanco: 'FFFFFF', acento: 'C55A11', verde: '375623', verdeF: 'C6EFCE', amar: '9C5700', amarF: 'FFEB9C', rojo: '9C0006', rojoF: 'FFC7CE',
  neutroF: 'F2F2F2', neutro: '666666',
};
const F = 'Arial';
const fmt = (n) => n.toLocaleString('en-US');

let pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';   // 13.33 x 7.5
pres.author = 'José Antonio Bueno Díaz';
pres.title = 'Harvey AI × Gentera: junta mensual Jurídico, octubre 2026';

const W = 13.33;
function titulo(s, t, sub) {
  s.addText(t, { x: 0.6, y: 0.4, w: W - 1.2, h: 0.7, fontFace: F, fontSize: 30, bold: true, color: C.navy, margin: 0, isTextBox: true });
  if (sub) s.addText(sub, { x: 0.6, y: 1.1, w: W - 1.2, h: 0.4, fontFace: F, fontSize: 14, color: C.gris, margin: 0, isTextBox: true });
}
function pie(s, n, fuente) {
  s.addText(fuente || '', { x: 0.6, y: 7.0, w: 10.5, h: 0.3, fontFace: F, fontSize: 9, color: C.gris, margin: 0, isTextBox: true });
  s.addText(String(n), { x: W - 1.1, y: 7.0, w: 0.5, h: 0.3, fontFace: F, fontSize: 9, color: C.gris, align: 'right', margin: 0, isTextBox: true });
}
function card(s, x, y, w, h, fill) {
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: fill || C.ice }, line: { color: fill || C.ice } });
}
function numero(s, x, y, w, big, label, color) {
  s.addText(big, { x, y, w, h: 0.9, fontFace: F, fontSize: 44, bold: true, color: color || C.navy, margin: 0, isTextBox: true });
  s.addText(label, { x, y: y + 0.9, w, h: 0.7, fontFace: F, fontSize: 13, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
}
function bullets(s, items, x, y, w, h, size = 14) {
  s.addText(items.map((t, i) => ({
    text: t, options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 8 },
  })), { x, y, w, h, fontFace: F, fontSize: size, color: C.ink, valign: 'top', margin: 0, isTextBox: true });
}

// 1. Portada ---------------------------------------------------------------------------------
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  s.addText('Harvey AI × Gentera', { x: 0.8, y: 2.2, w: 11.5, h: 1.0, fontFace: F, fontSize: 44, bold: true, color: C.blanco, margin: 0, isTextBox: true });
  s.addText('Cómo vamos: adopción, nuevos reportes, Harvey 2.0, KPIs y plan de trabajo', { x: 0.8, y: 3.25, w: 11.5, h: 0.6, fontFace: F, fontSize: 20, color: C.ice2, margin: 0, isTextBox: true });
  s.addText('Junta mensual Dirección Jurídica  |  Octubre 2026  |  Datos al corte del 21-25 sep 2026', { x: 0.8, y: 4.3, w: 11.5, h: 0.4, fontFace: F, fontSize: 14, color: C.ice2, margin: 0, isTextBox: true });
  s.addText('José Antonio Bueno Díaz  |  Gerente Contratos TI & AI', { x: 0.8, y: 6.4, w: 11.5, h: 0.4, fontFace: F, fontSize: 13, color: C.blanco, margin: 0, isTextBox: true });
  s.addNotes('Agenda: adopción, nuevos reportes, Harvey 2.0, KPIs y planes de trabajo. Todos los números de adopción salen del cálculo automático sobre los exports de Harvey (10 jun a 25 sep 2026).');
}

// 2. De un vistazo ---------------------------------------------------------------------------------
{
  const s = pres.addSlide();
  titulo(s, 'De un vistazo', 'Septiembre frente a junio, promedio por semana');
  const jun = M.jun, sep = M.sep;
  const crec = Math.round(100 * (sep.acciones_semana - jun.acciones_semana) / jun.acciones_semana);
  const stats = [
    [fmt(sep.acciones_semana), `acciones por semana en septiembre (+${crec}% vs. junio)`],
    [String(Math.round(sep.activas_semana)), `de ${D.universo} personas de la Dirección Jurídica usan Harvey cada semana`],
    [String(sep.workflows_distintos), `workflows distintos en uso en septiembre (${jun.workflows_distintos} en junio)`],
    ['6 de 12', 'KPIs de negocio ya en su meta de 1 año'],
  ];
  const cw = 2.85, gap = 0.2;
  stats.forEach(([b, l], i) => {
    const x = 0.6 + i * (cw + gap);
    card(s, x, 1.85, cw, 2.3);
    numero(s, x + 0.25, 2.05, cw - 0.5, b, l);
  });
  s.addText('Hoy', { x: 0.6, y: 4.55, w: 3, h: 0.4, fontFace: F, fontSize: 18, bold: true, color: C.navy, margin: 0, isTextBox: true });
  bullets(s, [
    'El uso creció y se sostiene: más personas, más acciones y más workflows distintos que en junio.',
    'Word y Outlook ganan terreno: Harvey entra al flujo diario de redacción y correo, no solo a la plataforma.',
    'Jurídico Contencioso y Relaciones Laborales son el foco de acompañamiento del siguiente trimestre.',
  ], 0.6, 5.0, 12.1, 1.8, 15);
  pie(s, 2, `Fuente: exports de uso de Harvey, 15 jun a 25 sep 2026; universo de ${D.universo} personas de la Dirección Jurídica (las 6 Subdirecciones, la Directora y la coordinación del proyecto). KPIs: tablero de KPIs por SD, sep 2026.`);
  s.addNotes(`Promedios semanales. Junio = 2 semanas completas (15-26 jun); septiembre = 4 semanas (31 ago a 25 sep). Personas activas: promedio de personas con al menos una acción por semana.`);
}

// 3. Adopcion: tendencia ---------------------------------------------------------------------------------
{
  const s = pres.addSlide();
  titulo(s, 'Adopción: el volumen sube y se sostiene', 'Acciones por semana de la Dirección Jurídica (cada pregunta y cada seguimiento cuenta 1)');
  const labels = D.semanas.map((x) => x.corte.replace(/^(\d+)(?: \w+)?-\d+ (\w+) \d{4}$/, '$1 $2').replace(/^(\d+) (\w+)-.*$/, '$1 $2'));
  s.addChart(pres.charts.BAR, [{ name: 'Acciones', labels, values: D.semanas.map((x) => x.acciones) }], {
    x: 0.5, y: 1.7, w: 8.2, h: 5.0, barDir: 'col', chartColors: [C.navy], barGapWidthPct: 45,
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 9, dataLabelColor: C.gris, dataLabelFontFace: F,
    catAxisLabelFontSize: 9, catAxisLabelColor: C.gris, catAxisLabelFontFace: F, valAxisHidden: true,
    valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showLegend: false,
  });
  card(s, 9.0, 1.7, 3.8, 5.0);
  const tx = 9.25;
  const blk = (y, big, l) => {
    s.addText(big, { x: tx, y, w: 3.3, h: 0.6, fontFace: F, fontSize: 28, bold: true, color: C.navy, margin: 0, isTextBox: true });
    s.addText(l, { x: tx, y: y + 0.6, w: 3.3, h: 0.7, fontFace: F, fontSize: 12, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
  };
  const s0 = D.semanas[0], s1 = D.semanas[D.semanas.length - 1];
  blk(1.9, `${fmt(s0.acciones)} → ${fmt(s1.acciones)}`, `acciones por semana, del 15 jun al 21-25 sep (+${Math.round(100 * (s1.acciones - s0.acciones) / s0.acciones)}%)`);
  blk(3.45, `${s0.activas} → ${s1.activas}`, `personas activas en la semana, de ${D.universo}`);
  blk(5.0, `${M.jun.o_semana} → ${M.sep.o_semana}`, 'acciones por semana en Outlook (promedio jun vs. sep)');
  pie(s, 3, 'Fuente: exports de uso de Harvey, semanas lunes a viernes (hora CDMX).');
  { const pk = D.semanas.reduce((a, b) => (b.acciones > a.acciones ? b : a)); s.addNotes(`Pico de ${fmt(pk.acciones)} en la semana del ${pk.corte}. La semana del 14-18 sep incluye el día inhábil del 16 de septiembre.`); }
}

// 4. Adopcion: mezcla y areas ---------------------------------------------------------------------------------
{
  const s = pres.addSlide();
  titulo(s, 'Adopción: dónde y cómo se usa', 'Mezcla de herramientas y promedio semanal de acciones por Subdirección');
  const tools = [['A', 'Assistant'], ['Wo', 'Word'], ['W', 'Workflow'], ['V', 'Vault'], ['O', 'Outlook']];
  const colores = ['1F3864', '9C5700', '9C0006', '375623', '7030A0'];
  const ct = (t, o = {}) => ({ text: String(t), options: { fontFace: F, fontSize: 14, color: C.ink, valign: 'middle', ...o } });
  const mrows = [['Herramienta', 'Junio', 'Septiembre'].map((h, i) => ct(h, { bold: true, color: C.blanco, fill: { color: C.navy }, align: i ? 'center' : 'left', fontSize: 12 }))];
  tools.forEach(([k, n], i) => {
    const fill = i % 2 ? { color: C.ice } : undefined;
    mrows.push([ct(n, { fill, bold: true, color: colores[i] }), ct(`${M.jun.mezcla_pct[k]}%`, { fill, align: 'center' }), ct(`${M.sep.mezcla_pct[k]}%`, { fill, align: 'center', bold: true })]);
  });
  s.addTable(mrows, { x: 0.6, y: 1.75, w: 5.4, colW: [2.4, 1.5, 1.5], rowH: 0.52, border: { type: 'solid', pt: 0.5, color: C.grisClaro } });
  s.addText(`Word y Outlook crecen: Harvey entra a la redacción y al correo de todos los días. Workflow se mantiene entre ${Math.min(...D.meses.map((m) => m.w_semana))} y ${Math.max(...D.meses.map((m) => m.w_semana))} ejecuciones por semana.`, { x: 0.6, y: 5.1, w: 5.4, h: 1.0, fontFace: F, fontSize: 13, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
  const SD = [['ENN', 'Expansión Nuevos Negocios'], ['CN', 'Cumplimiento Normativo'], ['PLD', 'Prevención de Lavado de Dinero'], ['GC', 'Gobierno Corporativo'], ['JC', 'Jurídico Contencioso'], ['RL', 'Relaciones Laborales'], ['DJ', 'Dirección y coordinación del proyecto']];
  const hdr = ['Subdirección', 'Jul', 'Ago', 'Sep', 'Lectura'];
  const lectura = {
    ENN: 'Crece y se sostiene', CN: 'Estable y alto', PLD: 'Recupera tras la reestructuración',
    GC: 'Baja en septiembre', JC: 'Crece desde un nivel bajo', RL: 'A la baja: foco del trimestre', DJ: 'Uso de la Dirección',
  };
  const cell = (t, o = {}) => ({ text: String(t), options: { fontFace: F, fontSize: 12, color: C.ink, valign: 'middle', ...o } });
  const rows = [hdr.map((h, i) => cell(h, { bold: true, color: C.blanco, fill: { color: C.navy }, align: i && i < 4 ? 'center' : 'left' }))];
  SD.forEach(([k, n], i) => {
    const fill = i % 2 ? { color: C.ice } : undefined;
    rows.push([cell(n, { fill, bold: true }), ...['jul', 'ago', 'sep'].map((m) => cell(M[m].sd_semana[k], { fill, align: 'center' })), cell(lectura[k], { fill, fontSize: 11 })]);
  });
  s.addTable(rows, { x: 6.5, y: 1.75, w: 6.3, colW: [2.55, 0.6, 0.6, 0.6, 1.95], rowH: 0.46, border: { type: 'solid', pt: 0.5, color: C.grisClaro } });
  s.addText('PLD tuvo una excepción documentada de agosto al 24 de septiembre (reestructuración y capacitaciones).', { x: 6.5, y: 5.55, w: 6.3, h: 0.6, fontFace: F, fontSize: 10, italic: true, color: C.gris, margin: 0, isTextBox: true });
  pie(s, 4, 'Fuente: exports de uso de Harvey. Promedio de acciones por semana; julio = 5 semanas, agosto y septiembre = 4.');
  s.addNotes(`Word pasa de ${M.jun.mezcla_pct.Wo}% a ${M.sep.mezcla_pct.Wo}% del uso y Outlook de ${M.jun.mezcla_pct.O}% a ${M.sep.mezcla_pct.O}%: Harvey entra al flujo de redacción y correo. El Workflow se mantiene entre ${Math.min(...D.meses.map((m) => m.w_semana))} y ${Math.max(...D.meses.map((m) => m.w_semana))} ejecuciones por semana.`);
}

// 5. Casos de impacto ---------------------------------------------------------------------------------
{
  const s = pres.addSlide();
  titulo(s, 'Casos de impacto', 'Valor real que no siempre aparece en el conteo de Workflows');
  const casos = [
    ['Gobierno Corporativo', '600', 'reactivos de 3 cuestionarios regulatorios para autoridades, con comparativos e informes de cumplimiento. El abogado conserva la revisión final.'],
    ['Jurídico Contencioso', '280', 'consultas a un solo repositorio de Vault de oficios: la cifra más alta de la Dirección. Es una herramienta de producción, no exploración.'],
    ['Relaciones Laborales', '103', 'consultas a dos Vaults de resoluciones que el Champion compartió con su equipo: el conocimiento se vuelve colectivo.'],
  ];
  casos.forEach(([area, big, txt], i) => {
    const x = 0.6 + i * 4.1;
    card(s, x, 1.85, 3.9, 3.9);
    s.addText(area, { x: x + 0.3, y: 2.05, w: 3.3, h: 0.4, fontFace: F, fontSize: 14, bold: true, color: C.acento, margin: 0, isTextBox: true });
    s.addText(big, { x: x + 0.3, y: 2.5, w: 3.3, h: 1.0, fontFace: F, fontSize: 54, bold: true, color: C.navy, margin: 0, isTextBox: true });
    s.addText(txt, { x: x + 0.3, y: 3.6, w: 3.3, h: 2.3, fontFace: F, fontSize: 14, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
  });
  s.addText('Nota: Harvey atribuye las consultas de un Vault a quien lo creó; en Vaults compartidos no se puede separar cuánto consultó cada integrante.', { x: 0.6, y: 6.25, w: 12.1, h: 0.45, fontFace: F, fontSize: 11, italic: true, color: C.gris, margin: 0, isTextBox: true });
  pie(s, 5, 'Fuente: Catálogo de Casos Estrella (HIL) y export de Vaults al 26 sep 2026.');
  s.addNotes('JC y RL muestran valor real en Vault aunque casi no usen Workflow: por eso el acompañamiento del trimestre parte de ahí.');
}

// 6. Nuevos reportes ---------------------------------------------------------------------------------
{
  const s = pres.addSlide();
  titulo(s, 'Nuevos reportes', 'Desde el corte del 21-25 sep: cálculo automático y un formato que se lee sin contexto');
  const pasos = [['Exports de Harvey', 'Se cargan cada viernes'], ['Cálculo automático', 'Mismas reglas cada semana, con pruebas contra los reportes aprobados'], ['14 reportes', 'Listos y revisados antes del lunes']];
  pasos.forEach(([t, d], i) => {
    const y = 1.85 + i * 1.6;
    s.addShape(pres.shapes.OVAL, { x: 0.6, y, w: 0.7, h: 0.7, fill: { color: C.navy }, line: { color: C.navy } });
    s.addText(String(i + 1), { x: 0.6, y, w: 0.7, h: 0.7, fontFace: F, fontSize: 20, bold: true, color: C.blanco, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addText(t, { x: 1.5, y: y - 0.02, w: 3.6, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.navy, margin: 0, isTextBox: true });
    s.addText(d, { x: 1.5, y: y + 0.38, w: 3.6, h: 0.8, fontFace: F, fontSize: 12, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
  });
  const rep = [['6', 'Champion', 'Triage semanal por persona'], ['6', 'Ejecutivo', 'Una página por Subdirección, con qué pedirle a cada Gerencia'], ['1', 'Dirección', 'Vista por Subdirección'], ['1', 'Gobierno de licencias', 'Uso por licencia, revisión mensual']];
  rep.forEach(([n, t, d], i) => {
    const x = 5.6 + (i % 2) * 3.65, y = 1.85 + Math.floor(i / 2) * 1.35;
    card(s, x, y, 3.45, 1.2);
    s.addText(n, { x: x + 0.2, y: y + 0.15, w: 0.8, h: 0.9, fontFace: F, fontSize: 36, bold: true, color: C.navy, margin: 0, valign: 'middle', isTextBox: true });
    s.addText([{ text: t, options: { bold: true, breakLine: true } }, { text: d, options: { fontSize: 11, color: C.gris } }], { x: x + 1.0, y: y + 0.15, w: 2.3, h: 0.9, fontFace: F, fontSize: 14, color: C.ink, margin: 0, valign: 'middle', isTextBox: true });
  });
  s.addText('Qué cambia', { x: 5.6, y: 4.65, w: 7, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.navy, margin: 0, isTextBox: true });
  bullets(s, [
    'Cada persona se compara contra su propio ritmo, no contra su equipo.',
    'La tabla se ordena por urgencia: primero a quién acompañar esta semana.',
    'Las ausencias documentadas no cuentan en contra de nadie.',
  ], 5.6, 5.1, 7.1, 1.7, 13);
  pie(s, 6, '');
  s.addNotes('Antes el cálculo se hacía a mano cada semana. Ahora vive en un repositorio privado con reglas documentadas y se valida contra los reportes ya aprobados. Los Champions recibieron el Playbook de lectura v3.');
}

// 7. Gobierno de licencias (tambien se exporta sola) --------------------------------------------------
function slideLicencias(n) {
  const s = pres.addSlide();
  titulo(s, 'Gobierno de licencias: revisión mensual', 'Cada mes identificamos qué licencias se aprovecharían más en otras manos');
  s.addText('Qué se toma en cuenta', { x: 0.6, y: 1.75, w: 5.2, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.navy, margin: 0, isTextBox: true });
  const crit = [
    ['Cada semana', 'Las 10 personas con menor uso, en dos listas: equipo jurídico y cuentas externas a la Dirección.'],
    ['Cada mes', 'Se suman las veces que cada persona aparece en esa lista durante el mes calendario.'],
    ['Candidato', '2 o más apariciones en el mismo mes.'],
    ['No cuentan', 'Vacaciones, incapacidades y eventos documentados de la Subdirección.'],
    ['Antes de decidir', 'Se revisa la tendencia de 8 semanas, para no confundir una semana atípica con falta de uso.'],
  ];
  crit.forEach(([t, d], i) => {
    const y = 2.3 + i * 0.8;
    s.addShape(pres.shapes.OVAL, { x: 0.6, y, w: 0.5, h: 0.5, fill: { color: C.navy }, line: { color: C.navy } });
    s.addText(String(i + 1), { x: 0.6, y, w: 0.5, h: 0.5, fontFace: F, fontSize: 14, bold: true, color: C.blanco, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addText([{ text: `${t}: `, options: { bold: true } }, { text: d }], { x: 1.3, y: y - 0.08, w: 4.6, h: 0.72, fontFace: F, fontSize: 12, color: C.ink, margin: 0, valign: 'middle', isTextBox: true });
  });
  s.addText('La lista es un insumo: la decisión se toma una vez al mes, en la sesión de KPIs, y la toma la Dirección.', { x: 0.6, y: 6.35, w: 5.3, h: 0.55, fontFace: F, fontSize: 12, bold: true, color: C.acento, margin: 0, isTextBox: true });

  s.addText('Ejemplo ilustrativo: octubre', { x: 6.3, y: 1.75, w: 6.4, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.navy, margin: 0, isTextBox: true });
  const c = (t, o = {}) => ({ text: t, options: { fontFace: F, fontSize: 11, color: C.ink, align: 'center', valign: 'middle', ...o } });
  const T = () => c('Top 10', { fill: { color: C.rojoF }, color: C.rojo, bold: true });
  const V = () => c('Vacaciones', { fill: { color: C.neutroF }, color: C.neutro, italic: true });
  const O = () => c('');
  const hdr = ['', '2 oct', '9 oct', '16 oct', '23 oct', '30 oct'].map((h) => c(h, { bold: true, color: C.blanco, fill: { color: C.navy } }));
  const rows = [hdr,
    [c('Persona A', { bold: true, align: 'left' }), O(), T(), O(), T(), O()],
    [c('Persona B', { bold: true, align: 'left' }), T(), O(), O(), O(), O()],
    [c('Persona C', { bold: true, align: 'left' }), O(), O(), V(), O(), T()],
  ];
  s.addTable(rows, { x: 6.3, y: 2.3, w: 6.4, colW: [1.4, 1.0, 1.0, 1.0, 1.0, 1.0], rowH: 0.5, border: { type: 'solid', pt: 0.5, color: C.grisClaro } });
  const res = [
    ['Persona A', '2 apariciones, es candidata para la sesión de noviembre.', C.rojoF, C.rojo],
    ['Persona B', '1 aparición, una semana atípica: no es candidata.', C.verdeF, C.verde],
    ['Persona C', '1 aparición, porque la semana de vacaciones no cuenta: no es candidata.', C.verdeF, C.verde],
  ];
  res.forEach(([p, t, fill, col], i) => {
    const y = 4.5 + i * 0.62;
    s.addShape(pres.shapes.RECTANGLE, { x: 6.3, y, w: 6.4, h: 0.52, fill: { color: fill }, line: { color: fill } });
    s.addText([{ text: `${p}: `, options: { bold: true } }, { text: t }], { x: 6.45, y, w: 6.15, h: 0.52, fontFace: F, fontSize: 12, color: col, valign: 'middle', margin: 0, isTextBox: true });
  });
  s.addText('Si hay empate en el lugar 10, entran todos los empatados.', { x: 6.3, y: 6.45, w: 6.4, h: 0.35, fontFace: F, fontSize: 10, italic: true, color: C.gris, margin: 0, isTextBox: true });
  pie(s, n, '');
  s.addNotes('Personas A, B y C son un ejemplo ilustrativo, no casos reales. El sistema empezó a contar el 25 de septiembre; octubre es el primer mes completo, así que la primera lista de candidatos llega a la sesión de KPIs de noviembre.');
  return s;
}
slideLicencias(7);

// 8. Harvey 2.0 ---------------------------------------------------------------------------------
{
  const s = pres.addSlide();
  titulo(s, 'Harvey 2.0 (Harvey II)', 'Nueva generación de la plataforma, anunciada por Harvey el 18 de agosto de 2026');
  const feats = [
    ['Memoria', 'Aprende cómo trabaja cada abogado y lleva sus preferencias a Harvey, Word, Outlook y los agentes.'],
    ['Spaces', 'Un espacio por asunto o proyecto: documentos, tareas, permisos e historial en un solo lugar.'],
    ['Agentes con contexto', 'Los agentes arrancan con la información del asunto y las preferencias del usuario ya cargadas.'],
  ];
  feats.forEach(([t, d], i) => {
    const x = 0.6 + i * 4.1;
    card(s, x, 1.85, 3.9, 2.35);
    s.addText(t, { x: x + 0.3, y: 2.05, w: 3.3, h: 0.5, fontFace: F, fontSize: 18, bold: true, color: C.navy, margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.3, y: 2.6, w: 3.3, h: 1.5, fontFace: F, fontSize: 13, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
  });
  s.addText('Por qué importa para Gentera', { x: 0.6, y: 4.5, w: 6, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.navy, margin: 0, isTextBox: true });
  bullets(s, [
    `Word y Outlook ya son ${M.sep.mezcla_pct.Wo + M.sep.mezcla_pct.O}% del uso: ahí la Memoria rinde primero.`,
    'Spaces encaja con el trabajo por expediente de Contencioso y Laboral.',
    'Menos tiempo explicando el contexto en cada consulta.',
  ], 0.6, 4.95, 6.2, 1.9, 13);
  s.addText('Despliegue anunciado de la Memoria', { x: 7.2, y: 4.5, w: 5.6, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.navy, margin: 0, isTextBox: true });
  const fases = [['1', 'Personal', 'Acceso anticipado'], ['2', 'Spaces', 'Próximos meses'], ['3', 'Organización', 'Toda la firma']];
  fases.forEach(([n, t, d], i) => {
    const x = 7.2 + i * 1.9;
    s.addShape(pres.shapes.OVAL, { x, y: 5.0, w: 0.5, h: 0.5, fill: { color: C.acento }, line: { color: C.acento } });
    s.addText(n, { x, y: 5.0, w: 0.5, h: 0.5, fontFace: F, fontSize: 14, bold: true, color: C.blanco, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addText([{ text: t, options: { bold: true, breakLine: true } }, { text: d, options: { color: C.gris, fontSize: 11 } }], { x, y: 5.6, w: 1.8, h: 0.8, fontFace: F, fontSize: 13, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
  });
  s.addText('Fechas de habilitación para Gentera: por confirmar con Harvey.', { x: 7.2, y: 6.45, w: 5.6, h: 0.35, fontFace: F, fontSize: 11, italic: true, color: C.acento, margin: 0, isTextBox: true });
  pie(s, 8, 'Fuente: anuncio público de Harvey II (Artificial Lawyer y Global Legal Post, 18 ago 2026).');
  s.addNotes('Lo público: Harvey II se anunció el 18 ago 2026 con Memoria, Spaces y agentes con contexto; la Memoria se despliega en tres fases (personal, Spaces, organización). No tenemos confirmado cuándo se habilita en nuestro workspace: es el punto a cerrar con Harvey.');
}

// 8. KPIs ---------------------------------------------------------------------------------
{
  const s = pres.addSlide();
  titulo(s, 'KPIs de negocio', '6 de 12 ya en meta de 1 año; 1 en meta de 6 meses; 4 avanzando; 1 sin medición todavía');
  const E = {
    m1: ['Meta 1 año', C.verdeF, C.verde], m6: ['Meta 6 meses', C.verdeF, C.verde],
    av: ['Avanzando', C.amarF, C.amar], sm: ['Sin medición', C.neutroF, C.neutro],
  };
  const K = [
    ['ENN', 'Revisión de contratos (workflow)', '48 min', '10.4 min', '4 min', 'av'],
    ['ENN', 'Ahorro en despachos (REPSE)', '7 abogados', '2 abogados', '2 abogados', 'm1'],
    ['CN', 'Análisis de oficios de autoridad', '20 días', '7.8 días', '10 días', 'm1'],
    ['CN', 'Optimización de productos', '60 días', '28 días *', '45 días', 'm1'],
    ['RL', 'Reportería de bajas', '5 días', '0.76 días', '1 día', 'm1'],
    ['RL', 'Reportería contenciosa laboral', '3 días', '3.4 horas', '3 horas', 'm6'],
    ['PLD', 'Análisis de hits en listas', '3 días', '0.05 días', '1 día', 'm1'],
    ['PLD', 'Oficios de requerimiento', '8 horas', '24 min', '3 horas', 'm1'],
    ['GC', 'Documentos corporativos', '2-6 horas', '1.2-3.6 horas', '30 min', 'av'],
    ['GC', 'Formatos de marcas', '1 hora', '24 min', '10 min', 'av'],
    ['JC', 'Análisis de demandas y oficios', '24-36 horas', '20-24 horas', '5 horas', 'av'],
    ['JC', 'Licencias y permisos de inmuebles', '18 horas', 'Sin dato', '2 horas', 'sm'],
  ];
  const c = (t, o = {}) => ({ text: t, options: { fontFace: F, fontSize: 11, color: C.ink, valign: 'middle', ...o } });
  const rows = [['SD', 'KPI', 'Punto de partida', 'Real más reciente', 'Meta 1 año', 'Estado'].map((h, i) => c(h, { bold: true, color: C.blanco, fill: { color: C.navy }, align: i >= 2 ? 'center' : 'left' }))];
  K.forEach(([sd, k, b, r, m, e], i) => {
    const fill = i % 2 ? { color: C.ice } : undefined;
    rows.push([c(sd, { fill, bold: true }), c(k, { fill }), c(b, { fill, align: 'center' }), c(r, { fill, align: 'center', bold: true }), c(m, { fill, align: 'center' }),
      c(E[e][0], { fill: { color: E[e][1] }, color: E[e][2], bold: true, align: 'center' })]);
  });
  s.addTable(rows, { x: 0.6, y: 1.7, w: 12.1, colW: [0.8, 4.3, 1.75, 1.95, 1.55, 1.75], rowH: 0.37, border: { type: 'solid', pt: 0.5, color: C.grisClaro } });
  pie(s, 9, 'Fuente: tablero de KPIs por SD (Notion), reales de ago-sep 2026 reportados por cada Champion. * Una sola medición; muestra no representativa todavía.');
  s.addNotes('GC reporta avance de madurez del workflow y de ahí se estima el tiempo; no es un tiempo medido directo. El KPI de licencias de JC sigue pendiente de aclarar su alcance. Los KPIs de CN tienen una propuesta de cambio pendiente de aprobación con Planeación y Finanzas.');
}

// 10. Modelo de operacion: quien hace que (tambien se exporta sola) -----------------------------------
function slideRoles(n) {
  const s = pres.addSlide();
  titulo(s, 'Cómo llegamos: quién hace qué', 'Cada nivel tiene una tarea concreta cada semana y cada mes');
  const R = [
    ['Champion', 'Uno por Subdirección', 'Acompaña a su equipo en el día a día.',
      ['Cierra cada semana la tarea "Antes del próximo corte".', 'Da sesiones y construye casos de uso con su equipo.', 'Avisa ausencias y reporta los reales de KPIs cada mes.'],
      'Reporte Champion, cada lunes'],
    ['Subdirección', 'Subdirectores y Gerentes', 'Es dueña de la adopción y de los KPIs de su área.',
      ['Pide a cada Gerencia lo que sugiere su reporte.', 'Prioriza qué procesos convertir en Workflow.', 'Valida los reales de sus KPIs.'],
      'Reporte Ejecutivo, cada lunes'],
    ['Dirección Jurídica', 'Directora Jurídica', 'Fija el rumbo y decide.',
      ['Revisa el avance en la junta mensual.', 'Decide la reasignación de licencias.', 'Destraba lo que depende de otras áreas: Planeación y Finanzas, TI.'],
      'Reporte de Dirección y junta mensual'],
    ['Coordinación Harvey', 'Gerencia Contratos TI & AI', 'Mide, conecta y habilita.',
      ['Genera y valida los 14 reportes cada semana.', 'Coordina a los Champions y la relación con Harvey, incluido Harvey 2.0.', 'Consolida KPIs y prepara la lista mensual de licencias.'],
      'Datos de Harvey, ausencias y reales de KPIs'],
  ];
  const cw = 2.9, gap = 0.17;
  R.forEach(([rol, quien, papel, hace, recibe], i) => {
    const x = 0.6 + i * (cw + gap);
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.7, w: cw, h: 0.85, fill: { color: C.navy }, line: { color: C.navy } });
    s.addText([{ text: rol, options: { bold: true, fontSize: 16, breakLine: true } }, { text: quien, options: { fontSize: 11, color: C.ice2 } }],
      { x: x + 0.2, y: 1.7, w: cw - 0.4, h: 0.85, fontFace: F, color: C.blanco, valign: 'middle', margin: 0, isTextBox: true });
    card(s, x, 2.55, cw, 3.55);
    s.addText(papel, { x: x + 0.2, y: 2.7, w: cw - 0.4, h: 0.55, fontFace: F, fontSize: 13, bold: true, color: C.acento, margin: 0, valign: 'top', isTextBox: true });
    bullets(s, hace, x + 0.2, 3.3, cw - 0.4, 2.1, 12);
    s.addText([{ text: 'Recibe: ', options: { bold: true } }, { text: recibe }], { x: x + 0.2, y: 5.5, w: cw - 0.4, h: 0.5, fontFace: F, fontSize: 11, color: C.gris, margin: 0, valign: 'top', isTextBox: true });
  });
  const ciclo = [['Cada semana', 'Datos de Harvey el viernes, reportes el lunes, el Champion actúa y avisa ausencias.'],
    ['Cada mes', 'Reales de KPIs, lista de licencias y junta con la Dirección.'],
    ['Cada trimestre', 'Revisión y ajuste del plan de trabajo.']];
  ciclo.forEach(([t, d], i) => {
    const x = 0.6 + i * 4.1;
    s.addText([{ text: `${t}: `, options: { bold: true, color: C.navy } }, { text: d }], { x, y: 6.25, w: 3.95, h: 0.6, fontFace: F, fontSize: 11, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
  });
  pie(s, n, '');
  s.addNotes('Propuesta de modelo de operación. El Champion ejecuta y acompaña; la Subdirección pide y prioriza; la Dirección decide y destraba; la coordinación mide, conecta con Harvey y prepara la información para decidir.');
  return s;
}
slideRoles(10);

// 11. Plan de trabajo ---------------------------------------------------------------------------------
{
  const s = pres.addSlide();
  titulo(s, 'Plan de trabajo', 'Octubre a diciembre de 2026');
  const cols = [
    ['Octubre', ['Primer mes completo con los nuevos reportes semanales.', 'Primera revisión mensual de licencias, junto con los KPIs.', 'Carga de reales de KPIs de septiembre y octubre.']],
    ['Noviembre', ['Acompañamiento a Contencioso y Laboral con casos de uso del negocio, partiendo de sus Vaults.', 'Confirmar con Harvey la habilitación de Harvey 2.0 y pilotear Memoria y Spaces con Champions.']],
    ['Diciembre', ['Formalizar los KPIs de Cumplimiento Normativo con Planeación y Finanzas.', 'Definir el alcance del KPI de licencias de inmuebles (JC).', 'Cierre de año: casos de impacto documentados por Subdirección.']],
  ];
  cols.forEach(([t, items], i) => {
    const x = 0.6 + i * 4.1;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.8, w: 3.9, h: 0.6, fill: { color: C.navy }, line: { color: C.navy } });
    s.addText(t, { x: x + 0.25, y: 1.8, w: 3.4, h: 0.6, fontFace: F, fontSize: 16, bold: true, color: C.blanco, valign: 'middle', margin: 0, isTextBox: true });
    card(s, x, 2.4, 3.9, 3.0);
    bullets(s, items, x + 0.25, 2.6, 3.4, 2.7, 13);
  });
  s.addText('Continuo: seguimiento con Harvey a la estabilidad de los Workflows y con TI a la integración con SharePoint.  |  Marzo 2027: reporte de ahorro en tiempos (Fase 4).', { x: 0.6, y: 5.7, w: 12.1, h: 0.5, fontFace: F, fontSize: 12, color: C.gris, margin: 0, isTextBox: true });
  pie(s, 11, '');
  s.addNotes('El foco en JC y RL responde a lo que reportan las propias Subdirecciones: menos utilidad percibida porque la capacitación inicial fue muy de contratos. El plan es construir casos de uso con su contexto de negocio.');
}

// 10. Cierre ---------------------------------------------------------------------------------
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  s.addText('Lo que necesitamos de la Dirección', { x: 0.8, y: 1.0, w: 11.5, h: 0.8, fontFace: F, fontSize: 32, bold: true, color: C.blanco, margin: 0, isTextBox: true });
  const pedidos = [
    ['Harvey 2.0', 'Aval para pilotear Memoria y Spaces con los Champions en cuanto Harvey lo habilite.'],
    ['KPIs de CN', 'Agenda con Planeación y Finanzas para aprobar la actualización pendiente.'],
    ['Licencias', 'Validar la revisión mensual de uso como base para reasignar licencias.'],
  ];
  pedidos.forEach(([t, d], i) => {
    const y = 2.3 + i * 1.35;
    s.addShape(pres.shapes.OVAL, { x: 0.8, y, w: 0.7, h: 0.7, fill: { color: C.acento }, line: { color: C.acento } });
    s.addText(String(i + 1), { x: 0.8, y, w: 0.7, h: 0.7, fontFace: F, fontSize: 20, bold: true, color: C.blanco, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addText([{ text: t, options: { bold: true, breakLine: true, fontSize: 18 } }, { text: d, options: { color: C.ice2, fontSize: 15 } }], { x: 1.8, y: y - 0.1, w: 10.5, h: 1.0, fontFace: F, color: C.blanco, margin: 0, valign: 'top', isTextBox: true });
  });
  s.addText('José Antonio Bueno Díaz  |  Gerente Contratos TI & AI', { x: 0.8, y: 6.5, w: 11.5, h: 0.4, fontFace: F, fontSize: 13, color: C.ice2, margin: 0, isTextBox: true });
}

pres.writeFile({ fileName: OUT }).then(() => {
  console.log('OK:', OUT);
  // Lamina de licencias sola, para insertarla en otra presentacion
  pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  slideLicencias('');
  const solo2 = OUT.replace(/\.pptx$/, '_lamina_roles.pptx');
  const solo = OUT.replace(/\.pptx$/, '_lamina_licencias.pptx');
  return pres.writeFile({ fileName: solo }).then(() => {
    console.log('OK:', solo);
    pres = new pptxgen();
    pres.layout = 'LAYOUT_WIDE';
    slideRoles('');
    return pres.writeFile({ fileName: solo2 }).then(() => console.log('OK:', solo2));
  });
});
