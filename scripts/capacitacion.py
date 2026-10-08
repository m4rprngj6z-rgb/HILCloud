#!/usr/bin/env python3
"""
capacitacion.py: fortalezas por equipo y Champion, analisis por rango y calendario de capacitacion
(seccion del Gobierno de Licencias; Tony, 7 oct 2026).

Uso: python3 scripts/capacitacion.py --corte-fin 2026-10-09
Requiere los 6 JSON del ETL (out/<SD>_<fecha>.json). No recalcula acciones: agrega el historial.

Reglas (docs/REGLAS_ETL.md seccion 8k):
- Ventana: ultimas 8 semanas utiles de cada persona (sin excepcion, con datos; las excepciones de SD
  con cuenta_en_base_desde, como la reestructura de PLD, si cuentan).
- Mezcla = % de acciones por herramienta. Fortaleza de un equipo o Champion = herramienta con mas
  uso. Hueco de un equipo = la de menor uso entre Wo, V, W y O (Assistant lo usan todos).
- Rango: nivel del roster. Necesidad = la primera herramienta de la fortaleza esperada del rango
  (Playbook v3, seccion 6) que no es Assistant; se reporta cuantas personas no la usaron en 8 semanas.
  Rangos con menos de 3 personas no se analizan (se dice cuantas personas quedan fuera).
- Referente por herramienta: el Champion y la persona de la DJ con mas acciones por semana util.
- Subdirectores: solo agregado, nunca uno contra otro (REGLAS 8f).
- Calidad de Assistant (provisional, Tony 7 oct 2026: "no asumir que un uso de Assistant es un uso
  de valor"), con los exports harvey-queries, superficie ASISTENTE pura, ultimas 8 semanas, por hilo
  (la primera consulta de cada hilo es la instruccion de la tarea):
  * Tarea repetida: >= 50% de sus hilos (min. 10) arrancan con la misma instruccion (primeras 8
    palabras normalizadas, 3+ veces). No cuentan prefijos de rol ("actua como...") ni llamadas a
    workflows. Lectura: deberia ser un Workflow; su volumen de Assistant no es ritmo de valor.
  * Instrucciones minimas: mediana de la instruccion inicial < 15 palabras (min. 5 hilos).
- Top 3 urgentes por sesion: del publico de la sesion. Workflow: primero tarea repetida (por hilos
  repetidos), luego sin uso de Workflow por volumen total. Otras herramientas: sin uso, por volumen
  total (los mas activos sin la herramienta son los que mas ganan). Assistant: instrucciones minimas.
- Expertos por sesion: las 3 personas con mas uso de la herramienta (power users); quien coordina lo
  decide Tony (habilidad para llevar una capacitacion, no solo uso).
"""
import argparse
import glob
import json
import os
import unicodedata
from datetime import date, timedelta

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SDS = ['ENN', 'CN', 'PLD', 'GC', 'JC', 'RL']
T = ['A', 'Wo', 'V', 'W', 'O']
NOMBRE_T = {'A': 'Assistant', 'Wo': 'Word', 'V': 'Vault', 'W': 'Workflow', 'O': 'Outlook'}
N_SEM = 8
ESPERADA = {'Subdirector': ['A', 'V'], 'Gerente': ['A', 'W'], 'Líder': ['W', 'A'], 'Coordinador': ['W', 'A'],
            'Analista': ['W', 'V', 'A']}
ORDEN_RANGO = ['Subdirector', 'Gerente', 'Líder', 'Coordinador', 'Analista']
MIN_RANGO = 3
MIN_WF_ESCRITO = 2       # hilos que arrancan solo con el nombre de un workflow
MIN_NEGATIVOS = 5        # calificaciones negativas en la ventana
MIN_ALERTA_SD = 3        # personas con senal para alerta amarilla de la SD (o su Champion con senal)
UPLOADS_DEFAULT = '/mnt/user-data/uploads'
PREFIJOS_ROL = ('actua como', 'actuando como', 'como experto', 'como abogado', 'eres un', 'eres una', 'mention type')


def norm(txt, n=8):
    t = unicodedata.normalize('NFKD', str(txt).lower())
    t = ''.join(c for c in t if c.isalpha() or c == ' ')
    return ' '.join(t.split()[:n])


