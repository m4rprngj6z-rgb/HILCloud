#!/usr/bin/env python3
"""
semanas.py: historial semanal versionado (Tony, 16 oct 2026). Con esto un corte corre solo con el export
de su semana: las semanas que el export ya no cubre salen de estado/semanas.json, no de exports viejos.

estado/semanas.json:
  "cubiertas": viernes (AAAA-MM-DD) de las semanas completas guardadas. Una persona sin fila en una
               semana cubierta tuvo 0 acciones (cero real, no falta de datos).
  "personas":  {usuario: {viernes: {A, Wo, V, W, O, total, dias_activos, wf_conteo, ultima}}}
               (solo semanas con actividad). Las semanas que vienen del estado de cortes viejos traen
               conteos por herramienta pero no "detalle" (dias_activos, wf_conteo); se marcan
               "detalle": false.

Quien lo usa: etl.py y licencias.py, solo para semanas cuyo lunes es anterior al primer dato de los
exports cargados. Con exports que cubren todo (pruebas de regresion) no se usa.

Uso:
  python3 scripts/semanas.py --desde-estado [--hasta 2026-10-09]   # arma la base con estado/<corte>/
  python3 scripts/semanas.py --uploads <carpeta> --corte-fin 2026-10-16   # agrega las semanas completas del export
Variable HIL_SEMANAS: ruta alternativa del archivo (pruebas).
"""
import argparse
import glob
import json
import os
import sys
from datetime import date, timedelta

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = ['A', 'Wo', 'V', 'W', 'O']
SDS = ['ENN', 'CN', 'PLD', 'GC', 'JC', 'RL']
WF_GENERICOS = {'Assist', 'Word Add-In Assistant'}


def ruta():
    return os.environ.get('HIL_SEMANAS') or os.path.join(REPO, 'estado', 'semanas.json')


def cargar():
    p = ruta()
    if not os.path.exists(p):
        return {'cubiertas': [], 'personas': {}}
    return json.load(open(p))


def guardar(s):
    s['cubiertas'] = sorted(set(s['cubiertas']))
    s['_nota'] = ('Historial semanal por persona (scripts/semanas.py). Lo usan etl.py y licencias.py para las '
                  'semanas que el export del corte ya no cubre.')
    json.dump(s, open(ruta(), 'w'), ensure_ascii=False, indent=0, sort_keys=True)


def semana(s, uid, viernes):
    """Stats de la semana para etl.week_stats, o None si la semana no esta guardada."""
    v = str(viernes)
    if v not in set(s['cubiertas']):
        return None
    x = s['personas'].get(uid, {}).get(v)
    if not x:
        return {**{t: 0 for t in TOOLS}, 'total': 0, 'dias_activos': 0, 'wf_distintos': 0, 'wf_conteo': {}, 'ultima': None}
    wf = x.get('wf_conteo') or {}
    return {**{t: int(x.get(t, 0)) for t in TOOLS}, 'total': int(x['total']), 'dias_activos': int(x.get('dias_activos', 0)),
            'wf_distintos': len(wf), 'wf_conteo': dict(wf), 'ultima': x.get('ultima')}


def total(s, uid, viernes):
    x = semana(s, uid, viernes)
    return None if x is None else x['total']


def desde_estado(hasta=None):
    """Base a partir de los JSON guardados por corte. Corte mas reciente gana. Solo semanas con datos y
    personas en su universo; las SD dan conteos por herramienta, el GL da totales de externos y aparte."""
    s = {'cubiertas': [], 'personas': {}}
    cortes = sorted(d for d in os.listdir(os.path.join(REPO, 'estado')) if d[:4].isdigit())
    if hasta:
        cortes = [c for c in cortes if c <= hasta]
    for c in cortes:
        for sd in SDS:
            f = os.path.join(REPO, 'estado', c, f'{sd}_{c}.json')
            if not os.path.exists(f):
                continue
            rows = json.load(open(f))['rows']
            # Semana cubierta por los exports de ese corte: con datos para alguien de la SD. El conteo de
            # cada persona se guarda aunque su semana no cuente (antes de su alta), igual que el ETL.
            cub = {h['viernes'] for r in rows for h in r['historial'] if h['con_datos']}
            for r in rows:
                for h in r['historial']:
                    if h['viernes'] not in cub:
                        continue
                    s['cubiertas'].append(h['viernes'])
                    if h['total']:
                        s['personas'].setdefault(r['usuario'], {})[h['viernes']] = {
                            **{t: h[t] for t in TOOLS}, 'total': h['total'], 'detalle': False}
                    else:
                        s['personas'].get(r['usuario'], {}).pop(h['viernes'], None)
        f = os.path.join(REPO, 'estado', c, f'GL_{c}.json')
        if os.path.exists(f):
            g = json.load(open(f))
            for p in g['ranking_no_juridico'] + g['aparte']:
                for x in p['serie']:
                    if not x['con_datos']:
                        continue
                    if x['total']:
                        s['personas'].setdefault(p['usuario'], {})[x['viernes']] = {'total': x['total'], 'detalle': False}
                    else:
                        s['personas'].get(p['usuario'], {}).pop(x['viernes'], None)
    return s


