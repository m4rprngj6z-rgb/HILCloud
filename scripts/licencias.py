#!/usr/bin/env python3
"""
licencias.py: calculo del Reporte de Gobierno de Licencias (para Tony, no para Champions ni Fibi).

Uso: python3 scripts/licencias.py --corte-fin 2026-09-25

Reglas: seccion "Gobierno de Licencias" del HIL (regla 25 sep 2026), resumidas en
docs/REGLAS_ETL.md seccion 8e. Usa las mismas funciones del ETL (carga, clasificacion, cortes,
excepciones), asi que las acciones de cada persona son las mismas que en los otros reportes.
"""
import argparse
import json
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import etl  # noqa: E402

REPO = etl.REPO
N_SEMANAS = 8                  # ventana de tendencia (regla 6: 8-10 semanas)
TOP = 10                       # regla 2
UMBRAL_CANDIDATO = 2           # regla 4
SISTEMA_DESDE = date(2026, 9, 25)   # primer corte del sistema (regla establecida 25 sep 2026)
SDS = ['ENN', 'CN', 'PLD', 'GC', 'JC', 'RL']


def top_con_empates(personas, n):
    """Top n de menor uso. Si hay empate en el lugar n, entran todos los empatados (nadie queda
    fuera por un desempate arbitrario)."""
    orden = sorted(personas, key=lambda p: (p['total'], p['nombre']))
    if len(orden) <= n:
        return orden
    corte = orden[n - 1]['total']
    return [p for p in orden if p['total'] <= corte]


