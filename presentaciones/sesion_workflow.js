/**
 * Sesion abierta de Workflow, semana 12-16 oct 2026 (coordina Tony; Jean Cub Najera no puede esta semana).
 * Datos: out/WF_sesion_<corte>.json (presentaciones/datos_workflow.py). Guion en las notas de cada lamina.
 * Uso: node presentaciones/sesion_workflow.js out/WF_sesion_2026-10-09.json out/Sesion_Workflow_oct2026.pptx
 */
const fs = require('fs');
const pptxgen = require('pptxgenjs');

const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const OUT = process.argv[3] || 'out/Sesion_Workflow_oct2026.pptx';
const C = {
  navy: '1F3864', ice: 'EBF3FB', ice2: 'D6E4F0', ink: '1A1A1A', gris: '595959', grisClaro: 'BFBFBF',
  blanco: 'FFFFFF', acento: 'C55A11', acentoF: 'FBE5D6',
};
const F = 'Arial';
const W = 13.33;
const ses = D.sesion;
const comp = D.compartidos;
const cr = D.creados_dj;
const nConstruyen = Object.keys(D.construyen).length;
const pruebas = (n) => D.construyen[n] || 0;
const wfDe = (n) => Object.keys(D.expertos_workflows[n] || {}).filter((w) => !/eliminar|\(\d+\)$/i.test(w));

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'José Antonio Bueno Díaz';
pres.title = 'Workflow: de la tarea repetida al workflow';

const T = (s, text, o) => s.addText(text, { fontFace: F, color: C.ink, margin: 0, isTextBox: true, valign: 'top', ...o });
function titulo(s, t, sub) {
  T(s, t, { x: 0.6, y: 0.4, w: W - 1.2, h: 0.7, fontSize: 30, bold: true, color: C.navy, valign: 'middle' });
  if (sub) T(s, sub, { x: 0.6, y: 1.1, w: W - 1.2, h: 0.4, fontSize: 14, color: C.gris });
}
function pie(s, n, fuente) {
  T(s, fuente || '', { x: 0.6, y: 7.0, w: 11, h: 0.3, fontSize: 9, color: C.gris });
  T(s, String(n), { x: W - 1.1, y: 7.0, w: 0.5, h: 0.3, fontSize: 9, color: C.gris, align: 'right' });
}
const card = (s, x, y, w, h, fill) => s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: fill || C.ice }, line: { color: fill || C.ice } });
const circulo = (s, x, y, d, txt, fill, color) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
  T(s, txt, { x, y, w: d, h: d, fontSize: d > 0.7 ? 22 : 16, bold: true, color, align: 'center', valign: 'middle' });
};
const FUENTE = `Fuente: export de uso de Harvey del 10 sep al 9 oct 2026 y export de workflows y agentes al 9 oct; universo de ${D.universo} personas de las 6 Subdirecciones.`;

// 1. Portada
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  T(s, 'Harvey AI × Gentera', { x: 0.8, y: 1.9, w: 11.5, h: 0.5, fontSize: 18, color: C.ice2 });
  T(s, 'De la tarea repetida al workflow', { x: 0.8, y: 2.4, w: 11.5, h: 1.0, fontSize: 44, bold: true, color: C.blanco });
  T(s, 'Sesión abierta de Workflow  |  Semana del 12 al 16 de octubre de 2026', { x: 0.8, y: 3.5, w: 11.5, h: 0.5, fontSize: 20, color: C.ice2 });
  T(s, 'José Antonio Bueno Díaz  |  Gerente Contratos TI & AI', { x: 0.8, y: 6.3, w: 11.5, h: 0.4, fontSize: 13, color: C.blanco });
  s.addNotes(`[1 min] Bienvenida. Objetivo de hoy: que cada quien salga con una tarea suya identificada para convertirla en workflow, y que lo que ya existe en la DJ se comparta. Duración sugerida: 45 minutos. Expertos que acompañan: ${ses.expertos.filter((e) => !e.startsWith('Jean')).map((e) => e.split(' (')[0]).join(' y ')}.`);
}

