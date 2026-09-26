"""
Roster oficial Harvey AI x Gentera - Direccion Juridica (DJ)

Fuente unica de verdad: Notion, pagina "Base de Usuarios Harvey AI x Gentera"
(376f66a1-7162-81c5-a12f-d8385313d6e7). Ultima sincronizacion desde Notion: 26 sep 2026.

REGLA: este archivo se actualiza SOLO despues de confirmar contra esa pagina de Notion.
No editar a mano por sospecha o memoria; si algo no cuadra con el corte semanal, ir primero
a Notion, corregir alla, y luego reflejarlo aqui.

user_id = local-part del correo, en minusculas (antes del @). Varias personas tienen mas de
un dominio de correo historico (compartamos.com / genteraservicios.com / gentera.com.mx);
en los exports de uso, fusionar SIEMPRE por user_id antes de agregar por semana o se subestima
la actividad real de esa persona.
"""

SD_NAMES = {
    "ENN": "Expansion Nuevos Negocios",
    "CN": "Cumplimiento Normativo",
    "PLD": "Prevencion de Lavado de Dinero",
    "GC": "Gobierno Corporativo",
    "JC": "Juridico Contencioso",
    "RL": "Relaciones Laborales",
    "DJ": "Direccion Juridica (capa transversal)",
}

CHAMPIONS = {
    "ENN": "nsotelo",   # Karime Sotelo, nombrada junio 2026
    "CN": "jbelloc",    # Jorge Belloc
    "PLD": "gubernal",  # Gustavo Bernal
    "GC": "amireles",   # Alejandra Mireles
    "JC": "amhernandez",# Amed Hernandez (sin sesiones semanales establecidas)
    "RL": "jnajera",    # Jean Cub Najera
}

# jbueno (Tony) es Champion de Champions, capa DJ: excluido de metricas y de rankings.
# zmanzur (Fibi) es co-owner MVP Harvey: excluido de rankings, solo su propia seccion.
EXCLUDED_FROM_METRICS = {"jbueno", "zmanzur"}

# No se incluyen en reportes de semaforo (cortesia / externos a la DJ).
CORTESIA_EXTERNOS = {"gchirinos", "bleperez", "brytrujillo", "jcajuarez"}

