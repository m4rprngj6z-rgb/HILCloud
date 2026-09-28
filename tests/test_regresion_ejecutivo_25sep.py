#!/usr/bin/env python3
"""
Regresion del Ejecutivo: el ETL debe reproducir las cifras de los 6 Ejecutivos aprobados del
25 sep 2026 (acciones, semana anterior, workflows, personas activas, usos clave) y el conteo del
semaforo de ENN (unica SD que ya usaba el semaforo propio). La Vista por Gerencia NO se compara:
cambio a propósito a totales de gerencia (Tony, 28 sep 2026).
"""
import json
import os
import re
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts'))
import etl  # noqa: E402

fx = json.load(open(os.path.join(os.path.dirname(__file__), 'fixtures', 'aprobado_ejecutivo_25sep2026.json')))['sd']
fallas, ok = [], 0
for sd, ap in fx.items():
    d = etl.build(date(2026, 9, 25), sd, etl.UPLOADS_DEFAULT)
    t = d['totales']
    for k in ['acciones', 'acciones_anterior', 'workflows', 'personas_activas', 'personas']:
        if t[k] == ap[k]:
            ok += 1
        else:
            fallas.append(f'{sd} {k}: ETL={t[k]} aprobado={ap[k]}')
    mis = [[u['persona'], u['uso'], u['veces']] for u in d['usos_clave']]
    orden = lambda xs: sorted(xs, key=lambda u: (-u[2], u[0]))   # empates: el viejo desempataba al azar
    if orden(mis) == orden(ap['usos_clave']):
        ok += 1
    else:
        fallas.append(f'{sd} usos clave: ETL={mis} aprobado={ap["usos_clave"]}')
    if sd == 'ENN':
        cuenta = {s: sum(1 for r in d['rows'] if r['semaforo'] == s) for s in ['verde', 'amarillo', 'rojo']}
        esp = [int(re.findall(r'\d+', x)[0]) for x in ap['semaforo'][:3]]
        got = [cuenta['verde'], cuenta['amarillo'], cuenta['rojo']]
        if got == esp:
            ok += 1
        else:
            fallas.append(f'ENN semaforo: ETL={got} aprobado={esp}')
print(f'Comparaciones iguales: {ok}')
print(f'FALLAS: {len(fallas)}')
for f in fallas:
    print('  X', f)
sys.exit(1 if fallas else 0)
