#!/usr/bin/env python3
"""
Regresion: el ETL debe reproducir los reportes Champion aprobados del 26 sep 2026
(corte 21-25 sep, Outlook dentro de A, que era el criterio vigente ese dia).

Uso: python3 tests/test_regresion_26sep.py [--uploads DIR]

Diferencias ESPERADAS (documentadas en docs/REGLAS_ETL.md, seccion 9), no cuentan como falla:
  - PLD completo: el 26 sep se califico con semaforo; despues Tony confirmo que la
    reestructuracion cerro el 23-24 sep, asi que 21-25 sep ya es semana de excepcion.
  - Karime Sotelo (motivo): el generador viejo calculaba la linea base por herramienta sin
    excluir semanas de excepcion; el ETL las excluye en ambos lados (regla del HIL).
  - Gramatica: "Caida parejo/concentrado" -> "Caida pareja/concentrada".
"""
import argparse
import json
import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts'))
import etl  # noqa: E402

SEM = {'VERDE': 'verde', 'AMARILLO': 'amarillo', 'ROJO': 'rojo', 'EXCEPCIÓN': 'excepcion'}
ESPERADAS_MOTIVO = {'Karime Sotelo', 'Alfredo Duarte'}   # Alfredo: nota post-excepcion obligatoria (HIL)
ESPERADAS_FIRMA = {'Javier García'}   # empate Wo=W: el generador viejo desempataba por orden de aparicion


def plano(parts):
    return ''.join(p['text'] for p in parts)


def norm(s):
    return (s.replace('Caída parejo', 'Caída pareja').replace('Caída concentrado', 'Caída concentrada')
             .replace('Vacaciones (17 sep-2 oct 2026)', 'Vacaciones (17 sep-2 oct 2026)'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--uploads', default=etl.UPLOADS_DEFAULT)
    a = ap.parse_args()
    fx = json.load(open(os.path.join(os.path.dirname(__file__), 'fixtures', 'aprobado_champion_26sep2026.json')))['filas']
    fallas, esperadas, ok = [], [], 0
    for sd in ['ENN', 'CN', 'PLD', 'GC', 'JC', 'RL']:
        out = etl.build(date(2026, 9, 25), sd, a.uploads, o_en_a=True, vault_solo_superficie=True)
        mine = {r['nombre']: r for r in out['rows']}
        for f in [x for x in fx if x['sd'] == sd]:
            r = mine.get(f['persona'])
            if r is None:
                fallas.append(f"{sd} {f['persona']}: no esta en el ETL")
                continue
            checks = {
                'conteos': ((r['a'], r['wo'], r['v'], r['w']), tuple(int(f[k]) for k in ['A', 'Wo', 'V', 'W'])),
                'semaforo': (r['semaforo'], SEM.get(f['sem'], f['sem'])),
                'urgencia': (r['urgencia'], f['urg']),
                'firma': (r['firma'], f['firma']),
                'motivo': (plano(r['motivo']), norm(f['motivo'])),
                'fortaleza': (plano(r['fortaleza']), f['fort']),
            }
            for k, (got, exp) in checks.items():
                if got == exp:
                    ok += 1
                    continue
                msg = f"{sd} {f['persona']} [{k}] ETL={got!r} aprobado={exp!r}"
                if (sd == 'PLD' and k != 'conteos') or (k == 'motivo' and f['persona'] in ESPERADAS_MOTIVO) or (k == 'firma' and f['persona'] in ESPERADAS_FIRMA):
                    esperadas.append(msg)
                else:
                    fallas.append(msg)
    print(f'Comparaciones iguales: {ok}')
    print(f'Diferencias esperadas (documentadas): {len(esperadas)}')
    for m in esperadas:
        print('  ~', m)
    print(f'FALLAS: {len(fallas)}')
    for m in fallas:
        print('  X', m)
    sys.exit(1 if fallas else 0)


if __name__ == '__main__':
    main()