// 2. Donde estamos
{
  const s = pres.addSlide();
  titulo(s, 'La DJ ya construye workflows; falta que viajen', 'Últimos 30 días');
  const stats = [
    [`${D.personas_con_workflow} de ${D.universo}`, 'personas usaron Workflow'],
    [String(nConstruyen), 'personas construyen o prueban sus propios workflows'],
    [`${cr.workflows_borrador} de ${cr.workflows}`, 'workflows creados en la DJ siguen en borrador, sin publicar'],
    [`${D.workflows_una_persona} de ${D.workflows_en_uso}`, 'workflows en uso los usa una sola persona'],
  ];
  const cw = 2.85, gap = 0.2;
  stats.forEach(([b, l], i) => {
    const x = 0.6 + i * (cw + gap);
    card(s, x, 1.85, cw, 2.5, i >= 2 ? C.acentoF : C.ice);
    T(s, b, { x: x + 0.25, y: 2.05, w: cw - 0.5, h: 0.9, fontSize: 40, bold: true, color: i >= 2 ? C.acento : C.navy, valign: 'middle' });
    T(s, l, { x: x + 0.25, y: 3.0, w: cw - 0.5, h: 1.2, fontSize: 14 });
  });
  T(s, 'Lo que esto quiere decir', { x: 0.6, y: 4.75, w: 6, h: 0.4, fontSize: 18, bold: true, color: C.navy });
  T(s, [
    { text: 'Saber construir ya no es el problema: hay workflows útiles hechos por gente de la DJ.', options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: 'Lo que se construye se queda con quien lo hizo. Un workflow que nadie más corre ahorra tiempo a una persona, no al equipo.', options: { bullet: true } },
  ], { x: 0.6, y: 5.2, w: 12.1, h: 1.6, fontSize: 15 });
  pie(s, 2, FUENTE);
  s.addNotes(`[4 min] Arrancar con el dato positivo: ${D.personas_con_workflow} personas ya usaron Workflow y ${nConstruyen} están construyendo los suyos. El punto de la sesión está en las tarjetas naranjas: de ${cr.workflows} workflows creados en la DJ, los ${cr.workflows_borrador} siguen en borrador (${cr.workflows_sin_nombre} todavía se llaman "Nuevo Workflow"), y ${D.workflows_una_persona} de los ${D.workflows_en_uso} workflows en uso los corre una sola persona. Mensaje: hoy no venimos a aprender a construir desde cero, venimos a que lo bueno se comparta. Cifras sin Assist ni los complementos de Word y Outlook, que el export registra como workflows.`);
}

// 3. La senal
{
  const s = pres.addSlide();
  titulo(s, '¿Tu tarea ya es un workflow?', 'Si cumple 3 de las 4 señales, sí');
  const sen = [
    ['Se repite', 'La haces cada semana, o varias veces al mes.'],
    ['Empieza igual', 'Copias y pegas el mismo prompt al abrir el hilo.'],
    ['Misma entrada', 'El insumo es el mismo tipo de documento: oficio, contrato, resolución, expediente.'],
    ['Salida con forma fija', 'Siempre entregas lo mismo: una tabla, una ficha, un párrafo con estructura.'],
  ];
  sen.forEach(([h, d], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + col * 4.1, y = 1.85 + row * 2.3;
    card(s, x, y, 3.9, 2.1);
    circulo(s, x + 0.25, y + 0.3, 0.6, String(i + 1), C.navy, C.blanco);
    T(s, h, { x: x + 1.05, y: y + 0.3, w: 2.65, h: 0.6, fontSize: 18, bold: true, color: C.navy, valign: 'middle' });
    T(s, d, { x: x + 0.25, y: y + 1.05, w: 3.45, h: 0.95, fontSize: 14 });
  });
  card(s, 9.0, 1.85, 3.75, 4.4, C.navy);
  T(s, String(D.tarea_repetida.length), { x: 9.3, y: 2.1, w: 3.2, h: 1.1, fontSize: 60, bold: true, color: C.blanco });
  T(s, 'personas en la DJ abren más de la mitad de sus hilos de Assistant con la misma instrucción.', { x: 9.3, y: 3.25, w: 3.2, h: 1.4, fontSize: 15, color: C.blanco });
  T(s, 'Son tareas listas para volverse workflow: extraer los mismos datos de cada documento, pasar una tabla a párrafo, revisar contra el mismo criterio.', { x: 9.3, y: 4.65, w: 3.2, h: 1.5, fontSize: 12, color: C.ice2 });
  pie(s, 3, 'Fuente: hilos de Assistant de los últimos 30 días; misma instrucción = mismas primeras 8 palabras en al menos la mitad de 10 o más hilos.');
  s.addNotes('[5 min] Pedir que cada quien piense en su tarea más repetida mientras explicas las 4 señales. La segunda señal es la más fácil de detectar: si tienes un prompt guardado en un Word para pegarlo cada vez, eso ya es un workflow esperando. No nombrar a nadie en la sesión: los casos se trabajan en lo individual con su Champion. Ejemplos genéricos para la sala: extraer los mismos datos de cada documento (fecha, partes, monto), pasar una tabla a párrafo redactado, revisar un documento contra el mismo criterio normativo.');
}

