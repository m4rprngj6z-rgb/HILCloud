"""Medicion de la sesion de Workflow del jue 15 oct 2026 (Tony, 15 oct 2026). Corre con los exports del
corte 12-16 oct; no recalcula nada del ETL.

1. Borrador -> publicado: workflows creados por las 65 personas en el export de workflows del corte,
   contra la linea base del 9 oct (19 de 19 en borrador). Si existe la lista de esos 19
   (estado/2026-10-09/WF_borradores_2026-10-09.json, con ID o Nombre+Creador), se compara uno por uno;
   si no, solo por conteo y lo dice.
2. Compartidos: workflows usados por 2 o mas personas en el export de uso de 30 dias que cierra en el
   corte (misma regla que datos_workflow.py). Linea base: 6. Meta al corte del 30 oct.
3. Asistencia contra actividad del dia de la sesion: por persona, acciones en superficie WORKFLOW,
   pruebas (WORKFLOW_TEST) y ejecuciones de workflows publicados ese dia, y workflows creados ese dia.
   Si se pasa la lista de asistencia de Teams (--asistencia, CSV o XLSX con columna de correo o
   nombre), cruza: asistio con actividad, asistio sin actividad, actividad sin registro de asistencia.
   Marca a los obligatorios de PLD (handoff 15 oct).

Uso: python3 presentaciones/medir_sesion_workflow.py --corte-fin 2026-10-16 --uploads <carpeta>
       [--dia 2026-10-15] [--asistencia <archivo>]
Salida: out/WF_medicion_<corte>.json y resumen en consola. Copiar el JSON a estado/<corte>/.
"""
import argparse
import glob
import json
import os
import unicodedata

import pandas as pd

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SDS = ['ENN', 'CN', 'PLD', 'GC', 'JC', 'RL']
NO_WF = {'Assist', 'Word Add-In Assistant', 'Outlook Add-In Assistant'}
BASE = os.path.join(RAIZ, 'estado', '2026-10-09')
OBLIGATORIOS_PLD = ['jepallares', 'mamanzano', 'gubernal', 'rcenturion', 'acasillas', 'msotomayor', 'cjreyes',
                    'gaguerrero', 'imbecerra', 'kshernandez', 'dammercado', 'radimas']


def col(d, *opciones):
    """Primera columna que coincide (espanol o ingles; sin acentos ni mayusculas)."""
    n = {sin_acentos(c): c for c in d.columns}
    for o in opciones:
        if sin_acentos(o) in n:
            return n[sin_acentos(o)]
    for o in opciones:
        for k, c in n.items():
            if sin_acentos(o) in k:
                return c
    return None


def sin_acentos(t):
    return ''.join(c for c in unicodedata.normalize('NFKD', str(t).lower()) if not unicodedata.combining(c)).strip()


