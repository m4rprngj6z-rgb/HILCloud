#!/usr/bin/env python3
"""Sustento de valor por Subdireccion para la revision presupuestal 2027 (Tony, 9 nov 2026).
Junta datos ya calculados (estado/) y exports del mes para que cada Champion los revise y enriquezca.
Uso: python3 scripts/sustento_valor.py <viernes_estado> <viernes_mensual> <dir_exports>
Salida: out/SV_<SD>_<viernes>.json
"""
import json, os, sys, glob
import pandas as pd
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V, VM, U = sys.argv[1], sys.argv[2], sys.argv[3]
SDS = ['ENN', 'CN', 'PLD', 'GC', 'JC', 'RL']
P = json.load(open(os.path.join(R, 'data', 'roster.json')))['personas']
FM = json.load(open(os.path.join(R, 'estado', VM, f'FM_{VM}.json')))
KPI = json.load(open(os.path.join(R, 'data', 'kpis_negocio.json')))
CASOS = json.load(open(os.path.join(R, 'data', 'casos_estrella.json')))
HERR = {'A': 'Assistant', 'Wo': 'Word', 'V': 'Vault', 'W': 'Workflow', 'O': 'Outlook'}

use = pd.read_excel(glob.glob(os.path.join(U, 'harvey-usage-*.xlsx'))[0])
use['uid'] = use['Usuario'].astype(str).str.split('@').str[0].str.lower()
wf = use[use['Nombre del workflow'].notna() & use['Superficie del producto'].astype(str).str.contains('WORKFLOW')]
# 'Assist' es Assistant registrado bajo la superficie de workflow, no un workflow del equipo
wf = wf[~wf['Nombre del workflow'].astype(str).str.strip().str.lower().isin(['assist', 'assistant'])]
wf = wf[~wf['Nombre del workflow'].astype(str).str.contains('Add-In', case=False)]
vx = pd.read_excel(glob.glob(os.path.join(U, 'vaults_export_*.xlsx'))[0])
vx['uid'] = vx['Owner'].astype(str).str.split('@').str[0].str.lower()
vx['sh'] = vx['Shared With'].fillna('').apply(lambda s: len([x for x in str(s).split(',') if x.strip()]))
inicio, fin = str(use['Tiempo (Etc/GMT+6)'].min())[:10], str(use['Tiempo (Etc/GMT+6)'].max())[:10]

for sd in SDS:
    d = json.load(open(os.path.join(R, 'estado', V, f'{sd}_{V}.json')))
    uids = [r['usuario'] for r in d['rows']]
    personas = []
    for r in d['rows']:
        h = [x for x in r['historial'] if x.get('con_datos') and not x.get('excepcion')][-8:]
        prom = round(sum(int(x.get('total', 0) or 0) for x in h) / len(h), 1) if h else 0
        principal = (r.get('firma') or '').split('>')[0]
        personas.append({'nombre': r['nombre'], 'nivel': r['nivel'], 'prom_semana': prom,
                         'principal': HERR.get(principal, 'Sin actividad'),
                         'workflow': (wf[wf.uid == r['usuario']]['Nombre del workflow'].value_counts().index[0] if (wf.uid == r['usuario']).any() else None),
                         'en_excepcion': r.get('en_excepcion', False)})
    personas.sort(key=lambda x: -x['prom_semana'])
    w = wf[wf.uid.isin(uids)].groupby('Nombre del workflow').agg(veces=('uid', 'size'), personas=('uid', 'nunique')).reset_index()
    w = w.sort_values(['veces'], ascending=False).head(8)
    vv = vx[vx.uid.isin(uids)]
    fm = next(s for s in FM['sds'] if s['sd'] == sd)
    out = {'sd': sd, 'nombre': fm['nombre'], 'champion': next((r['nombre'] for r in d['rows'] if r.get('champion')), None),
           'subdirector': d.get('subdirector'), 'ventana': [inicio, fin], 'corte': d['corte'],
           'mes': {'oct': fm['mes'], 'sep': fm['anterior'], 'delta_pct': fm['delta_pct']},
           'personas_total': len(d['rows']),
           'activas_mes': int(use[use.uid.isin(uids)].uid.nunique()),
           'workflows': [{'nombre': x['Nombre del workflow'], 'veces': int(x['veces']), 'personas': int(x['personas'])} for _, x in w.iterrows()],
           'workflows_distintos': int(wf[wf.uid.isin(uids)]['Nombre del workflow'].nunique()),
           'ejecuciones_wf': int(len(wf[wf.uid.isin(uids)])),
           'vaults': {'proyectos': int(len(vv)), 'consultas': int(vv['Queries Count'].sum()), 'compartidos': int((vv.sh > 0).sum())},
           'vaults_top': [{'nombre': x['Project Name'], 'consultas': int(x['Queries Count']), 'compartido': int(x['sh'])}
                          for _, x in vv.sort_values('Queries Count', ascending=False).head(3).iterrows()],
           'kpis': KPI.get(sd, []), 'casos': CASOS.get(sd, []), 'personas': personas}
    json.dump(out, open(os.path.join(R, 'out', f'SV_{sd}_{V}.json'), 'w'), ensure_ascii=False, indent=1)
    print('OK', sd, out['activas_mes'], out['ejecuciones_wf'], out['vaults'])
