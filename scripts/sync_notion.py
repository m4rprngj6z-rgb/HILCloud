#!/usr/bin/env python3
"""
sync_notion.py: sincroniza data/roster.json y data/excepciones.json desde el HIL de Notion.

Uso:
  python3 scripts/sync_notion.py <hil.md>            # muestra diferencias, no escribe
  python3 scripts/sync_notion.py <hil.md> --escribir # escribe los dos JSON

<hil.md> = la pagina HIL (notion.so/37df66a17162812a9f53e15cb031792d) en markdown, tal como la
devuelve el fetch del conector de Notion. El script no llama a Notion: la sesion hace el fetch,
guarda el texto y se lo pasa. No versionar ese archivo (trae notas de personal).

Que viene de Notion (Notion gana):
  - Roster, por persona de las 6 SD: sd, nombre, puesto, nivel, rol_hai, f_esperada, champion
    (rol que empieza con estrella), reporta_a (organigrama de la SD) y alta ("Alta DD mmm AAAA"
    en Flags). Tambien quien existe: altas y bajas de usuarios en la tabla maestra.
  - Excepciones: tabla "Excepciones activas", columnas "Fecha inicio/Fecha fin (AAAA-MM-DD)".
    La primera palabra de Persona es el usuario, o "Toda la SD XXX" / "Toda la DJ".

Que NO esta en Notion y se conserva del JSON actual:
  - Campos solo del repo: gerencia, area, nota_licencia, baja_ejecutada, fuera_de_semaforo,
    excluido_metricas, y las llaves de nivel superior (sd_nombres, orden_gerencias...).
  - Personas fuera de las 6 tablas maestras (DJ y cortesias, cuentas especiales): se conservan
    como estan; una cuenta nueva en "DJ y cortesias" se reporta para darla de alta a mano.
  - data/roster_correcciones.json: diferencias deliberadas contra Notion (cada una con motivo).
  - Excepciones: si una fila ya existe (mismo a-quien y mismas fechas), se conserva su tipo y
    nota cortos del repo, porque ese texto sale en los reportes. Filas nuevas toman el Tipo de
    Notion sin el parentesis final.
"""
import argparse
import json
import os
import re
import sys
from datetime import date

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SDS = ['ENN', 'CN', 'PLD', 'GC', 'JC', 'RL']
CAMPOS_NOTION = ['sd', 'nombre', 'puesto', 'nivel', 'rol_hai', 'f_esperada', 'champion', 'reporta_a']
MESES = {m: i + 1 for i, m in enumerate(['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'])}


def limpiar(t):
    t = re.sub(r'<[^>]+>', '', t)
    return t.replace('\\>', '>').replace('\\<', '<').replace('\\[', '[').replace('\\]', ']').strip()


def tablas(md):
    """Lista de (posicion, filas) de cada <table> del markdown; filas = listas de celdas limpias."""
    out = []
    for m in re.finditer(r'<table[^>]*>(.*?)</table>', md, re.S):
        filas = [[limpiar(c) for c in re.findall(r'<td>(.*?)</td>', tr, re.S)]
                 for tr in re.findall(r'<tr>(.*?)</tr>', m.group(1), re.S)]
        out.append((m.start(), [f for f in filas if f]))
    return out


def seccion(md, titulo_regex):
    m = re.search(titulo_regex, md, re.M)
    if not m:
        sys.exit(f'No encuentro la seccion {titulo_regex!r} en el HIL')
    fin = re.search(r'^#{2,3} ', md[m.end():], re.M)
    return m.start(), m.end() + (fin.start() if fin else len(md) - m.end())


