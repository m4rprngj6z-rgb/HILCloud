/**
 * Borrador de la sesion de Vault, jue 29 oct 2026 (coordina Jorge Belloc, experto Javier Garcia; Tony, 20 oct 2026).
 * Escueto a peticion de Tony: Jorge lo ajusta con un caso real de CN. Guion en las notas.
 * Datos: estado/<viernes>/CAP_<viernes>.json (capacitacion.py).
 * Uso: node presentaciones/sesion_vault.js estado/2026-10-16/CAP_2026-10-16.json out/Sesion_Vault_29oct2026.pptx
 */
const fs = require('fs');
const pptxgen = require('pptxgenjs');

const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const OUT = process.argv[3] || 'out/Sesion_Vault_29oct2026.pptx';
const C = { navy: '1F3864', ice: 'EBF3FB', ice2: 'D6E4F0', ink: '1A1A1A', gris: '595959', blanco: 'FFFFFF', acento: 'C55A11', acentoF: 'FBE5D6' };
const F = 'Arial';
const W = 13.33;
const V = D.herramientas.find(h => h.herramienta === 'V');
const universo = D.personas;
const conUso = universo - V.sin_uso;
const eqs = [...D.equipos].sort((a, b) => b.mezcla.V - a.mezcla.V);

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'José Antonio Bueno Díaz';
pres.title = 'Vault: repositorios y bases compartidas';
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
const FUENTE = `Fuente: export de uso de Harvey, últimas ${D.semanas} semanas al ${D.corte_viernes.split('-').reverse().join('/')}; ${universo} personas de las 6 Subdirecciones.`;

// 1. Portada
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  T(s, 'Harvey AI × Gentera', { x: 0.8, y: 1.9, w: 11.5, h: 0.5, fontSize: 18, color: C.ice2 });
  T(s, 'Vault: repositorios y bases compartidas', { x: 0.8, y: 2.4, w: 11.5, h: 1.0, fontSize: 40, bold: true, color: C.blanco });
  T(s, 'Sesión abierta  |  Jueves 29 de octubre de 2026', { x: 0.8, y: 3.5, w: 11.5, h: 0.5, fontSize: 20, color: C.ice2 });
  T(s, 'Coordina: Jorge Belloc (CN)  |  Experto: Javier García (CN)', { x: 0.8, y: 6.3, w: 11.5, h: 0.4, fontSize: 13, color: C.blanco });
  s.addNotes('[1 min] Objetivo: que cada quien salga con un vault propio creado y compartido con una persona de su equipo. 60 minutos.');
}

// 2. Donde estamos
{
  const s = pres.addSlide();
  titulo(s, `${V.sin_uso} de ${universo} personas no han usado Vault`, `Últimas ${D.semanas} semanas. Qué parte del uso de Harvey de cada Subdirección pasa por Vault`);
  eqs.forEach((e, i) => {
    const y = 1.9 + i * 0.75;
    T(s, e.sd, { x: 0.8, y, w: 1.2, h: 0.5, fontSize: 18, bold: true, valign: 'middle' });
    const w = Math.max(0.08, (e.mezcla.V / 25) * 8);
    card(s, 2.1, y + 0.08, w, 0.36, e.mezcla.V >= 10 ? C.navy : C.acento);
    T(s, `${e.mezcla.V}%`, { x: 2.2 + w, y, w: 1.2, h: 0.5, fontSize: 16, bold: true, valign: 'middle' });
  });
  card(s, 10.4, 1.9, 2.3, 2.2, C.acentoF);
  T(s, `${conUso} de ${universo}`, { x: 10.5, y: 2.1, w: 2.1, h: 0.8, fontSize: 30, bold: true, color: C.acento, align: 'center' });
  T(s, 'personas ya lo usan', { x: 10.5, y: 2.9, w: 2.1, h: 0.8, fontSize: 14, align: 'center' });
  pie(s, 2, FUENTE);
  s.addNotes('[3 min] El hueco más grande está donde Vault casi no aparece. No es un ranking: es dónde hay más que ganar.');
}

// 3. Que resuelve
{
  const s = pres.addSlide();
  titulo(s, 'Tres usos de Vault');
  [['Repositorio', 'Sube un expediente o una carpeta completa y pregúntale lo que necesites, con la cita del documento.'],
   ['Tabla de revisión', 'Extrae los mismos datos de muchos documentos a una sola tabla: fechas, montos, partes, plazos.'],
   ['Vault compartido', 'Una base del equipo que todos consultan, en lugar de que cada quien suba los mismos archivos.']]
    .forEach(([t, d], i) => {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.8, 3.9, 2.6);
      T(s, t, { x: x + 0.3, y: 2.1, w: 3.3, h: 0.6, fontSize: 22, bold: true, color: C.navy });
      T(s, d, { x: x + 0.3, y: 2.8, w: 3.3, h: 2.4, fontSize: 16 });
    });
  pie(s, 3);
  s.addNotes('[5 min] Jorge: aterriza cada uso con un ejemplo de CN. Javier: cuál usas más y para qué.');
}

// 4. Caso en vivo
{
  const s = pres.addSlide();
  titulo(s, 'Caso en vivo: un vault real de CN', 'Jorge y Javier');
  [['1', 'Qué tarea resuelve', 'El documento que entra y lo que tenías que buscar a mano.'],
   ['2', 'Cómo está armado', 'Qué subieron, cómo lo organizaron y quién tiene acceso.'],
   ['3', 'Qué le preguntan', 'Dos o tres preguntas reales, en vivo, con la respuesta citada.']]
    .forEach(([n, t, d], i) => {
      const y = 1.9 + i * 1.5;
      s.addShape(pres.shapes.OVAL, { x: 0.8, y, w: 0.9, h: 0.9, fill: { color: C.navy }, line: { color: C.navy } });
      T(s, n, { x: 0.8, y, w: 0.9, h: 0.9, fontSize: 24, bold: true, color: C.blanco, align: 'center', valign: 'middle' });
      T(s, t, { x: 2.0, y, w: 10, h: 0.5, fontSize: 22, bold: true, color: C.navy });
      T(s, d, { x: 2.0, y: y + 0.5, w: 10, h: 0.5, fontSize: 16 });
    });
  pie(s, 4);
  s.addNotes('[15 min] Jorge elige el vault y lo muestra; Javier agrega su uso como Gerente. Probar el vault antes de la sesión.');
}

// 5. Practica y compromiso
{
  const s = pres.addSlide();
  titulo(s, 'Hoy, antes de irte', '30 minutos de práctica');
  [['1', 'Crea un vault con 5 documentos de una tarea tuya'],
   ['2', 'Hazle 3 preguntas que hoy resuelves a mano'],
   ['3', 'Compártelo con una persona de tu equipo']]
    .forEach(([n, t], i) => {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.9, 3.9, 2.6, i === 2 ? C.acentoF : C.ice);
      T(s, n, { x: x + 0.3, y: 2.1, w: 1, h: 0.8, fontSize: 40, bold: true, color: i === 2 ? C.acento : C.navy });
      T(s, t, { x: x + 0.3, y: 3.0, w: 3.3, h: 1.3, fontSize: 18, bold: true });
    });
  T(s, 'Dudas después de la sesión: con el Champion de tu Subdirección.', { x: 0.6, y: 5.2, w: 12, h: 0.5, fontSize: 16, color: C.gris });
  pie(s, 5);
  s.addNotes('[30 min + 5 de cierre] Jorge y Javier recorren las mesas. Al cierre: cuántos crearon y compartieron su vault.');
}

pres.writeFile({ fileName: OUT }).then(f => console.log('ok', f));
