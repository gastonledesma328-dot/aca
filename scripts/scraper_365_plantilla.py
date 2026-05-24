import asyncio
import json
import os
import re
import time
import unicodedata
from pathlib import Path

import requests
from playwright.async_api import async_playwright


# ============================================================
# SCRAPER: IMÁGENES DESDE 365SCORES + DATOS PERSONALES DESDE ESPN
# ============================================================
#
# Basado en:
# https://github.com/pseudo-r/Public-ESPN-API/blob/main/docs/sports/soccer.md
#
# Endpoints usados:
#
# 1) Equipos de una liga:
# https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/teams
#
# 2) Plantel de un equipo:
# https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/teams/{team_id}/roster
#
# 3) Detalle extra de atleta, si hace falta:
# https://sports.core.api.espn.com/v2/sports/soccer/leagues/{league}/athletes/{athlete_id}
#
# ESPN no necesita API key.
#
# Formato recomendado de equipos.json:
# [
#   {
#     "equipo": "Arsenal",
#     "url": "https://www.365scores.com/es/football/team/arsenal-104/squad",
#     "espn_slug": "eng.1",
#     "espn_team_id": "359",
#     "liga": "Premier League"
#   }
# ]
#
# Si no ponés espn_team_id, el scraper lo busca por nombre dentro de /teams.
# Si no ponés espn_slug, lo deduce por liga/equipo.
#
# Imagen: SIEMPRE desde 365Scores.
# Datos personales: desde ESPN.
# Si el jugador de ESPN no aparece con imagen en la plantilla de 365Scores, no se guarda.
# No se usa imagen/headshot de ESPN.
#
# ============================================================


EQUIPOS_FILE = "equipos.json"
BLACKLIST_FILE = "blacklist_jugadores.json"

DATA_DIR = Path("data/adivina-jugador")
GAME_DIR = Path("juegos/adivinajugador")

OUTPUT_JSON = DATA_DIR / "plantilla_365_jugadores.json"
OUTPUT_SIMPLE_JSON = DATA_DIR / "plantilla_365_jugadores_simple.json"

GAME_IMAGES_DIR = GAME_DIR / "imagenes_jugadores_365"
GAME_JSON = GAME_DIR / "jugadores.json"

FUENTE = "365Scores imágenes + ESPN datos personales"

ESPN_SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer"
ESPN_CORE_BASE = "https://sports.core.api.espn.com/v2/sports/soccer/leagues"

