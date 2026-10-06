#!/usr/bin/env python3
"""
casos_estrella.py: cifras del reporte externo de Casos Estrella (para Harvey, 6 oct 2026).

Uso: python3 presentaciones/casos_estrella.py --uploads <carpeta> --vaults <vaults_export.xlsx> --out out/casos_estrella.json

La narrativa sale del Catalogo de Casos Estrella del HIL (Notion 384f66a1716281cc8c9ac1411b2be683);
aqui solo se recalculan las cifras con los exports mas recientes:
- Vault: Queries Count por proyecto (atribuido al Owner del proyecto, limite del export).
- Workflow: ejecuciones por workflow y usuario (mismas reglas de clasificacion que etl.py).
"""
import argparse
import json
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts'))
import etl  # noqa: E402

VALIDADOR = 'Validador de Expedientes Legales'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--uploads', required=True)
    ap.add_argument('--vaults', required=True)
    ap.add_argument('--out', default=os.path.join(etl.REPO, 'out', 'casos_estrella.json'))
    a = ap.parse_args()
    R = json.load(open(os.path.join(etl.REPO, 'data', 'roster.json')))['personas']

    vx = pd.read_excel(a.vaults)
    vx['usuario'] = vx['Owner'].str.split('@').str[0]

    def proyectos(owner, contiene=None):
        x = vx[vx['usuario'] == owner]
        if contiene:
            x = x[x['Project Name'].str.upper().str.contains('|'.join(contiene))]
        return [{'proyecto': r['Project Name'].strip().rstrip('.'), 'consultas': int(r['Queries Count']),
                 'compartido_con': [R.get(s.strip().split('@')[0], {}).get('nombre', s.strip())
                                    for s in str(r['Shared With']).split(',')] if pd.notna(r['Shared With']) else []}
                for _, r in x.sort_values('Queries Count', ascending=False).iterrows()]

    jc = proyectos('crifernandez', ['SITI', 'PENSION'])
    rl = proyectos('jnajera', ['RESOLUCIONES'])
    isis = vx[vx['usuario'] == 'isrodriguez']
    top_proy = vx.sort_values('Queries Count', ascending=False).iloc[0]

    ev, _ = etl.load_events(a.uploads)
    ev['tool'] = [etl.classify(s, False, v) for s, v in zip(ev['superficie'], ev['vault'])]
    w = ev[ev['tool'] == 'W']
    val = w[w['workflow'].fillna('').str.contains(VALIDADOR, case=False)]
    por_sd = {}
    for u, n in val.groupby('user_id').size().items():
        sd = R.get(u, {}).get('sd', 'otro')
        por_sd.setdefault(sd, {'usuarios': 0, 'ejecuciones': 0})
        por_sd[sd]['usuarios'] += 1
        por_sd[sd]['ejecuciones'] += int(n)
    meses = val.assign(mes=val['ts'].dt.strftime('%Y-%m')).groupby('mes').agg(ejecuciones=('user_id', 'size'), usuarios=('user_id', 'nunique'))
    nombrados = w[~w['workflow'].fillna('').isin(etl.WF_GENERICOS) & w['workflow'].notna()]
    rank = nombrados.groupby('workflow').size().sort_values(ascending=False)
    top_u = val.groupby('user_id').size().sort_values(ascending=False)
    fuera_enn = [(u, int(n)) for u, n in top_u.items() if R.get(u, {}).get('sd') != 'ENN']
    les = w[(w['user_id'] == 'lesespinoza') & (w['ts'] >= '2026-08-03')]

    out = {
        'datos_al': str(ev['ts'].max().date()), 'datos_desde': str(ev['ts'].min().date()),
        'vault_al': os.path.basename(a.vaults).replace('vaults_export_', '').replace('.xlsx', ''),
        'vault_total_proyectos': int(len(vx)), 'vault_total_consultas': int(vx['Queries Count'].sum()),
        'vault_top_proyecto': {'proyecto': top_proy['Project Name'], 'usuario': top_proy['usuario'], 'consultas': int(top_proy['Queries Count'])},
        'jc': {'proyectos': jc, 'total': sum(p['consultas'] for p in jc)},
        'rl': {'proyectos': rl, 'total': sum(p['consultas'] for p in rl)},
        'validador': {
            'ejecuciones': int(len(val)), 'usuarios': int(val['user_id'].nunique()), 'sds': len(por_sd), 'por_sd': por_sd,
            'lugar_en_dj': int(list(rank.index).index(next(k for k in rank.index if VALIDADOR.lower() in k.lower())) + 1),
            'meses': {m: {'ejecuciones': int(r.ejecuciones), 'usuarios': int(r.usuarios)} for m, r in meses.iterrows()},
            'principal_fuera_enn': {'nombre': R[fuera_enn[0][0]]['nombre'], 'sd': R[fuera_enn[0][0]]['sd'], 'ejecuciones': fuera_enn[0][1]} if fuera_enn else None,
        },
        'isis': {'proyectos_vault': int(len(isis)), 'consultas': int(isis['Queries Count'].sum())},
        'leslie': {'ejecuciones': int(len(les)), 'workflows_distintos': int(les['workflow'].nunique()), 'desde': '2026-08-03'},
    }
    json.dump(out, open(a.out, 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