def calidad_assistant(uploads, fin, roster_uids):
    """Senales de calidad de Assistant por persona (ver docstring)."""
    import pandas as pd
    fs = sorted(glob.glob(os.path.join(uploads, 'harvey-queries-*.xlsx')))
    if not fs:
        return {}
    x = pd.concat([pd.read_excel(f) for f in fs[-4:]]).drop_duplicates('ID de uso único')
    x['t'] = pd.to_datetime(x['Tiempo (Etc/GMT+6)'])
    desde = fin - timedelta(weeks=N_SEM) + timedelta(days=3)   # lunes de la primera semana
    wf_nombres = {norm(w) for w in x['Nombre del workflow'].dropna().unique()}
    x = x[(x['t'].dt.date >= desde) & (x['t'].dt.date <= fin)].copy()
    x['u'] = x['Usuario'].str.split('@').str[0]
    negativos = x.groupby('u')['Valoración de los comentarios'].apply(lambda s: int((s == 'Negativo').sum())).to_dict()
    x = x[x['Superficie del producto'] == 'ASISTENTE'].copy()
    x['u'] = x['Usuario'].str.split('@').str[0]
    first = x.sort_values('t').groupby(['u', 'ID del hilo de la Matriz']).head(1).copy()
    first['k'] = first['Consulta'].map(norm)
    first['pal'] = first['Consulta'].fillna('').str.split().str.len()
    out = {}
    for u, g in first.groupby('u'):
        if u not in roster_uids:
            continue
        tareas = g[~g['k'].str.startswith(PREFIJOS_ROL)]
        # llamadas a workflows (mencion o nombre del workflow escrito) no son instrucciones
        propias = g[~g['k'].str.startswith('mention type') & ~g['k'].isin(wf_nombres)]
        vc = tareas['k'].value_counts()
        rep = int(vc[vc >= 3].sum())
        out[u] = {'hilos': int(len(g)), 'hilos_repetidos': rep,
                  'plantilla': ' '.join(str(tareas[tareas['k'] == vc.index[0]]['Consulta'].iloc[0]).split()[:8]) if rep else None,
                  'pal_inicial': float(propias['pal'].median()) if len(propias) else None,
                  'tarea_repetida': bool(len(g) >= 10 and rep / len(g) >= 0.5),
                  'instrucciones_minimas': bool(len(propias) >= 5 and propias['pal'].median() < 15),
                  'workflow_escrito': int(g['k'].isin(wf_nombres).sum()),
                  'negativos': negativos.get(u, 0)}
    for u in set(negativos) - set(out):
        if u in roster_uids and negativos[u]:
            out[u] = {'hilos': 0, 'hilos_repetidos': 0, 'plantilla': None, 'pal_inicial': None, 'tarea_repetida': False,
                      'instrucciones_minimas': False, 'workflow_escrito': 0, 'negativos': negativos[u]}
    return out