// 4. Cuando viaja
{
  const s = pres.addSlide();
  titulo(s, 'Así se ve un workflow que viaja', 'Workflows que usan 2 o más personas, últimos 30 días');
  s.addChart(pres.charts.BAR, [{ name: 'Personas', labels: comp.map((c) => c.nombre), values: comp.map((c) => c.personas) }], {
    x: 0.5, y: 1.7, w: 7.9, h: 5.0, barDir: 'bar', chartColors: [C.navy], barGapWidthPct: 40,
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 12, dataLabelColor: C.ink, dataLabelFontFace: F,
    catAxisLabelFontSize: 11, catAxisLabelColor: C.ink, catAxisLabelFontFace: F, catAxisOrientation: 'maxMin',
    valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showLegend: false,
    showTitle: true, title: 'Personas que lo usan', titleFontSize: 12, titleColor: C.gris, titleFontFace: F,
  });
  const v = comp[0];
  card(s, 8.8, 1.7, 4.0, 5.0);
  T(s, v.nombre, { x: 9.05, y: 1.9, w: 3.5, h: 0.8, fontSize: 18, bold: true, color: C.navy });
  T(s, String(v.personas), { x: 9.05, y: 2.75, w: 1.6, h: 0.8, fontSize: 40, bold: true, color: C.navy });
  T(s, 'personas', { x: 9.05, y: 3.55, w: 1.6, h: 0.4, fontSize: 13 });
  T(s, String(v.acciones), { x: 10.9, y: 2.75, w: 1.6, h: 0.8, fontSize: 40, bold: true, color: C.navy });
  T(s, 'usos en 30 días', { x: 10.9, y: 3.55, w: 1.7, h: 0.4, fontSize: 13 });
  T(s, `Lo usan ${v.sd.length} Subdirecciones. Se hizo una vez y lo corre todo el que tiene el mismo problema.`, { x: 9.05, y: 4.2, w: 3.5, h: 1.1, fontSize: 14 });
  T(s, `Del otro lado: ${D.workflows_una_persona} workflows que hoy solo usa quien los hizo.`, { x: 9.05, y: 5.4, w: 3.5, h: 1.1, fontSize: 14, bold: true, color: C.acento });
  pie(s, 4, FUENTE);
  s.addNotes(`[4 min] El Validador de Expedientes Legales es el modelo: ${v.personas} personas, ${v.acciones} usos en 30 días. Los otros que ya viajan: ${comp.slice(1).map((c) => c.nombre).join('; ')}. Contraste: entre los que usa una sola persona hay workflows con mucho uso, por ejemplo ${D.top_individuales.slice(0, 4).map((t) => `${t.nombre} (${t.acciones} usos)`).join(', ')}. Pregunta a la sala: ¿cuántos de ustedes harían esa misma tarea si supieran que existe?`);
}

