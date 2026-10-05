#!/usr/bin/env python3
"""
etl.py: convierte los exports crudos de Harvey en el JSON que consume generate.js.

Uso:
  python3 scripts/etl.py --corte-fin 2026-09-25 --sd ENN
  python3 scripts/etl.py --corte-fin 2026-09-25 --sd ENN --o-en-a   # modo regresion: Outlook dentro de A

Todas las reglas de calculo estan escritas en docs/REGLAS_ETL.md. Si cambias una regla aqui,
cambiala alla en el mismo commit. Nada de este archivo depende de criterio de un LLM: mismo
input, mismo output.
"""
import argparse
import glob
import json
import os
import sys
from datetime import date, datetime, timedelta

import pandas as pd

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOADS_DEFAULT = '/mnt/user-data/uploads'

# ---------------------------------------------------------------------------
# 1. Carga y normalizacion de exports (dos esquemas: ingles hasta jul 2026, espanol despues)
# ---------------------------------------------------------------------------
COLMAP = {
    # espanol
    'Tiempo (Etc/GMT+6)': 'ts', 'Usuario': 'email', 'Acción': 'accion',
    'Superficie del producto': 'superficie', 'ID de uso único': 'uso_id',
    'Nombre del workflow': 'workflow', 'Nombre del proyecto Vault': 'vault',
    'Nombre del Playbook': 'playbook', 'ID del hilo de la Matriz': 'hilo',
    # ingles
    'Time (Etc/GMT+6)': 'ts', 'User': 'email', 'Action': 'accion',
    'Product Surface Area': 'superficie', 'Unique Usage ID': 'uso_id',
    'Workflow Name': 'workflow', 'Vault Project Name': 'vault', 'Playbook Name': 'playbook',
    'Parent Thread ID': 'hilo',
}
TOKEN_ES = {'ASSISTANT': 'ASISTENTE', 'DRAFT': 'BORRADOR', 'COMMAND_CENTER': 'CENTRO_DE_COMANDO'}
CANON = ['ts', 'email', 'accion', 'superficie', 'uso_id', 'workflow', 'vault', 'playbook', 'hilo']


_CACHE = {}


def load_events(uploads):
    if uploads in _CACHE:
        ev, meta = _CACHE[uploads]
        return ev.copy(), meta
    files = sorted(glob.glob(os.path.join(uploads, 'harvey-usage-start_*.xlsx')))
    if not files:
        sys.exit(f'No hay exports harvey-usage-start_*.xlsx en {uploads}')
    frames = []
    for f in files:
        d = pd.read_excel(f)
        d = d.rename(columns={c: COLMAP[c] for c in d.columns if c in COLMAP})
        missing = [c for c in ['ts', 'email', 'superficie', 'uso_id'] if c not in d.columns]
        if missing:
            sys.exit(f'{os.path.basename(f)}: faltan columnas {missing}. Esquema nuevo de Harvey: actualizar COLMAP.')
        for c in CANON:
            if c not in d.columns:
                d[c] = None
        d = d[CANON].copy()
        d['_archivo'] = os.path.basename(f)
        frames.append(d)
    ev = pd.concat(frames, ignore_index=True)
    n_raw = len(ev)
    # Los exports son ventanas moviles de ~30 dias que se traslapan: deduplicar por ID unico.
    con_id = ev[ev['uso_id'].notna()].drop_duplicates(subset=['uso_id'])
    sin_id = ev[ev['uso_id'].isna()].drop_duplicates(subset=['ts', 'email', 'superficie', 'workflow'])
    ev = pd.concat([con_id, sin_id], ignore_index=True)
    ev['ts'] = pd.to_datetime(ev['ts'])
    ev['email'] = ev['email'].astype(str).str.strip().str.lower()
    ev['user_id'] = ev['email'].str.split('@').str[0]
    ev['superficie'] = ev['superficie'].fillna('').astype(str).map(
        lambda s: ', '.join(TOKEN_ES.get(t.strip(), t.strip()) for t in s.split(',') if t.strip()))
    meta = {
        'archivos': [os.path.basename(f) for f in files],
        'filas_crudas': n_raw, 'eventos_unicos': len(ev),
        'filas_sin_id': int(len(sin_id)),
        'datos_desde': str(ev['ts'].min()), 'datos_hasta': str(ev['ts'].max()),
    }
    _CACHE[uploads] = (ev, meta)
    return ev.copy(), meta


# ---------------------------------------------------------------------------
# 2. Clasificacion de herramienta (regla confirmada por Tony, 28 sep 2026)
#    Precedencia: W > V > Wo (Word o Playbook) > O > A
# ---------------------------------------------------------------------------
TOOLS = ['A', 'Wo', 'V', 'W', 'O']   # orden de columnas del reporte aprobado (+ O)
ORDEN_DESEMPATE = ['A', 'W', 'V', 'Wo', 'O']   # orden de la Nomenclatura del HIL; desempata la Firma
# Nombres de "workflow" que Harvey pone a hilos de Assistant lanzados desde Workflow. Cuentan en W
# (regla de precedencia), pero no son un workflow real: no se nombran ni cuentan para Diversidad.
WF_GENERICOS = {'Assist', 'Word Add-In Assistant'}


def classify(superficie, o_en_a=False, proyecto_vault=None, vault_solo_superficie=False):
    """proyecto_vault: nombre del proyecto Vault de la fila. Harvey registra las consultas a un
    Vault hechas desde Assistant o Word con superficie ASISTENTE/WORD y el proyecto en otra
    columna; tambien cuentan como V (regla de Tony: si trae Vault, es V). Hallazgo 28 sep 2026:
    solo 168 de 1,864 acciones sobre Vault traian VAULT en la superficie."""
    toks = {t.strip() for t in superficie.split(',') if t.strip()}
    if 'WORKFLOW' in toks:
        return 'W'
    tiene_vault = isinstance(proyecto_vault, str) and proyecto_vault.strip() != ''
    if 'VAULT' in toks or (tiene_vault and not vault_solo_superficie):
        return 'V'
    if 'WORD' in toks or 'PLAYBOOK' in toks:
        return 'Wo'
    if 'OUTLOOK' in toks:
        return 'A' if o_en_a else 'O'
    if 'ASISTENTE' in toks:
        return 'A'
    return 'OTRO'


