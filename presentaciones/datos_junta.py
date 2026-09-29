#!/usr/bin/env python3
"""Cifras de adopcion para la junta mensual con Juridico. Uso: python3 presentaciones/datos_junta.py 2026-09-25
Mismas funciones del ETL (carga, clasificacion, cortes). Universo: toda la Direccion Juridica (Tony,
29 sep 2026): las 65 personas de las 6 SD mas la Directora (zmanzur) y jbueno, que en la junta se
muestran como fila "DJ". Sin cortesias externas. (Los reportes semanales siguen excluyendo a
zmanzur y jbueno de las metricas por SD.) Semanas asignadas al mes de su viernes."""
import json, os, sys
from datetime import date
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts'))
import etl
fin = date.fromisoformat(sys.argv[1])
ev, meta = etl.load_events(etl.UPLOADS_DEFAULT)
ev['tool'] = [etl.classify(s, False, v) for s, v in zip(ev['superficie'], ev['vault'])]
ev = ev[ev.tool != 'OTRO']; ev['fecha'] = ev['ts'].dt.date
R = json.load(open(os.path.join(etl.REPO, 'data', 'roster.json')))['personas']
SDS = ['ENN', 'CN', 'PLD', 'GC', 'JC', 'RL', 'DJ']
sd_de = lambda u: 'DJ' if R[u].get('excluido_metricas') else R[u]['sd']
jur = {u for u, p in R.items() if p['sd'] in SDS or p.get('excluido_metricas')}
e = ev[ev.user_id.isin(jur)]
MES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
semanas = []
for mon, fri in etl.corte_windows(fin, 15):
    m = e[(e.fecha >= mon) & (e.fecha <= fri)]
    semanas.append({'corte': etl.label(mon, fri), 'mes': MES[fri.month - 1], 'acciones': len(m),
                    'activas': int(m.user_id.nunique()),
                    'tools': {t: int((m.tool == t).sum()) for t in ['A', 'Wo', 'V', 'W', 'O']},
                    'workflows': sorted(set(m[m.tool == 'W'].workflow.dropna())),
                    'sd': {sd: int(m.user_id.map(lambda u: sd_de(u) == sd).sum()) for sd in SDS}})
meses = {}
for s in semanas:
    meses.setdefault(s['mes'], []).append(s)
res = []
for mes, ss in meses.items():
    n = len(ss); tot = sum(s['acciones'] for s in ss)
    tools = {t: sum(s['tools'][t] for s in ss) for t in ['A', 'Wo', 'V', 'W', 'O']}
    res.append({'mes': mes, 'semanas': n, 'acciones_semana': round(tot / n), 'activas_semana': round(sum(s['activas'] for s in ss) / n, 1),
                'mezcla_pct': {t: round(100 * v / tot) for t, v in tools.items()},
                'w_semana': round(tools['W'] / n), 'o_semana': round(tools['O'] / n),
                'workflows_distintos': len(set(w for s in ss for w in s['workflows'])),
                'sd_semana': {sd: round(sum(s['sd'][sd] for s in ss) / n) for sd in SDS}})
out = {'universo': len(jur), 'semanas': [{k: v for k, v in s.items() if k != 'workflows'} for s in semanas], 'meses': res,
       'datos_desde': meta['datos_desde'], 'datos_hasta': meta['datos_hasta']}
os.makedirs(os.path.join(etl.REPO, 'out'), exist_ok=True)
json.dump(out, open(os.path.join(etl.REPO, 'out', f'junta_{fin}.json'), 'w'), ensure_ascii=False, indent=1)
for r in res: print(r)
print([ (s['corte'], s['acciones'], s['activas']) for s in semanas][0], [(s['corte'], s['acciones'], s['activas']) for s in semanas][-1])