REQUEST_DELAY = float(os.environ.get("ESPN_SCRAPER_DELAY", "0.15"))
# Modo obligatorio: solo se guardan jugadores que tengan imagen encontrada en la plantilla de 365Scores.
ONLY_WITH_IMAGE = True

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json,text/plain,*/*",
}

HEADERS_IMAGE = {
    "User-Agent": HEADERS["User-Agent"],
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Referer": "https://www.espn.com/",
}

HEADERS_365 = {
    **HEADERS_IMAGE,
    "Referer": "https://www.365scores.com/",
}


# Slugs oficiales de ESPN según documentación.
ESPN_SLUGS_POR_LIGA = {
    "Premier League": "eng.1",
    "LaLiga": "esp.1",
    "La Liga": "esp.1",
    "Serie A": "ita.1",
    "Bundesliga": "ger.1",
    "Ligue 1": "fra.1",
    "Primeira Liga": "por.1",
    "Eredivisie": "ned.1",
    "Liga Profesional Argentina": "arg.1",
    "Brasileirão": "bra.1",
    "Brasileirao": "bra.1",
    "Categoría Primera A": "col.1",
    "Categoria Primera A": "col.1",
    "MLS": "usa.1",
    "Saudi Pro League": "ksa.1",
    "Süper Lig": "tur.1",
    "Super Lig": "tur.1",
    "Liga MX": "mex.1",
}

LIGAS_POR_EQUIPO = {
    "arsenal": "Premier League",
    "manchester city": "Premier League",
    "liverpool": "Premier League",
    "chelsea": "Premier League",
    "manchester united": "Premier League",
    "tottenham hotspur": "Premier League",

    "real madrid": "LaLiga",
    "barcelona": "LaLiga",
    "fc barcelona": "LaLiga",
    "atlético de madrid": "LaLiga",
    "atletico de madrid": "LaLiga",
    "sevilla": "LaLiga",
    "real sociedad": "LaLiga",
    "villarreal": "LaLiga",

    "inter milan": "Serie A",
    "inter": "Serie A",
    "juventus": "Serie A",
    "ac milan": "Serie A",
    "milan": "Serie A",
    "napoli": "Serie A",
    "roma": "Serie A",
    "lazio": "Serie A",

    "bayern münchen": "Bundesliga",
    "bayern munchen": "Bundesliga",
    "bayern munich": "Bundesliga",
    "borussia dortmund": "Bundesliga",
    "bayer leverkusen": "Bundesliga",
    "rb leipzig": "Bundesliga",

    "paris saint-germain": "Ligue 1",
    "psg": "Ligue 1",
    "olympique de marseille": "Ligue 1",
    "marseille": "Ligue 1",
    "as monaco": "Ligue 1",
    "monaco": "Ligue 1",
    "olympique lyonnais": "Ligue 1",
    "lyon": "Ligue 1",

    "benfica": "Primeira Liga",
    "fc porto": "Primeira Liga",
    "sporting cp": "Primeira Liga",

    "ajax amsterdam": "Eredivisie",
    "ajax": "Eredivisie",
    "psv eindhoven": "Eredivisie",
    "psv": "Eredivisie",
    "feyenoord": "Eredivisie",

    "boca juniors": "Liga Profesional Argentina",
    "river plate": "Liga Profesional Argentina",
    "racing club": "Liga Profesional Argentina",
    "independiente": "Liga Profesional Argentina",
    "san lorenzo": "Liga Profesional Argentina",

    "flamengo": "Brasileirão",
    "palmeiras": "Brasileirão",
    "santos": "Brasileirão",
    "corinthians": "Brasileirão",
    "são paulo": "Brasileirão",
    "sao paulo": "Brasileirão",

    "atlético nacional": "Categoría Primera A",
    "atletico nacional": "Categoría Primera A",
    "millonarios": "Categoría Primera A",
    "junior fc": "Categoría Primera A",

    "inter miami cf": "MLS",
    "inter miami": "MLS",
    "lafc": "MLS",
    "los angeles fc": "MLS",
    "seattle sounders": "MLS",

    "al nassr": "Saudi Pro League",
    "al hilal": "Saudi Pro League",
    "al ahli": "Saudi Pro League",

    "galatasaray": "Süper Lig",
    "fenerbahçe": "Süper Lig",
    "fenerbahce": "Süper Lig",
    "beşiktaş": "Süper Lig",
    "besiktas": "Süper Lig",

    "club américa": "Liga MX",
    "club america": "Liga MX",
    "cruz azul": "Liga MX",
    "tigres uanl": "Liga MX",
}


# IDs ESPN conocidos.
# Si faltan, el scraper los busca automáticamente en /teams.
ESPN_TEAM_IDS = {
    "arsenal": "359",
    "manchester city": "382",
    "liverpool": "364",
    "chelsea": "363",
    "manchester united": "360",
    "tottenham hotspur": "367",

    "real madrid": "86",
    "barcelona": "83",
    "fc barcelona": "83",
    "atletico madrid": "1068",
    "atletico de madrid": "1068",
    "atlético de madrid": "1068",
    "sevilla": "243",
    "real sociedad": "89",
    "villarreal": "102",

    "inter milan": "110",
    "inter": "110",
    "juventus": "111",
    "ac milan": "103",
    "milan": "103",
    "napoli": "114",
    "roma": "104",
    "lazio": "112",

    "bayern munchen": "132",
    "bayern münchen": "132",
    "bayern munich": "132",
    "borussia dortmund": "124",
    "bayer leverkusen": "131",
    "rb leipzig": "11420",

    "paris saint-germain": "160",
    "psg": "160",
    "olympique de marseille": "176",
    "marseille": "176",
    "as monaco": "174",
    "monaco": "174",
    "olympique lyonnais": "167",
    "lyon": "167",

    "benfica": "1929",
    "fc porto": "437",
    "sporting cp": "2250",

    "ajax amsterdam": "139",
    "ajax": "139",
    "psv eindhoven": "148",
    "psv": "148",
    "feyenoord": "142",

    "boca juniors": "5",
    "river plate": "16",
    "racing club": "15",
    "independiente": "10",
    "san lorenzo": "18",

    "flamengo": "819",
    "palmeiras": "2029",
    "santos": "2674",
    "corinthians": "874",
    "são paulo": "2026",
    "sao paulo": "2026",

    "atlético nacional": "3907",
    "atletico nacional": "3907",
    "millonarios": "3918",
    "junior fc": "3921",

    "inter miami cf": "20232",
    "inter miami": "20232",
    "lafc": "18966",
    "los angeles fc": "18966",
    "seattle sounders": "9726",

    "al nassr": "817",
    "al hilal": "605",
    "al ahli": "834",

    "galatasaray": "432",
    "fenerbahçe": "436",
    "fenerbahce": "436",
    "beşiktaş": "428",
    "besiktas": "428",

    "club américa": "227",
    "club america": "227",
    "cruz azul": "218",
    "tigres uanl": "232",
}

EQUIPOS_365_FALLBACK = {
    "boca-juniors": {
        "equipo": "Boca Juniors",
        "url": "https://www.365scores.com/es/football/team/boca-juniors-866/squad"
    },
    "river-plate": {
        "equipo": "River Plate",
        "url": "https://www.365scores.com/es/football/team/river-plate-868/squad"
    },
    "racing-club": {
        "equipo": "Racing Club",
        "url": "https://www.365scores.com/es/football/team/racing-club-876/squad"
    },
    "independiente": {
        "equipo": "Independiente",
        "url": "https://www.365scores.com/es/football/team/independiente-874/squad"
    },
    "san-lorenzo": {
        "equipo": "San Lorenzo",
        "url": "https://www.365scores.com/es/football/team/san-lorenzo-873/squad"
    },
    "arsenal": {
        "equipo": "Arsenal",
        "url": "https://www.365scores.com/es/football/team/arsenal-104/squad"
    },
    "manchester-city": {
        "equipo": "Manchester City",
        "url": "https://www.365scores.com/es/football/team/manchester-city-110/squad"
    },
    "liverpool": {
        "equipo": "Liverpool",
        "url": "https://www.365scores.com/es/football/team/liverpool-108/squad"
    },
    "real-madrid": {
        "equipo": "Real Madrid",
        "url": "https://www.365scores.com/es/football/team/real-madrid-131/squad"
    },
    "barcelona": {
        "equipo": "Barcelona",
        "url": "https://www.365scores.com/es/football/team/fc-barcelona-132/squad"
    },
    "atletico-madrid": {
        "equipo": "Atlético de Madrid",
        "url": "https://www.365scores.com/es/football/team/atletico-madrid-134/squad"
    },
    "inter-miami": {
        "equipo": "Inter Miami CF",
        "url": "https://www.365scores.com/es/football/team/inter-miami-54729/squad"
    },
}


TEAMS_CACHE = {}
ATHLETE_DETAIL_CACHE = {}


# ============================================================
# UTILIDADES
# ============================================================

def limpiar_texto(txt):
    if not txt:
        return ""
    return re.sub(r"\s+", " ", str(txt)).strip()


def normalizar(txt):
    txt = str(txt or "").strip().lower()
    txt = unicodedata.normalize("NFD", txt)
    txt = "".join(c for c in txt if unicodedata.category(c) != "Mn")
    txt = re.sub(r"\s+", " ", txt)
    return txt.strip()


def slugify(text):
    text = normalizar(text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    return text or "item"


def limpiar_competicion(valor):
    comp = limpiar_texto(valor)

    if not comp:
        return ""

    n = normalizar(comp)

    invalidas = {
        "365scores",
        "365 scores",
        "fuente",
        "-",
        "sin datos",
        "liga sin dato",
    }

    if n in invalidas:
        return ""

    return comp


def normalizar_posicion(pos):
    p = normalizar(pos)

    if not p:
        return ""

    if any(x in p for x in ["goalkeeper", "goalkeepers", "arquero", "portero", "gk"]):
        return "Portero"

    if any(x in p for x in ["defender", "defenders", "defensa", "defensor", "centre back", "center back", "left back", "right back", "lateral", "df"]):
        return "Defensa"

    if any(x in p for x in ["midfielder", "midfielders", "mediocampista", "medio", "volante", "mf"]):
        return "Mediocampista"

    if any(x in p for x in ["forward", "forwards", "attacker", "attackers", "delantero", "striker", "winger", "extremo", "fw"]):
        return "Delantero"

    return limpiar_texto(pos)


def fecha_iso_a_ddmmyyyy(fecha):
    fecha = limpiar_texto(fecha)

    # ESPN puede traer "1995-09-15T07:00Z" o "1995-09-15".
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", fecha)

    if not m:
        return fecha

    return f"{m.group(3)}/{m.group(2)}/{m.group(1)}"


def altura_espn_a_cm(valor):
    """
    ESPN a veces trae height en pulgadas.
    También puede venir como displayHeight.
    """
    if valor in [None, ""]:
        return ""

    if isinstance(valor, (int, float)):
        n = float(valor)

        # ESPN suele usar pulgadas.
        if 50 <= n <= 90:
            return int(round(n * 2.54))

        if 140 <= n <= 230:
            return int(round(n))

        return ""

    raw = limpiar_texto(valor).lower().replace(",", ".")

    # 6' 2"
    m = re.search(r"(\d+)\s*'\s*(\d+)", raw)
    if m:
        feet = int(m.group(1))
        inches = int(m.group(2))
        return int(round((feet * 12 + inches) * 2.54))

    # 183 cm
    m = re.search(r"(\d{3})\s*cm", raw)
    if m:
        return int(m.group(1))

    # 1.83 m
    m = re.search(r"([12]\.\d{2})\s*m", raw)
    if m:
        return int(round(float(m.group(1)) * 100))

    # fallback numérico
    m = re.search(r"\d+(?:\.\d+)?", raw)
    if not m:
        return ""

    n = float(m.group(0))

    if 50 <= n <= 90:
        return int(round(n * 2.54))

    if 140 <= n <= 230:
        return int(round(n))

    return ""


def obtener_nombre_equipo(equipo):
    return limpiar_texto(
        equipo.get("equipo")
        or equipo.get("nombre")
        or equipo.get("name")
        or equipo.get("club")
        or "Equipo"
    )


def obtener_liga_equipo(equipo):
    liga = limpiar_competicion(
        equipo.get("liga")
        or equipo.get("competicion")
        or equipo.get("competition")
        or equipo.get("league")
        or equipo.get("torneo")
        or ""
    )

    if liga:
        return liga

    return LIGAS_POR_EQUIPO.get(normalizar(obtener_nombre_equipo(equipo)), "")


def obtener_liga_por_club(club):
    return LIGAS_POR_EQUIPO.get(normalizar(club), "")


def obtener_espn_slug_equipo(equipo):
    for key in ["espn_slug", "league_slug", "espn_league", "liga_slug"]:
        valor = limpiar_texto(equipo.get(key, ""))

        if valor:
            return valor

    liga = obtener_liga_equipo(equipo)

    for nombre_liga, slug in ESPN_SLUGS_POR_LIGA.items():
        if normalizar(nombre_liga) == normalizar(liga):
            return slug

    return ""


def obtener_url_365_equipo(equipo):
    url = (
        equipo.get("url")
        or equipo.get("link")
        or equipo.get("squad")
        or equipo.get("squad_url")
        or equipo.get("plantel_url")
        or equipo.get("url_365scores")
        or equipo.get("href")
        or ""
    )

    url = limpiar_texto(url)

    if url:
        if "/squad" not in url:
            url = url.rstrip("/") + "/squad"
        return url

    equipo_id = normalizar(equipo.get("id", ""))
    equipo_slug = slugify(obtener_nombre_equipo(equipo))

    for key in [equipo_id, equipo_slug]:
        if key in EQUIPOS_365_FALLBACK:
            return EQUIPOS_365_FALLBACK[key]["url"]

    return ""


def asegurar_carpetas():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    GAME_DIR.mkdir(parents=True, exist_ok=True)
    GAME_IMAGES_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# ARCHIVOS
# ============================================================

def cargar_equipos():
    if not os.path.exists(EQUIPOS_FILE):
        ejemplo = [
            {
                "equipo": "Arsenal",
                "url": "https://www.365scores.com/es/football/team/arsenal-104/squad",
                "espn_slug": "eng.1",
                "espn_team_id": "359",
                "liga": "Premier League"
            }
        ]

        with open(EQUIPOS_FILE, "w", encoding="utf-8") as f:
            json.dump(ejemplo, f, ensure_ascii=False, indent=2)

        print(f"⚠️ No existía {EQUIPOS_FILE}. Se creó uno de ejemplo.")
        return ejemplo

    with open(EQUIPOS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("equipos.json debe ser una lista.")

    equipos = []

    for equipo in data:
        if not isinstance(equipo, dict):
            continue

        nombre = obtener_nombre_equipo(equipo)
        url_365 = obtener_url_365_equipo(equipo)
        liga = obtener_liga_equipo({**equipo, "equipo": nombre})
        espn_slug = obtener_espn_slug_equipo({**equipo, "equipo": nombre, "liga": liga})

        equipos.append({
            **equipo,
            "equipo": nombre,
            "url": url_365,
            "liga": liga,
            "espn_slug": espn_slug,
        })

    return equipos


def cargar_blacklist_jugadores():
    if not os.path.exists(BLACKLIST_FILE):
        ejemplo = [
            {"nombre": "Leonardo Jardim"},
            {"nombre": "Claudio Úbeda"},
            {"nombre": "Eduardo Coudet"},
            {"nombre": "Frederico Juarez", "club": "Seattle Sounders"},
        ]

        with open(BLACKLIST_FILE, "w", encoding="utf-8") as f:
            json.dump(ejemplo, f, ensure_ascii=False, indent=2)

        print(f"⚠️ No existía {BLACKLIST_FILE}. Se creó uno de ejemplo.")
        return ejemplo

    try:
        with open(BLACKLIST_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        if not isinstance(data, list):
            print(f"⚠️ {BLACKLIST_FILE} debe ser una lista. Se ignora blacklist.")
            return []

        return [x for x in data if isinstance(x, dict)]

    except Exception as e:
        print(f"⚠️ No se pudo leer {BLACKLIST_FILE}: {e}")
        return []


def cargar_jugadores_existentes():
    if not GAME_JSON.exists():
        return {}

    try:
        data = json.loads(GAME_JSON.read_text(encoding="utf-8"))
    except Exception:
        return {}

    existentes = {}

    if not isinstance(data, list):
        return existentes

    for j in data:
        if not isinstance(j, dict):
            continue

        keys = [
            f"espn:{j.get('espn_id', '')}",
            f"{normalizar(j.get('club'))}|{normalizar(j.get('nombre'))}",
        ]

        for key in keys:
            if key.strip() and not key.endswith(":"):
                existentes[key] = j

    return existentes


def buscar_jugador_existente(jugador, existentes):
    keys = [
        f"espn:{jugador.get('espn_id', '')}",
        f"{normalizar(jugador.get('club'))}|{normalizar(jugador.get('nombre'))}",
    ]

    for key in keys:
        if key in existentes:
            return existentes[key]

    return None


# ============================================================
# BLACKLIST / STAFF
# ============================================================

def jugador_en_blacklist(jugador, blacklist):
    if not blacklist:
        return False

    jugador_id = limpiar_texto(jugador.get("id", ""))
    espn_id = limpiar_texto(jugador.get("espn_id", ""))
    nombre = normalizar(jugador.get("nombre", ""))
    club = normalizar(jugador.get("club", ""))

    for item in blacklist:
        item_id = limpiar_texto(item.get("id", ""))
        item_espn_id = limpiar_texto(item.get("espn_id", ""))
        item_nombre = normalizar(item.get("nombre", ""))
        item_club = normalizar(item.get("club", ""))

        if item_id and jugador_id and item_id == jugador_id:
            return True

        if item_espn_id and espn_id and item_espn_id == espn_id:
            return True

        if item_nombre and item_club:
            if item_nombre == nombre and item_club == club:
                return True
            continue

        if item_nombre and item_nombre == nombre:
            return True

    return False


def aplicar_blacklist_jugadores(jugadores, blacklist):
    salida = []

    for jugador in jugadores:
        if jugador_en_blacklist(jugador, blacklist):
            print(f"🚫 Jugador bloqueado por blacklist: {jugador.get('nombre')} ({jugador.get('club')})")
            continue

        salida.append(jugador)

    return salida


def es_staff_o_no_jugador(nombre, texto=""):
    n = normalizar(nombre)
    t = normalizar(texto)

    frases_staff = [
        "entrenador de futbol",
        "entrenador de fútbol",
        "football coach",
        "head coach",
        "assistant coach",
        "manager",
        "director tecnico",
        "director técnico",
        "cuerpo tecnico",
        "cuerpo técnico",
        "coach",
        "coaches",
    ]

    if any(frase in t for frase in frases_staff):
        return True

    nombres_staff_comunes = {
        "abel ferreira",
        "aleksandar kolarov",
        "alfredo arias",
        "alvaro arbeloa",
        "andre jardine",
        "andrey lopes",
        "angelo gregucci",
        "ante razov",
        "arne slot",
        "brian schmetzer",
        "carlos martinho",
        "cesar sampaio",
        "claudio ubeda",
        "cristian chivu",
        "cuca",
        "cuquinha",
        "daniel oldra",
        "diego arias",
        "diego simeone",
        "eduardo coudet",
        "enrique duran",
        "fabian bustos",
        "francesco farioli",
        "frederico juarez",
        "gabriel heinze",
        "gian piero gasperini",
        "guido pizarro",
        "guillermo hoyos",
        "habib beye",
        "hans-dieter flick",
        "hansi flick",
        "irfan saraloglu",
        "james freitas",
        "javier morales",
        "joao martins",
        "joao tralhao",
        "joel huiqui",
        "john de wolf",
        "jorge jesus",
        "jose barros",
        "jose mourinho",
        "jose tavares",
        "kasper hjulmand",
        "kosta runjaic",
        "leonardo jardim",
        "lucas pagano",
        "lucho gonzalez",
        "luciano spalletti",
        "luis castro",
        "luis enrique",
        "luis garcia",
        "luis zubeldia",
        "marc dos santos",
        "marcao",
        "marco landucci",
        "marcus sorg",
        "martin demichelis",
        "massimiliano allegri",
        "massimiliano farris",
        "matthias jaissle",
        "maximiliano cuberas",
        "maximiliano velazquez",
        "michel der zakarian",
        "mikel arteta",
        "nelson vivas",
        "niko kovac",
        "okan buruk",
        "oscar garcia",
        "ozan koprulu",
        "paulo rodrigues",
        "pep guardiola",
        "pepijn lijnders",
        "peter bosz",
        "preki",
        "przemyslaw malecki",
        "rafel pol",
        "ricardo rocha",
        "rob maas",
        "roberto de zerbi",
        "robin van persie",
        "rogier meijer",
        "rubi",
        "rui borges",
        "salvatore foti",
        "sebastien pocognoli",
        "sergen yalcin",
        "simone inzaghi",
        "sipke hulshoff",
        "toni tapalovic",
        "tullio gritti",
        "vincent kompany",
        "vitor castanheira",
        "vitor severino",
        "zeki murat gole",
    }

    return n in nombres_staff_comunes


# ============================================================
# HTTP ESPN
# ============================================================

def http_get_json(url, params=None, headers=None):
    params = params or {}
    headers = headers or HEADERS

    try:
        time.sleep(REQUEST_DELAY)

        r = requests.get(url, params=params, headers=headers, timeout=45)

        if not r.ok:
            print(f"⚠️ HTTP {r.status_code}: {url}")
            return None

        return r.json()

    except Exception as e:
        print(f"⚠️ Error GET JSON {url}: {e}")
        return None


def espn_site_get(path, params=None):
    url = f"{ESPN_SITE_BASE}/{path.lstrip('/')}"
    return http_get_json(url, params=params)


def espn_core_get(path, params=None):
    url = f"{ESPN_CORE_BASE}/{path.lstrip('/')}"
    return http_get_json(url, params=params)


# ============================================================
# ESPN TEAMS / ROSTER
# ============================================================

def obtener_teams_espn(espn_slug):
    if not espn_slug:
        return []

    if espn_slug in TEAMS_CACHE:
        return TEAMS_CACHE[espn_slug]

    data = espn_site_get(f"{espn_slug}/teams")

    teams = []

    raw_teams = data.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", []) if isinstance(data, dict) else []

    for item in raw_teams:
        team = item.get("team") or item

        if not isinstance(team, dict):
            continue

        team_id = limpiar_texto(team.get("id"))
        name = limpiar_texto(team.get("name"))
        display_name = limpiar_texto(team.get("displayName"))
        short_display_name = limpiar_texto(team.get("shortDisplayName"))
        abbreviation = limpiar_texto(team.get("abbreviation"))

        if not team_id:
            continue

        teams.append({
            "id": team_id,
            "name": name,
            "displayName": display_name,
            "shortDisplayName": short_display_name,
            "abbreviation": abbreviation,
            "raw": team,
        })

    TEAMS_CACHE[espn_slug] = teams

    print(f"📦 ESPN teams {espn_slug}: {len(teams)}")

    return teams


def obtener_espn_team_id(equipo):
    for key in ["espn_team_id", "team_id_espn", "espn_id"]:
        valor = limpiar_texto(equipo.get(key, ""))

        if valor:
            return valor

    nombre = obtener_nombre_equipo(equipo)
    n = normalizar(nombre)

    if n in ESPN_TEAM_IDS:
        return str(ESPN_TEAM_IDS[n])

    espn_slug = obtener_espn_slug_equipo(equipo)

    if not espn_slug:
        print(f"⚠️ Sin espn_slug para buscar team_id: {nombre}")
        return ""

    teams = obtener_teams_espn(espn_slug)

    # exacto
    for t in teams:
        opciones = [
            t.get("name", ""),
            t.get("displayName", ""),
            t.get("shortDisplayName", ""),
            t.get("abbreviation", ""),
        ]

        if any(normalizar(op) == n for op in opciones):
            print(f"🔎 ESPN team_id exacto: {nombre} -> {t.get('displayName')} ({t.get('id')})")
            return t.get("id")

    # suave
    for t in teams:
        opciones = [
            t.get("name", ""),
            t.get("displayName", ""),
            t.get("shortDisplayName", ""),
        ]

        for op in opciones:
            opn = normalizar(op)

            if opn and len(n) > 3 and (opn in n or n in opn):
                print(f"🔎 ESPN team_id aproximado: {nombre} -> {t.get('displayName')} ({t.get('id')})")
                return t.get("id")

    print(f"⚠️ No se encontró team_id ESPN para {nombre} en {espn_slug}")
    return ""


def extraer_imagen_headshot(athlete):
    """
    ESPN puede traer:
    - headshot.href
    - headshot
    - links con rel image
    """
    headshot = athlete.get("headshot")

    if isinstance(headshot, dict):
        href = limpiar_texto(headshot.get("href") or headshot.get("url"))
        if href:
            return href

    if isinstance(headshot, str):
        return limpiar_texto(headshot)

    for link in athlete.get("links", []) or []:
        if not isinstance(link, dict):
            continue

        rels = link.get("rel") or []
        href = limpiar_texto(link.get("href"))

        if href and any(str(r).lower() in ["headshot", "image", "playercard"] for r in rels):
            return href

    return ""


def extraer_pais_athlete(athlete):
    for key in ["citizenship", "nationality", "country"]:
        valor = athlete.get(key)

        if isinstance(valor, str) and limpiar_texto(valor):
            return limpiar_texto(valor)

        if isinstance(valor, dict):
            nombre = limpiar_texto(valor.get("displayName") or valor.get("name") or valor.get("abbreviation"))
            if nombre:
                return nombre

    birth_place = athlete.get("birthPlace") or {}

    if isinstance(birth_place, dict):
        pais = limpiar_texto(
            birth_place.get("country")
            or birth_place.get("countryName")
            or birth_place.get("displayName")
        )

        if pais:
            return pais

    return ""


def extraer_posicion_athlete(athlete, fallback=""):
    position = athlete.get("position")

    if isinstance(position, dict):
        return normalizar_posicion(
            position.get("displayName")
            or position.get("name")
            or position.get("abbreviation")
            or fallback
        )

    if isinstance(position, str):
        return normalizar_posicion(position)

    return normalizar_posicion(fallback)


def fetch_detalle_atleta_core(espn_slug, athlete_id):
    """
    Detalle extra. No siempre agrega mucho en soccer, pero puede traer más campos.
    """
    if not espn_slug or not athlete_id:
        return {}

    key = f"{espn_slug}|{athlete_id}"

    if key in ATHLETE_DETAIL_CACHE:
        return ATHLETE_DETAIL_CACHE[key]

    data = espn_core_get(f"{espn_slug}/athletes/{athlete_id}")

    if not isinstance(data, dict):
        data = {}

    ATHLETE_DETAIL_CACHE[key] = data

    return data


def combinar_detalle_athlete(athlete, detalle):
    """
    Fusiona sin romper la data del roster.
    """
    if not isinstance(detalle, dict):
        return athlete

    salida = dict(athlete)

    for key, value in detalle.items():
        if key not in salida or salida.get(key) in [None, "", [], {}]:
            salida[key] = value

    return salida


def atleta_espn_a_json(athlete, equipo_nombre, equipo_id, liga_nombre, espn_slug, position_group=""):
    athlete_id = limpiar_texto(athlete.get("id") or athlete.get("uid") or athlete.get("guid"))

    nombre = limpiar_texto(
        athlete.get("displayName")
        or athlete.get("fullName")
        or athlete.get("name")
        or athlete.get("shortName")
    )

    numero = limpiar_texto(
        athlete.get("jersey")
        or athlete.get("jerseyNumber")
        or athlete.get("number")
    )

    edad = limpiar_texto(athlete.get("age"))

    fecha_nacimiento = fecha_iso_a_ddmmyyyy(
        athlete.get("dateOfBirth")
        or athlete.get("birthDate")
        or ""
    )

    pais = extraer_pais_athlete(athlete)
    posicion = extraer_posicion_athlete(athlete, position_group)

    altura = altura_espn_a_cm(
        athlete.get("height")
        or athlete.get("displayHeight")
        or athlete.get("heightDisplay")
        or ""
    )

    # No usamos imagen de ESPN. La imagen_url se completa después con 365Scores.
    imagen_url = ""

    return {
        "id": athlete_id,
        "espn_id": athlete_id,
        "nombre": nombre,
        "club": equipo_nombre,
        "club_id": str(equipo_id),
        "espn_team_id": str(equipo_id),
        "espn_slug": espn_slug,
        "pais": pais,
        "posicion": posicion,
        "competicion": liga_nombre,
        "numero": numero,
        "edad": edad,
        "fecha_nacimiento": fecha_nacimiento,
        "altura": altura,
        "fin_contrato": "",
        "imagen": "",
        "imagen_url": imagen_url,
        "url_365scores": "",
        "fuente": FUENTE,
    }


def normalizar_roster_items(roster_data):
    """
    ESPN roster puede venir de varias formas:
    A) athletes: [{position:..., items:[...]}]
    B) athletes: [{...jugador...}]
    C) roster: [...]
    """
    salida = []

    if not isinstance(roster_data, dict):
        return salida

    athletes = roster_data.get("athletes") or roster_data.get("roster") or []

    if not isinstance(athletes, list):
        return salida

    for bloque in athletes:
        if not isinstance(bloque, dict):
            continue

        # Forma agrupada por posición.
        items = bloque.get("items")

        if isinstance(items, list):
            position_group = ""

            pos = bloque.get("position")

            if isinstance(pos, str):
                position_group = pos
            elif isinstance(pos, dict):
                position_group = pos.get("displayName") or pos.get("name") or pos.get("abbreviation") or ""

            position_group = position_group or bloque.get("displayName") or bloque.get("name") or ""

            for item in items:
                if isinstance(item, dict):
                    salida.append((item, position_group))

            continue

        # Forma plana.
        salida.append((bloque, ""))

    return salida


def obtener_jugadores_espn(equipo):
    equipo_nombre = obtener_nombre_equipo(equipo)
    liga_nombre = obtener_liga_equipo(equipo)
    espn_slug = obtener_espn_slug_equipo(equipo)

    if not espn_slug:
        print(f"⚠️ {equipo_nombre}: sin espn_slug/liga compatible.")
        return []

    team_id = obtener_espn_team_id(equipo)

    if not team_id:
        print(f"⚠️ {equipo_nombre}: sin espn_team_id.")
        return []

    print(f"\n🌍 ESPN roster: {equipo_nombre} | slug={espn_slug} | team={team_id}")

    roster = espn_site_get(f"{espn_slug}/teams/{team_id}/roster")

    if not isinstance(roster, dict):
        print(f"⚠️ ESPN no devolvió roster para {equipo_nombre}")
        return []

    team_info = roster.get("team") or {}
    equipo_nombre_espn = limpiar_texto(
        team_info.get("displayName")
        or team_info.get("name")
        or equipo_nombre
    )

    raw_items = normalizar_roster_items(roster)

    jugadores = []

    for athlete, position_group in raw_items:
        if not isinstance(athlete, dict):
            continue

        athlete_id = limpiar_texto(athlete.get("id"))

        # Detalle extra, si hay ID.
        detalle = fetch_detalle_atleta_core(espn_slug, athlete_id) if athlete_id else {}
        athlete_full = combinar_detalle_athlete(athlete, detalle)

        jugador = atleta_espn_a_json(
            athlete_full,
            equipo_nombre_espn,
            team_id,
            liga_nombre,
            espn_slug,
            position_group=position_group,
        )

        if not jugador.get("nombre"):
            continue

        texto_staff = f"{jugador.get('nombre')} {jugador.get('posicion')}"
        if es_staff_o_no_jugador(jugador.get("nombre", ""), texto_staff):
            print(f"🚫 Staff descartado desde ESPN: {jugador.get('nombre')} ({jugador.get('club')})")
            continue

        jugadores.append(jugador)

    print(f"👥 Jugadores ESPN encontrados en {equipo_nombre_espn}: {len(jugadores)}")

    return jugadores


# ============================================================
# IMÁGENES: ESPN / 365SCORES
# ============================================================

def extension_desde_url(url):
    url_limpia = str(url or "").split("?")[0].lower()

    for ext in [".png", ".jpg", ".jpeg", ".webp", ".avif"]:
        if url_limpia.endswith(ext):
            return ext.replace(".jpeg", ".jpg")

    return ".png"


def imagen_local_existe(ruta_imagen):
    ruta = str(ruta_imagen or "").replace("\\", "/").strip()

    if not ruta:
        return False

    nombre_archivo = ruta.split("/")[-1]

    if not nombre_archivo:
        return False

    path = GAME_IMAGES_DIR / nombre_archivo

    return path.exists() and path.is_file() and path.stat().st_size > 0


def buscar_imagen_existente(nombre_archivo):
    extensiones = [".png", ".jpg", ".jpeg", ".webp", ".avif"]

    for ext in extensiones:
        game_path = GAME_IMAGES_DIR / f"{nombre_archivo}{ext}"

        if game_path.exists() and game_path.stat().st_size > 0:
            return f"imagenes_jugadores_365/{nombre_archivo}{ext}"

    return ""


def descargar_imagen(url, nombre_archivo, headers=None, etiqueta="imagen"):
    existente = buscar_imagen_existente(nombre_archivo)

    if existente:
        print(f"♻️ Imagen ya cargada, omito descarga: {existente}")
        return existente

    if not url:
        return ""

    headers = headers or HEADERS_IMAGE
    ext = extension_desde_url(url)

    game_path = GAME_IMAGES_DIR / f"{nombre_archivo}{ext}"
    rel_game_path = f"imagenes_jugadores_365/{nombre_archivo}{ext}"

    try:
        r = requests.get(url, headers=headers, timeout=30)
        print(f"🖼️ {r.status_code} {etiqueta} {url}")

        if not r.ok:
            return ""

        content_type = r.headers.get("content-type", "").lower()

        if "image" not in content_type:
            return ""

        game_path.write_bytes(r.content)

        return rel_game_path

    except Exception as e:
        print(f"❌ Error descargando {etiqueta} {url}: {e}")
        return ""


def extraer_athlete_id_desde_imagen_365(url):
    if not url:
        return ""

    match = re.search(r"/Athletes/(\d+)", str(url), re.I)
    return match.group(1) if match else ""


def extraer_athlete_version_desde_imagen_365(url):
    if not url:
        return "v1"

    match = re.search(r"/(v\d+)/Athletes/\d+", str(url), re.I)
    return match.group(1) if match else "v1"


def imagen_365_alta_calidad(url):
    athlete_id = extraer_athlete_id_desde_imagen_365(url)

    if not athlete_id:
        return url or ""

    version = extraer_athlete_version_desde_imagen_365(url)

    return (
        "https://imagecache.365scores.com/image/upload/"
        "f_png,w_400,h_400,c_limit,q_auto:best,dpr_2,"
        "d_Athletes:default.png,r_max,c_thumb,g_face,z_0.65/"
        f"{version}/Athletes/{athlete_id}"
    )


def es_url_imagen_valida_365(url):
    if not url:
        return False

    low = url.lower()

    if "athletes/" not in low:
        return False

    basura = [
        "/website/",
        "appstore",
        "googleplay",
        "badge",
        "store",
        "favicon",
    ]

    if any(x in low for x in basura):
        return False

    return True


async def cerrar_cookies_o_popups(page):
    textos = [
        "Aceptar",
        "Acepto",
        "Aceptar todo",
        "Accept",
        "Accept all",
        "OK",
        "Entendido",
    ]

    for texto in textos:
        try:
            btn = page.get_by_role("button", name=re.compile(texto, re.I))

            if await btn.count() > 0:
                await btn.first.click(timeout=1500)
                await page.wait_for_timeout(700)
                return
        except Exception:
            pass


async def hacer_scroll(page):
    for y in [0, 700, 1400, 2300, 3400, 4600, 6000, 7600, 9500, 12000]:
        try:
            await page.evaluate(f"window.scrollTo(0, {y})")
            await page.wait_for_timeout(500)
        except Exception:
            pass


async def obtener_imagenes_365_equipo(context, equipo):
    equipo_nombre = obtener_nombre_equipo(equipo)
    url_365 = obtener_url_365_equipo(equipo)

    if not url_365:
        print(f"⚠️ {equipo_nombre}: sin URL 365Scores para imágenes fallback.")
        return {}

    page = await context.new_page()

    try:
        print(f"🖼️ 365Scores fallback imágenes: {equipo_nombre}")
        print(f"🔗 URL: {url_365}")

        await page.goto(url_365, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(3500)
        await cerrar_cookies_o_popups(page)
        await hacer_scroll(page)

        imagenes = await page.evaluate(
            """
            () => {
                const BASE = location.origin;
                const anchors = Array.from(document.querySelectorAll('a[href*="/football/player/"]'));
                const map = new Map();

                function clean(s) {
                    return String(s || "").replace(/\\s+/g, " ").trim();
                }

                function getImgSrc(img) {
                    if (!img) return "";

                    if (img.currentSrc) return img.currentSrc;
                    if (img.src) return img.src;
                    if (img.getAttribute("data-src")) return img.getAttribute("data-src");

                    const srcset = img.getAttribute("srcset");

                    if (srcset) {
                        const parts = srcset
                            .split(",")
                            .map(x => x.trim().split(" ")[0])
                            .filter(Boolean);

                        if (parts.length) return parts[parts.length - 1];
                    }

                    return "";
                }

                function getBestCard(a) {
                    let card = a;

                    for (let i = 0; i < 8; i++) {
                        if (!card.parentElement) break;

                        const next = card.parentElement;
                        const links = next.querySelectorAll('a[href*="/football/player/"]').length;
                        const txt = clean(next.innerText || next.textContent || "");

                        if (links === 1 && txt.length >= 2 && txt.length <= 260) {
                            card = next;
                        } else if (links > 1) {
                            break;
                        } else {
                            card = next;
                        }
                    }

                    return card;
                }

                function guessName(a, card) {
                    const img = a.querySelector("img") || card.querySelector("img");

                    if (img && clean(img.alt)) {
                        return clean(img.alt);
                    }

                    const aria = clean(a.getAttribute("aria-label"));
                    if (aria) return aria;

                    const text = clean(a.innerText || a.textContent || "");
                    if (!text) return "";

                    const parts = text
                        .split(/\\n|\\r|\\t|•|·/)
                        .map(clean)
                        .filter(Boolean);

                    if (parts.length) return parts[0];

                    return text;
                }

                for (const a of anchors) {
                    const hrefRaw = a.getAttribute("href");
                    if (!hrefRaw) continue;

                    const href = new URL(hrefRaw, BASE).href;
                    const card = getBestCard(a);
                    const name = guessName(a, card);

                    if (!name || name.length < 2 || name.length > 70) continue;

                    const img = a.querySelector("img") || card.querySelector("img");
                    const imgSrc = getImgSrc(img);

                    if (!imgSrc || !String(imgSrc).toLowerCase().includes("athletes/")) continue;

                    if (!map.has(name)) {
                        map.set(name, {
                            nombre: name,
                            imagen_url: imgSrc,
                            url_365scores: href
                        });
                    }
                }

                return Array.from(map.values());
            }
            """
        )

        index = {}

        for item in imagenes:
            nombre = limpiar_texto(item.get("nombre", ""))
            imagen_url = imagen_365_alta_calidad(item.get("imagen_url", ""))
            url_jugador = limpiar_texto(item.get("url_365scores", ""))

            if not nombre or not es_url_imagen_valida_365(imagen_url):
                continue

            index[normalizar(nombre)] = {
                "nombre_365": nombre,
                "imagen_url": imagen_url,
                "url_365scores": url_jugador,
            }

        print(f"🖼️ Imágenes 365Scores encontradas para {equipo_nombre}: {len(index)}")

        return index

    except Exception as e:
        print(f"⚠️ No se pudieron obtener imágenes 365Scores de {equipo_nombre}: {e}")
        return {}

    finally:
        await page.close()


def buscar_imagen_365_para_jugador(jugador, index_imagenes):
    if not index_imagenes:
        return None

    nombres = [
        jugador.get("nombre", ""),
        re.sub(r"^[A-ZÁÉÍÓÚÑ]\.\s+", "", jugador.get("nombre", "")),
    ]

    for nombre in nombres:
        key = normalizar(nombre)

        if key and key in index_imagenes:
            return index_imagenes[key]

    n_jugador = normalizar(jugador.get("nombre", ""))

    if not n_jugador:
        return None

    partes_jugador = [p for p in n_jugador.split() if len(p) >= 3]

    for key, datos in index_imagenes.items():
        if not key:
            continue

        if key == n_jugador:
            return datos

        if len(key) >= 8 and len(n_jugador) >= 8:
            if key in n_jugador or n_jugador in key:
                return datos

    for key, datos in index_imagenes.items():
        partes_key = [p for p in key.split() if len(p) >= 3]

        coincidencias = set(partes_jugador).intersection(set(partes_key))

        if len(coincidencias) >= 1 and len(partes_jugador) <= 2:
            return datos

        if len(coincidencias) >= 2:
            return datos

    return None


# ============================================================
# SALIDA
# ============================================================

def limpiar_jugador_final(j):
    club = j.get("club", "")
    competicion = obtener_liga_por_club(club) or limpiar_competicion(j.get("competicion", ""))

    posicion = normalizar_posicion(j.get("posicion", ""))

    if not posicion:
        posicion = "Sin dato"

    edad = j.get("edad", "")
    altura = j.get("altura", "")

    if str(edad).strip() in ["0", "0.0"]:
        edad = ""

    if str(altura).strip() in ["0", "0.0"]:
        altura = ""

    return {
        "id": str(j.get("id", "") or j.get("espn_id", "")),
        "espn_id": str(j.get("espn_id", "")),
        "nombre": j.get("nombre", ""),
        "club": club,
        "club_id": str(j.get("club_id", "")),
        "espn_team_id": str(j.get("espn_team_id", "")),
        "espn_slug": str(j.get("espn_slug", "")),
        "pais": j.get("pais", ""),
        "posicion": posicion,
        "competicion": competicion,
        "numero": j.get("numero", ""),
        "edad": edad,
        "fecha_nacimiento": j.get("fecha_nacimiento", ""),
        "altura": altura,
        "fin_contrato": j.get("fin_contrato", ""),
        "imagen": j.get("imagen", ""),
        "imagen_url": j.get("imagen_url", ""),
        "url_365scores": j.get("url_365scores", ""),
        "fuente": FUENTE,
    }


def limpiar_imagenes_huerfanas(jugadores):
    if not GAME_IMAGES_DIR.exists():
        return

    imagenes_usadas = set()

    for j in jugadores:
        imagen = str(j.get("imagen", "") or "").replace("\\", "/").strip()

        if not imagen:
            continue

        nombre_archivo = imagen.split("/")[-1]

        if nombre_archivo:
            imagenes_usadas.add(nombre_archivo)

    extensiones_validas = {".png", ".jpg", ".jpeg", ".webp", ".avif"}
    borradas = 0

    for archivo in GAME_IMAGES_DIR.iterdir():
        if not archivo.is_file():
            continue

        if archivo.suffix.lower() not in extensiones_validas:
            continue

        if archivo.name not in imagenes_usadas:
            try:
                archivo.unlink()
                borradas += 1
                print(f"🧹 Imagen huérfana eliminada: {archivo.name}")
            except Exception as e:
                print(f"⚠️ No se pudo eliminar imagen huérfana {archivo.name}: {e}")

    print(f"🧹 Imágenes huérfanas eliminadas: {borradas}")


async def procesar_equipo(context, equipo, existentes):
    """
    Flujo final:
    1) 365Scores trae la plantilla visual y la imagen real del jugador.
    2) ESPN trae solamente datos personales/deportivos del jugador.
    3) Solo se guardan jugadores que existen en ESPN y además tienen imagen en 365Scores.
    4) No se usa imagen de ESPN y no se genera ninguna imagen.
    """
    equipo_nombre = obtener_nombre_equipo(equipo)

    # Primero 365Scores, porque ahora es el filtro obligatorio.
    index_imagenes_365 = await obtener_imagenes_365_equipo(context, equipo)

    if not index_imagenes_365:
        print(f"🛑 {equipo_nombre}: no se encontraron imágenes en 365Scores. No se guardan jugadores de este equipo.")
        return []

    jugadores_espn = obtener_jugadores_espn(equipo)

    if not jugadores_espn:
        print(f"⚠️ {equipo_nombre}: no se obtuvieron jugadores desde ESPN.")
        return []

    resultados = []

    for i, jugador in enumerate(jugadores_espn, start=1):
        print(f"[{i}/{len(jugadores_espn)}] ⚽ {jugador.get('nombre')} - {jugador.get('club')}")

        # Match obligatorio con imagen de 365Scores.
        img_365 = buscar_imagen_365_para_jugador(jugador, index_imagenes_365)

        if not img_365:
            print(f"🚫 No está en plantilla 365Scores con imagen, omitido: {jugador.get('nombre')} ({jugador.get('club')})")
            continue

        # Imagen SIEMPRE desde 365Scores. Nunca usar headshot de ESPN.
        jugador["imagen_url"] = img_365.get("imagen_url", "")
        jugador["url_365scores"] = img_365.get("url_365scores", "")

        existente = buscar_jugador_existente(jugador, existentes)

        if existente and imagen_local_existe(existente.get("imagen", "")):
            jugador["imagen"] = existente.get("imagen", "")
            print(f"♻️ Imagen 365Scores existente reutilizada: {jugador.get('nombre')}")
        else:
            nombre_archivo = f"{slugify(jugador.get('club'))}-{slugify(jugador.get('nombre'))}-{jugador.get('espn_id')}"
            jugador["imagen"] = descargar_imagen(
                jugador["imagen_url"],
                nombre_archivo,
                headers=HEADERS_365,
                etiqueta="imagen 365Scores"
            )

        if not jugador.get("imagen"):
            print(f"🚫 Imagen 365Scores no descargada, omitido: {jugador.get('nombre')} ({jugador.get('club')})")
            continue

        resultados.append(limpiar_jugador_final(jugador))

    print(f"✅ {equipo_nombre}: guardados {len(resultados)} jugadores con datos ESPN + imagen 365Scores.")

    return resultados


def deduplicar_jugadores(jugadores):
    vistos = set()
    salida = []

    for j in jugadores:
        key = j.get("espn_id") or f"{normalizar(j.get('club'))}|{normalizar(j.get('nombre'))}"

        if key in vistos:
            continue

        vistos.add(key)
        salida.append(j)

    return salida


async def main():
    asegurar_carpetas()

    equipos = cargar_equipos()
    blacklist = cargar_blacklist_jugadores()
    existentes = cargar_jugadores_existentes()

    imagenes_existentes_reales = sum(
        1 for j in existentes.values()
        if imagen_local_existe(j.get("imagen", ""))
    )

    print(f"📋 Equipos cargados: {len(equipos)}")
    print(f"🚫 Blacklist cargada: {len(blacklist)}")
    print(f"♻️ Jugadores existentes en JSON del juego: {len(existentes)}")
    print(f"🖼️ Imágenes físicas existentes detectadas: {imagenes_existentes_reales}")
    print("✅ Modo activo: imagen SIEMPRE desde 365Scores + datos personales desde ESPN.")
    print("🖼️ No se usa imagen generada ni imagen ESPN.")

    todos_los_jugadores = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        )

        context = await browser.new_context(
            user_agent=HEADERS["User-Agent"],
            viewport={"width": 1366, "height": 900},
            locale="es-ES",
        )

        for equipo in equipos:
            jugadores_equipo = await procesar_equipo(context, equipo, existentes)
            todos_los_jugadores.extend(jugadores_equipo)

        await browser.close()

    todos_los_jugadores = deduplicar_jugadores(todos_los_jugadores)
    todos_los_jugadores = aplicar_blacklist_jugadores(todos_los_jugadores, blacklist)

    OUTPUT_JSON.write_text(
        json.dumps(todos_los_jugadores, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    simple = [
        {
            "nombre": j.get("nombre", ""),
            "club": j.get("club", ""),
            "pais": j.get("pais", ""),
            "posicion": j.get("posicion", ""),
            "edad": j.get("edad", ""),
            "fecha_nacimiento": j.get("fecha_nacimiento", ""),
            "altura": j.get("altura", ""),
            "numero": j.get("numero", ""),
            "competicion": j.get("competicion", ""),
            "fin_contrato": j.get("fin_contrato", ""),
            "imagen": j.get("imagen", ""),
            "fuente": FUENTE,
        }
        for j in todos_los_jugadores
    ]

    OUTPUT_SIMPLE_JSON.write_text(
        json.dumps(simple, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    GAME_JSON.write_text(
        json.dumps(simple, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # Protección: si por error la API devuelve 0 jugadores, NO borra imágenes previas.
    if len(simple) > 0:
        limpiar_imagenes_huerfanas(simple)
    else:
        print("🛑 No se limpian imágenes huérfanas porque el JSON quedó vacío.")

    con_imagen = sum(1 for j in simple if j.get("imagen"))
    sin_imagen = len(simple) - con_imagen

    con_pais = sum(1 for j in simple if j.get("pais"))
    con_altura = sum(1 for j in simple if j.get("altura"))
    con_numero = sum(1 for j in simple if j.get("numero"))
    con_posicion = sum(1 for j in simple if j.get("posicion") and j.get("posicion") != "Sin dato")

    print("\n✅ Listo.")
    print(f"📄 JSON completo: {OUTPUT_JSON}")
    print(f"📄 JSON simple: {OUTPUT_SIMPLE_JSON}")
    print(f"🎮 JSON juego: {GAME_JSON}")
    print(f"🖼️ Imágenes juego: {GAME_IMAGES_DIR}")
    print(f"👥 Total jugadores: {len(simple)}")
    print(f"✅ Con imagen: {con_imagen}")
    print(f"⚠️ Sin imagen: {sin_imagen}")
    print(f"🌍 Con país ESPN: {con_pais}")
    print(f"📏 Con altura ESPN: {con_altura}")
    print(f"🔢 Con dorsal ESPN: {con_numero}")
    print(f"📌 Con posición ESPN: {con_posicion}")


if __name__ == "__main__":
    asyncio.run(main())