# ---------------------------------------------------------------------------
# 3. Cortes: lunes 00:00 a viernes 23:59 hora CDMX (Context Prompt, Notion)
# ---------------------------------------------------------------------------
def corte_windows(corte_fin, n):
    """Regresa n cortes [(lunes, viernes)] terminando en corte_fin (viernes), del mas viejo al actual."""
    out = []
    for k in range(n - 1, -1, -1):
        fri = corte_fin - timedelta(days=7 * k)
        out.append((fri - timedelta(days=4), fri))
    return out


def label(mon, fri):
    meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    if mon.month == fri.month:
        return f'{mon.day}-{fri.day} {meses[fri.month - 1]} {fri.year}'
    return f'{mon.day} {meses[mon.month - 1]}-{fri.day} {meses[fri.month - 1]} {fri.year}'


# ---------------------------------------------------------------------------
# 4. Excepciones (data/excepciones.json, copia de la tabla de Notion)
# ---------------------------------------------------------------------------
def load_excepciones():
    return json.load(open(os.path.join(REPO, 'data', 'excepciones.json')))['excepciones']


def dias_semana(mon):
    return [mon + timedelta(days=i) for i in range(5)]


def excepcion_semana(uid, sd, mon, excs):
    """Evalua una persona en un corte (regla en docs/REGLAS_ETL.md, seccion 4).
    - es_excepcion: incapacidad cualquier dia, o 3+ dias habiles cubiertos.
    - transicion: la semana es de excepcion SOLO porque una excepcion de toda la SD cierra
      dentro de esta semana (decision Tony 28 sep 2026: se califica, pero sigue en excepcion).
    - detalle: dias por tipo, para explicar bajas parciales (<3 dias) en el Motivo."""
    feriados, ausente, personal, incapacidad = set(), {}, set(), False
    cierra_sd = False
    fri = mon + timedelta(days=4)
    for e in excs:
        d0, d1 = date.fromisoformat(e['desde']), date.fromisoformat(e['hasta'])
        aplica_dj = e.get('sd') == 'TODA_DJ'
        es_personal = uid in e.get('personas', [])
        if not (aplica_dj or es_personal or e.get('sd') == sd):
            continue
        for d in dias_semana(mon):
            if d0 <= d <= d1:
                if aplica_dj:
                    feriados.add(d)
                    continue
                ausente.setdefault(d, [])
                if e['tipo'] not in ausente[d]:
                    ausente[d].append(e['tipo'])
                if es_personal:
                    personal.add(d)
                if e['tipo'].lower().startswith('incapacidad'):
                    incapacidad = True
        if not es_personal and not aplica_dj and mon <= d1 <= fri and d1 >= d0:
            cierra_sd = True
    for d in feriados:
        ausente.pop(d, None)
    personal -= feriados
    habiles = 5 - len(feriados)
    n = len(ausente)
    es_exc = incapacidad or n >= 3 or (habiles > 0 and n >= habiles)
    transicion = bool(es_exc and cierra_sd and not incapacidad and len(personal) < 3)
    # detalle legible: {tipo: [fechas]} + feriados
    por_tipo = {}
    for d in sorted(ausente):
        for t in ausente[d]:
            por_tipo.setdefault(t, []).append(d)
    # la excepcion personal va primero (la etiqueta muestra la personal sobre la de la SD)
    personales = {e['tipo'] for e in excs if uid in e.get('personas', [])}
    por_tipo = dict(sorted(por_tipo.items(), key=lambda kv: 0 if kv[0] in personales else 1))
    return {'dias_habiles': habiles, 'dias_ausente': n, 'tipos': list(por_tipo),
            'por_tipo': {t: [str(x) for x in v] for t, v in por_tipo.items()},
            'feriados': [str(d) for d in sorted(feriados)],
            'es_excepcion': es_exc, 'transicion': transicion,
            # excepcion por evento de toda la SD (no personal): 3+ dias de la SD en la semana
            'de_sd': bool(es_exc and len(set(ausente) - personal) >= min(3, habiles))}


def rango_txt(fechas):
    ds = sorted(date.fromisoformat(f) if isinstance(f, str) else f for f in fechas)
    if len(ds) == 1:
        return fmt_fecha(ds[0])
    if (ds[-1] - ds[0]).days + 1 != len(ds):
        # Dias no consecutivos (ej. 28 y 30 sep): se listan, no se dibuja un rango que incluye el 29.
        if all(d.month == ds[-1].month for d in ds):
            return ', '.join(str(d.day) for d in ds[:-1]) + f' y {fmt_fecha(ds[-1])}'
        return ', '.join(fmt_fecha(d) for d in ds[:-1]) + f' y {fmt_fecha(ds[-1])}'
    return f'{ds[0].day}-{fmt_fecha(ds[-1])}' if ds[0].month == ds[-1].month else f'{fmt_fecha(ds[0])}-{fmt_fecha(ds[-1])}'


def nota_ausencia_parcial(exc):
    """Explica una baja en semana con ausencia documentada que NO llega a excepcion (regla de 3
    dias intacta; decision Tony 28 sep 2026)."""
    partes = []
    for tipo, fechas in exc['por_tipo'].items():
        n = len(fechas)
        partes.append(f"{n} día{'s' if n > 1 else ''} de {tipo.lower()} ({rango_txt(fechas)})")
    if exc['feriados']:
        n = len(exc['feriados'])
        partes.append(f"{n} día{'s' if n > 1 else ''} inhábil{'es' if n > 1 else ''} ({rango_txt(exc['feriados'])})")
    if not partes:
        return None
    if not exc['por_tipo']:   # solo dia(s) inhabil(es) de toda la DJ: no es ausencia
        return f"Semana de {exc['dias_habiles']} días hábiles ({rango_txt(exc['feriados'])} inhábil): explica parte de la baja. "
    return ('Semana con ' + ' y '.join(partes) +
            ': explica parte de la baja, pero no alcanza los 3 días hábiles para excepción. ')


