#!/usr/bin/env python3
"""
subdirectores.py: comparativo entre las cabezas de las 6 SD (pedido de Karla Mendez, 29 sep 2026).

Uso: python3 scripts/subdirectores.py --corte-fin 2026-09-25 [--semanas 15]
Requiere antes los 6 JSON del ETL (out/<SD>_<fecha>.json). No recalcula: toma el historial por
corte de cada persona que ya produjo etl.py y solo agrega.

Reglas (docs/REGLAS_ETL.md seccion 8f):
- Ventana: las ultimas N semanas completas (15 = 15 jun a 25 sep 2026, desde que hay datos).
- Semanas de excepcion documentada: fuera del promedio y de la mezcla de herramientas (misma
  regla que la linea base). Se dibujan como punto hueco en la tendencia.
- Orden: promedio semanal de acciones en semanas utiles; empate por nombre.
- El semaforo es el del reporte de la semana (contra su propio ritmo), no contra los demas.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import etl  # noqa: E402
from licencias import sparkline  # noqa: E402

REPO = etl.REPO
TOOLS = ['A', 'Wo', 'V', 'W', 'O']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corte-fin', required=True)
    ap.add_argument('--semanas', type=int, default=15)
    a = ap.parse_args()
    roster = json.load(open(os.path.join(REPO, 'data', 'roster.json')))
    carpeta = os.path.join(REPO, 'out', f'sub_graficas_{a.corte_fin}')
    os.makedirs(carpeta, exist_ok=True)
    personas = []
    for sd, uid in roster['subdirectores'].items():
        d = json.load(open(os.path.join(REPO, 'out', f'{sd}_{a.corte_fin}.json')))
        r = next(x for x in d['rows'] if x['usuario'] == uid)
        hist = r['historial'][-a.semanas:]
        utiles = [h for h in hist if not h['excepcion']]
        mezcla = {t: sum(h[t] for h in utiles) for t in TOOLS}
        tot = sum(mezcla.values())
        orden = sorted([t for t in TOOLS if mezcla[t]], key=lambda t: (-mezcla[t], TOOLS.index(t)))
        prom = round(tot / len(utiles), 1) if utiles else None
        ult4 = [h for h in hist[-4:] if not h['excepcion']]
        personas.append({
            'usuario': uid, 'nombre': r['nombre'], 'sd': sd, 'puesto': r['puesto'],
            'esta_semana': r['total'], 'semaforo': r['semaforo'], 'transicion': r.get('transicion', False),
            'ratio': r.get('ratio'),
            'promedio': prom, 'semanas_utiles': len(utiles), 'semanas_excepcion': len(hist) - len(utiles),
            'semanas_con_uso': sum(1 for h in utiles if h['total'] > 0),
            # Si las 4 ultimas son todas de excepcion de su SD, se muestra el promedio crudo marcado
            # (la persona si trabajo; solo no entra a lineas base).
            'promedio_4': round(sum(h['total'] for h in (ult4 or hist[-4:])) / len(ult4 or hist[-4:]), 1),
            'promedio_4_en_excepcion': not ult4,
            'total_periodo': tot, 'mezcla': mezcla,
            'mezcla_pct': {t: round(100 * mezcla[t] / tot) if tot else 0 for t in TOOLS},
            'firma': '>'.join(orden) if orden else 'Sin actividad',
            'workflows': mezcla['W'],
            'serie': [{'corte': h['corte'], 'total': h['total'], 'excepcion': h['excepcion']} for h in hist],
        })
    personas.sort(key=lambda p: (-(p['promedio'] if p['promedio'] is not None else -1), p['nombre']))
    for i, p in enumerate(personas, 1):
        p['lugar'] = i
        p['grafica'] = sparkline(p['serie'], os.path.join(carpeta, f"{p['usuario']}.png"))

    # Lectura: frases armadas con los mismos numeros (sin texto a mano).
    con = [p for p in personas if p['promedio'] is not None]
    top, bot = con[0], con[-1]
    lect = [
        f"Mayor uso sostenido: {top['nombre']} ({top['sd']}), {top['promedio']:g} acciones por semana. "
        f"Menor: {bot['nombre']} ({bot['sd']}), {bot['promedio']:g}.",
    ]
    constantes = [p for p in con if p['semanas_con_uso'] == p['semanas_utiles']]
    lect.append(f"Uso en todas sus semanas útiles: {len(constantes)} de {len(personas)}"
                + (f" ({', '.join(p['nombre'] for p in constantes)})." if constantes else "."))
    sin_w = [p['nombre'] for p in personas if p['workflows'] == 0]
    con_w = [p for p in personas if p['workflows'] > 0]
    if con_w:
        mw = max(con_w, key=lambda p: p['workflows'])
        lect.append(f"Workflow: {len(con_w)} de {len(personas)} lo usaron en el periodo; más ejecuciones: "
                    f"{mw['nombre']} ({mw['workflows']})." + (f" Sin Workflow: {', '.join(sin_w)}." if sin_w else ''))
    arriba = [p['nombre'] + (' (como referencia: su SD cerraba excepción)' if p['transicion'] else '')
              for p in personas if p['semaforo'] == 'verde']
    if arriba:
        lect.append(f"Esta semana, por encima de su propio ritmo: {', '.join(arriba)}.")
    exc = [p for p in personas if p['semanas_excepcion']]
    notas = [f"{p['nombre']}: {p['semanas_excepcion']} de {len(p['serie'])} semanas en excepción documentada de su SD; "
             f"su promedio usa las {p['semanas_utiles']} semanas útiles"
             + (" y el de las últimas 4 semanas es crudo, marcado con *." if p['promedio_4_en_excepcion'] else ".") for p in exc]

    out = {'corte': personas[0]['serie'][-1]['corte'], 'corte_viernes': a.corte_fin,
           'semanas': [h['corte'] for h in personas[0]['serie']], 'personas': personas,
           'lectura': lect, 'notas_excepcion': notas}
    path = os.path.join(REPO, 'out', f'SUB_{a.corte_fin}.json')
    json.dump(out, open(path, 'w'), ensure_ascii=False, indent=1)
    print('OK:', path)
    for p in personas:
        print(p['lugar'], p['nombre'], p['sd'], p['promedio'], p['promedio_4'], p['esta_semana'], p['semaforo'],
              p['semanas_con_uso'], '/', p['semanas_utiles'], p['firma'], p['mezcla_pct'])
    print(*lect, *notas, sep='\n')


if __name__ == '__main__':
    main()
