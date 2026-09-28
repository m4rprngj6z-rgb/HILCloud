#!/usr/bin/env python3
"""
validar_narrativa.py: revisa el texto redactado de un reporte ANTES de generarlo.

El texto (Recomendacion y Accion del Ejecutivo; Casos y Puntos de atencion del Fibi) lo redacta
Claude o Tony en narrativa/<corte>/<SD>.json. El codigo no redacta, pero si vigila:

  1. Ningun numero que no salga del calculo del ETL (evita cifras inventadas o mal copiadas).
  2. Nada de raya larga (preferencia permanente de Tony).
  3. Frases prohibidas por el Estandar (tratamiento politico, "subir a verde", etc.).
  4. Fibi: maximo 2 personas nombradas en todo el documento (regla 11 jul 2026).
  5. Personas nombradas: solo del roster.

Uso: python3 scripts/validar_narrativa.py out/ENN_2026-09-25.json narrativa/2026-09-25/ENN.json
Sale con codigo 1 si algo falla.
"""
import json
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PROHIBIDAS = [
    'tratamiento político', 'tratamiento politico', 'trato especial', 'trato político',
    'subir a verde', 'pasar a verde', 'subir de amarillo', 'llegar a verde',   # el semaforo es consecuencia
    'carga operativa', 'sobrecarga',                                           # fuera de scope (regla 14 sep)
]


def porcentajes_permitidos(etl):
    pc = set()
    for r in etl.get('rows', []):
        if r.get('ratio') is not None:
            pc.add(float(round(r['ratio'] * 100)))
    t = etl.get('totales', {})
    if t.get('acciones_anterior'):
        d = round((t['acciones'] - t['acciones_anterior']) / t['acciones_anterior'] * 100)
        pc.update({float(d), float(abs(d))})
    if t.get('personas'):
        pc.add(float(round(t['personas_activas'] / t['personas'] * 100)))
    pc.add(100.0)
    pc.update(float(x) for x in etl.get('porcentajes', []))   # vista DJ (dj.py)
    return pc


def numeros_permitidos(etl):
    ok = set()

    def walk(x):
        if isinstance(x, bool):
            return
        if isinstance(x, (int, float)):
            ok.add(round(float(x), 1))
            ok.add(float(round(x)))
        elif isinstance(x, str):
            for n in re.findall(r'\d+(?:\.\d+)?', x):
                ok.add(float(n))
        elif isinstance(x, dict):
            for k, v in x.items():
                if k not in ('historial', 'calidad_datos', 'baseline_tool'):   # solo cifras del corte actual
                    walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
    walk(etl)
    for r in etl.get('rows', []):
        if r.get('ratio') is not None:
            ok.add(float(round(r['ratio'] * 100)))
    t = etl.get('totales', {})
    if t.get('acciones_anterior'):
        ok.add(float(round((t['acciones'] - t['acciones_anterior']) / t['acciones_anterior'] * 100)))
        ok.add(float(abs(round((t['acciones'] - t['acciones_anterior']) / t['acciones_anterior'] * 100))))
    if t.get('personas'):
        ok.add(float(round(t['personas_activas'] / t['personas'] * 100)))
    for s in ['verde', 'amarillo', 'rojo', 'excepcion', 'sin_historial']:
        ok.add(float(sum(1 for r in etl.get('rows', []) if r.get('semaforo') == s)))
    return ok


def validar(etl, narr, tipo='ejecutivo'):
    errores = []
    roster = json.load(open(os.path.join(REPO, 'data', 'roster.json')))['personas']
    nombres = {p['nombre'] for p in roster.values()}
    permitidos = numeros_permitidos(etl)
    pct = porcentajes_permitidos(etl)
    textos = []

    def recoger(x, ruta):
        if isinstance(x, str):
            textos.append((ruta, x))
        elif isinstance(x, list):
            for i, v in enumerate(x):
                recoger(v, f'{ruta}[{i}]')
        elif isinstance(x, dict):
            for k, v in x.items():
                recoger(v, f'{ruta}.{k}')
    recoger(narr.get(tipo, {}), tipo)
    if not textos:
        errores.append(f'No hay texto para "{tipo}" en la narrativa.')

    mencionados = set()
    for ruta, t in textos:
        if '—' in t:
            errores.append(f'{ruta}: trae raya larga (em dash).')
        low = t.lower()
        for f in PROHIBIDAS:
            if f in low:
                errores.append(f'{ruta}: frase prohibida "{f}".')
        # numeros: ignora los que son parte de una fecha del corte ("21-25 sep", "2026")
        for m in re.finditer(r'(?<![\w.])(\d+(?:\.\d+)?)(%?)', t):
            n = float(m.group(1))
            if m.group(2) == '%':
                if n not in pct:
                    errores.append(f'{ruta}: el porcentaje {m.group(0)} no coincide con ningún porcentaje calculado por el ETL.')
            elif n not in permitidos:
                errores.append(f'{ruta}: el número {m.group(0)} no sale del cálculo del ETL.')
        for n in nombres:
            if n in t:
                mencionados.add(n)
    if tipo == 'fibi' and len(mencionados) > 2:
        errores.append(f'Fibi: nombra a {len(mencionados)} personas ({", ".join(sorted(mencionados))}); el máximo es 2.')
    return errores, sorted(mencionados)


def main():
    if len(sys.argv) < 3:
        sys.exit('Uso: validar_narrativa.py <etl.json> <narrativa.json> [ejecutivo|fibi]')
    etl = json.load(open(sys.argv[1]))
    narr = json.load(open(sys.argv[2]))
    tipo = sys.argv[3] if len(sys.argv) > 3 else 'ejecutivo'
    errores, mencionados = validar(etl, narr, tipo)
    print(f'Personas nombradas: {", ".join(mencionados) or "ninguna"}')
    if errores:
        print('NARRATIVA RECHAZADA:')
        for e in errores:
            print('  X', e)
        sys.exit(1)
    print('Narrativa OK')


if __name__ == '__main__':
    main()
