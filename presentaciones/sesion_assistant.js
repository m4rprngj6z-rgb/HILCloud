/**
 * Sesion abierta de Assistant, jue 5 nov 2026 13:00. La da Tony (30 oct 2026), en lugar de Karime.
 * Tema: instrucciones que si funcionan (3P = Proposito, Parametros, Profundidad). Guion en las notas.
 * Datos: estado/<viernes>/CAP_<viernes>.json (capacitacion.py) y <SD>_<viernes>.json (uso de la semana).
 * Uso: node presentaciones/sesion_assistant.js estado/2026-10-30 2026-10-30 out/Sesion_Assistant_5nov2026.pptx
 */
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const DIR = process.argv[2];
const V = process.argv[3];
const OUT = process.argv[4] || 'out/Sesion_Assistant_5nov2026.pptx';
const CAP = JSON.parse(fs.readFileSync(path.join(DIR, `CAP_${V}.json`), 'utf8'));
const SDS = ['ENN', 'CN', 'PLD', 'GC', 'JC', 'RL'];
let accA = 0, acc = 0, usanA = 0;
for (const sd of SDS) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, `${sd}_${V}.json`), 'utf8'));
  for (const r of d.rows) { accA += r.a || 0; acc += r.total || 0; if ((r.a || 0) > 0) usanA += 1; }
}
const A = CAP.herramientas.find((h) => h.herramienta === 'A');
const universo = CAP.personas;
const conA = universo - A.sin_uso;
const pctA = Math.round((100 * accA) / acc);
const calidad = CAP.assistant_calidad;
const minimas = calidad.instrucciones_minimas.map((p) => p.pal_inicial).sort((a, b) => a - b);
const medMin = Math.round(minimas[Math.floor(minimas.length / 2)]);
const rep = [...calidad.tarea_repetida].sort((a, b) => b.hilos_repetidos - a.hilos_repetidos)[0];

const C = { navy: '1F3864', ice: 'EBF3FB', ice2: 'D6E4F0', ink: '1A1A1A', gris: '595959', blanco: 'FFFFFF', acento: 'C55A11', acentoF: 'FBE5D6', verde: '375623', verdeF: 'E2EFDA' };
const F = 'Arial';
const W = 13.33;
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'José Antonio Bueno Díaz';
pres.title = 'Assistant: instrucciones que sí funcionan';
const T = (s, text, o) => s.addText(text, { fontFace: F, color: C.ink, margin: 0, isTextBox: true, valign: 'top', ...o });
const titulo = (s, t, sub) => {
  T(s, t, { x: 0.6, y: 0.4, w: W - 1.2, h: 0.7, fontSize: 30, bold: true, color: C.navy, valign: 'middle' });
  if (sub) T(s, sub, { x: 0.6, y: 1.1, w: W - 1.2, h: 0.4, fontSize: 14, color: C.gris });
};
const pie = (s, n, f) => {
  T(s, f || '', { x: 0.6, y: 7.0, w: 11, h: 0.3, fontSize: 9, color: C.gris });
  T(s, String(n), { x: W - 1.1, y: 7.0, w: 0.5, h: 0.3, fontSize: 9, color: C.gris, align: 'right' });
};
const card = (s, x, y, w, h, fill) => s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: fill || C.ice }, line: { color: fill || C.ice } });
const FUENTE = `Fuente: export de uso y de consultas de Harvey, corte al ${V.split('-').reverse().join('/')}; ${universo} personas de las 6 Subdirecciones.`;

// 1. Portada
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  T(s, 'Harvey AI × Gentera', { x: 0.8, y: 1.9, w: 11.5, h: 0.5, fontSize: 18, color: C.ice2 });
  T(s, 'Assistant: instrucciones que sí funcionan', { x: 0.8, y: 2.4, w: 11.5, h: 1.0, fontSize: 40, bold: true, color: C.blanco });
  T(s, 'Sesión abierta  |  Jueves 5 de noviembre de 2026, 13:00', { x: 0.8, y: 3.5, w: 11.5, h: 0.5, fontSize: 20, color: C.ice2 });
  T(s, 'José Antonio Bueno Díaz  |  Gerente Contratos TI & AI', { x: 0.8, y: 6.3, w: 11.5, h: 0.4, fontSize: 13, color: C.blanco });
  s.addNotes('[1 min] Objetivo: que cada quien salga con una instrucción suya reescrita en 3P y la compare contra la original. 60 minutos.');
}

