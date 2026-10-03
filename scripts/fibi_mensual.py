#!/usr/bin/env python3
"""
fibi_mensual.py: vista mensual de la DJ para el Fibi del ultimo viernes del mes (Tony, 2 oct 2026).

Uso: python3 scripts/fibi_mensual.py --corte-fin 2026-10-30
Requiere antes out/<SD>_<fecha>.json (etl.py) y out/GL_<fecha>.json (licencias.py).
No recalcula acciones: agrega el historial por persona que ya produjo el ETL.

Reglas (docs/REGLAS_ETL.md seccion 8i):
- Mes = cortes cuyo viernes cae en el mes calendario (misma regla que licencias). El corte
  28 sep-2 oct es de octubre.
- Semana util = con datos y sin excepcion de la persona (las excepciones de SD marcadas
  cuenta_en_base_desde, como la reestructura de PLD, si cuentan: el equipo trabajo). Las metricas son por persona por semana
  util, para que meses de 4 y 5 cortes se comparen parejo y las ausencias no cuenten como caida.
- SD con menos de 2 semanas utiles en un mes (excepcion de toda la SD): sin comparativo.
- Candidatos a licencia: los del ultimo corte del mes en GL (2+ apariciones en el mes), con nombre
  (Tony, 2 oct 2026, excepcion a la regla de 2 nombres solo en esta seccion). Mandos (Director y
  Subdirector) en su propia linea. Fuera: quien tenga nota_licencia en el roster.
"""
import argparse
import json
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import etl  # noqa: E402

REPO = etl.REPO
SDS = ['ENN', 'CN', 'PLD', 'GC', 'JC', 'RL']
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
         'octubre', 'noviembre', 'diciembre']
N_SERIE = 10   # semanas en la grafica de tendencia
MANDOS = ('Director', 'Subdirector')


def mes_de(viernes):
    d = date.fromisoformat(viernes)
    return (d.year, d.month)


def pct(a, b):
    return None if not b else round((a - b) / b * 100)


def agregar(rows, semanas):
    """Acciones y actividad por persona por semana util, en las semanas dadas (viernes)."""
    pw, acc, act, wf, sem_utiles = 0, 0, 0, 0, set()
    for r in rows:
        for h in r['historial']:
            # excepciones con actividad (cuenta_en_base_desde, caso PLD) si cuentan: la SD trabajo
            if h['viernes'] in semanas and h.get('con_datos', True) and (not h['excepcion'] or h.get('cuenta_en_base')):
                pw += 1
                acc += h['total']
                act += h['total'] > 0
                wf += h['W']
                sem_utiles.add(h['viernes'])
    if not pw:
        return None
    return {'persona_semanas': pw, 'acciones': acc, 'semanas_utiles': len(sem_utiles),
            'acc_ppw': round(acc / pw, 1), 'activas_pct': round(100 * act / pw),
            'wf_semana': round(wf / len(sem_utiles), 1)}