# ---------------------------------------------------------------------------
# 5. Semaforo self-relative (HIL, regla 26 sep 2026)
# ---------------------------------------------------------------------------
def semaforo(total, baseline):
    if baseline is None:
        return 'sin_historial'
    if baseline == 0:
        return 'verde' if total > 0 else 'rojo'
    r = total / baseline
    if r >= 1.0:
        return 'verde'
    if r >= 0.4:
        return 'amarillo'
    return 'rojo'


# ---------------------------------------------------------------------------
# 6. Columnas derivadas del reporte Champion (reconstruidas y verificadas contra los 65
#    casos de los reportes Champion aprobados del 26 sep 2026; ver docs/REGLAS_ETL.md)
# ---------------------------------------------------------------------------
UMBRAL_ALTA_RATIO = 0.5     # cualquier valor en (0.455, 0.639] reproduce lo aprobado
UMBRAL_BAJA_RATIO = 1.2     # cualquier valor en (1.113, 1.230] reproduce lo aprobado
UMBRAL_LEVE = 2.0           # delta maximo por herramienta para "cambio leve"
UMBRAL_PAREJO = 0.5         # segunda herramienta / primera >= 0.5 -> "parejo"


def urgencia(sem, total, ratio):
    if sem == 'excepcion':
        return 'Sin acción'
    if sem == 'sin_historial':
        return 'Media'
    if sem == 'rojo' or total <= UMBRAL_RACHA or (ratio is not None and ratio < UMBRAL_ALTA_RATIO):
        return 'Alta'
    if sem == 'amarillo' or (ratio is not None and ratio < UMBRAL_BAJA_RATIO):
        return 'Media'
    return 'Baja'


def motivo(sem, cur, base_tool):
    """Regresa lista de fragmentos [{'text','tool'?}] para que el generador coloree los codigos."""
    if not base_tool:
        return [{'text': 'Sin línea base suficiente para comparar por herramienta.'}]
    delta = {t: cur[t] - base_tool.get(t, 0) for t in TOOLS}
    if sum(cur[t] for t in TOOLS) == 0:
        principal = max(TOOLS, key=lambda t: (base_tool.get(t, 0), -ORDEN_DESEMPATE.index(t)))
        if base_tool.get(principal, 0) > 0:
            return [{'text': 'Sin actividad esta semana; su herramienta principal es '}, {'text': principal, 'tool': principal}, {'text': '.'}]
        return [{'text': 'Sin actividad esta semana.'}]
    if max(abs(v) for v in delta.values()) < UMBRAL_LEVE:
        return [{'text': 'Cambio leve y parejo entre herramientas, sin un patrón concentrado.'}]
    sube = sem == 'verde'
    movs = sorted(((t, v) for t, v in delta.items() if (v > 0 if sube else v < 0)),
                  key=lambda kv: (-abs(kv[1]), ORDEN_DESEMPATE.index(kv[0])))
    if not movs:
        return [{'text': 'Cambio leve y parejo entre herramientas, sin un patrón concentrado.'}]
    verbo = 'Aumento' if sube else 'Caída'
    conc, parejo = ('concentrado', 'parejo') if sube else ('concentrada', 'pareja')
    if len(movs) > 1 and abs(movs[1][1]) >= UMBRAL_PAREJO * abs(movs[0][1]):
        return [{'text': f'{verbo} {parejo} entre '}, {'text': movs[0][0], 'tool': movs[0][0]},
                {'text': ' y '}, {'text': movs[1][0], 'tool': movs[1][0]}, {'text': '.'}]
    if sum(cur[t] for t in TOOLS) == 0:
        # Sin actividad: no se puede decir que "el resto se mantiene" (Tony, 29 sep 2026).
        return [{'text': 'Sin actividad esta semana; su herramienta principal es '}, {'text': movs[0][0], 'tool': movs[0][0]},
                {'text': '.'}]
    resto_estable = all(abs(v) < UMBRAL_LEVE for t, v in delta.items() if t != movs[0][0])
    return [{'text': f'{verbo} {conc} en '}, {'text': movs[0][0], 'tool': movs[0][0]},
            {'text': ', el resto se mantiene cerca de su ritmo habitual.' if resto_estable else '.'}]


def fortaleza(wf_top, fuerte):
    if wf_top:
        return [{'text': f"{wf_top[0]} (su workflow más usado, {wf_top[1]}x)"}]
    if fuerte:
        return [{'text': fuerte, 'tool': fuerte}, {'text': ' es su herramienta más consistente históricamente.'}]
    return [{'text': 'Sin historial suficiente.'}]


def fmt_fecha(d):
    meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    return f'{d.day} {meses[d.month - 1]}'


# ---------------------------------------------------------------------------
# 7. Calculo principal
# ---------------------------------------------------------------------------
N_HIST = 5          # ventana de linea base
N_CICLO = 5         # ciclo de racha / diversidad
UMBRAL_RACHA = 5    # "mas de 5 interacciones"
N_LOOKBACK = 16     # semanas de historial que se cargan (respaldo de linea base tras excepciones largas)