// 2. Punto de partida
{
  const s = pres.addSlide();
  titulo(s, 'Assistant es la herramienta de todos', 'La usamos todos; la pregunta es qué tan bien le pedimos las cosas');
  [[`${conA} de ${universo}`, 'personas lo usan'], [`${pctA}%`, 'de las acciones de la semana pasan por Assistant'], [`${usanA}`, 'personas lo usaron esta semana']]
    .forEach(([n, t], i) => {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.9, 3.9, 2.4, i === 0 ? C.acentoF : C.ice);
      T(s, n, { x: x + 0.2, y: 2.15, w: 3.5, h: 1.0, fontSize: 44, bold: true, color: i === 0 ? C.acento : C.navy, align: 'center' });
      T(s, t, { x: x + 0.3, y: 3.2, w: 3.3, h: 0.9, fontSize: 16, align: 'center' });
    });
  T(s, 'Por eso aquí está la mayor ganancia: una mejor instrucción mejora la mayor parte de nuestro trabajo con Harvey.', { x: 0.6, y: 4.9, w: 12, h: 0.8, fontSize: 18, color: C.navy, bold: true });
  pie(s, 2, FUENTE);
  s.addNotes('[3 min] Assistant ya no es lo que hay que enseñar a abrir: todos lo usan. Lo que sigue es pedir mejor.');
}

// 3. Dos patrones
{
  const s = pres.addSlide();
  titulo(s, 'Dos patrones que vemos en las consultas', 'Sin nombres: son de la DJ en el último mes');
  card(s, 0.6, 1.8, 5.9, 3.6);
  T(s, `${medMin} palabras`, { x: 0.9, y: 2.0, w: 5.3, h: 0.9, fontSize: 40, bold: true, color: C.acento });
  T(s, 'La primera instrucción de varias personas apenas pasa de una línea. Harvey tiene que adivinar el resto, y luego vienen las correcciones.', { x: 0.9, y: 3.0, w: 5.3, h: 2.2, fontSize: 17 });
  card(s, 6.8, 1.8, 5.9, 3.6);
  T(s, `${rep.hilos_repetidos} de ${rep.hilos}`, { x: 7.1, y: 2.0, w: 5.3, h: 0.9, fontSize: 40, bold: true, color: C.acento });
  T(s, 'conversaciones de una sola persona empiezan con la misma instrucción. Si la escribes cada semana, ya es un workflow.', { x: 7.1, y: 3.0, w: 5.3, h: 2.2, fontSize: 17 });
  pie(s, 3, FUENTE);
  s.addNotes('[4 min] Ninguno de los dos es un error: son la señal de qué sigue. Instrucción corta: falta contexto. Instrucción repetida: falta un workflow.');
}

// 4. 3P
{
  const s = pres.addSlide();
  titulo(s, 'La regla de las 3P', 'Tres cosas que Harvey necesita saber antes de responder');
  [['Propósito', 'Para qué lo necesitas y para quién. Qué decisión vas a tomar con la respuesta.'],
   ['Parámetros', 'Los hechos, los documentos, la ley aplicable, tu posición y los límites. Todo en el primer mensaje.'],
   ['Profundidad', 'El formato y el nivel de detalle: tabla, memo, cláusula; una página o un análisis completo.']]
    .forEach(([t, d], i) => {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.8, 3.9, 3.4);
      T(s, t, { x: x + 0.3, y: 2.05, w: 3.3, h: 0.6, fontSize: 26, bold: true, color: C.navy });
      T(s, d, { x: x + 0.3, y: 2.8, w: 3.3, h: 2.3, fontSize: 17 });
    });
  T(s, 'Si los hechos llegan en mensajes sueltos, Harvey responde con información incompleta y las respuestas intermedias salen mal.', { x: 0.6, y: 5.6, w: 12, h: 0.8, fontSize: 16, color: C.gris });
  pie(s, 4);
  s.addNotes('[8 min] Explicar cada P con un caso de la sala. Insistir en Parámetros: es la que más se omite y la que más cambia la respuesta.');
}

