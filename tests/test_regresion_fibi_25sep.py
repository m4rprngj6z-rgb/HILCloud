#!/usr/bin/env python3
"""Regresion del Fibi: cifras DJ y por SD contra FibiDJ_25sep2026.docx aprobado. El conteo de
semaforo por SD no se compara (el aprobado aun usaba el metodo viejo en 5 de 6 SD)."""
import json, os, subprocess, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AP = {'acciones': 1145, 'acciones_anterior': 946, 'personas_activas': 60, 'personas': 65, 'workflows': 147, 'wau_pct': 92,
      'sds': {'ENN': (100.0, 97), 'CN': (86.7, 28), 'PLD': (94.7, -39), 'GC': (100.0, 73), 'JC': (100.0, 66), 'RL': (75.0, 54)}}
for sd in AP['sds']:
    subprocess.run([sys.executable, os.path.join(R, 'scripts', 'etl.py'), '--corte-fin', '2026-09-25', '--sd', sd], check=True, capture_output=True)
subprocess.run([sys.executable, os.path.join(R, 'scripts', 'dj.py'), '--corte-fin', '2026-09-25'], check=True, capture_output=True)
d = json.load(open(os.path.join(R, 'out', 'DJ_2026-09-25.json')))
ok, fallas = 0, []
for k in ['acciones', 'acciones_anterior', 'personas_activas', 'personas', 'workflows']:
    (ok := ok + 1) if d['totales'][k] == AP[k] else fallas.append(f'{k}: {d["totales"][k]} vs {AP[k]}')
(ok := ok + 1) if d['wau_pct'] == AP['wau_pct'] else fallas.append(f'wau: {d["wau_pct"]}')
for s in d['sds']:
    esp = AP['sds'][s['sd']]
    (ok := ok + 1) if (s['wau_pct'], s['delta_pct']) == esp else fallas.append(f'{s["sd"]}: {(s["wau_pct"], s["delta_pct"])} vs {esp}')
print(f'Comparaciones iguales: {ok}\nFALLAS: {len(fallas)}')
for f in fallas:
    print('  X', f)
sys.exit(1 if fallas else 0)