# ROSTER: user_id -> dict
# puesto: como aparece en Notion (puede estar vacio si no se ha confirmado)
# champion: True si es el Champion de esa SD
ROSTER = {
    # --- ENN --- Champion: nsotelo
    "jbueno":      dict(sd="ENN", puesto="Champion de Champions (capa DJ)", champion=False),
    "nsotelo":     dict(sd="ENN", puesto="Champion ENN", champion=True),
    "kmendez":     dict(sd="ENN", puesto="Subdirectora ENN", champion=False),
    "alduarte":    dict(sd="ENN", puesto="User (permisos de Champion, rol User)", champion=False),
    "rodosuna":    dict(sd="ENN", puesto="User", champion=False),
    "dfuentes":    dict(sd="ENN", puesto="User", champion=False),
    "isrodriguez": dict(sd="ENN", puesto="Coordinadora Contratos", champion=False),
    "migjaimes":   dict(sd="ENN", puesto="User", champion=False),
    "soochoa":     dict(sd="ENN", puesto="User", champion=False),
    "rrcubillo":   dict(sd="ENN", puesto="Gerente Arrendamientos (Inmuebles), reporta a kmendez", champion=False),

    # --- CN --- Champion: jbelloc
    "jbelloc":     dict(sd="CN", puesto="Champion CN", champion=True),
    "farcos":      dict(sd="CN", puesto="Subdirector CN", champion=False),
    "jgsantillan": dict(sd="CN", puesto="User", champion=False),
    "amaqueda":    dict(sd="CN", puesto="User", champion=False),
    "jixta":       dict(sd="CN", puesto="User", champion=False),
    "ealvarez":    dict(sd="CN", puesto="User", champion=False),
    "larrazola":   dict(sd="CN", puesto="User", champion=False),
    "anraya":      dict(sd="CN", puesto="User", champion=False),
    "japperez":    dict(sd="CN", puesto="User", champion=False),
    "lesespinoza": dict(sd="CN", puesto="User (caso Montessori)", champion=False),
    "fymedina":    dict(sd="CN", puesto="User", champion=False),
    "aksalinas":   dict(sd="CN", puesto="User (caso Montessori)", champion=False),
    "ceberrelleza":dict(sd="CN", puesto="User", champion=False),
    "kiguerrero":  dict(sd="CN", puesto="User", champion=False),
    "adguillen":   dict(sd="CN", puesto="Gerente de Seguros, reporta a farcos", champion=False),

    # --- PLD --- Champion: gubernal (19 personas incl. Champion)
    "gubernal":    dict(sd="PLD", puesto="Champion PLD", champion=True),
    "gcadena":     dict(sd="PLD", puesto="Subdirectora PLD", champion=False),
    "hfalcon":     dict(sd="PLD", puesto="User", champion=False),
    "cjreyes":     dict(sd="PLD", puesto="User", champion=False),
    "akamartinez": dict(sd="PLD", puesto="User (incapacidad maternidad desde 1 sep 2026 hasta ene 2027; gerencia cubierta por radimas y jepallares)", champion=False),
    "nerangel":    dict(sd="PLD", puesto="User", champion=False),
    "msotomayor":  dict(sd="PLD", puesto="User", champion=False),
    "rcenturion":  dict(sd="PLD", puesto="User", champion=False),
    "acasillas":   dict(sd="PLD", puesto="User", champion=False),
    "kshernandez": dict(sd="PLD", puesto="User", champion=False),
    "mamanzano":   dict(sd="PLD", puesto="User", champion=False),
    "dammercado":  dict(sd="PLD", puesto="User", champion=False),
    "radimas":     dict(sd="PLD", puesto="User", champion=False),
    "anlramirez":  dict(sd="PLD", puesto="Gerente PLD (Ana Lilia Ramirez Barranco)", champion=False),
    "imbecerra":   dict(sd="PLD", puesto="Coordinador PLD, reporta a anlramirez (Israel Marquez Becerra)", champion=False),
    "jepallares":  dict(sd="PLD", puesto="Coordinador PLD, reporta a anlramirez (Jesus Paul Pallares)", champion=False),
    "kaparicio":   dict(sd="PLD", puesto="Coordinador PLD, reporta a hfalcon (Karla Stephanie Aparicio Gonzalez)", champion=False),
    "dilmendoza":  dict(sd="PLD", puesto="Coordinador PLD, reporta a hfalcon (Diana Laura Mendoza Osorio)", champion=False),
    "gaguerrero":  dict(sd="PLD", puesto="Gerente PLD, reporta a gcadena (Gabriela Mejia Guerrero)", champion=False),

    # --- GC --- Champion: amireles
    "amireles":    dict(sd="GC", puesto="Champion GC", champion=True),
    "lrobert":     dict(sd="GC", puesto="Subdirector GC", champion=False),
    "gjuarez":     dict(sd="GC", puesto="User", champion=False),
    "juagalvez":   dict(sd="GC", puesto="User", champion=False),
    "zulgarcia":   dict(sd="GC", puesto="User", champion=False),
    "myalvarezf":  dict(sd="GC", puesto="User", champion=False),
    "dialvarado":  dict(sd="GC", puesto="User", champion=False),

    # --- JC --- Champion: amhernandez (sin sesiones semanales establecidas)
    "amhernandez": dict(sd="JC", puesto="Champion JC", champion=True),
    "masmora":     dict(sd="JC", puesto="Subdirector JC", champion=False),
    "arperez":     dict(sd="JC", puesto="User", champion=False),
    "omonteverde": dict(sd="JC", puesto="User", champion=False),
    "aqsordo":     dict(sd="JC", puesto="User", champion=False),
    "glosanchez":  dict(sd="JC", puesto="User", champion=False),
    "crifernandez":dict(sd="JC", puesto="User (caso estrella Vault, ~280 consultas en un proyecto)", champion=False),

    # --- RL --- Champion: jnajera
    "jnajera":     dict(sd="RL", puesto="Champion RL", champion=True),
    "jcenteno":    dict(sd="RL", puesto="Director Funcional RL", champion=False),
    "kzetina":     dict(sd="RL", puesto="User", champion=False),
    "charamirez":  dict(sd="RL", puesto="User", champion=False),
    "pgodinez":    dict(sd="RL", puesto="User", champion=False),
    "ajogarcia":   dict(sd="RL", puesto="User", champion=False),
    "valcruz":     dict(sd="RL", puesto="User", champion=False),
    "rvfernandezl":dict(sd="RL", puesto="User (verificar cada corte: vacaciones vs. inactividad)", champion=False),

    # --- DJ (capa transversal) ---
    "zmanzur":     dict(sd="DJ", puesto="Co-owner MVP Harvey (Fibi)", champion=False),

    # --- Cortesia / externos (no entran a reportes de semaforo) ---
    "gchirinos":   dict(sd="EXTERNO", puesto="Cortesia, area sin confirmar", champion=False),
    "bleperez":    dict(sd="EXTERNO", puesto="Cortesia, area sin confirmar (dada de baja)", champion=False),
    "brytrujillo": dict(sd="EXTERNO", puesto="Control Interno, consultor ciberseguridad (regulador, no candidato a baja)", champion=False),
    "jcajuarez":   dict(sd="EXTERNO", puesto="Control Interno Operativo TI (baja ejecutada)", champion=False),
}

# Dominios de correo conocidos por persona, para fusionar en los exports de uso.
# No exhaustivo: si aparece un dominio nuevo para un user_id ya conocido, agregarlo aqui.
KNOWN_DOMAINS = {
    "radimas": ["genteraservicios.com"],       # gentera.com.mx y compartamos.com desactivados
    "myalvarezf": ["genteraservicios.com"],    # compartamos.com fuera
    "jgsantillan": ["genteraservicios.com"],   # compartamos.com fuera
    "fymedina": ["genteraservicios.com"],      # compartamos.com fuera
}


def all_users(exclude_metrics=True, exclude_cortesia=True):
    """Regresa la lista de user_id a incluir en calculos de metricas/semaforo."""
    out = []
    for uid, info in ROSTER.items():
        if exclude_metrics and uid in EXCLUDED_FROM_METRICS:
            continue
        if exclude_cortesia and info["sd"] == "EXTERNO":
            continue
        out.append(uid)
    return out


def by_sd(sd_code):
    return [uid for uid, info in ROSTER.items() if info["sd"] == sd_code]