def grafica_barras(serie, path):
    """Barras por semana: las del mes en azul marino, las anteriores en gris azulado. Etiqueta de
    valor solo en las del mes (lectura selectiva); eje x con el viernes de cada corte."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    ys = [x['total'] for x in serie]
    xs = range(len(ys))
    fig = plt.figure(figsize=(7.2, 1.3), dpi=150)
    ax = fig.add_axes([0.01, 0.2, 0.98, 0.72])
    cols = ['#1F3864' if x['del_mes'] else '#C9D3E3' for x in serie]
    ax.bar(xs, ys, width=0.62, color=cols, edgecolor='white', linewidth=1)
    top = max(ys) or 1
    for x, y, s in zip(xs, ys, serie):
        if s['del_mes']:
            ax.text(x, y + top * 0.03, f'{y:.1f}', ha='center', va='bottom', fontsize=8, color='#262626')
    ax.set_ylim(0, top * 1.22)
    ax.set_xticks(list(xs))
    m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    ax.set_xticklabels([f"{int(s['viernes'][8:])} {m[int(s['viernes'][5:7]) - 1]}" for s in serie], fontsize=7.5, color='#595959')
    ax.tick_params(axis='x', length=0)
    ax.set_yticks([])
    for sp in ('top', 'right', 'left'):
        ax.spines[sp].set_visible(False)
    ax.spines['bottom'].set_color('#BFBFBF')
    fig.savefig(path, transparent=True)
    plt.close(fig)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corte-fin', required=True)
    ap.add_argument('--gl', default=None, help='GL json a usar (p. ej. cierre retroactivo de septiembre)')
    a = ap.parse_args()
    fin = date.fromisoformat(a.corte_fin)
    P = json.load(open(os.path.join(REPO, 'data', 'roster.json')))['personas']
    datos = {sd: json.load(open(os.path.join(REPO, 'out', f'{sd}_{a.corte_fin}.json'))) for sd in SDS}
    gl = json.load(open(a.gl or os.path.join(REPO, 'out', f'GL_{a.corte_fin}.json')))

    viernes = [h['viernes'] for h in datos['ENN']['rows'][0]['historial']]
    labels = {h['viernes']: h['corte'] for h in datos['ENN']['rows'][0]['historial']}
    mes = (fin.year, fin.month)
    ant = (fin.year - 1, 12) if fin.month == 1 else (fin.year, fin.month - 1)
    sem_mes = [v for v in viernes if mes_de(v) == mes]
    sem_ant = [v for v in viernes if mes_de(v) == ant]

    # Candidatos (Tony, 2 oct 2026): con nombre; mandos (Director/Subdirector) en su propia linea;
    # fuera quien tenga nota_licencia (regulador "no candidato" o "En revision").
    fuera = [c for c in gl['candidatos'] if c.get('nota_licencia')]
    cand = [c for c in gl['candidatos'] if not c.get('nota_licencia')]
    sem_gl = {x['viernes'] for x in cand[0]['serie']} if cand else set()

    def fila(c):
        mes_serie = [x['total'] for x in c['serie'] if mes_de(x['viernes']) == (fin.year, fin.month)]
        return {'nombre': c['nombre'], 'sd': c['sd'], 'nivel': c['nivel'], 'puesto': P.get(c['usuario'], {}).get('puesto', c['nivel']),
                'apariciones': c['apariciones_mes'], 'cortes': len(gl['cortes_del_mes']), 'serie_mes': mes_serie}
    sds, todas = [], []
    for sd in SDS:
        rows = datos[sd]['rows']
        todas += rows
        m, p = agregar(rows, sem_mes), agregar(rows, sem_ant)
        comparable = bool(m and p and m['semanas_utiles'] >= 2 and p['semanas_utiles'] >= 2)
        sds.append({
            'sd': sd, 'nombre': datos[sd]['sdNombre'], 'personas': len(rows),
            'mes': m, 'anterior': p, 'comparable': comparable,
            'delta_pct': pct(m['acc_ppw'], p['acc_ppw']) if comparable else None,
            'en_excepcion_ant': bool(p is None or p['semanas_utiles'] < 2),
            'candidatos_licencia': sum(1 for c in cand if c['sd'] == sd),
        })
    dj_m, dj_p = agregar(todas, sem_mes), agregar(todas, sem_ant)
    # Serie semanal de la DJ (acciones por persona por semana util), para la grafica.
    serie = []
    for v in viernes[-N_SERIE:]:
        g = agregar(todas, [v])
        serie.append({'corte': labels[v], 'viernes': v, 'total': g['acc_ppw'] if g else 0,
                      'excepcion': False, 'del_mes': v in sem_mes})
    carpeta = os.path.join(REPO, 'out', f'fm_graficas_{a.corte_fin}')
    os.makedirs(carpeta, exist_ok=True)
    grafica = grafica_barras(serie, os.path.join(carpeta, 'dj.png'))

    out = {
        'mes': MESES[fin.month - 1], 'anio': fin.year, 'mes_anterior': MESES[ant[1] - 1],
        'corte_viernes': a.corte_fin, 'corte': datos['ENN']['corte'],
        'cortes_mes': [labels[v] for v in sem_mes], 'cortes_mes_anterior': [labels[v] for v in sem_ant],
        'personas': len(todas),
        'dj': {'mes': dj_m, 'anterior': dj_p, 'delta_pct': pct(dj_m['acc_ppw'], dj_p['acc_ppw']) if dj_m and dj_p else None,
               'delta_activas_pp': (dj_m['activas_pct'] - dj_p['activas_pct']) if dj_m and dj_p else None},
        'sds': sds,
        'serie': serie, 'grafica': grafica,
        'licencias': {
            'candidatos': len(cand),
            'mandos': sorted([fila(c) for c in cand if c['nivel'] in MANDOS], key=lambda f: (-f['apariciones'], f['nombre'])),
            'resto': sorted([fila(c) for c in cand if c['nivel'] not in MANDOS], key=lambda f: (-f['apariciones'], f['nombre'])),
            'mandos_n': sum(1 for c in cand if c['nivel'] in MANDOS),
            'en_revision': sum(1 for c in fuera if c['nota_licencia'].startswith('En revisión')),
            'no_candidato': sum(1 for c in fuera if not c['nota_licencia'].startswith('En revisión')),
            'cortes_contados': len(gl['cortes_del_mes']),
            'retroactivo': bool(a.gl),
        },
    }
    # porcentajes que el texto puede citar (validar_narrativa.py)
    out['porcentajes'] = sorted({x for s in sds for x in (s['delta_pct'], abs(s['delta_pct'] or 0)) if x is not None}
                                | {x for s in sds for k in ('mes', 'anterior') if s[k] for x in (s[k]['activas_pct'],)}
                                | {x for x in (out['dj']['delta_pct'], abs(out['dj']['delta_pct'] or 0),
                                               dj_m['activas_pct'] if dj_m else None, dj_p['activas_pct'] if dj_p else None,
                                               out['dj']['delta_activas_pp']) if x is not None})
    path = os.path.join(REPO, 'out', f'FM_{a.corte_fin}.json')
    json.dump(out, open(path, 'w'), ensure_ascii=False, indent=1)
    print('OK:', path, '|', out['mes'], 'cortes', len(sem_mes), 'vs', out['mes_anterior'], len(sem_ant))
    print('DJ', dj_m, '\n  vs', dj_p, '| delta', out['dj']['delta_pct'])
    for s in sds:
        print(f"  {s['sd']:4} {s['mes'] and s['mes']['acc_ppw']} vs {s['anterior'] and s['anterior']['acc_ppw']} "
              f"delta={s['delta_pct']} activas={s['mes'] and s['mes']['activas_pct']} wf/sem={s['mes'] and s['mes']['wf_semana']} "
              f"cand={s['candidatos_licencia']} comparable={s['comparable']}")
    print('Licencias:', out['licencias'])


if __name__ == '__main__':
    main()