def mezcla(suma):
    tot = sum(suma[t] for t in T)
    return {t: round(100 * suma[t] / tot) if tot else 0 for t in T}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corte-fin', required=True)
    ap.add_argument('--uploads', default=UPLOADS_DEFAULT)
    a = ap.parse_args()
    fin = date.fromisoformat(a.corte_fin)
    personas = []
    for sd in SDS:
        d = json.load(open(os.path.join(REPO, 'out', f'{sd}_{a.corte_fin}.json')))
        for r in d['rows']:
            hh = [h for h in r['historial'] if (not h['excepcion'] or h.get('cuenta_en_base')) and h.get('con_datos', True)][-N_SEM:]
            if not hh:
                continue
            suma = {t: sum(h[t] for h in hh) for t in T}
            personas.append({'usuario': r['usuario'], 'nombre': r['nombre'], 'sd': sd, 'nivel': r['nivel'],
                             'champion': r['champion'], 'semanas': len(hh), 'suma': suma,
                             'por_semana': {t: round(suma[t] / len(hh), 1) for t in T},
                             'total_semana': round(sum(suma.values()) / len(hh), 1), 'div_wf': r['diversidadWf']})

    cal_a = calidad_assistant(a.uploads, fin, {p['usuario'] for p in personas})
    for p in personas:
        p['calidad_a'] = cal_a.get(p['usuario'])

    def senales(p):
        """Practicas de uso deficiente (alerta amarilla por persona; Tony 7 oct 2026)."""
        c = p['calidad_a'] or {}
        out = []
        if c.get('tarea_repetida'):
            out.append({'senal': 'Tarea repetida en Assistant', 'detalle': f"{c['hilos_repetidos']} de {c['hilos']} hilos arrancan igual: \"{c['plantilla']}...\"",
                        'follow_up': 'Convertir esa tarea en un Workflow con un experto de Workflow.'})
        if c.get('instrucciones_minimas'):
            out.append({'senal': 'Instrucciones mínimas', 'detalle': f"instrucción inicial de {c['pal_inicial']:g} palabras en promedio ({c['hilos']} hilos)",
                        'follow_up': 'Sesión de Assistant: contexto, documento y resultado esperado en la instrucción.'})
        if c.get('workflow_escrito', 0) >= MIN_WF_ESCRITO:
            out.append({'senal': 'Escribe el nombre del workflow en Assistant', 'detalle': f"{c['workflow_escrito']} hilos arrancan solo con el nombre de un workflow",
                        'follow_up': 'Mostrarle cómo ejecutar el workflow desde su sección (por confirmar si así no corre).'})
        if c.get('negativos', 0) >= MIN_NEGATIVOS:
            out.append({'senal': 'Respuestas calificadas como negativas', 'detalle': f"{c['negativos']} calificaciones negativas en {N_SEM} semanas",
                        'follow_up': 'Revisar con la persona qué falló: la instrucción, el documento o la herramienta.'})
        return out

    for p in personas:
        p['senales'] = senales(p)

    def senal_a(p):
        c = p['calidad_a'] or {}
        return bool(c.get('tarea_repetida') or c.get('instrucciones_minimas'))

    def elegibles(t, ps):
        """El volumen no basta: fuera de expertos y referentes quien tenga una alerta amarilla."""
        return [p for p in ps if not p['senales'] and not (t == 'A' and senal_a(p))]

    def grupo(ps):
        suma = {t: sum(p['suma'][t] for p in ps) for t in T}
        pw = sum(p['semanas'] for p in ps)
        return suma, pw

    equipos = []
    for sd in SDS:
        ps = [p for p in personas if p['sd'] == sd]
        suma, pw = grupo(ps)
        m = mezcla(suma)
        equipos.append({'sd': sd, 'personas': len(ps), 'acc_ppw': round(sum(suma.values()) / pw, 1), 'mezcla': m,
                        'fortaleza': max(T, key=lambda t: (m[t], -T.index(t))),
                        'hueco': min(['Wo', 'V', 'W', 'O'], key=lambda t: (m[t], T.index(t)))})

    champions = []
    for p in sorted([p for p in personas if p['champion']], key=lambda p: SDS.index(p['sd'])):
        m = mezcla(p['suma'])
        champions.append({'nombre': p['nombre'], 'sd': p['sd'], 'acc_semana': p['total_semana'], 'mezcla': m,
                          'fortaleza': max(T, key=lambda t: (m[t], -T.index(t))), 'div_wf': p['div_wf']})

    herramientas = []
    for t in T:
        ch = max(elegibles(t, [p for p in personas if p['champion']]), key=lambda p: p['por_semana'][t])
        ref = max(elegibles(t, personas), key=lambda p: p['por_semana'][t])
        herramientas.append({
            'herramienta': t, 'nombre': NOMBRE_T[t],
            'champion': {'nombre': ch['nombre'], 'sd': ch['sd'], 'por_semana': ch['por_semana'][t]},
            'referente': {'nombre': ref['nombre'], 'sd': ref['sd'], 'nivel': ref['nivel'], 'por_semana': ref['por_semana'][t],
                          'es_champion': ref['champion']},
            'sin_uso': sum(1 for p in personas if p['suma'][t] == 0),
        })

    rangos, fuera = [], 0
    for nv in ORDEN_RANGO + sorted({p['nivel'] for p in personas} - set(ORDEN_RANGO)):
        ps = [p for p in personas if p['nivel'] == nv]
        if not ps:
            continue
        if len(ps) < MIN_RANGO or nv not in ESPERADA:
            fuera += len(ps)
            continue
        suma, pw = grupo(ps)
        sin = {t: sum(1 for p in ps if p['suma'][t] == 0) for t in T}
        nec = next(t for t in ESPERADA[nv] if t != 'A')
        rangos.append({'nivel': nv, 'personas': len(ps), 'acc_ppw': round(sum(suma.values()) / pw, 1),
                       'mezcla': mezcla(suma), 'esperada': '>'.join(ESPERADA[nv]), 'sin_uso': sin,
                       'necesidad': nec, 'sin_necesidad': sin[nec]})

    cal = json.load(open(os.path.join(REPO, 'data', 'capacitaciones.json')))['sesiones']
    def fila(p, motivo):
        return {'nombre': p['nombre'], 'sd': p['sd'], 'nivel': p['nivel'], 'motivo': motivo}

    # Coordinacion rotativa (Tony, 7 oct 2026): "rotacion" = siguiente Champion de la lista de
    # data/capacitaciones.json, saltando a quien coordino la sesion anterior, a quien este fuera esa
    # semana y a quien tenga una alerta amarilla activa (no ensena una practica que no tiene).
    import json as _j
    excs = _j.load(open(os.path.join(REPO, 'data', 'excepciones.json')))['excepciones']
    rot = _j.load(open(os.path.join(REPO, 'data', 'capacitaciones.json'))).get('rotacion', [])
    R = _j.load(open(os.path.join(REPO, 'data', 'roster.json')))['personas']
    por_uid = {p['usuario']: p for p in personas}

    def esta_fuera(uid, ini):
        fin_s = ini + timedelta(days=4)
        return any(uid in e.get('personas', []) and date.fromisoformat(e['desde']) <= fin_s and date.fromisoformat(e['hasta']) >= ini for e in excs)

    i_rot, previo = 0, None
    for s in sorted(cal, key=lambda s: s['fecha']):
        if s.get('coordina') != 'rotacion':
            previo = s.get('coordina_uid', previo)
            continue
        ini = date.fromisoformat(s['fecha'])
        saltados = []
        for k in range(len(rot)):
            uid = rot[(i_rot + k) % len(rot)]
            motivo = ('coordinó la sesión anterior' if uid == previo else 'fuera esa semana' if esta_fuera(uid, ini)
                      else 'alerta amarilla activa' if por_uid.get(uid, {}).get('senales') else None)
            if motivo:
                saltados.append(f"{R[uid]['nombre']} ({motivo})")
                continue
            s['coordina'] = f"{R[uid]['nombre']} ({R[uid]['sd']})"
            s['coordina_uid'] = uid
            s['rotacion_saltados'] = saltados
            i_rot, previo = (i_rot + k + 1) % len(rot), uid
            break

    for s in cal:
        t = s['herramienta']
        ps = [p for p in personas if p['nivel'] in s['niveles']]
        s['publico'] = len(ps)
        if t == 'A':
            urg = sorted([p for p in ps if (p['calidad_a'] or {}).get('instrucciones_minimas')],
                         key=lambda p: (-p['calidad_a']['hilos'], p['nombre']))
            s['publico_sin_uso'] = len(urg)
            s['urgentes'] = [fila(p, f"instrucción inicial de {p['calidad_a']['pal_inicial']:g} palabras en promedio ({p['calidad_a']['hilos']} hilos)") for p in urg[:3]]
        else:
            sin = [p for p in ps if p['suma'][t] == 0]
            s['publico_sin_uso'] = len(sin)
            urg = []
            if t == 'W':
                rep = sorted([p for p in ps if (p['calidad_a'] or {}).get('tarea_repetida')],
                             key=lambda p: (-p['calidad_a']['hilos_repetidos'], p['nombre']))
                urg = [fila(p, f"repite la misma tarea en Assistant en {p['calidad_a']['hilos_repetidos']} de {p['calidad_a']['hilos']} hilos") for p in rep]
            vistos = {u['nombre'] for u in urg}
            urg += [fila(p, f"sin uso de {NOMBRE_T[t]}; {p['total_semana']:g} acciones por semana en otras herramientas")
                    for p in sorted(sin, key=lambda p: (-p['total_semana'], p['nombre'])) if p['nombre'] not in vistos]
            s['urgentes'] = urg[:3]
        if s.get('expertos') == 'auto':
            top = sorted([p for p in elegibles(t, personas) if p['por_semana'][t] > 0], key=lambda p: -p['por_semana'][t])[:3]
            s['expertos'] = [f"{p['nombre']} ({p['sd']}, {p['por_semana'][t]:g} por semana)" for p in top]

    out = {'corte_viernes': a.corte_fin, 'semanas': N_SEM, 'personas': len(personas),
           'equipos': equipos, 'champions': champions, 'herramientas': herramientas,
           'rangos': rangos, 'rangos_fuera': fuera,
           'sin_outlook': sum(1 for p in personas if p['suma']['O'] == 0),
           'alertas_personas': [{'nombre': p['nombre'], 'sd': p['sd'], 'nivel': p['nivel'], 'champion': p['champion'], 'senales': p['senales']}
                                for p in sorted(personas, key=lambda p: (SDS.index(p['sd']), not p['champion'], p['nombre'])) if p['senales']],
           'alertas_sd': [{'sd': sd, 'personas': len([p for p in personas if p['sd'] == sd and p['senales']]),
                           'de': len([p for p in personas if p['sd'] == sd]),
                           'champion': next((p['nombre'] for p in personas if p['sd'] == sd and p['champion'] and p['senales']), None)}
                          for sd in SDS
                          if len([p for p in personas if p['sd'] == sd and p['senales']]) >= MIN_ALERTA_SD
                          or any(p['champion'] and p['senales'] for p in personas if p['sd'] == sd)],
           'assistant_calidad': {
               'evaluadas': sum(1 for p in personas if p['calidad_a']),
               'tarea_repetida': [{'nombre': p['nombre'], 'sd': p['sd'], 'nivel': p['nivel'], **p['calidad_a']}
                                  for p in sorted(personas, key=lambda p: -((p['calidad_a'] or {}).get('hilos_repetidos') or 0))
                                  if (p['calidad_a'] or {}).get('tarea_repetida')],
               'instrucciones_minimas': [{'nombre': p['nombre'], 'sd': p['sd'], 'nivel': p['nivel'], **p['calidad_a']}
                                         for p in personas if (p['calidad_a'] or {}).get('instrucciones_minimas')],
           },
           'calendario': cal}
    path = os.path.join(REPO, 'out', f'CAP_{a.corte_fin}.json')
    json.dump(out, open(path, 'w'), ensure_ascii=False, indent=1)
    print('OK:', path)
    for e in equipos:
        print(' ', e['sd'], e['acc_ppw'], e['mezcla'], 'fortaleza', e['fortaleza'], 'hueco', e['hueco'])
    for c in champions:
        print(' ', c['nombre'], c['acc_semana'], c['mezcla'], c['fortaleza'], c['div_wf'])
    for h in herramientas:
        print(' ', h['nombre'], 'champion', h['champion'], '| referente', h['referente'], '| sin uso', h['sin_uso'])
    for r in rangos:
        print(' ', r['nivel'], r['personas'], r['acc_ppw'], r['mezcla'], 'necesidad', r['necesidad'], r['sin_necesidad'], r['sin_uso'])
    print('  fuera', fuera, 'sin outlook', out['sin_outlook'])
    for s in cal:
        print(' ', s['fecha_txt'], s['tema'], s['publico'], s['publico_sin_uso'], s.get('expertos'))
        for u in s['urgentes']:
            print('     urge:', u)
    for x in out['alertas_sd']:
        print('  ALERTA SD', x)
    for x in out['alertas_personas']:
        print('  alerta', x['nombre'], x['sd'], [z['senal'] for z in x['senales']])
    for s in cal:
        print('  coordina', s['fecha_txt'], s['tema'], s['coordina'], s.get('rotacion_saltados'))
    ac = out['assistant_calidad']
    print('  Assistant evaluadas', ac['evaluadas'])
    for r in ac['tarea_repetida']:
        print('   repetida:', r['nombre'], r['sd'], r['hilos_repetidos'], '/', r['hilos'], r['plantilla'])
    for r in ac['instrucciones_minimas']:
        print('   minimas:', r['nombre'], r['sd'], r['pal_inicial'], r['hilos'])


if __name__ == '__main__':
    main()
