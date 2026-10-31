#!/usr/bin/env python3
"""Decisiones vigentes de Tony que viven en datos o codigo (CLAUDE.md, seccion "Decisiones vigentes", y
docs/HANDOFF_*.md). No necesita exports: revisa data/, scripts/ y narrativa/.

Cada decision devuelve (estado, detalle):
  ok        se cumple
  pendiente depende de Tony (falta su si o hay un choque que el decide); no rompe la prueba
  falla     el repo contradice una decision ya tomada; la prueba sale con 1

scripts/corte_de_caja.py importa DECISIONES y las reporta con la fecha del corte como referencia.
Uso: python3 tests/test_decisiones.py [AAAA-MM-DD]   (referencia; por defecto, hoy)
"""
import glob
import json
import os
import re
import sys
from datetime import date, timedelta

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(R, 'scripts'))
from capacitacion import revisar_fijos, roles_fijos  # noqa: E402

SDS = ['ENN', 'CN', 'PLD', 'GC', 'JC', 'RL']


def _j(rel):
    return json.load(open(os.path.join(R, rel)))


def _cap():
    return _j('data/capacitaciones.json')


def _sesion(tema):
    return next((s for s in _cap()['sesiones'] if s['tema'] == tema), None)


def _lunes(d):
    return d - timedelta(days=d.weekday())


# --- Capacitaciones -------------------------------------------------------------------------------

def workflow_15oct(ref):
    s = _sesion('Workflow: de la tarea repetida al workflow')
    if not s:
        return 'falla', 'no está la sesión de Workflow en data/capacitaciones.json'
    esperado = {'coordina_uid': 'jbueno', 'apoyo_uid': ['nsotelo'], 'expertos_uid': ['lesespinoza', 'aksalinas', 'kaparicio']}
    mal = [k for k, v in esperado.items() if s.get(k) != v]
    if mal or not s.get('fijo'):
        return 'falla', 'difiere en ' + ', '.join(mal or ['fijo'])
    return 'ok', 'coordina Tony con Karime de apoyo; guías Leslie Espinoza, Ana Karen Salinas, Karla Stephanie Aparicio'


def word_playbook_karime(ref):
    s = _sesion('Word')
    if not s:
        return 'falla', 'no está la sesión de Word'
    if s.get('coordina_uid') != 'nsotelo' or not s.get('fijo'):
        return 'falla', f"coordina_uid = {s.get('coordina_uid')!r}, fijo = {s.get('fijo')!r}"
    if s.get('apoyo_uid') != ['jbueno']:
        return 'falla', 'Tony no está de respaldo'
    return 'ok', 'Karime coordina sola, Tony de respaldo'


def semanas_fijas(ref):
    """La semana del corte y la siguiente llevan coordinador y expertos fijos."""
    lun = _lunes(ref)
    semanas = {lun, lun + timedelta(days=7)}
    ses = [s for s in _cap()['sesiones'] if _lunes(date.fromisoformat(s['fecha'])) in semanas]
    # externa: la da el equipo de Harvey (RL, 5 nov 2026); no lleva coordinador ni expertos de la DJ.
    sin = [s['tema'] for s in ses if not s.get('externa') and not (s.get('fijo') and s.get('coordina_uid') and s.get('expertos_uid'))]
    if sin:
        return 'pendiente', 'sin coordinador o expertos fijos: ' + '; '.join(sin)
    return 'ok', f'{len(ses)} sesiones fijas entre el {lun:%d/%m} y el {lun + timedelta(days=11):%d/%m}'


def _con_rol(uid, desde):
    return [f"{s['tema']} ({rol})" for s in _cap()['sesiones'] if s['fecha'] >= desde
            for rol, u in roles_fijos(s) if u == uid and rol in ('coordina', 'apoyo')]


def alejandra_backoffice(ref):
    al_frente = _con_rol('amireles', '2026-10-12')
    if al_frente:
        return 'falla', 'Alejandra Mireles al frente de: ' + '; '.join(al_frente)
    if 'amireles' in _cap().get('rotacion', []):
        return 'pendiente', 'sigue en la rotación de coordinación; la rotación podría asignarle una sesión (Vault, 26-30 oct). Espera el sí de Tony para sacarla'
    return 'ok', 'fuera de sesiones y de la rotación'


def sofia_no_presenta(ref):
    roles = [f"{s['tema']} ({rol})" for s in _cap()['sesiones'] for rol, u in roles_fijos(s) if u == 'soochoa']
    return ('falla', 'Sofía Ochoa en: ' + '; '.join(roles)) if roles else ('ok', 'sin rol en ninguna sesión')


def fijos_sin_choques(ref):
    avisos = revisar_fijos([s for s in _cap()['sesiones'] if s['fecha'] >= _lunes(ref).isoformat()],
                           _j('data/excepciones.json')['excepciones'], _j('data/roster.json')['personas'])
    if avisos:
        return 'pendiente', '; '.join(f"{a.get('nombre') or '-'} ({a['rol']}, {a['sesion']}): {a['motivo']}" for a in avisos)
    return 'ok', 'nadie fijado a mano tiene excepción ese día o esa semana (alertas: se revisan con datos en el corte)'


