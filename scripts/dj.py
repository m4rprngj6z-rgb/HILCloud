#!/usr/bin/env python3
"""
dj.py: junta los JSON del ETL de las 6 SD en la vista DJ que consume el Reporte Fibi.

Uso: python3 scripts/dj.py --corte-fin 2026-09-25   (corre el ETL de cada SD si falta su JSON)

Solo suma y cuenta lo que el ETL ya calculo por SD; no introduce reglas nuevas.
"""
import argparse
import json
import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SDS = ['ENN', 'CN', 'PLD', 'GC', 'JC', 'RL']
TOOLS = ['a', 'wo', 'v', 'w', 'o']


def pct(a, b):
    return None if not b else round((a - b) / b * 100)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corte-fin', required=True)
    a = ap.parse_args()
    sds, rows = [], []
    for sd in SDS:
        p = os.path.join(REPO, 'out', f'{sd}_{a.corte_fin}.json')
        if not os.path.exists(p):
            subprocess.run([sys.executable, os.path.join(REPO, 'scripts', 'etl.py'), '--corte-fin', a.corte_fin, '--sd', sd], check=True)
        d = json.load(open(p))
        t = d['totales']
        cuenta = {s: sum(1 for r in d['rows'] if r['semaforo'] == s) for s in ['verde', 'amarillo', 'rojo', 'excepcion', 'sin_historial']}
        sds.append({
            'sd': sd, 'nombre': d['sdNombre'], **t,
            'delta_pct': pct(t['acciones'], t['acciones_anterior']),
            'wau_pct': round(t['personas_activas'] / t['personas'] * 1000) / 10 if t['personas'] else 0,
            'semaforo': cuenta,
            'transicion': any(r['transicion'] for r in d['rows']),
            'transicion_info': d.get('transicion_info'),
            'herramientas': {k: sum(r[k] for r in d['rows']) for k in TOOLS},
            'corte': d['corte'],
        })
        rows += [{**r, 'sd': sd} for r in d['rows']]
    tot = {k: sum(s[k] for s in sds) for k in ['acciones', 'acciones_anterior', 'personas', 'personas_activas', 'workflows', 'atencion_alta', 'evaluadas', 'conversaciones']}
    out = {
        'corte': sds[0]['corte'],
        'totales': tot,
        'delta_pct': pct(tot['acciones'], tot['acciones_anterior']),
        'wau_pct': round(tot['personas_activas'] / tot['personas'] * 100),
        'sds': sds,
        # porcentajes que el texto del Fibi puede citar (los usa validar_narrativa.py)
        'porcentajes': sorted({p for s in sds for p in (s['delta_pct'], abs(s['delta_pct'] or 0), s['wau_pct']) if p is not None}
                              | {pct(tot['acciones'], tot['acciones_anterior']), round(tot['personas_activas'] / tot['personas'] * 100)}),
        'rows': rows,
    }
    path = os.path.join(REPO, 'out', f'DJ_{a.corte_fin}.json')
    json.dump(out, open(path, 'w'), ensure_ascii=False, indent=1, default=str)
    print('OK:', path, '| acciones', tot['acciones'], 'vs', tot['acciones_anterior'], '| activas', tot['personas_activas'], '/', tot['personas'], '| W', tot['workflows'])


if __name__ == '__main__':
    main()