def ultimo(patron):
    fs = sorted(glob.glob(patron))
    return fs[-1] if fs else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corte-fin', required=True)
    ap.add_argument('--uploads', default='/mnt/user-data/uploads')
    ap.add_argument('--dia', default='2026-10-15')
    ap.add_argument('--asistencia')
    a = ap.parse_args()
    R = json.load(open(os.path.join(RAIZ, 'data', 'roster.json')))['personas']
    uni = {u for u, p in R.items() if p['sd'] in SDS and not p.get('excluido_metricas') and not p.get('baja_ejecutada')}
    nom = lambda u: R.get(u, {}).get('nombre', u)  # noqa: E731
    base = json.load(open(os.path.join(BASE, 'WF_sesion_2026-10-09.json')))
    out = {'corte_fin': a.corte_fin, 'dia_sesion': a.dia}

    # 1. Borrador -> publicado
    wfx = ultimo(os.path.join(a.uploads, f'workflows_export_*_to_{a.corte_fin}.xlsx')) or ultimo(os.path.join(a.uploads, 'workflows_export_*.xlsx'))
    if wfx:
        wf = pd.read_excel(wfx)
        c_cre, c_st, c_nm = col(wf, 'Creator', 'Creador'), col(wf, 'Status', 'Estado'), col(wf, 'Name', 'Nombre')
        c_id, c_cr = col(wf, 'ID', 'Workflow ID'), col(wf, 'Created', 'Creado', 'Created At')
        wf['u'] = wf[c_cre].astype(str).str.split('@').str[0].str.lower()
        wf = wf[wf.u.isin(uni)].copy()
        pub = wf[wf[c_st].astype(str).str.lower().str.startswith('publi')]
        bl = os.path.join(BASE, 'WF_borradores_2026-10-09.json')
        trans = None
        if os.path.exists(bl):
            b = json.load(open(bl))
            clave = (lambda r: str(r.get('id'))) if c_id and all(x.get('id') for x in b) else (lambda r: f"{r['nombre']}|{r['creador']}")
            claves_b = {clave(x) for x in b}
            act = {(str(r[c_id]) if c_id and all(x.get('id') for x in b) else f"{r[c_nm]}|{r['u']}"): r for _, r in wf.iterrows()}
            trans = [{'nombre': act[k][c_nm], 'quien': nom(act[k]['u'])} for k in claves_b
                     if k in act and str(act[k][c_st]).lower().startswith('publi')]
        nuevos = []
        if c_cr:
            f = pd.to_datetime(wf[c_cr], errors='coerce')
            nuevos = wf[f.dt.date >= pd.Timestamp('2026-10-10').date()]
        out['publicados'] = {
            'fuente': os.path.basename(wfx), 'workflows_dj': int(len(wf)), 'publicados': int(len(pub)),
            'borrador': int(len(wf) - len(pub)),
            'linea_base': base['creados_dj'],
            'paso_a_publicado': trans if trans is not None else 'sin lista base: comparación solo por conteo',
            'publicados_lista': [{'nombre': r[c_nm], 'quien': nom(r['u'])} for _, r in pub.iterrows()],
            'creados_desde_10oct': int(len(nuevos)) if c_cr else 'el export no trae fecha de creación',
        }
    else:
        out['publicados'] = 'falta workflows_export del corte'

    # 2 y 3. Uso
    usage = ultimo(os.path.join(a.uploads, f'harvey-usage-*_end_{a.corte_fin}.xlsx'))
    if usage:
        d = pd.read_excel(usage)
        c_us, c_wf, c_sup = col(d, 'Usuario', 'User'), col(d, 'Nombre del workflow', 'Workflow Name'), col(d, 'Superficie del producto', 'Product Surface Area')
        c_sub, c_t = col(d, 'Subsuperficie', 'Sub Surface Area', 'Subsurface'), col(d, 'Tiempo (Etc/GMT+6)', 'Time (Etc/GMT+6)')
        d['u'] = d[c_us].astype(str).str.split('@').str[0].str.lower()
        d = d[d.u.isin(uni)].copy()
        w = d[d[c_wf].notna() & ~d[c_wf].isin(NO_WF)]
        g = w.groupby(c_wf)['u'].nunique()
        comp = g[g > 1].sort_index()
        out['compartidos'] = {'fuente': os.path.basename(usage), 'hoy': int(len(comp)), 'linea_base': len(base['compartidos']),
                              'lista': {k: int(v) for k, v in comp.items()},
                              'nuevos_vs_base': sorted(set(comp.index) - {x['nombre'] for x in base['compartidos']})}
        dia = d[pd.to_datetime(d[c_t]).dt.date == pd.Timestamp(a.dia).date()]
        sup = dia[c_sup].fillna('').astype(str).str.contains('WORKFLOW')
        test = dia[c_sub].fillna('').astype(str).str.contains('WORKFLOW_TEST') if c_sub else pd.Series(False, index=dia.index)
        ejec = dia[c_wf].notna() & ~dia[c_wf].isin(NO_WF)
        act = {}
        for u, x in dia[sup | test | ejec].groupby('u'):
            act[u] = {'acciones_workflow': int(len(x)), 'pruebas': int(test[x.index].sum()),
                      'ejecuciones': int(ejec[x.index].sum()), 'workflows': sorted(x[c_wf].dropna().unique().tolist())}
        out['actividad_dia'] = {nom(u): {**v, 'sd': R[u]['sd']} for u, v in sorted(act.items(), key=lambda kv: (R[kv[0]]['sd'], nom(kv[0])))}

        if a.asistencia:
            t = pd.read_csv(a.asistencia, sep=None, engine='python', encoding='utf-8-sig') if a.asistencia.endswith(('.csv', '.txt')) else pd.read_excel(a.asistencia)
            c_mail, c_name = col(t, 'Correo', 'Email', 'Correo electrónico', 'Participant ID (UPN)'), col(t, 'Nombre', 'Name', 'Full Name')
            asis = set()
            por_nombre = {sin_acentos(p['nombre']): u for u, p in R.items()}
            for _, r in t.iterrows():
                if c_mail and isinstance(r[c_mail], str) and '@' in r[c_mail]:
                    asis.add(r[c_mail].split('@')[0].lower())
                elif c_name and isinstance(r[c_name], str):
                    n = sin_acentos(r[c_name])
                    m = [u for k, u in por_nombre.items() if k in n or n in k]
                    asis.update(m[:1])
            asis &= uni
            out['asistencia'] = {
                'fuente': os.path.basename(a.asistencia), 'asistentes': len(asis),
                'asistio_con_actividad': sorted(nom(u) for u in asis if u in act),
                'asistio_sin_actividad': sorted(nom(u) for u in asis if u not in act),
                'actividad_sin_registro': sorted(nom(u) for u in act if u not in asis),
            }
        asis_n = set(out['asistencia']['asistio_con_actividad'] + out['asistencia']['asistio_sin_actividad']) if a.asistencia else None
        out['obligatorios_pld'] = {nom(u): ('' if asis_n is None else ('asistió, ' if nom(u) in asis_n else 'no está en la lista, '))
                                   + f"{'con' if u in act else 'sin'} actividad el día" for u in OBLIGATORIOS_PLD}
    else:
        out['compartidos'] = out['actividad_dia'] = 'falta harvey-usage del corte'

    os.makedirs(os.path.join(RAIZ, 'out'), exist_ok=True)
    dest = os.path.join(RAIZ, 'out', f'WF_medicion_{a.corte_fin}.json')
    json.dump(out, open(dest, 'w'), ensure_ascii=False, indent=1, default=str)
    print(json.dumps(out, ensure_ascii=False, indent=1, default=str))


if __name__ == '__main__':
    main()