// 5. Antes y despues
{
  const s = pres.addSlide();
  titulo(s, 'Antes y después');
  card(s, 0.6, 1.4, 4.0, 4.9, C.acentoF);
  T(s, 'Antes', { x: 0.9, y: 1.6, w: 3.4, h: 0.5, fontSize: 20, bold: true, color: C.acento });
  T(s, '"Revisa este contrato."', { x: 0.9, y: 2.3, w: 3.4, h: 1.0, fontSize: 22, italic: true });
  card(s, 4.9, 1.4, 7.8, 4.9, C.verdeF);
  T(s, 'Con 3P', { x: 5.2, y: 1.6, w: 7.2, h: 0.5, fontSize: 20, bold: true, color: C.verde });
  T(s, [
    { text: 'Propósito: ', options: { bold: true } },
    { text: 'voy a recomendar si firmamos este contrato de servicios de TI con un proveedor nuevo.', options: { breakLine: true } },
    { text: ' ', options: { breakLine: true, fontSize: 6 } },
    { text: 'Parámetros: ', options: { bold: true } },
    { text: 'somos el cliente. Revisa responsabilidad, penas convencionales, confidencialidad, datos personales y terminación anticipada, contra nuestra posición: responsabilidad limitada al monto del contrato.', options: { breakLine: true } },
    { text: ' ', options: { breakLine: true, fontSize: 6 } },
    { text: 'Profundidad: ', options: { bold: true } },
    { text: 'tabla con cláusula, riesgo (alto, medio, bajo) y redacción propuesta. Máximo una página.' },
  ], { x: 5.2, y: 2.2, w: 7.2, h: 4.0, fontSize: 16 });
  pie(s, 5);
  s.addNotes('[6 min] Correr las dos instrucciones en vivo con el mismo contrato y comparar las respuestas.');
}

// 6. De instruccion repetida a workflow
{
  const s = pres.addSlide();
  titulo(s, '¿La escribes cada semana? Pídele a Harvey que te ayude a automatizarla');
  card(s, 0.6, 1.6, 12.1, 2.0);
  T(s, '"Hago este proceso: paso 1, paso 2, paso 3. Ayúdame a identificar qué se puede automatizar y cómo lo armaría como workflow."', { x: 0.9, y: 1.8, w: 11.5, h: 1.6, fontSize: 22, italic: true, color: C.navy });
  T(s, 'Truco que compartió Andrés Quintero (JC) en la sesión de Workflow del 15 de octubre.', { x: 0.6, y: 3.8, w: 12, h: 0.5, fontSize: 14, color: C.gris });
  T(s, 'Tu instrucción en 3P ya es el borrador de tu workflow: el Propósito es su nombre, los Parámetros son sus campos y la Profundidad es su formato de salida.', { x: 0.6, y: 4.6, w: 12, h: 1.2, fontSize: 18, bold: true });
  pie(s, 6);
  s.addNotes('[4 min] Puente con la sesión de Workflow del 12 nov: publicar y compartir.');
}

// 7. Practica y cierre
{
  const s = pres.addSlide();
  titulo(s, 'Hoy, antes de irte', '30 minutos de práctica');
  [['1', 'Elige una instrucción real que hayas usado esta semana'],
   ['2', 'Reescríbela con Propósito, Parámetros y Profundidad'],
   ['3', 'Córrela otra vez y compara las dos respuestas']]
    .forEach(([n, t], i) => {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.9, 3.9, 2.6, i === 2 ? C.acentoF : C.ice);
      T(s, n, { x: x + 0.3, y: 2.1, w: 1, h: 0.8, fontSize: 40, bold: true, color: i === 2 ? C.acento : C.navy });
      T(s, t, { x: x + 0.3, y: 3.0, w: 3.3, h: 1.3, fontSize: 18, bold: true });
    });
  T(s, 'Comparte en el chat la instrucción que más mejoró. Dudas después de la sesión: con el Champion de tu Subdirección.', { x: 0.6, y: 5.2, w: 12, h: 0.8, fontSize: 16, color: C.gris });
  pie(s, 7);
  s.addNotes('[30 min + 4 de cierre] Los expertos recorren y ayudan con la parte de Parámetros. Al cierre: dos o tres antes y después de la sala.');
}

pres.writeFile({ fileName: OUT }).then((f) => console.log('ok', f));