def combinar(viejo, nuevo):
    """Los exports de Harvey son ventanas de ~30 dias que no siempre traen todo (los extremos se recortan):
    el ETL siempre unio todos los exports. Aqui la union se aproxima con el maximo por herramienta y por
    workflow entre lo guardado y lo nuevo. Probado contra el corte del 16 oct (tests/test_semanas_16oct.py)."""
    if not viejo:
        return {**nuevo, 'total': sum(nuevo[t] for t in TOOLS), 'detalle': True}
    out = {t: max(int(viejo.get(t, 0)), int(nuevo.get(t, 0))) for t in TOOLS}
    out['total'] = sum(out.values())
    wf = dict(viejo.get('wf_conteo') or {})
    for k, n in nuevo['wf_conteo'].items():
        wf[k] = max(wf.get(k, 0), n)
    out.update({'dias_activos': max(int(viejo.get('dias_activos', 0)), nuevo['dias_activos']), 'wf_conteo': wf,
                'ultima': max(filter(None, [viejo.get('ultima'), nuevo['ultima']])), 'detalle': True})
    return out


def desde_export(s, uploads, fin):
    """Agrega las semanas completas (lunes a viernes) que cubre el export, con detalle. Reemplaza lo que
    hubiera para esas semanas."""
    sys.path.insert(0, os.path.join(REPO, 'scripts'))
    import etl
    ev, meta = etl.load_events(uploads)
    ev['tool'] = [etl.classify(x, False, v) for x, v in zip(ev['superficie'], ev['vault'])]
    ev = ev[ev['tool'] != 'OTRO'].copy()
    ev['fecha'] = ev['ts'].dt.date
    desde, hasta = ev['fecha'].min(), ev['fecha'].max()
    nuevas = []
    for mon, fri in etl.corte_windows(fin, 20):
        if mon < desde or fri > fin or fri > hasta + timedelta(days=3):
            continue
        v = str(fri)
        nuevas.append(v)
        m = ev[(ev['fecha'] >= mon) & (ev['fecha'] <= fri)]
        for uid, g in m.groupby('user_id'):
            wf = g[g['tool'] == 'W']['workflow'].dropna()
            wf = wf[~wf.isin(WF_GENERICOS)]
            cnt = {t: int((g['tool'] == t).sum()) for t in TOOLS}
            nuevo = {**cnt, 'dias_activos': int(g['fecha'].nunique()),
                     'wf_conteo': {k: int(n) for k, n in wf.value_counts().items()}, 'ultima': str(g['ts'].max())}
            s['personas'].setdefault(uid, {})[v] = combinar(s['personas'][uid].get(v), nuevo)
    s['cubiertas'] = sorted(set(s['cubiertas']) | set(nuevas))
    s['personas'] = {u: w for u, w in s['personas'].items() if w}
    return nuevas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--desde-estado', action='store_true')
    ap.add_argument('--hasta')
    ap.add_argument('--uploads')
    ap.add_argument('--corte-fin')
    a = ap.parse_args()
    s = desde_estado(a.hasta) if a.desde_estado else cargar()
    if a.uploads:
        nuevas = desde_export(s, a.uploads, date.fromisoformat(a.corte_fin))
        print('Semanas del export:', ', '.join(nuevas) or 'ninguna completa')
    guardar(s)
    print(f"OK: {ruta()} | {len(s['cubiertas'])} semanas ({s['cubiertas'][0] if s['cubiertas'] else '-'} a "
          f"{s['cubiertas'][-1] if s['cubiertas'] else '-'}) | {len(s['personas'])} personas")


if __name__ == '__main__':
    main()
