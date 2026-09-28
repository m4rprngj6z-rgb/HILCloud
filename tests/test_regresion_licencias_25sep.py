#!/usr/bin/env python3
"""Regresion de Gobierno de Licencias contra GobiernoDeLicencias_25sep2026.docx aprobado: acciones de
la semana del top 10 juridico y del ranking no juridico, y total de 8 semanas del radar. Diferencias
esperadas (documentadas): el top incluye empates en el lugar 10 (Karla Guerrero, Oscar Monteverde) y
PLD no suma aparicion (semana de excepcion por cierre de la reestructuracion)."""
import json, os, subprocess, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEMANA = {'Julián Centeno': 0, 'Patsy Godínez': 0, 'Fernando Yhibran Medina': 0, 'Ana Karen Martínez': 0, 'César Berelleza': 0,
          'Karla Zetina': 1, 'Rocío Fernández': 1, 'Ana Lilia Ramírez Barranco': 2, 'Juan Miguel Gálvez': 3, 'Kelly Hernández': 3,
          'Bryan Trujillo': 0, 'George Chirinos': 150}
OCHO = {'Julián Centeno': 13, 'Patsy Godínez': 47, 'Fernando Yhibran Medina': 40, 'Ana Karen Martínez': 81, 'César Berelleza': 58,
        'Karla Zetina': 51, 'Rocío Fernández': 19, 'Ana Lilia Ramírez Barranco': 71, 'Juan Miguel Gálvez': 96, 'Kelly Hernández': 11,
        'Bryan Trujillo': 0, 'George Chirinos': 319}
subprocess.run([sys.executable, os.path.join(R, 'scripts', 'licencias.py'), '--corte-fin', '2026-09-25'], check=True, capture_output=True)
d = json.load(open(os.path.join(R, 'out', 'GL_2026-09-25.json')))
todos = {p['nombre']: p for p in d['ranking_juridico_top'] + d['ranking_no_juridico'] + d['radar']}
ok, fallas = 0, []
for n, v in SEMANA.items():
    got = todos.get(n, {}).get('total')
    (ok := ok + 1) if got == v else fallas.append(f'{n} semana: {got} vs {v}')
for n, v in OCHO.items():
    got = todos.get(n, {}).get('total_8s')
    (ok := ok + 1) if got == v else fallas.append(f'{n} 8 semanas: {got} vs {v}')
print(f'Comparaciones iguales: {ok}\nFALLAS: {len(fallas)}')
for f in fallas:
    print('  X', f)
sys.exit(1 if fallas else 0)
