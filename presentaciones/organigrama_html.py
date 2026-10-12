#!/usr/bin/env python3
"""organigrama_html.py: organigrama visual de las 6 SD desde data/roster.json (Tony, 12 oct 2026).
Uso: python3 presentaciones/organigrama_html.py out/Organigrama_DJ.html
Marca con 'Por confirmar' los nombres de gerencia genericos y los reportes directos a la cabeza que no son gerencias."""
import json, os, sys, html
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
r = json.load(open(os.path.join(REPO, 'data', 'roster.json'))); R = r['personas']
SDS = ['ENN', 'CN', 'PLD', 'GC', 'JC', 'RL']
CONFIRMADAS = {'PLD'}   # SD con nombres de gerencia oficiales confirmados por Tony
GENERICO = lambda g: any(g.endswith(s) for s in (' I', ' II', ' III')) or g in ('Gerencia RL',)
e = html.escape
def persona(u, extra=''):
    p = R[u]; star = '<span class="star" title="Champion">★</span>' if p.get('champion') else ''
    return f'<li><span class="n">{star}{e(p["nombre"])}</span><span class="lv">{e(p["nivel"])}</span>{extra}</li>'
cards = []; pend = 0
for sd in SDS:
    head = r['subdirectores'][sd]; orden = r['orden_gerencias'].get(sd, [])
    etq = r.get('etiqueta_subdireccion', {}).get(sd, 'Subdirección')
    gers = []
    for g in orden:
        miembros = sorted([u for u, p in R.items() if p.get('reporta_a') == g and not p.get('baja_ejecutada')], key=lambda u: R[u]['nombre'])
        nombre = R[g].get('gerencia') or 'Gerencia sin nombre'
        dudosa = sd not in CONFIRMADAS and (GENERICO(nombre) or not R[g].get('gerencia'))
        pend += dudosa
        tag = '<span class="tag">Nombre por confirmar</span>' if dudosa else ''
        gers.append(f'<div class="ger"><div class="gh"><span class="gn">{e(nombre)}</span>{tag}</div>'
                    f'<div class="gl">{e(R[g]["nombre"])} <span class="lv">Gerente</span></div>'
                    f'<ul>{"".join(persona(u) for u in miembros) or "<li class=vacio>Sin equipo</li>"}</ul></div>')
    directos = [u for u, p in R.items() if p.get('reporta_a') == head and u not in orden and p['sd'] == sd and not p.get('baja_ejecutada')]
    if directos:
        pend += len(directos)
        gers.append('<div class="ger dir"><div class="gh"><span class="gn">Directo a la cabeza</span><span class="tag">Por confirmar</span></div>'
                    f'<ul>{"".join(persona(u) for u in directos)}</ul></div>')
    n = sum(1 for p in R.values() if p['sd'] == sd and not p.get('baja_ejecutada'))
    cards.append(f'<section class="sd"><header><span class="code">{sd}</span><div><h2>{e(r["sd_nombres"][sd])}</h2>'
                 f'<p>{e(etq)}: <b>{e(R[head]["nombre"])}</b> &middot; {n} personas</p></div></header><div class="gers">{"".join(gers)}</div></section>')
doc = f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Organigrama DJ</title><style>
:root{{--navy:#1F3864;--ink:#1d1d1f;--mut:#5b6170;--line:#d9dee8;--bg:#f5f7fb;--card:#fff;--amb:#9C5700;--ambbg:#FFEB9C}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:14px/1.4 Arial,Helvetica,sans-serif}}
.wrap{{max-width:1200px;margin:0 auto;padding:24px 16px}}h1{{color:var(--navy);margin:0;font-size:24px}}.sub{{color:var(--mut);margin:4px 0 16px}}
.sum{{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}}.k{{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 14px}}.k b{{font-size:20px;color:var(--navy);display:block}}
.sd{{background:var(--card);border:1px solid var(--line);border-radius:10px;margin-bottom:16px;overflow:hidden}}
.sd header{{display:flex;gap:12px;align-items:center;background:var(--navy);color:#fff;padding:10px 14px}}.code{{font-weight:700;font-size:18px;background:#fff;color:var(--navy);border-radius:6px;padding:4px 8px}}
.sd h2{{margin:0;font-size:16px}}.sd header p{{margin:2px 0 0;font-size:13px;opacity:.9}}
.gers{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;padding:12px}}
.ger{{border:1px solid var(--line);border-radius:8px;padding:8px 10px}}.ger.dir{{border-style:dashed}}
.gh{{display:flex;flex-direction:column;align-items:flex-start;gap:3px}}.gn{{font-weight:700;color:var(--navy)}}
.tag{{background:var(--ambbg);color:var(--amb);font-size:11px;font-weight:700;border-radius:4px;padding:1px 6px;white-space:nowrap}}
.gl{{margin:4px 0 6px;font-weight:600}}ul{{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}}li{{display:flex;justify-content:space-between;gap:6px;padding:4px 0;border-bottom:1px solid #eef1f6}}
.lv{{color:var(--mut);font-size:12px;font-weight:400;white-space:nowrap}}.star{{color:#c99700;margin-right:3px}}.vacio{{color:var(--mut)}}
.foot{{color:var(--mut);font-size:12px;margin-top:8px}}</style></head><body><div class="wrap">
<h1>Dirección Jurídica: organigrama Harvey</h1><p class="sub">Desde el roster del pipeline, sincronizado con el HIL de Notion &middot; 12 oct 2026</p>
<div class="sum"><div class="k"><b>6</b>Subdirecciones</div><div class="k"><b>{sum(len(r["orden_gerencias"].get(s,[])) for s in SDS)}</b>Gerencias</div><div class="k"><b>{sum(1 for u,p in R.items() if p["sd"] in SDS and not p.get("baja_ejecutada") and not p.get("excluido_metricas"))}</b>Personas en reportes</div><div class="k"><b>{pend}</b>Por confirmar</div></div>
{"".join(cards)}<p class="foot">★ Champion. "Nombre por confirmar": nombre de gerencia genérico en el roster (PLD ya tiene los oficiales). "Directo a la cabeza": personas que no pertenecen a una gerencia. Tony Bueno aparece en ENN por línea de reporte, pero no cuenta en las métricas.</p></div></body></html>'''
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, 'out', 'Organigrama_DJ.html')
open(out, 'w').write(doc); print('OK', out, 'pendientes', pend)
