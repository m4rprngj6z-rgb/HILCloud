#!/usr/bin/env python3
"""Infografía del corte de caja para Tony (pedido 7 nov 2026): mapa de las 6 SD y lo que tiene que hacer.
Datos: out/DJ_<viernes>.json (calculado por el ETL) y narrativa/<viernes>/tony.json (pendientes).
Uso: python3 presentaciones/infografia_corte/infografia.py 2026-11-06 out/Infografia_Corte_06nov2026.png
"""
import json, sys, os, html, asyncio
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
v, salida = sys.argv[1], os.path.abspath(sys.argv[2])
dj = json.load(open(os.path.join(REPO, 'out', f'DJ_{v}.json')))
t = json.load(open(os.path.join(REPO, 'narrativa', v, 'tony.json')))
T = dj['totales']
e = html.escape
NOMBRE = {'ENN': 'Expansión Nuevos Negocios', 'CN': 'Cumplimiento Normativo', 'PLD': 'Prevención de Lavado',
          'GC': 'Gobierno Corporativo', 'JC': 'Jurídico Contencioso', 'RL': 'Relaciones Laborales'}

def delta(p):
    if p is None: return ''
    cls = 'up' if p > 0 else ('down' if p < 0 else 'flat')
    flecha = '▲' if p > 0 else ('▼' if p < 0 else '●')
    return f'<span class="d {cls}">{flecha} {abs(p)}%</span>'

def barra(s):
    tot = sum(s.get(k, 0) for k in ('verde', 'amarillo', 'rojo', 'excepcion', 'sin_historial')) or 1
    segs = ''.join(f'<i class="{k}" style="flex:{s.get(k,0)}"></i>' for k in ('verde', 'amarillo', 'rojo', 'excepcion', 'sin_historial') if s.get(k, 0))
    return f'<div class="bar">{segs}</div><div class="leg">{s.get("verde",0)} verde · {s.get("amarillo",0)} amarillo · {s.get("rojo",0)} rojo</div>'

cards = ''
for s in dj['sds']:
    alerta = s['atencion_alta']
    cards += f'''<div class="card">
      <div class="top"><b>{s['sd']}</b><span class="nm">{e(NOMBRE[s['sd']])}</span></div>
      <div class="big">{s['acciones']:,}<small>acciones</small>{delta(s['delta_pct'])}</div>
      {barra(s['semaforo'])}
      <div class="foot"><span>{s['personas_activas']} de {s['personas']} activas</span>
      <span class="{'al' if alerta >= 3 else ''}">{alerta} en atención alta</span></div></div>'''

pend = ''.join(f'<li class="{"u" if p.get("urgente") else ""}"><span class="when">{e(p["cuando"])}</span><span>{e(p["que"])}</span></li>' for p in t['pendientes'])
fuera = ' · '.join(e(x) for x in t.get('fuera', []))

doc = f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1080px;background:#F4F6FA;font-family:Inter,'Liberation Sans',Arial,sans-serif;color:#1A1F2E;padding:48px}}
.k{{font-size:18px;letter-spacing:3px;text-transform:uppercase;color:#5B6478;font-weight:700}}
h1{{font-size:46px;color:#1F3864;margin-top:6px}}
.ctx{{font-size:19px;color:#5B6478;margin-top:6px}}
.kpis{{display:flex;gap:16px;margin-top:26px}}
.kpi{{flex:1;background:#1F3864;color:#fff;border-radius:18px;padding:18px 22px}}
.kpi b{{font-size:44px;display:block}} .kpi span{{font-size:17px;color:#C9D6EA}}
h2{{font-size:26px;color:#1F3864;margin:34px 0 14px}}
.grid{{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}}
.card{{background:#fff;border-radius:18px;padding:18px 20px;box-shadow:0 2px 8px rgba(31,56,100,.08)}}
.top b{{font-size:24px;color:#1F3864;margin-right:8px}} .nm{{font-size:14px;color:#5B6478}}
.big{{font-size:40px;font-weight:800;margin:8px 0 10px;display:flex;align-items:baseline;gap:8px}}
.big small{{font-size:15px;font-weight:500;color:#5B6478}}
.d{{font-size:17px;font-weight:700;margin-left:auto;padding:3px 10px;border-radius:12px}}
.d.up{{color:#2E6B2E;background:#E2EFDA}} .d.down{{color:#9C3D00;background:#FBE5D6}} .d.flat{{color:#5B6478;background:#EEF1F6}}
.bar{{display:flex;height:14px;border-radius:7px;overflow:hidden;background:#EEF1F6}}
.bar i{{display:block}} .verde{{background:#5AA75A}} .amarillo{{background:#E8B931}} .rojo{{background:#D2463C}} .excepcion,.sin_historial{{background:#B9C0CC}}
.leg{{font-size:13px;color:#5B6478;margin-top:6px}}
.foot{{display:flex;justify-content:space-between;font-size:15px;margin-top:12px;color:#3A4152}}
.foot .al{{color:#B3261E;font-weight:700}}
ul{{list-style:none;background:#fff;border-radius:18px;padding:8px 22px;box-shadow:0 2px 8px rgba(31,56,100,.08)}}
li{{display:flex;gap:18px;padding:14px 0;border-bottom:1px solid #EEF1F6;font-size:20px;align-items:baseline}}
li:last-child{{border-bottom:0}}
.when{{min-width:210px;white-space:nowrap;font-weight:700;color:#1F3864}}
li.u .when{{color:#B3261E}} li.u .when::before{{content:"● ";}}
.out{{margin-top:18px;font-size:17px;color:#5B6478}} .out b{{color:#1A1F2E}}
.pie{{margin-top:26px;font-size:14px;color:#8A92A3;border-top:1px solid #DDE2EA;padding-top:12px}}
</style></head><body>
<div class="k">Corte de caja · {e(dj['corte'])}</div>
<h1>Cómo va la DJ y qué me toca</h1>
<div class="ctx">{e(t.get('contexto',''))}</div>
<div class="kpis">
 <div class="kpi"><b>{T['acciones']:,}</b><span>acciones · {'+' if dj['delta_pct']>0 else ''}{dj['delta_pct']}% vs semana anterior</span></div>
 <div class="kpi"><b>{T['personas_activas']} / {T['personas']}</b><span>personas activas</span></div>
 <div class="kpi"><b>{T['atencion_alta']}</b><span>en atención alta</span></div>
</div>
<h2>Mapa de las Subdirecciones</h2>
<div class="grid">{cards}</div>
<h2>Lo que tengo que hacer</h2>
<ul>{pend}</ul>
<div class="out"><b>Fuera:</b> {fuera}</div>
<div class="pie">Semáforo: cada persona contra su propio promedio de 5 semanas. Gris: excepción o sin historial. Fuente: export de uso de Harvey, HILCloud.</div>
</body></html>'''

async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1080, 'height': 1000}, device_scale_factor=2)
        await pg.set_content(doc)
        await pg.screenshot(path=salida, full_page=True)
        await b.close()
asyncio.run(main())
print('OK', salida)
