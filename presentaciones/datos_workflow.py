"""Datos para la sesion abierta de Workflow (semana 12-16 oct 2026, coordina Tony).
Ventana: el export de uso de 30 dias que cierra en el corte. Universo: las 65 personas de los
reportes semanales (sin excluidos ni cortesias). 'Workflow real' = cualquier workflow que no sea
Assist ni los add-ins de Word y Outlook (el export los registra como workflows).
Uso: python3 presentaciones/datos_workflow.py --corte-fin 2026-10-09 --uploads <carpeta>"""
import argparse, glob, json, os, sys
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))
RAIZ = os.path.join(os.path.dirname(__file__), '..')
NO_WF = {'Assist', 'Word Add-In Assistant', 'Outlook Add-In Assistant'}
SDS = ['ENN', 'CN', 'PLD', 'GC', 'JC', 'RL']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corte-fin', required=True)
    ap.add_argument('--uploads', default='/mnt/user-data/uploads')
    a = ap.parse_args()
    R = json.load(open(os.path.join(RAIZ, 'data/roster.json')))['personas']
    uni = {u for u, p in R.items() if p['sd'] in SDS and not p.get('excluido_metricas') and not p.get('baja_ejecutada')}

    usage = sorted(glob.glob(os.path.join(a.uploads, f'harvey-usage-*_end_{a.corte_fin}.xlsx')))[-1]
    d = pd.read_excel(usage)
    d['u'] = d['Usuario'].str.split('@').str[0]
    d = d[d['u'].isin(uni)]
    w = d[d['Nombre del workflow'].notna() & ~d['Nombre del workflow'].isin(NO_WF)]
    sup = d[d['Superficie del producto'].fillna('').str.contains('WORKFLOW')]
    prueba = d[d['Subsuperficie'].fillna('').str.contains('WORKFLOW_TEST')]
    g = w.groupby('Nombre del workflow').agg(n=('u', 'size'), personas=('u', 'nunique'), quien=('u', lambda s: sorted(set(s))))
    g = g.sort_values('n', ascending=False)
    compartidos = g[g.personas > 1]
    por_persona = w.groupby('u')['Nombre del workflow'].agg(lambda s: s.value_counts().to_dict())
    # Superficie WORKFLOW = la accion corre en Workflow (publicado o en prueba); 'Nombre del workflow'
    # solo viene en los publicados. WORKFLOW_TEST = pruebas mientras se construye.

    wfx = sorted(glob.glob(os.path.join(a.uploads, f'workflows_export_*_to_{a.corte_fin}.xlsx')))[-1]
    agx = sorted(glob.glob(os.path.join(a.uploads, f'agents_export_*_to_{a.corte_fin}.xlsx')))[-1]
    wf, ag = pd.read_excel(wfx), pd.read_excel(agx)
    for x in (wf, ag):
        x['u'] = x['Creator'].str.split('@').str[0]
    wf_dj, ag_dj = wf[wf.u.isin(uni)], ag[ag.u.isin(uni)]

    cap = json.load(open(os.path.join(RAIZ, f'out/CAP_{a.corte_fin}.json')))
    ses = next(s for s in cap['calendario'] if s['herramienta'] == 'W')
    rep = cap['assistant_calidad']['tarea_repetida']

    out = {
        'corte_fin': a.corte_fin, 'fuente_uso': os.path.basename(usage),
        'universo': len(uni),
        'personas_con_workflow': int(sup.u.nunique()),
        'acciones_superficie_workflow': int(len(sup)),
        'construyen': {R[u]['nombre']: int(n) for u, n in prueba.u.value_counts().items()},
        'acciones_workflow': int(len(w)),
        'workflows_en_uso': int(len(g)),
        'workflows_una_persona': int((g.personas == 1).sum()),
        'compartidos': [{'nombre': k, 'acciones': int(v.n), 'personas': int(v.personas),
                         'sd': sorted({R[u]['sd'] for u in v.quien})} for k, v in compartidos.iterrows()],
        'top_individuales': [{'nombre': k, 'acciones': int(v.n), 'quien': R[v.quien[0]]['nombre'], 'sd': R[v.quien[0]]['sd']}
                             for k, v in g[g.personas == 1].head(8).iterrows()],
        'creados_dj': {'workflows': int(len(wf_dj)), 'workflows_borrador': int((wf_dj.Status == 'Draft').sum()),
                       'workflows_sin_nombre': int(wf_dj.Name.str.match(r'^(Nuevo|New) Workflow').sum()),
                       'agentes': int(len(ag_dj)), 'agentes_publicados': int((ag_dj.Status == 'Published').sum()),
                       'fuente': [os.path.basename(wfx), os.path.basename(agx)]},
        'tarea_repetida': [{'nombre': r['nombre'], 'sd': r['sd'], 'hilos': r['hilos'], 'repetidos': r['hilos_repetidos']} for r in rep],
        'sesion': ses,
        'workflows_por_persona': {R[u]['nombre']: v for u, v in por_persona.items()},
    }
    dest = os.path.join(RAIZ, f'out/WF_sesion_{a.corte_fin}.json')
    json.dump(out, open(dest, 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in out.items() if k not in ('sesion',)}, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