def organigrama(texto):
    """'zmanzur → kmendez → [alduarte → nsotelo, migjaimes] [rodosuna] [x directo a kmendez]'
    -> {usuario: jefe}."""
    texto = limpiar(texto)
    jefes = {}
    cabeza, _, grupos = texto.partition('[')
    cadena = [x.strip() for x in cabeza.split('→') if x.strip()]
    for a, b in zip(cadena, cadena[1:]):
        jefes[b] = a
    sub = cadena[-1]
    for g in re.findall(r'\[([^\]]*)\]', '[' + grupos):
        m = re.match(r'\s*(\w+)\s+directo a\s+(\w+)', g)
        if m:
            jefes[m.group(1)] = m.group(2)
            continue
        partes = [x.strip() for x in g.split('→')]
        jefes[partes[0]] = sub
        if len(partes) > 1:
            for u in partes[1].split(','):
                jefes[u.strip()] = partes[0]
    return jefes


def fecha_alta(flags):
    m = re.search(r'Alta(?: confirmada por Tony)? (\d{1,2}) (\w{3})\w* (\d{4})', flags)
    if not m:
        return None
    return str(date(int(m.group(3)), MESES[m.group(2).lower()], int(m.group(1))))


def roster_notion(md):
    todas = tablas(md)
    personas, jefes = {}, {}
    for sd in SDS:
        a, b = seccion(md, rf'^### .*\b{sd},')
        cuerpo = md[a:b]
        t = next((f for pos, f in todas if a <= pos < b), None)
        if not t or t[0][:2] != ['Usuario', 'Nombre']:
            sys.exit(f'La tabla maestra de {sd} cambio de formato: {t[0] if t else None}')
        h = t[0]
        ix = {c: h.index(c) for c in ['Usuario', 'Nombre', 'Puesto', 'Nivel', 'Rol HAI', 'F. esperada', 'Flags']}
        for f in t[1:]:
            u = f[ix['Usuario']].lstrip('★ ').strip()
            rol = f[ix['Rol HAI']]
            personas[u] = {'sd': sd, 'nombre': f[ix['Nombre']], 'puesto': f[ix['Puesto']],
                           'nivel': f[ix['Nivel']], 'rol_hai': rol, 'f_esperada': f[ix['F. esperada']],
                           'champion': rol.startswith('★'), 'alta': fecha_alta(f[ix['Flags']])}
        m = re.search(r'\*\*Organigrama:\*\*(.*)', cuerpo)
        if not m:
            sys.exit(f'Sin organigrama en {sd}')
        jefes.update(organigrama(m.group(1)))
    for u, p in personas.items():
        p['reporta_a'] = jefes.get(u)
    # Cuentas fuera de las tablas maestras: "DJ y cortesias" y "Cuentas especiales" (JC)
    a, b = seccion(md, r'^### .*DJ y cortes')
    otras = [f[0] for pos, t in todas if a <= pos < b for f in t[1:]]
    for m in re.finditer(r'\*\*Cuentas especiales[^*]*\*\*', md):
        t = next(t for pos, t in todas if pos > m.end())
        otras += [f[0] for f in t[1:]]
    return personas, otras


def excepciones_notion(md):
    a, b = seccion(md, r'^## .*Excepciones activas')
    t = next(f for pos, f in tablas(md) if a <= pos < b)
    h = t[0]
    i0, i1 = h.index('Fecha inicio (AAAA-MM-DD)'), h.index('Fecha fin (AAAA-MM-DD)')
    out = []
    for f in t[1:]:
        persona, tipo = f[0], re.sub(r'\s*\([^)]*\)\s*$', '', f[2]).strip()
        d0, d1 = f[i0], f[i1]
        for d in (d0, d1):
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', d):
                sys.exit(f'Excepcion sin fecha AAAA-MM-DD valida: {persona!r} ({d!r}). Llenar en Notion.')
        if persona.startswith('Toda la DJ'):
            e = {'sd': 'TODA_DJ'}
        elif persona.startswith('Toda la SD'):
            e = {'sd': persona.split()[3]}
        else:
            e = {'personas': [persona.split()[0]]}
        out.append({**e, 'tipo': tipo, 'desde': d0, 'hasta': d1})
    return out


