#!/usr/bin/env python3
"""
corte_de_caja.py: cierre del corte para Tony (14 oct 2026). Corre al final de correr_corte.sh.

Uso: python3 scripts/corte_de_caja.py --corte-fin 2026-10-16 [--hil <fetch del HIL>]

Cuatro bloques, en texto plano (consola y out/CorteDeCaja_<fecha>.md):
  1. Decisiones y su estado: tests/test_decisiones.py con el viernes del corte como referencia.
  2. Pendientes de Tony: los del ultimo docs/HANDOFF_*.md y las decisiones en estado pendiente.
  3. La semana que viene: sesiones de capacitacion con su gente, choques con ausencias (y con alertas
     amarillas si ya corrio capacitacion.py), personas con dos roles y quien esta fuera por SD.
  4. Cambios del HIL: sync_notion.py sin escribir, si se pasa --hil (markdown o el JSON del conector).
No calcula metricas ni cambia datos: solo lee y reporta.
"""
import argparse
import glob
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from datetime import date, timedelta

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO, 'scripts'))
sys.path.insert(0, os.path.join(REPO, 'tests'))
from capacitacion import SDS, ausencia, dias_sesion, revisar_fijos, roles_fijos  # noqa: E402
from test_decisiones import evaluar  # noqa: E402

ROL = {'coordina': 'coordina', 'apoyo': 'apoyo', 'experto': 'experta/o'}


def j(rel):
    return json.load(open(os.path.join(REPO, rel)))


def pendientes_handoff():
    hs = sorted(glob.glob(os.path.join(REPO, 'docs', 'HANDOFF_*.md')))
    if not hs:
        return None, []
    txt = open(hs[-1], encoding='utf-8').read()
    m = re.search(r'^## Pendientes que dependen de Tony\s*\n(.*?)(?=^## |\Z)', txt, re.S | re.M)
    items = re.findall(r'^\d+\.\s+(.+)$', m.group(1), re.M) if m else []
    items = [x for x in items if not x.lower().startswith('hecho')]   # cerrados se marcan "Hecho (...)"
    return os.path.relpath(hs[-1], REPO), items