def champion_del_corte(personas, roster, excs, viernes):
    """Champion que recibe el reporte. Si el Champion esta fuera cuando se entrega (lunes siguiente al
    corte) y su excepcion trae "suplente", lo recibe el suplente (Tony, 5 oct 2026: Javier Garcia
    cubre a Jorge Belloc del 9 al 23 oct)."""
    champ = next((u for u, p in personas.items() if p['champion']), None)
    if not champ:
        return None
    entrega = viernes + timedelta(days=3)
    for e in excs:
        if champ in e.get('personas', []) and e.get('suplente') and \
                date.fromisoformat(e['desde']) <= entrega <= date.fromisoformat(e['hasta']):
            sup = roster['personas'][e['suplente']]['nombre']
            return f"{sup} (suplente de {personas[champ]['nombre']})"
    return personas[champ]['nombre']


def build(corte_fin, sd, uploads, o_en_a=False, vault_solo_superficie=False):
    roster = json.load(open(os.path.join(REPO, 'data', 'roster.json')))
    personas = {u: p for u, p in roster['personas'].items()
                if p['sd'] == sd and not p.get('excluido_metricas') and not p.get('fuera_de_semaforo')}
    excs = load_excepciones()
    ev, meta = load_events(uploads)
    ev['tool'] = [classify(s, o_en_a, v, vault_solo_superficie) for s, v in zip(ev['superficie'], ev['vault'])]
    data_desde = ev['ts'].min().normalize()

    # Hace falta historial para: ciclo de 5 cortes, cada uno con 5 semanas de linea base.
    wins = corte_windows(corte_fin, N_LOOKBACK)
    ev['fecha'] = ev['ts'].dt.date
    ev['dow'] = ev['ts'].dt.dayofweek

    fin_ = datetime.combine(corte_fin, datetime.max.time())
    fds = ev[(ev['user_id'].isin(personas)) & (ev['dow'] >= 5) & (ev['ts'] <= fin_)]
    fuera = ev[(ev['user_id'].isin(personas)) & (ev['tool'] == 'OTRO')]

    # tabla semana x persona
    semanas = []
    for mon, fri in wins:
        cubierta = pd.Timestamp(mon) >= data_desde
        semanas.append({'lunes': mon, 'viernes': fri, 'label': label(mon, fri), 'con_datos': bool(cubierta)})

    def week_stats(uid, mon, fri):
        m = ev[(ev['user_id'] == uid) & (ev['fecha'] >= mon) & (ev['fecha'] <= fri) & (ev['tool'] != 'OTRO')]
        counts = {t: int((m['tool'] == t).sum()) for t in TOOLS}
        wf = m[m['tool'] == 'W']['workflow'].dropna()
        wf = wf[~wf.isin(WF_GENERICOS)]
        return {
            **counts,
            'total': int(sum(counts.values())),
            'dias_activos': int(m['fecha'].nunique()),
            'wf_distintos': int(wf.nunique()),
            'wf_conteo': wf.value_counts().to_dict(),
            'ultima': str(m['ts'].max()) if len(m) else None,
        }

    cur_mon_, cur_fri_ = wins[-1]
    excs_base = [e for e in excs if e.get('cuenta_en_base_desde') and e.get('sd') == sd]
    rows = []
    for uid, p in personas.items():
        alta = date.fromisoformat(p['alta']) if p.get('alta') else None
        hist = []
        for s in semanas:
            st = week_stats(uid, s['lunes'], s['viernes'])
            st['excepcion'] = excepcion_semana(uid, sd, s['lunes'], excs)
            # Excepciones marcadas "cuenta_en_base_desde" (la SD si trabajo durante ella; decision Tony
            # 2 oct 2026, PLD): desde esa fecha sus semanas entran a la linea base. Siguen en gris.
            st['base_desde'] = None
            if st['excepcion']['es_excepcion'] and excs_base:
                sin = excepcion_semana(uid, sd, s['lunes'], [e for e in excs if not e.get('cuenta_en_base_desde')])
                if not sin['es_excepcion']:
                    st['base_desde'] = max(date.fromisoformat(e['cuenta_en_base_desde']) for e in excs_base)
            # Semanas anteriores a su alta no son historial (no son ceros reales).
            st['con_datos'] = s['con_datos'] and (alta is None or s['viernes'] >= alta)
            st['label'] = s['label']
            hist.append(st)

        def exc_base(j, i):
            """La semana j es de excepcion para la linea base de la semana i."""
            h = hist[j]
            if not h['excepcion']['es_excepcion']:
                return False
            return not (h['base_desde'] and i < len(semanas) and semanas[i]['lunes'] >= h['base_desde'])

        def utiles(rng, i=None):
            i = len(semanas) if i is None else i
            return [hist[j] for j in rng if hist[j]['con_datos'] and not exc_base(j, i)]

        def semanas_base(i):
            """Semanas que forman la linea base de la semana i y si incluyen semanas previas a una
            excepcion larga de toda la SD (>= 5 semanas).
            Normal: semanas utiles dentro de las 5 anteriores.
            Tras una excepcion larga (decision Tony 2 oct 2026): mientras no haya 5 semanas utiles
            nuevas, la base son las utiles mas recientes completadas con las previas a la excepcion,
            y queda marcada como previa (referencia, sin escalar) hasta juntar 5 propias.
            Solo aplica a excepciones de toda la SD; tras una ausencia personal larga se compara
            contra las semanas nuevas, como siempre (reporte aprobado 26 sep, Sofia Ochoa)."""
            nuevas, j = [], i - 1
            while j >= 0 and len(nuevas) < N_HIST:
                h = hist[j]
                if not h['con_datos']:
                    break
                if not exc_base(j, i):
                    nuevas.append(h)
                    j -= 1
                    continue
                k = j
                while k >= 0 and hist[k]['con_datos'] and exc_base(k, i):
                    k -= 1
                de_sd = sum(1 for x in range(k + 1, j + 1) if hist[x]['excepcion'].get('de_sd'))
                if de_sd >= N_HIST:   # excepcion larga de la SD (roles distintos): se completa con las previas
                    antes = utiles(range(k, -1, -1), i)
                    usadas = (nuevas + antes)[:N_HIST]
                    return usadas, any(h in antes for h in usadas), len(nuevas)
                j = k
            prev = utiles(range(max(0, i - N_HIST), i), i)
            if not prev:   # excepcion larga personal: respaldo, las ultimas 5 utiles antes de ella
                return utiles(range(i - 1, -1, -1), i)[:N_HIST], True, 0
            return prev, False, None

        def baseline_at(i):
            """Promedio de las semanas de semanas_base(i)."""
            prev, previa, _ = semanas_base(i)
            if not prev:
                return None, [], 0, False
            b = sum(h['total'] for h in prev) / len(prev)
            per_tool = {t: sum(h[t] for h in prev) / len(prev) for t in TOOLS}
            return b, per_tool, len(prev), previa

        def detalle_base(i):
            """Para aclarar en el reporte (Tony, 28 sep 2026): cuantas de las 5 semanas anteriores
            quedaron sin conteo por excepcion y, si se uso el respaldo, que semanas se usaron."""
            sin_conteo = sum(1 for j in range(max(0, i - N_HIST), i) if hist[j]['con_datos'] and exc_base(j, i))
            usadas, _, nuevas = semanas_base(i)
            idx = sorted(hist.index(h) for h in usadas)
            rango = None
            if idx:
                d0, d1 = semanas[idx[0]]['lunes'], semanas[idx[-1]]['viernes']
                rango = f'{fmt_fecha(d0)}-{fmt_fecha(d1)}'
            return {'sin_conteo': sin_conteo, 'usadas': len(usadas), 'rango_usado': rango, 'nuevas': nuevas}

        def calificar(i, h, b):
            if alta and semanas[i]['lunes'] - timedelta(weeks=N_HIST) < alta:
                return 'sin_historial'                  # alta documentada hace <5 semanas
            if alta and len(utiles(range(0, i), i)) < N_HIST:
                return 'sin_historial'                  # alta sin 5 semanas utiles propias (p. ej. entro en excepcion de su SD)
            return semaforo(h['total'], b)              # b=None (sin semanas utiles) -> sin_historial

        for i, h in enumerate(hist):
            b, bt, n, previa = baseline_at(i)
            h['baseline'] = b
            h['baseline_tool'] = bt
            h['baseline_semanas'] = n
            h['baseline_previa'] = previa
            h['calificacion_transicion'] = None
            if h['excepcion']['es_excepcion']:
                h['semaforo'] = 'excepcion'
                if h['excepcion']['transicion']:
                    h['calificacion_transicion'] = calificar(i, h, b)
            else:
                h['semaforo'] = calificar(i, h, b)

        ciclo = hist[-N_CICLO:]
        # Racha: desde el corte actual hacia atras; excepcion se salta sin romper.
        racha, rota = 0, False
        for h in reversed(ciclo):
            if rota or h['semaforo'] == 'excepcion':
                continue
            if h['semaforo'] in ('verde', 'amarillo') and h['total'] > UMBRAL_RACHA:
                racha += 1
            else:
                rota = True
        na_ciclo = all(h['semaforo'] == 'excepcion' for h in ciclo)
        evaluables = [h for h in ciclo if h['semaforo'] != 'excepcion']
        div = round(sum(h['wf_distintos'] for h in evaluables) / len(evaluables), 1) if evaluables else None

        cur = hist[-1]
        prev_real = next((h for h in reversed(hist[:-1]) if h['con_datos']), None)
        ultima_exc = hist[-2]['excepcion']['es_excepcion'] if len(hist) > 1 else False
        firma = '>'.join(t for t, _ in sorted(((t, cur[t]) for t in TOOLS if cur[t] > 0),
                                               key=lambda kv: (-kv[1], ORDEN_DESEMPATE.index(kv[0]))))
        # Fortaleza historica: herramienta con mas uso promedio en las semanas de linea base.
        _, bt, _, _ = baseline_at(len(hist) - 1)
        fuerte = (max(TOOLS, key=lambda t: (bt.get(t, 0), -ORDEN_DESEMPATE.index(t)))
                  if bt and any(bt.values()) else None)
        wf_ciclo = {}
        for h in hist[-N_CICLO:]:
            for k, v in h['wf_conteo'].items():
                wf_ciclo[k] = wf_ciclo.get(k, 0) + v
        # workflow mas usado esta semana; empate: mas usado en el ciclo de 5 semanas; luego alfabetico
        wf_top = min(cur['wf_conteo'].items(), key=lambda kv: (-kv[1], -wf_ciclo.get(kv[0], 0), kv[0]), default=None)
        ratio = None if not cur['baseline'] else cur['total'] / cur['baseline']
        exc = cur['excepcion']
        sem_reporte = cur['calificacion_transicion'] or cur['semaforo']
        if cur['calificacion_transicion']:
            vig = [e for e in excs if e.get('sd') == sd and cur_mon_ <= date.fromisoformat(e['hasta']) <= cur_fri_]
            cierre = max((date.fromisoformat(e['hasta']) for e in vig), default=cur_fri_)
            inicio = min((date.fromisoformat(e['desde']) for e in vig), default=cur_mon_)
            ref = ('vs. su ritmo previo a la excepción' if cur['baseline_previa']
                   else 'vs. su propio promedio')
            if sem_reporte == 'sin_historial':
                mot = [{'text': "Alta reciente: todavía sin 5 semanas de historial propio fuera de la excepción."}]
            else:
                mot = motivo(sem_reporte, cur, cur['baseline_tool'])   # el resumen explica la transicion
            fort = fortaleza(wf_top, fuerte)
        elif cur['semaforo'] == 'excepcion':
            vig = [e for e in excs if (uid in e.get('personas', []) or e.get('sd') == sd)
                   and date.fromisoformat(e['desde']) <= cur_fri_ and date.fromisoformat(e['hasta']) >= cur_mon_]
            vig.sort(key=lambda e: 0 if uid in e.get('personas', []) else 1)   # la personal gana
            rango = vig[0] if vig else None
            txt = (f"{rango['tipo']} ({fmt_fecha(date.fromisoformat(rango['desde']))}-"
                   f"{fmt_fecha(date.fromisoformat(rango['hasta']))} {rango['hasta'][:4]})") if rango else 'Excepción documentada'
            mot = [{'text': txt}]
            fort = [{'text': 'Sin datos esta semana (excepción).'}]
        else:
            mot = motivo(cur['semaforo'], cur, cur['baseline_tool'])
            fort = fortaleza(wf_top, fuerte)
            if cur['semaforo'] in ('amarillo', 'rojo'):
                nota = nota_ausencia_parcial(exc)
                if nota:
                    mot = [{'text': nota}] + mot
            if cur['baseline_previa'] and cur['semaforo'] not in ('sin_historial',):
                db = detalle_base(len(hist) - 1)
                mot = [{'text': f"Sus {db['sin_conteo']} semanas anteriores quedaron sin conteo por excepción: se compara contra "
                                f"sus {db['usadas']} semanas previas a la excepción ({db['rango_usado']}). "}] + mot
        post = bool(len(hist) > 1 and hist[-2]['excepcion']['es_excepcion'] and not exc['es_excepcion'])
        if post:
            mot = [{'text': 'Primera semana completa tras una excepción: la cifra todavía no se lee como ritmo sostenido. '}] + mot

        rows.append({
            'usuario': uid, 'nombre': p['nombre'], 'nivel': p['nivel'], 'puesto': p['puesto'],
            'champion': p['champion'], 'f_esperada': p['f_esperada'], 'reporta_a': p.get('reporta_a'),
            **{t.lower(): cur[t] for t in TOOLS},
            'total': cur['total'], 'dias_activos': cur['dias_activos'], 'ultima_actividad': cur['ultima'],
            'semaforo': sem_reporte,
            'en_excepcion': cur['semaforo'] == 'excepcion',
            'transicion': bool(cur['calificacion_transicion']),
            'baseline_previa': cur['baseline_previa'],
            'base_detalle': detalle_base(len(hist) - 1),
            'baseline': None if cur['baseline'] is None else round(cur['baseline'], 1),
            'baseline_semanas': cur['baseline_semanas'],
            'ratio': None if not cur['baseline'] else round(cur['total'] / cur['baseline'], 3),
            'baseline_tool': {t: round(v, 1) for t, v in (cur['baseline_tool'] or {}).items()},
            'excepcion_actual': cur['excepcion'],
            'post_excepcion': post,
            'total_anterior': prev_real['total'] if prev_real else None,
            'racha': None if na_ciclo else racha, 'naCiclo': na_ciclo,
            'diversidadWf': div,
            'firma': firma or 'Sin actividad',
            'urgencia': urgencia(cur['semaforo'], cur['total'], ratio),   # transicion -> Sin accion
            'motivo': mot,
            'fortaleza': fort,
            'fortaleza_tool': fuerte,
            'workflow_top': {'nombre': wf_top[0], 'veces': int(wf_top[1])} if wf_top else None,
            'historial': [{'corte': h['label'], 'viernes': str(sem['viernes']), 'con_datos': h['con_datos'],
                           'total': h['total'], 'semaforo': h['semaforo'],
                           **{t: h[t] for t in TOOLS},
                           'excepcion': h['excepcion']['es_excepcion'],
                           'cuenta_en_base': bool(h['base_desde'])} for h, sem in zip(hist, semanas)],
        })

    # Resumen de la referencia pre-excepcion para la semana de transicion (Tony, 28 sep 2026)
    tr = [r for r in rows if r['transicion']]
    # Semanas despues de una excepcion larga de toda la SD (sin transicion): si el promedio de
    # comparacion todavia sale de las semanas previas a la excepcion, el reporte lo dice
    # (decision Tony 28 sep 2026: aclarar semanas sin conteo y que se usan las previas).
    base_previa_info = None
    if not tr:
        from collections import Counter
        prev = [r for r in rows if r['baseline_previa'] and not r['en_excepcion']]
        if len(prev) >= max(2, len(rows) // 2):
            rango = Counter(r['base_detalle']['rango_usado'] for r in prev if r['base_detalle']['rango_usado']).most_common(1)
            base_previa_info = {
                'sin_conteo': max(r['base_detalle']['sin_conteo'] for r in prev),
                'rango_referencia': rango[0][0] if rango else None,
                'personas_con_referencia': sum(1 for r in prev if r['semaforo'] != 'sin_historial'),
                # semanas utiles desde que cerro la excepcion; con 5 se califica normal
                'semanas_nuevas': max((r['base_detalle'].get('nuevas') or 0) for r in prev),
                'altas_sin_historial': sum(1 for r in rows if r['semaforo'] == 'sin_historial' and not r['en_excepcion']),
            }
            # El resumen ya lo explica una vez para toda la SD: en cada fila se deja solo el motivo
            # (si no, la columna Motivo repite 3 renglones por persona y el reporte crece a 7 paginas).
            for r in rows:
                txt = [m for m in r['motivo'] if not m['text'].startswith('Sus ') or 'sin conteo' not in m['text']]
                if txt and txt[0]['text'].startswith('Primera semana completa tras una excepción'):
                    txt = txt[1:]   # el resumen ya dice que es la primera semana tras la excepcion
                r['motivo'] = txt or [{'text': 'Primera semana tras la excepción.'}]
            # Decision Tony 2 oct 2026: mientras la comparacion sea contra semanas previas a la
            # excepcion (roles distintos), no se escala: urgencia Sin accion y color de referencia.
            for r in rows:
                if r['baseline_previa'] and not r['en_excepcion']:
                    r['urgencia'] = 'Sin acción'
                    r['comparacion_previa'] = True
    gerencias = agrupar_gerencias(rows, roster, sd)
    transicion_info = None
    if tr:
        from collections import Counter
        con_ref = [r for r in tr if r['baseline_previa'] and r['semaforo'] != 'sin_historial']
        rango = Counter(r['base_detalle']['rango_usado'] for r in con_ref).most_common(1)
        transicion_info = {
            'sin_conteo': max(r['base_detalle']['sin_conteo'] for r in tr),
            'rango_referencia': rango[0][0] if rango else None,
            'personas_con_referencia': len(con_ref),
            'altas_sin_historial': sum(1 for r in tr if r['semaforo'] == 'sin_historial'),
        }
    usos = sorted(({'persona': r['nombre'], 'uso': r['workflow_top']['nombre'], 'veces': r['workflow_top']['veces']}
                   for r in rows if r['workflow_top']), key=lambda u: (-u['veces'], u['persona']))

    cur_mon, cur_fri = wins[-1]
    # Cortesias bajo seguimiento de la SD (Tony, 30 sep 2026: la licencia de Diana Gabriela Castillo,
    # de Compras, la pidio Karla Mendez y su uso va en el Ejecutivo de ENN). Solo informativo: no entran
    # a totales, semaforo, urgencia ni gerencias. Sin cuenta antes de su alta.
    cortesias = []
    for u, p in roster['personas'].items():
        if p.get('seguimiento_sd') != sd or p.get('baja_ejecutada'):
            continue
        alta = date.fromisoformat(p['alta']) if p.get('alta') else None
        if alta and alta > cur_fri:
            continue
        serie = []
        for mon, fri in wins[-5:]:
            if alta and fri < alta:
                continue
            m = ev[(ev['user_id'] == u) & (ev['fecha'] >= mon) & (ev['fecha'] <= fri) & (ev['tool'] != 'OTRO')]
            serie.append({'corte': label(mon, fri), 'total': int(len(m)),
                          **{t: int((m['tool'] == t).sum()) for t in TOOLS}})
        act = serie[-1] if serie else {'total': 0, **{t: 0 for t in TOOLS}}
        orden = sorted([t for t in TOOLS if act[t]], key=lambda t: (-act[t], ORDEN_DESEMPATE.index(t)))
        cortesias.append({'usuario': u, 'nombre': p['nombre'], 'area': p.get('area'),
                          'solicito': p.get('solicito'), 'alta': p.get('alta'), 'total': act['total'],
                          'firma': '>'.join(orden) if orden else 'Sin actividad',
                          'ultimas': [x['total'] for x in serie], 'semanas_con_cuenta': len(serie)})
    out = {
        'sd': sd,
        'sdNombre': roster['sd_nombres'][sd],
        'champion': champion_del_corte(personas, roster, excs, cur_fri),
        'subdirector': roster['personas'][roster['subdirectores'][sd]]['nombre'],
        'corte': label(cur_mon, cur_fri),
        'corte_lunes': str(cur_mon), 'corte_viernes': str(cur_fri),
        'o_en_a': o_en_a,
        'vault_solo_superficie': vault_solo_superficie,
        'totales': {
            'acciones': sum(r['total'] for r in rows),
            'acciones_anterior': sum((r['total_anterior'] or 0) for r in rows),
            'personas': len(rows),
            'personas_activas': sum(1 for r in rows if r['total'] > 0),
            'workflows': sum(r['w'] for r in rows),
            'atencion_alta': sum(1 for r in rows if r['urgencia'] == 'Alta'),
            'evaluadas': sum(1 for r in rows if not r['en_excepcion'] and r['semaforo'] != 'sin_historial' and not r.get('comparacion_previa')),
        },
        'calidad_datos': {
            **meta,
            'eventos_fin_de_semana_excluidos': int(len(fds)),
            'eventos_superficie_no_clasificada': fuera['superficie'].value_counts().to_dict(),
            'usuarios_activos_fuera_de_roster': sorted(
                set(ev[(ev['fecha'] >= cur_mon) & (ev['fecha'] <= cur_fri)]['user_id'])
                - set(roster['personas'])),
        },
        'etiqueta_subdireccion': roster.get('etiqueta_subdireccion', {}).get(sd, 'Subdirección'),
        'gerencias': gerencias,
        'transicion_info': transicion_info,
        'base_previa_info': base_previa_info,
        'usos_clave': usos,
        'cortesias': cortesias,
        'rows': rows,
    }
    return out


NOMBRE_TOOL = {'A': 'Assistant', 'W': 'Workflow', 'V': 'Vault', 'Wo': 'Word Add-in', 'O': 'Outlook'}


def herramienta_esperada(f_esperada):
    """'W>A' -> 'W'; 'M (W>A)' -> 'W'; 'A>W>V' -> 'A'. Primera herramienta que el puesto espera (HIL)."""
    s = (f_esperada or '').replace('M (', '').replace(')', '').strip()
    t = s.split('>')[0].strip() if s else ''
    return t if t in NOMBRE_TOOL else None


def detalle_baja(m):
    if m['total'] == 0:
        return 'sin actividad'
    if m['ratio'] is not None and (m['ratio'] < UMBRAL_ALTA_RATIO or m['semaforo'] == 'rojo'):
        return f"{round(m['ratio'] * 100)}% de su ritmo"
    return f"solo {m['total']} acciones en la semana"   # Alta por volumen bajo, no por caida


def acciones_gerencia(miembros, destinatario=None):
    """'Que pedirle a la gerencia' (decision Tony 28 sep 2026: reemplaza la columna W). Reglas
    fijas, maximo 2 renglones:
      1. Personas en urgencia Alta: buscarlas, con su % contra su propio ritmo (o 'sin actividad').
      2. Gap de herramienta (HIL, 'el Gap es el dato accionable'): la primera herramienta que su
         puesto espera no es Assistant, no la uso esta semana y casi no la usa en su linea base.
      3. Si no hay nada: sostener. Si todos estan en excepcion o en semana de transicion: no escalar."""
    evaluables = [m for m in miembros if not m['en_excepcion']]
    # El Ejecutivo lo recibe el Subdirector: su propia fila no le pide buscarse a si mismo.
    accionables = [m for m in evaluables if m['usuario'] != destinatario]
    if not evaluables:
        return ['Sin escalar (cierre de excepción).' if any(m['transicion'] for m in miembros)
                else 'Sin acción: toda la gerencia en excepción.']
    out = []
    altas = [m for m in accionables if m['urgencia'] == 'Alta']
    if altas:
        det = [f"{m['nombre']} ({detalle_baja(m)})" for m in sorted(altas, key=lambda m: (m['ratio'] if m['ratio'] is not None else -1))]
        out.append('Buscar a ' + ', '.join(det[:3]) + ('' if len(det) <= 3 else f' y {len(det) - 3} más') + '.')
    gaps = []
    ya = {m['usuario'] for m in altas}
    for m in accionables:
        if m['usuario'] in ya:
            continue   # una sola accion por persona
        t = herramienta_esperada(m['f_esperada'])
        if not t or t == 'A':
            continue
        if m[t.lower()] == 0 and (m['baseline_tool'] or {}).get(t, 0) < 1:
            gaps.append((m['nombre'], t))
    if gaps:
        por_tool = {}
        for n, t in gaps:
            por_tool.setdefault(t, []).append(n)
        for t, ns in list(por_tool.items())[:1]:
            quien = ' y '.join(ns[:2]) + ('' if len(ns) <= 2 else f' y {len(ns) - 2} más')
            out.append(f"Proponer un primer uso de {NOMBRE_TOOL[t]} a {quien}: su puesto lo espera y no lo usa.")
    if any(m['transicion'] for m in miembros):
        out = ['Sin escalar (cierre de excepción).'] + out[1:] if not altas else out
    if any(m.get('comparacion_previa') for m in miembros) and not altas:
        out = ['Sin escalar: primeras semanas tras la excepción de la SD.'] + out[:1]
    return out[:2] or ['Sin pendiente: sostener el ritmo.']


def agrupar_gerencias(rows, roster, sd):
    """Vista por Gerencia (decision Tony 28 sep 2026: totales de toda la gerencia, no solo del
    responsable). Cada persona cae en la gerencia de su jefe inmediato bajo el Subdirector; quien
    reporta directo al Subdirector sin gerencia propia cae en la fila de la Subdireccion.
    Semaforo de la gerencia: total del equipo vs. suma de los promedios propios de sus
    integrantes (sin quienes estan en excepcion). Regla 8 del HIL: la gerencia de jbueno aparece
    con sus integrantes, sin las metricas de jbueno."""
    P = roster['personas']
    sub = roster['subdirectores'][sd]
    etiqueta = roster.get('etiqueta_subdireccion', {}).get(sd, 'Subdirección')

    def cabeza(uid):
        c, seen = uid, set()
        while c and c not in seen:
            seen.add(c)
            if c == sub:
                return sub
            jefe = P.get(c, {}).get('reporta_a')
            if jefe == sub:
                return c if P[c].get('gerencia') else sub
            c = jefe
        return sub

    grupos = {}
    for r in rows:
        grupos.setdefault(cabeza(r['usuario']), []).append(r)
    out = []
    orden = [sub] + roster.get('orden_gerencias', {}).get(sd, [u for u in P if P[u].get('gerencia') and P[u]['sd'] == sd])
    for h in orden:
        miembros = grupos.get(h, [])
        if not miembros:
            continue
        cal = [m for m in miembros if (not m['en_excepcion'] or m['transicion']) and m['baseline'] is not None
               and m['semaforo'] != 'sin_historial']
        tot = sum(m['total'] for m in miembros)
        base = sum(m['baseline'] for m in cal)
        if not cal:
            sem = 'excepcion' if all(m['en_excepcion'] and not m['transicion'] for m in miembros) else 'sin_historial'
        else:
            sem = semaforo(sum(m['total'] for m in cal), base)
        herr = {t: sum(m[t.lower()] for m in miembros) for t in TOOLS}
        firma = '>'.join(t for t, _ in sorted(((t, v) for t, v in herr.items() if v > 0),
                                               key=lambda kv: (-kv[1], ORDEN_DESEMPATE.index(kv[0])))) or 'Sin actividad'
        out.append({
            'gerencia': etiqueta if h == sub else P[h]['gerencia'],
            'responsable': P[h]['nombre'],
            'responsable_excluido': bool(P[h].get('excluido_metricas')),
            'personas': len(miembros),
            'integrantes': [m['nombre'] for m in miembros],
            'acciones': tot,
            'w': herr['W'], 'firma': firma, 'semaforo': sem,
            'que_pedir': acciones_gerencia(miembros, destinatario=sub),
            'en_transicion': any(m['transicion'] for m in miembros),
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corte-fin', required=True, help='viernes del corte, AAAA-MM-DD')
    ap.add_argument('--sd', required=True)
    ap.add_argument('--uploads', default=UPLOADS_DEFAULT)
    ap.add_argument('--o-en-a', action='store_true', help='regresion: contar Outlook dentro de A (criterio previo al 26 sep)')
    ap.add_argument('--vault-solo-superficie', action='store_true', help='regresion: V solo por superficie VAULT (criterio previo al 28 sep)')
    ap.add_argument('--out')
    a = ap.parse_args()
    fin = date.fromisoformat(a.corte_fin)
    if fin.weekday() != 4:
        sys.exit('--corte-fin debe ser viernes')
    out = build(fin, a.sd, a.uploads, a.o_en_a, a.vault_solo_superficie)
    path = a.out or os.path.join(REPO, 'out', f'{a.sd}_{a.corte_fin}{"_oena" if a.o_en_a else ""}.json')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(out, open(path, 'w'), ensure_ascii=False, indent=1, default=str)
    print('OK:', path)


if __name__ == '__main__':
    main()