// 5. Cuatro pasos
{
  const s = pres.addSlide();
  titulo(s, 'De tu mejor hilo a un workflow, en 4 pasos');
  const pasos = [
    ['Elige tu mejor hilo', 'El hilo de Assistant donde la respuesta te sirvió tal cual. Ese prompt es tu punto de partida.'],
    ['Separa lo fijo de lo variable', 'Fijo: instrucciones, criterio, formato de salida. Variable: el documento de cada vez.'],
    ['Prueba con 3 casos reales', 'Compara contra lo que harías a mano. Ajusta las instrucciones hasta que no tengas que corregir.'],
    ['Publícalo y compártelo', 'Ponle nombre claro y compártelo con tu equipo. Un borrador solo te sirve a ti.'],
  ];
  const cw = 2.85, gap = 0.2;
  pasos.forEach(([h, d], i) => {
    const x = 0.6 + i * (cw + gap);
    card(s, x, 1.7, cw, 4.2, i === 3 ? C.acentoF : C.ice);
    circulo(s, x + 0.25, 1.95, 0.8, String(i + 1), i === 3 ? C.acento : C.navy, C.blanco);
    T(s, h, { x: x + 0.25, y: 2.95, w: cw - 0.5, h: 0.9, fontSize: 18, bold: true, color: i === 3 ? C.acento : C.navy });
    T(s, d, { x: x + 0.25, y: 3.9, w: cw - 0.5, h: 2.2, fontSize: 14 });
  });
  T(s, `El paso 4 es el que falta hoy en la DJ: ${cr.workflows_borrador} de ${cr.workflows} workflows siguen en borrador.`, { x: 0.6, y: 6.25, w: 12.1, h: 0.4, fontSize: 14, bold: true, color: C.acento });
  pie(s, 5, '');
  s.addNotes('[6 min] Recorrer los 4 pasos con calma. Paso 2 es donde se gana o se pierde: lo fijo va en las instrucciones del workflow; lo variable es lo que el usuario sube cada vez. Paso 3: tres casos reales, no ejemplos inventados. Paso 4: insistir en nombre claro (10 de los workflows de la DJ siguen como "Nuevo Workflow") y en compartirlo con el equipo. Los expertos muestran en la demo dónde se hace cada paso en Harvey.');
}

// 6. Demo
{
  const s = pres.addSlide();
  titulo(s, 'Demo en vivo', 'De un hilo de Assistant a un workflow publicado');
  const exp = ses.expertos.filter((e) => !e.startsWith('Jean')).map((e) => {
    const [n, rest] = e.split(' (');
    return { n, sd: rest.split(',')[0] };
  });
  exp.forEach((e, i) => {
    const x = 0.6 + i * 6.15;
    card(s, x, 1.85, 5.95, 3.4);
    circulo(s, x + 0.3, 2.1, 0.9, e.n.split(' ').filter((p) => p[0] === p[0].toUpperCase()).slice(0, 2).map((p) => p[0]).join(''), C.navy, C.blanco);
    T(s, e.n, { x: x + 1.4, y: 2.1, w: 4.3, h: 0.55, fontSize: 18, bold: true, color: C.navy, valign: 'middle' });
    T(s, e.sd, { x: x + 1.4, y: 2.65, w: 4.3, h: 0.4, fontSize: 14, color: C.gris });
    const wf = wfDe(e.n);
    const txt = wf.length
      ? `Construye y usa sus propios workflows: ${wf.slice(0, 3).join(', ')}.`
      : `Está construyendo y probando workflows nuevos en ${e.sd}.`;
    T(s, txt, { x: x + 0.3, y: 3.3, w: 5.35, h: 1.0, fontSize: 14 });
    T(s, `${pruebas(e.n)} pruebas de construcción en 30 días`, { x: x + 0.3, y: 4.4, w: 5.35, h: 0.5, fontSize: 14, bold: true, color: C.navy });
  });
  T(s, 'Qué vamos a ver', { x: 0.6, y: 5.55, w: 6, h: 0.4, fontSize: 18, bold: true, color: C.navy });
  T(s, 'Dónde se crea el workflow, cómo se escriben las instrucciones fijas, cómo se prueba y cómo se publica y comparte.', { x: 0.6, y: 6.0, w: 12.1, h: 0.6, fontSize: 15 });
  pie(s, 6, 'Expertos: las personas con más uso de Workflow por semana en las últimas 5 semanas, sin alertas de uso.');
  s.addNotes(`[12 min] Dar la palabra a los expertos, 6 minutos cada uno. Pedirles que lleguen con un workflow suyo ya hecho y que muestren los 4 pasos, sobre todo cómo se publica y se comparte (paso 4). Jean Cub Nájera (RL) es experto de Workflow pero no puede esta semana. Si un experto no puede, la demo la hace el otro con dos workflows.`);
}