def clave(e):
    return (tuple(e.get('personas', [])), e.get('sd'), e['desde'], e['hasta'])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('hil')
    ap.add_argument('--escribir', action='store_true')
    a = ap.parse_args()
    md = open(a.hil, encoding='utf-8').read()
    hoy = str(date.today())

    # ---- Roster
    rpath = os.path.join(REPO, 'data', 'roster.json')
    cpath = os.path.join(REPO, 'data', 'roster_correcciones.json')
    actual = json.load(open(rpath, encoding='utf-8'))
    correc = json.load(open(cpath, encoding='utf-8'))['correcciones']
    notion, otras = roster_notion(md)
    nuevo = {k: v for k, v in actual.items() if k != 'personas'}
    nuevo['_sincronizado'] = hoy
    P, cambios = {}, []
    for u, p in actual['personas'].items():
        if u in notion:
            n = dict(notion[u])
            alta = n.pop('alta')
            q = {**p, **n}
            if alta:
                q['alta'] = alta
            for campo, valor in correc.get(u, {}).items():
                if not campo.startswith('_'):
                    q[campo] = valor
            for campo in CAMPOS_NOTION + ['alta']:
                if p.get(campo) != q.get(campo):
                    cambios.append(f'  {u}.{campo}: {p.get(campo)!r} -> {q.get(campo)!r}')
            P[u] = q
        elif p['sd'] in SDS and u not in otras:
            cambios.append(f'  BAJA {u} ({p["sd"]}, {p["nombre"]}): ya no esta en la tabla maestra')
        else:
            P[u] = p   # DJ, cortesias o cuenta especial: no vive en las tablas maestras
    for u, n in notion.items():
        if n['reporta_a'] is None and not correc.get(u, {}).get('reporta_a'):
            cambios.append(f'  REVISAR {u} ({n["sd"]}): no aparece en el organigrama de su SD')
        if u not in actual['personas']:
            n = {k: v for k, v in n.items() if v is not None or k == 'reporta_a'}
            P[u] = {**n, **{k: v for k, v in correc.get(u, {}).items() if not k.startswith('_')}}
            cambios.append(f'  ALTA {u} ({n["sd"]}, {n["nombre"]}); si es gerente, agregarle gerencia y orden_gerencias')
    for u in otras:
        if u not in P:
            cambios.append(f'  REVISAR {u}: nuevo en "DJ y cortesias" o "Cuentas especiales"; darlo de alta a mano (sd, area)')
    nuevo['personas'] = dict(sorted(P.items(), key=lambda kv: (kv[1]['sd'], kv[0])))
    # mismo orden que el archivo actual para que el diff de git sea legible
    orden = list(actual['personas'])
    nuevo['personas'] = {u: nuevo['personas'][u] for u in orden if u in nuevo['personas']} | \
        {u: v for u, v in nuevo['personas'].items() if u not in orden}

    # ---- Excepciones
    epath = os.path.join(REPO, 'data', 'excepciones.json')
    eact = json.load(open(epath, encoding='utf-8'))
    previas = {clave(e): e for e in eact['excepciones']}
    enuevas, ecambios = [], []
    for e in excepciones_notion(md):
        k = clave(e)
        if k in previas:
            enuevas.append(previas[k])   # conserva tipo/nota cortos del repo
        else:
            enuevas.append(e)
            ecambios.append(f'  NUEVA {e}')
    for k, e in previas.items():
        if k not in {clave(x) for x in enuevas}:
            ecambios.append(f'  YA NO ESTA {e}')
    eout = {**eact, '_sincronizado': hoy, 'excepciones': enuevas}

    print(f'Roster: {len(notion)} personas en las tablas maestras, {len(P)} en total')
    print('\n'.join(cambios) if cambios else '  sin cambios')
    print(f'Excepciones: {len(enuevas)} filas')
    print('\n'.join(ecambios) if ecambios else '  sin cambios')
    nuevo = {k: nuevo[k] for k in actual}   # mismo orden de llaves que el archivo actual
    if a.escribir:
        json.dump(nuevo, open(rpath, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        json.dump(eout, open(epath, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('Escrito. Correr las pruebas de regresion antes de commitear.')
    elif cambios or ecambios:
        print('(sin escribir: agregar --escribir para aplicar)')


if __name__ == '__main__':
    main()
