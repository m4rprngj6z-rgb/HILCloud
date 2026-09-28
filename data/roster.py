"""
Compatibilidad: el roster vive en data/roster.json (generado parseando el HIL de Notion).
Este modulo solo lo carga, para no tener dos copias que se desincronicen.
"""
import json
import os

_R = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'roster.json')))
SD_NAMES = _R['sd_nombres']
PERSONAS = _R['personas']
CHAMPIONS = {p['sd']: u for u, p in PERSONAS.items() if p['champion']}
EXCLUDED_FROM_METRICS = {u for u, p in PERSONAS.items() if p.get('excluido_metricas')}
CORTESIA_EXTERNOS = {u for u, p in PERSONAS.items() if p.get('fuera_de_semaforo')}


def by_sd(sd_code, evaluables=True):
    return [u for u, p in PERSONAS.items() if p['sd'] == sd_code
            and not (evaluables and (p.get('excluido_metricas') or p.get('fuera_de_semaforo')))]