def hil_markdown(path):
    t = open(path, encoding='utf-8').read()
    if t.lstrip().startswith('{'):
        try:
            t = json.loads(t)['text']
        except (ValueError, KeyError):
            pass
    return t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corte-fin', required=True)
    ap.add_argument('--hil', help='fetch del HIL guardado fuera del repo')
    a = ap.parse_args()
    fin = date.fromisoformat(a.corte_fin)
    R = j('data/roster.json')['personas']
    excs = j('data/excepciones.json')['excepciones']
    cal = j('data/capacitaciones.json')['sesiones']
    L = []
    nom = lambda u: R.get(u, {}).get('nombre', u)  # noqa: E731

    L.append(f'CORTE DE CAJA | corte al {fin:%d/%m/%Y}')
    L.append('')

    # 1. Decisiones
    res = evaluar(fin)
    L.append(f"1. DECISIONES: {sum(r[1] == 'ok' for r in res)} ok, {sum(r[1] == 'pendiente' for r in res)} pendientes, "
             f"{sum(r[1] == 'falla' for r in res)} con falla")
    for nombre, estado, detalle in sorted(res, key=lambda r: ['falla', 'pendiente', 'ok'].index(r[1])):
        L.append(f'   [{estado.upper()}] {nombre}: {detalle}')
    L.append('')

    # 2. Pendientes de Tony
    fuente, items = pendientes_handoff()
    L.append(f'2. PENDIENTES TUYOS ({fuente or "sin handoff"})')
    for i, x in enumerate(items, 1):
        L.append(f'   {i}. {x}')
    for s in sorted(cal, key=lambda s: s['fecha']):
        if 'por confirmar' in s.get('nota', '').lower() and dias_sesion(s)[1] >= fin:
            L.append(f"   * {s['fecha_txt']}, {s['tema']}: {s['nota']}")
    for nombre, estado, detalle in res:
        if estado == 'pendiente':
            L.append(f'   * {nombre}: {detalle}')
    L.append('')

    # 3. La semana que viene
    lun = fin + timedelta(days=(7 - fin.weekday()) % 7 or 7)
    vie = lun + timedelta(days=4)
    L.append(f'3. LA SEMANA QUE VIENE ({lun:%d/%m} al {vie:%d/%m})')
    prox = [s for s in sorted(cal, key=lambda s: s['fecha']) if lun <= dias_sesion(s)[0] <= vie]
    cap_path = os.path.join(REPO, 'out', f'CAP_{a.corte_fin}.json')
    con_datos = os.path.exists(cap_path)
    if con_datos:
        avisos = [x for x in j(os.path.relpath(cap_path, REPO)).get('avisos_fijos', []) if x['sesion'] in {s['tema'] for s in prox}]
    else:
        avisos = revisar_fijos(prox, excs, R)
    if not prox:
        L.append('   Sin capacitaciones.')
    for s in prox:
        L.append(f"   {s['fecha_txt']} | {s['tema']}{'' if s.get('fijo') else ' | SIN FIJAR (rotación/auto)'}")
        for rol, u in roles_fijos(s):
            L.append(f'      {ROL[rol]}: {nom(u)}')
    if avisos:
        L.append('   Choques:')
        for x in avisos:
            L.append(f"      ! {x.get('nombre') or '-'} ({ROL.get(x['rol'], x['rol'])}, {x['sesion']}): {x['motivo']}")
    else:
        L.append('   Choques: ninguno' + ('' if con_datos else ' con ausencias (alertas amarillas: sin CAP de este corte)'))
    carga = defaultdict(list)
    for s in prox:
        for rol, u in roles_fijos(s):
            carga[u].append(s['tema'])
    for u, ts in carga.items():
        if len(ts) > 1:
            L.append(f'   Doble rol: {nom(u)} en {len(ts)} sesiones ({"; ".join(ts)})')
    fuera = defaultdict(list)
    for u, p in R.items():
        if p['sd'] in SDS:
            e = ausencia(u, lun, vie, excs, R, solo_personal=True)
            if e:
                fuera[p['sd']].append(f"{p['nombre']}{' (Champion)' if p.get('champion') else ''}, {e['tipo'].lower()} "
                                      f"{date.fromisoformat(e['desde']):%d/%m}-{date.fromisoformat(e['hasta']):%d/%m}")
    sd_ex = [e for e in excs if e.get('sd') and date.fromisoformat(e['desde']) <= vie and date.fromisoformat(e['hasta']) >= lun]
    L.append('   Fuera:' + ('' if fuera or sd_ex else ' nadie registrado'))
    for sd in SDS:
        if fuera[sd]:
            L.append(f"      {sd}: {'; '.join(fuera[sd])}")
    for e in sd_ex:
        L.append(f"      {'Toda la DJ' if e['sd'] == 'TODA_DJ' else 'Toda ' + e['sd']}: {e['tipo']} {e['desde']} a {e['hasta']}")
    L.append('')

    # 4. HIL
    L.append('4. CAMBIOS DEL HIL')
    if a.hil:
        md = hil_markdown(a.hil)
        m = re.search(r'as of (\d{4}-\d{2}-\d{2})', md)
        tmp = a.hil + '.md' if not a.hil.endswith('.md') else a.hil
        if tmp != a.hil:
            open(tmp, 'w', encoding='utf-8').write(md)
        r = subprocess.run([sys.executable, os.path.join(REPO, 'scripts', 'sync_notion.py'), tmp], capture_output=True, text=True)
        if m:
            L.append(f'   HIL editado por última vez: {m.group(1)}')
        for x in (r.stdout + r.stderr).strip().splitlines():
            L.append('   ' + x)
        if 'sin cambios' not in r.stdout or r.stdout.count('sin cambios') < 2:
            L.append('   Hay diferencias: revisarlas y aplicar con sync_notion.py --escribir (y correr las pruebas).')
    else:
        L.append(f"   Sin fetch del HIL en esta corrida. Última sincronización: roster {j('data/roster.json').get('_sincronizado', '?')}, "
                 f"excepciones {j('data/excepciones.json').get('_sincronizado', '?')}. Pasar --hil (o HIL=... en correr_corte.sh).")

    texto = '\n'.join(L)
    print(texto)
    os.makedirs(os.path.join(REPO, 'out'), exist_ok=True)
    open(os.path.join(REPO, 'out', f'CorteDeCaja_{a.corte_fin}.md'), 'w', encoding='utf-8').write(texto + '\n')


if __name__ == '__main__':
    main()