# --- Roster y reportes ----------------------------------------------------------------------------

def gerencias_genericas(ref):
    ger = {p.get('gerencia') for p in _j('data/roster.json')['personas'].values()}
    esperadas = {'Gerencia CN I', 'Gerencia CN II', 'Gerencia CN III', 'Gerencia GC I', 'Gerencia GC II',
                 'Gerencia Jurídico Contencioso I', 'Gerencia Jurídico Contencioso II', 'Gerencia RL'}
    faltan = sorted(esperadas - ger)
    return ('falla', 'cambiaron: ' + ', '.join(faltan)) if faltan else ('ok', 'CN I/II/III, GC I/II, JC I/II y RL sin cambios')


def universo_65(ref):
    n = sum(1 for p in _j('data/roster.json')['personas'].values()
            if p['sd'] in SDS and not p.get('excluido_metricas') and not p.get('baja_ejecutada'))
    return ('ok', '65 personas en las 6 SD') if n == 65 else ('pendiente', f'{n} personas en las 6 SD (decisión: 65); revisar altas o bajas')


def firma(ref):
    h = open(os.path.join(R, 'scripts', 'helpers.js'), encoding='utf-8').read()
    if 'José Antonio Bueno Díaz  |  Gerente Contratos TI & AI' not in h:
        return 'falla', 'la firma de helpers.js cambió'
    titulos = []
    for f in glob.glob(os.path.join(R, 'scripts', '*.js')) + glob.glob(os.path.join(R, 'presentaciones', '*.js')):
        for i, l in enumerate(open(f, encoding='utf-8'), 1):
            if 'Champion de Champions' in l and not l.strip().startswith(('*', '//', '/*')):
                titulos.append(f'{os.path.basename(f)}:{i}')
    return ('falla', '"Champion de Champions" en texto de documento: ' + ', '.join(titulos)) if titulos else \
        ('ok', 'Gerente Contratos TI & AI; sin "Champion de Champions" como título')


def sin_raya_larga(ref):
    if not re.search(r'/—/\.test\(text\)\) throw', open(os.path.join(R, 'scripts', 'helpers.js'), encoding='utf-8').read()):
        return 'falla', 'helpers.js ya no bloquea la raya larga'
    con = [os.path.relpath(f, R) for f in glob.glob(os.path.join(R, 'narrativa', '**', '*.json'), recursive=True)
           + glob.glob(os.path.join(R, 'data', '*.json')) if '—' in open(f, encoding='utf-8').read()]
    return ('falla', 'raya larga en: ' + ', '.join(con)) if con else ('ok', 'helpers.js la bloquea; ninguna en narrativa/ ni data/')


def tres_p_en_espanol(ref):
    malos = []
    for f in glob.glob(os.path.join(R, '**', '*'), recursive=True):
        if os.path.isfile(f) and f.endswith(('.js', '.py', '.json', '.md')) and '/out/' not in f and not f.endswith('test_decisiones.py'):
            if re.search(r'\b(Purpose|Parameters|Depth)\b', open(f, encoding='utf-8', errors='ignore').read()):
                malos.append(os.path.relpath(f, R))
    return ('falla', '3P en inglés en: ' + ', '.join(malos)) if malos else ('ok', 'Propósito, Parámetros, Profundidad')


DECISIONES = [
    ('Workflow 15 oct: Tony coordina, Karime apoya, 3 guías de mesa fijas', workflow_15oct),
    ('Word: Karime coordina sola, Tony de respaldo', word_playbook_karime),
    ('Semana del corte y la siguiente con coordinador y expertos fijos', semanas_fijas),
    ('Alejandra Mireles en backoffice, no al frente de sesiones', alejandra_backoffice),
    ('Sofía Ochoa no presenta', sofia_no_presenta),
    ('Fijados a mano sin choques de ausencia', fijos_sin_choques),
    ('Nombres de gerencia genéricos se quedan', gerencias_genericas),
    ('Universo semanal: 65 personas de las 6 SD', universo_65),
    ('Firma: Gerente Contratos TI & AI', firma),
    ('Nunca raya larga', sin_raya_larga),
    ('3P en español', tres_p_en_espanol),
]


def evaluar(ref):
    out = []
    for nombre, fn in DECISIONES:
        try:
            estado, detalle = fn(ref)
        except Exception as e:  # una decision rota no tapa las demas
            estado, detalle = 'falla', f'error al revisar: {e}'
        out.append((nombre, estado, detalle))
    return out


if __name__ == '__main__':
    ref = date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else date.today()
    res = evaluar(ref)
    for nombre, estado, detalle in res:
        print(f'  [{estado.upper():9}] {nombre}: {detalle}')
    fallas = [r for r in res if r[1] == 'falla']
    print(f'Decisiones: {len(res)}; ok {sum(r[1] == "ok" for r in res)}; pendientes {sum(r[1] == "pendiente" for r in res)}\nFALLAS: {len(fallas)}')
    sys.exit(1 if fallas else 0)
