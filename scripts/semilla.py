#!/usr/bin/env python3
"""
semilla.py: historial semanal por persona tomado de estado/, para las semanas que los exports
crudos del corte no cubren (Tony, 16 y 23 oct 2026: que cada corte solo necesite el export de la
semana, sin volver a subir los de junio en adelante).

Fuente: el corte mas reciente en estado/<viernes>/ anterior al corte que se corre.
- <SD>_<viernes>.json -> rows[].historial[]: acciones por herramienta (A, Wo, V, W, O) por semana.
- GL_<viernes>.json -> series de acciones totales de cuentas no juridicas y aparte (cortesias, DJ).

Lo que la semilla NO trae (no se guardo por semana): dias activos, workflows distintos y conteo por
workflow. Por eso:
- Diversidad de Workflows promedia solo las semanas del ciclo con detalle (export crudo) y el JSON lo
  dice en calidad_datos.semanas_semilla.
- El workflow mas usado del ciclo se desempata solo con las semanas con detalle.

Regla: una semana usa la semilla solo si el export crudo no la cubre completa (su lunes es anterior
al primer dato crudo). Lo crudo siempre gana.
"""
import glob
import json
import os
from datetime import date

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SDS = ['ENN', 'CN', 'PLD', 'GC', 'JC', 'RL']
TOOLS = ['A', 'Wo', 'V', 'W', 'O']


def carpeta(corte_fin, forzar=None):
    """Carpeta de estado/ a usar: la indicada, o la mas reciente con viernes < corte_fin que tenga las 6 SD."""
    if forzar:
        return forzar
    cands = []
    for d in glob.glob(os.path.join(REPO, 'estado', '20*')):
        v = os.path.basename(d)
        try:
            vf = date.fromisoformat(v)
        except ValueError:
            continue
        if vf < corte_fin and all(os.path.exists(os.path.join(d, f'{sd}_{v}.json')) for sd in SDS):
            cands.append((vf, d))
    return max(cands)[1] if cands else None


_CACHE = {}


def cargar(corte_fin, forzar=None):
    """{(usuario, viernes_iso): {'A','Wo','V','W','O','total'}} y la carpeta usada."""
    d = carpeta(corte_fin, forzar or os.environ.get('SEMILLA'))
    if d in _CACHE:
        return _CACHE[d], d
    sem = {}
    if d:
        v = os.path.basename(d)
        for sd in SDS:
            for r in json.load(open(os.path.join(d, f'{sd}_{v}.json'), encoding='utf-8'))['rows']:
                for h in r.get('historial', []):
                    if not h.get('con_datos'):
                        continue
                    c = {t: int(h.get(t, 0) or 0) for t in TOOLS}
                    c['total'] = int(h.get('total', sum(c.values())))
                    sem[(r['usuario'], h['viernes'])] = c
        gl = os.path.join(d, f'GL_{v}.json')
        if os.path.exists(gl):
            g = json.load(open(gl, encoding='utf-8'))
            for k in ('ranking_no_juridico', 'aparte', 'radar', 'candidatos', 'ranking_juridico_top'):
                lst = g.get(k)
                if not isinstance(lst, list):
                    continue
                for p in lst:
                    for s in (p.get('serie', []) if isinstance(p, dict) else []):
                        if s.get('con_datos') and (p['usuario'], s['viernes']) not in sem:
                            sem[(p['usuario'], s['viernes'])] = {'total': int(s['total'])}
    _CACHE[d] = sem
    return sem, d