def sparkline(serie, path):
    """Tendencia de 8 semanas, estilo del reporte aprobado del 25 sep (linea azul marino, relleno
    suave, sin ejes). Semanas de excepcion: punto hueco gris, para no leerlas como caida. Cada
    grafica tiene su propia escala: el reporte pone el Total al lado."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    ys = [x['total'] for x in serie]
    xs = list(range(len(ys)))
    fig = plt.figure(figsize=(4.8, 1.35), dpi=100)
    ax = fig.add_axes([0.02, 0.06, 0.96, 0.88])
    top = max(ys) or 1
    ax.set_ylim(-0.06 * top, top * 1.08)
    ax.set_xlim(-0.2, len(ys) - 0.8)
    ax.fill_between(xs, ys, -0.06 * top, color='#1F3864', alpha=0.08, linewidth=0)
    ax.plot(xs, ys, color='#1F3864', linewidth=2.2, solid_capstyle='round', zorder=2)
    for x, y, s in zip(xs, ys, serie):
        if s['excepcion']:
            ax.scatter([x], [y], s=46, facecolor='white', edgecolor='#8C8C8C', linewidth=1.6, zorder=3)
        else:
            ax.scatter([x], [y], s=34, color='#1F3864', zorder=3)
    ax.axis('off')
    fig.savefig(path, transparent=True)
    plt.close(fig)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corte-fin', required=True)
    ap.add_argument('--uploads', default=etl.UPLOADS_DEFAULT)
    a = ap.parse_args()
    fin = date.fromisoformat(a.corte_fin)
    roster = json.load(open(os.path.join(REPO, 'data', 'roster.json')))
    P = roster['personas']
    excs = etl.load_excepciones()
    ev, meta = etl.load_events(a.uploads)
    ev['tool'] = [etl.classify(s, False, v) for s, v in zip(ev['superficie'], ev['vault'])]
    ev = ev[ev['tool'] != 'OTRO']
    ev['fecha'] = ev['ts'].dt.date
    wins = etl.corte_windows(fin, N_SEMANAS)
    data_desde = ev['fecha'].min()

    # Universos (regla 1 y 7). Sin filtros de exclusion: Tony decide.
    juridico = [u for u, p in P.items() if p['sd'] in SDS and not p.get('excluido_metricas')]
    no_juridico = [u for u, p in P.items() if p['sd'] == 'EXTERNO' and not p.get('baja_ejecutada')
                   and not (p.get('alta') and date.fromisoformat(p['alta']) > fin)]   # sin cuenta antes de su alta
    aparte = [u for u, p in P.items() if p.get('excluido_metricas')]
    activos = set(ev[(ev['fecha'] >= wins[-1][0]) & (ev['fecha'] <= fin)]['user_id'])
    sin_mapear = sorted(activos - set(P))

    def serie(uid, sd):
        out = []
        for mon, fri in wins:
            m = ev[(ev['user_id'] == uid) & (ev['fecha'] >= mon) & (ev['fecha'] <= fri)]
            exc = etl.excepcion_semana(uid, sd, mon, excs)
            out.append({'corte': etl.label(mon, fri), 'viernes': str(fri), 'total': int(len(m)),
                        'con_datos': mon >= data_desde, 'excepcion': exc['es_excepcion'],
                        'tipo_excepcion': exc['tipos'][0] if exc['tipos'] else None})
        return out

    def persona(uid):
        p = P.get(uid, {'sd': 'SIN MAPEAR', 'nombre': uid, 'nivel': '-'})
        s = serie(uid, p['sd'])
        return {'usuario': uid, 'nombre': p['nombre'], 'sd': p['sd'], 'nivel': p.get('nivel', '-'),
                'area': p.get('area'), 'nota_licencia': p.get('nota_licencia'), 'serie': s, 'total': s[-1]['total'],
                'total_8s': sum(x['total'] for x in s), 'excepcion': s[-1]['excepcion'],
                'tipo_excepcion': s[-1]['tipo_excepcion']}

    J = [persona(u) for u in juridico]
    NJ = [persona(u) for u in no_juridico] + [persona(u) for u in sin_mapear]
    A = [persona(u) for u in aparte]

    # Regla 2-4: apariciones en el top 10 de cada corte del mes calendario (desde el inicio del
    # sistema); las semanas de excepcion no cuentan.
    def apariciones(grupo, techo=None):
        """techo: por semana, el maximo de acciones que todavia cuenta como aparicion. Se usa en el
        ranking no juridico: con menos de 10 cuentas, el top 10 incluye a todas y cualquier cortesia
        con uso alto apareceria cada semana. Ahi solo cuenta quien esta en la franja de menor uso
        de la DJ (igual o debajo del lugar 10 del ranking juridico de esa semana). Regla provisional
        del 2 oct 2026, pendiente de ratificar por Tony."""
        cuenta = {p['usuario']: 0 for p in grupo}
        cortes_mes, cortes = [], {}
        for i, (mon, fri) in enumerate(wins):
            if fri.month != fin.month or fri.year != fin.year or fri < SISTEMA_DESDE:
                continue
            cortes_mes.append(etl.label(mon, fri))
            semana = [{**p, 'total': p['serie'][i]['total']} for p in grupo]
            top = top_con_empates(semana, TOP)
            cortes[i] = max((p['total'] for p in top), default=0)
            for p in top:
                if p['serie'][i]['excepcion']:
                    continue
                if techo is not None and p['total'] > techo.get(i, 0):
                    continue
                cuenta[p['usuario']] += 1
        return cuenta, cortes_mes, cortes

    cj, cortes_mes, techo_j = apariciones(J)
    cnj, _, _ = apariciones(NJ, techo_j)
    for p in J:
        p['apariciones_mes'] = cj[p['usuario']]
    for p in NJ:
        p['apariciones_mes'] = cnj[p['usuario']]

    top_j = top_con_empates(J, TOP)
    top_nj = sorted(NJ, key=lambda p: (p['total'], p['nombre']))   # universo completo
    candidatos = [p for p in J + NJ if p['apariciones_mes'] >= UMBRAL_CANDIDATO]

    # Salto atipico al alza (no es candidato; es anomalia en sentido contrario): esta semana >= 20
    # acciones y >= 3 veces su promedio de las 7 semanas previas (sin excepciones).
    def salto(p):
        prev = [x['total'] for x in p['serie'][:-1] if x['con_datos'] and not x['excepcion']]
        prom = sum(prev) / len(prev) if prev else 0
        return p['total'] >= 20 and p['total'] >= 3 * max(prom, 1)
    for p in J:
        p['salto_atipico'] = False   # en juridico el salto suele ser regreso de vacaciones: ruido
    for p in NJ:
        p['salto_atipico'] = salto(p)

    radar_ids, radar = set(), []
    for p in top_j + top_nj + [c for c in J if c['apariciones_mes'] >= 1] + [p for p in NJ if p['salto_atipico']]:
        if p['usuario'] not in radar_ids:
            radar_ids.add(p['usuario'])
            radar.append(p)

    out = {
        'corte': etl.label(*wins[-1]), 'corte_viernes': str(fin),
        'semanas': [x['corte'] for x in J[0]['serie']],
        'cortes_del_mes': cortes_mes,
        'primer_corte_del_sistema': fin == SISTEMA_DESDE,
        'ranking_juridico_top': top_j,
        'ranking_juridico_universo': len(J),
        'ranking_no_juridico': top_nj,
        'candidatos': candidatos,
        'radar': radar,
        'aparte': A,
        'sin_mapear': sin_mapear,
        'calidad_datos': meta,
    }
    carpeta = os.path.join(REPO, 'out', f'gl_graficas_{a.corte_fin}')
    os.makedirs(carpeta, exist_ok=True)
    for p in radar:
        p['grafica'] = sparkline(p['serie'], os.path.join(carpeta, f"{p['usuario']}.png"))
    path = os.path.join(REPO, 'out', f'GL_{a.corte_fin}.json')
    json.dump(out, open(path, 'w'), ensure_ascii=False, indent=1, default=str)
    print('OK:', path, '| top jur', len(top_j), '| no jur', len(top_nj), '| candidatos', len(candidatos), '| radar', len(radar))


if __name__ == '__main__':
    main()