// 7. Ejercicio
{
  const s = pres.addSlide();
  titulo(s, 'Ejercicio: tu primera tarea', '10 minutos. Llénalo con una tarea tuya real');
  const filas = [
    ['La tarea que repito', 'Ej.: extraer partes, montos y fechas de cada oficio que llega'],
    ['Cada cuánto', 'Ej.: 5 veces por semana'],
    ['Qué entra', 'Ej.: el oficio en PDF'],
    ['Lo fijo (instrucciones)', 'Ej.: qué datos buscar y cómo marcar los faltantes'],
    ['Qué sale', 'Ej.: tabla con una fila por oficio'],
    ['Con quién lo comparto', 'Ej.: mi gerencia'],
  ];
  filas.forEach(([h, ej], i) => {
    const y = 1.75 + i * 0.8;
    card(s, 0.6, y, 3.6, 0.65, C.navy);
    T(s, h, { x: 0.8, y, w: 3.3, h: 0.65, fontSize: 15, bold: true, color: C.blanco, valign: 'middle' });
    card(s, 4.3, y, 8.45, 0.65);
    T(s, ej, { x: 4.5, y, w: 8.1, h: 0.65, fontSize: 14, italic: true, color: C.gris, valign: 'middle' });
  });
  pie(s, 7, '');
  s.addNotes('[10 min] Cada quien llena la plantilla en su cuaderno o en un chat consigo mismo. Al minuto 7, pedir 2 o 3 voluntarios que lean la suya; los expertos dicen en voz alta si ya existe un workflow parecido en la DJ (por ejemplo, extractores de datos de oficios y resoluciones). Si existe, la tarea es pedirlo, no construirlo de nuevo.');
}

// 8. Compromiso
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  T(s, 'Compromiso', { x: 0.6, y: 0.4, w: W - 1.2, h: 0.7, fontSize: 30, bold: true, color: C.blanco, valign: 'middle' });
  T(s, 'Antes del 30 de octubre: un workflow publicado y usado por al menos otra persona de tu equipo.', { x: 0.6, y: 1.4, w: 12.1, h: 1.0, fontSize: 24, color: C.blanco });
  card(s, 0.6, 2.8, 5.9, 2.6, C.blanco);
  T(s, String(comp.length), { x: 0.9, y: 3.0, w: 2, h: 1.1, fontSize: 60, bold: true, color: C.navy });
  T(s, 'workflows usados por 2 o más personas hoy. Lo volvemos a medir en el corte del 30 de octubre.', { x: 0.9, y: 4.15, w: 5.3, h: 1.1, fontSize: 15 });
  card(s, 6.85, 2.8, 5.9, 2.6, C.blanco);
  T(s, 'Siguientes sesiones', { x: 7.15, y: 3.0, w: 5.3, h: 0.5, fontSize: 18, bold: true, color: C.navy });
  T(s, [
    { text: 'Assistant: instrucciones que sí funcionan (19-23 oct)', options: { bullet: true, breakLine: true, paraSpaceAfter: 6 } },
    { text: 'Word y Playbook (19-23 oct)', options: { bullet: true, breakLine: true, paraSpaceAfter: 6 } },
    { text: 'Vault: repositorios y bases compartidas (26-30 oct)', options: { bullet: true } },
  ], { x: 7.15, y: 3.55, w: 5.4, h: 1.7, fontSize: 15 });
  T(s, '¿Dudas? Tu Champion o los expertos de hoy.', { x: 0.6, y: 5.9, w: 12.1, h: 0.5, fontSize: 16, color: C.ice2 });
  pie(s, 8, '');
  s.addNotes(`[3 min] Cerrar con un solo compromiso, medible en el pipeline: workflows usados por 2 o más personas (hoy ${comp.length}). Recordar el calendario y que cada Champion da seguimiento en su equipo. Si se manda encuesta, avisar aquí que llega por correo.`);
}

pres.writeFile({ fileName: OUT }).then(() => console.log('OK:', OUT));
