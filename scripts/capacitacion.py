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
"""
import argparse
import json
import os

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SDS = ['ENN', 'CN', 'PLD', 'GC', 'JC', 'RL']
T = ['A', 'Wo', 'V', 'W', 'O']
NOMBRE_T = {'A': 'Assistant', 'Wo': 'Word', 'V': 'Vault', 'W': 'Workflow', 'O': 'Outlook'}
N_SEM = 8
ESPERADA = {'Subdirector': ['A', 'V'], 'Gerente': ['A', 'W'], 'Líder': ['W', 'A'], 'Coordinador': ['W', 'A'],
            'Analista': ['W', 'V', 'A']}
ORDEN_RANGO = ['Subdirector', 'Gerente', 'Líder', 'Coordinador', 'Analista']
MIN_RANGO = 3


def mezcla(suma):
    tot = sum(suma[t] for t in T)
    return {t: round(100 * suma[t] / tot) if tot else 0 for t in T}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corte-fin', required=True)
    a = ap.parse_args()
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
        ch = max([p for p in personas if p['champion']], key=lambda p: p['por_semana'][t])
        ref = max(personas, key=lambda p: p['por_semana'][t])
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
    for s in cal:
        ps = [p for p in personas if p['nivel'] in s['niveles']]
        s['publico'] = len(ps)
        s['publico_sin_uso'] = sum(1 for p in ps if p['suma'][s['herramienta']] == 0)

    out = {'corte_viernes': a.corte_fin, 'semanas': N_SEM, 'personas': len(personas),
           'equipos': equipos, 'champions': champions, 'herramientas': herramientas,
           'rangos': rangos, 'rangos_fuera': fuera,
           'sin_outlook': sum(1 for p in personas if p['suma']['O'] == 0),
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
        print(' ', s['fecha_txt'], s['tema'], s['publico'], s['publico_sin_uso'])


if __name__ == '__main__':
    main()
