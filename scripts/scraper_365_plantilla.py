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
# SCRAPER: DATOS DESDE apifootball.com + IMÁGENES DESDE 365Scores
# ============================================================
#
# API usada:
# https://apiv3.apifootball.com/
#
# Endpoints principales:
# - get_teams: trae equipos y dentro trae players.
# - get_leagues: ayuda a encontrar league_id si no lo pusiste.
# - get_standings: ayuda a encontrar team_id si solo tenés league_id.
#
# IMPORTANTE:
# Esta API NO usa los mismos IDs que api-sports.io.
# Ejemplo documentación:
# Premier League league_id = 152
# Arsenal team_id/team_key = 141
#
# Formato recomendado en equipos.json:
# [
#   {
#     "equipo": "Arsenal",
#     "url": "https://www.365scores.com/es/football/team/arsenal-104/squad",
#     "apifootball_league_id": "152",
#     "apifootball_team_id": "141",
#     "liga": "Premier League"
#   }
# ]
#
# Si no ponés apifootball_team_id, intenta buscar el equipo dentro de la liga.
# Si no ponés apifootball_league_id, intenta buscar la liga por nombre.
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

FUENTE = "apifootball.com datos + 365Scores imágenes"

# Te dejo la key puesta porque me lo pediste.
# Recomendado: regenerarla luego y usar variable de entorno APIFOOTBALL_KEY.
APIFOOTBALL_KEY = os.environ.get(
    "APIFOOTBALL_KEY",
    "dc112beaffd4422ca582b1d4dd444b259fb1223403736845ca898937beab38c0"
)

APIFOOTBALL_BASE_URL = "https://apiv3.apifootball.com/"
APIFOOTBALL_DELAY = float(os.environ.get("APIFOOTBALL_DELAY", "0.35"))

HEADERS_365 = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Referer": "https://www.365scores.com/",
}

# IDs confirmados por documentación:
# Premier League league_id 152, Arsenal team_key/team_id 141.
# El resto se intenta buscar automáticamente por get_leagues/get_teams/get_standings.
APIFOOTBALL_LEAGUE_IDS = {
    "premier league": "152",
    "la liga": "302",
    "laliga": "302",
}

APIFOOTBALL_TEAM_IDS = {
    "arsenal": "141",
}

# Para acelerar búsqueda de ligas.
COUNTRY_HINTS = {
    "Premier League": "England",
    "LaLiga": "Spain",
    "La Liga": "Spain",
    "Serie A": "Italy",
    "Bundesliga": "Germany",
    "Ligue 1": "France",
    "Primeira Liga": "Portugal",
    "Eredivisie": "Netherlands",
    "Liga Profesional Argentina": "Argentina",
    "Brasileirão": "Brazil",
    "Brasileirao": "Brazil",
    "Categoría Primera A": "Colombia",
    "MLS": "USA",
    "Saudi Pro League": "Saudi Arabia",
    "Süper Lig": "Turkey",
    "Super Lig": "Turkey",
    "Liga MX": "Mexico",
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
    "juventus": "Serie A",
    "ac milan": "Serie A",
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

LEAGUES_CACHE = None
LEAGUES_BY_COUNTRY_CACHE = {}
TEAMS_BY_LEAGUE_CACHE = {}
STANDINGS_BY_LEAGUE_CACHE = {}
COUNTRIES_CACHE = None


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
        "fuente 365scores",
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

    if any(x in p for x in ["goalkeeper", "goalkeepers", "arquero", "portero"]):
        return "Portero"

    if any(x in p for x in ["defender", "defenders", "defensa", "defensor", "centre back", "center back", "left back", "right back", "lateral"]):
        return "Defensa"

    if any(x in p for x in ["midfielder", "midfielders", "mediocampista", "medio", "volante"]):
        return "Mediocampista"

    if any(x in p for x in ["forward", "forwards", "attacker", "attackers", "delantero", "striker", "winger", "extremo"]):
        return "Delantero"

    return limpiar_texto(pos)


def fecha_api_a_ddmmyyyy(fecha):
    fecha = limpiar_texto(fecha)
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", fecha)

    if not m:
        return fecha

    return f"{m.group(3)}/{m.group(2)}/{m.group(1)}"


def obtener_nombre_equipo(equipo):
    return limpiar_texto(
        equipo.get("equipo")
        or equipo.get("nombre")
        or equipo.get("name")
        or equipo.get("club")
        or "Equipo"
    )


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


def asegurar_carpetas():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    GAME_DIR.mkdir(parents=True, exist_ok=True)
    GAME_IMAGES_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# ARCHIVOS BASE
# ============================================================

def cargar_equipos():
    if not os.path.exists(EQUIPOS_FILE):
        ejemplo = [
            {
                "equipo": "Arsenal",
                "url": "https://www.365scores.com/es/football/team/arsenal-104/squad",
                "apifootball_league_id": "152",
                "apifootball_team_id": "141",
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

        equipos.append({
            **equipo,
            "equipo": nombre,
            "url": url_365,
            "liga": liga,
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
            f"api:{j.get('apifootball_player_id', '')}",
            f"{normalizar(j.get('club'))}|{normalizar(j.get('nombre'))}",
        ]

        for key in keys:
            if key.strip() and not key.endswith(":"):
                existentes[key] = j

    return existentes


def buscar_jugador_existente(jugador, existentes):
    keys = [
        f"api:{jugador.get('apifootball_player_id', '')}",
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
    api_id = limpiar_texto(jugador.get("apifootball_player_id", ""))
    nombre = normalizar(jugador.get("nombre", ""))
    club = normalizar(jugador.get("club", ""))

    for item in blacklist:
        item_id = limpiar_texto(item.get("id", ""))
        item_api_id = limpiar_texto(item.get("apifootball_player_id", ""))
        item_nombre = normalizar(item.get("nombre", ""))
        item_club = normalizar(item.get("club", ""))

        if item_id and jugador_id and item_id == jugador_id:
            return True

        if item_api_id and api_id and item_api_id == api_id:
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
# APIFOOTBALL.COM
# ============================================================

def apifootball_get(action, params=None):
    params = params or {}

    if not APIFOOTBALL_KEY:
        print("❌ Falta APIFOOTBALL_KEY.")
        return None

    query = {
        "action": action,
        "APIkey": APIFOOTBALL_KEY,
    }

    query.update({k: v for k, v in params.items() if v not in [None, ""]})

    try:
        time.sleep(APIFOOTBALL_DELAY)

        r = requests.get(
            APIFOOTBALL_BASE_URL,
            params=query,
            timeout=45,
        )

        if not r.ok:
            print(f"⚠️ APIFootball HTTP {r.status_code}: {r.text[:300]}")
            return None

        data = r.json()

        if isinstance(data, dict):
            # Formatos de error frecuentes.
            if data.get("error"):
                print(f"⚠️ APIFootball error: {data}")
                return None

            if data.get("message") or data.get("error_message"):
                print(f"⚠️ APIFootball mensaje: {data}")
                return None

        return data

    except Exception as e:
        print(f"⚠️ Error consultando APIFootball action={action}: {e}")
        return None


def cargar_paises_apifootball():
    global COUNTRIES_CACHE

    if COUNTRIES_CACHE is not None:
        return COUNTRIES_CACHE

    data = apifootball_get("get_countries")

    if not isinstance(data, list):
        COUNTRIES_CACHE = []
    else:
        COUNTRIES_CACHE = data

    print(f"🌎 Países APIFootball cargados: {len(COUNTRIES_CACHE)}")

    return COUNTRIES_CACHE


def obtener_country_id_por_nombre(country_name):
    if not country_name:
        return ""

    paises = cargar_paises_apifootball()
    buscado = normalizar(country_name)

    for p in paises:
        nombre = normalizar(p.get("country_name", ""))
        country_id = p.get("country_id", "")

        if country_id and nombre == buscado:
            return str(country_id)

    for p in paises:
        nombre = normalizar(p.get("country_name", ""))
        country_id = p.get("country_id", "")

        if country_id and (buscado in nombre or nombre in buscado):
            return str(country_id)

    return ""


def cargar_ligas_apifootball(country_id=""):
    global LEAGUES_CACHE
    global LEAGUES_BY_COUNTRY_CACHE

    if country_id:
        country_id = str(country_id)

        if country_id in LEAGUES_BY_COUNTRY_CACHE:
            return LEAGUES_BY_COUNTRY_CACHE[country_id]

        data = apifootball_get("get_leagues", {"country_id": country_id})

        if not isinstance(data, list):
            LEAGUES_BY_COUNTRY_CACHE[country_id] = []
        else:
            LEAGUES_BY_COUNTRY_CACHE[country_id] = data

        print(f"📚 Ligas APIFootball país {country_id}: {len(LEAGUES_BY_COUNTRY_CACHE[country_id])}")

        return LEAGUES_BY_COUNTRY_CACHE[country_id]

    if LEAGUES_CACHE is not None:
        return LEAGUES_CACHE

    data = apifootball_get("get_leagues")

    if not isinstance(data, list):
        LEAGUES_CACHE = []
    else:
        LEAGUES_CACHE = data

    print(f"📚 Ligas APIFootball cargadas: {len(LEAGUES_CACHE)}")

    return LEAGUES_CACHE


def obtener_apifootball_league_id(equipo):
    for key in ["apifootball_league_id", "api_football_league_id", "league_id"]:
        valor = equipo.get(key)

        if valor:
            return str(valor)

    liga = obtener_liga_equipo(equipo)

    if not liga:
        return ""

    liga_norm = normalizar(liga)

    if liga_norm in APIFOOTBALL_LEAGUE_IDS:
        return str(APIFOOTBALL_LEAGUE_IDS[liga_norm])

    # Primero intenta por país para reducir ruido.
    country_hint = COUNTRY_HINTS.get(liga, "")
    country_id = obtener_country_id_por_nombre(country_hint) if country_hint else ""

    ligas = cargar_ligas_apifootball(country_id) if country_id else cargar_ligas_apifootball()

    candidatas = []

    for item in ligas:
        nombre = normalizar(item.get("league_name", ""))
        league_id = item.get("league_id")

        if not league_id:
            continue

        if nombre == liga_norm:
            candidatas.append(item)
        elif liga_norm in nombre or nombre in liga_norm:
            candidatas.append(item)

    # Si por país no encontró, intenta global.
    if not candidatas and country_id:
        ligas = cargar_ligas_apifootball()

        for item in ligas:
            nombre = normalizar(item.get("league_name", ""))
            league_id = item.get("league_id")

            if not league_id:
                continue

            if nombre == liga_norm or liga_norm in nombre or nombre in liga_norm:
                candidatas.append(item)

    if not candidatas:
        print(f"⚠️ APIFootball no encontró league_id para liga: {liga}")
        return ""

    # Usa la candidata con season más alta según texto.
    candidatas.sort(key=lambda x: str(x.get("league_season", "")), reverse=True)

    elegido = candidatas[0]
    print(
        f"🔎 APIFootball league_id encontrado: {liga} -> "
        f"{elegido.get('league_name')} ({elegido.get('league_id')}) "
        f"season={elegido.get('league_season')}"
    )

    return str(elegido.get("league_id"))


def cargar_equipos_de_liga_apifootball(league_id):
    league_id = str(league_id)

    if league_id in TEAMS_BY_LEAGUE_CACHE:
        return TEAMS_BY_LEAGUE_CACHE[league_id]

    data = apifootball_get("get_teams", {"league_id": league_id})

    if not isinstance(data, list):
        TEAMS_BY_LEAGUE_CACHE[league_id] = []
    else:
        TEAMS_BY_LEAGUE_CACHE[league_id] = data

    print(f"📦 Equipos APIFootball get_teams league_id={league_id}: {len(TEAMS_BY_LEAGUE_CACHE[league_id])}")

    return TEAMS_BY_LEAGUE_CACHE[league_id]


def cargar_standings_de_liga_apifootball(league_id):
    league_id = str(league_id)

    if league_id in STANDINGS_BY_LEAGUE_CACHE:
        return STANDINGS_BY_LEAGUE_CACHE[league_id]

    data = apifootball_get("get_standings", {"league_id": league_id})

    if not isinstance(data, list):
        STANDINGS_BY_LEAGUE_CACHE[league_id] = []
    else:
        STANDINGS_BY_LEAGUE_CACHE[league_id] = data

    print(f"📊 Standings APIFootball league_id={league_id}: {len(STANDINGS_BY_LEAGUE_CACHE[league_id])}")

    return STANDINGS_BY_LEAGUE_CACHE[league_id]


def obtener_apifootball_team_id(equipo, league_id=""):
    for key in ["apifootball_team_id", "api_football_team_id", "api_team_id", "team_id", "api_id"]:
        valor = equipo.get(key)

        if valor:
            return str(valor)

    nombre = obtener_nombre_equipo(equipo)
    n = normalizar(nombre)

    if n in APIFOOTBALL_TEAM_IDS:
        return str(APIFOOTBALL_TEAM_IDS[n])

    if not league_id:
        league_id = obtener_apifootball_league_id(equipo)

    if not league_id:
        print(f"⚠️ No hay league_id para buscar team_id de: {nombre}")
        return ""

    # 1) Buscar en get_teams.
    equipos_liga = cargar_equipos_de_liga_apifootball(league_id)

    for item in equipos_liga:
        team_name = item.get("team_name", "")
        team_key = item.get("team_key", "")

        if team_key and normalizar(team_name) == n:
            print(f"🔎 APIFootball team_id exacto get_teams: {nombre} -> {team_name} ({team_key})")
            return str(team_key)

    for item in equipos_liga:
        team_name = item.get("team_name", "")
        team_key = item.get("team_key", "")
        tn = normalizar(team_name)

        if not team_key or not tn:
            continue

        if tn in n or n in tn:
            print(f"🔎 APIFootball team_id aproximado get_teams: {nombre} -> {team_name} ({team_key})")
            return str(team_key)

    # 2) Buscar en standings si get_teams no matcheó.
    standings = cargar_standings_de_liga_apifootball(league_id)

    for item in standings:
        team_name = item.get("team_name", "")
        team_id = item.get("team_id", "")

        if team_id and normalizar(team_name) == n:
            print(f"🔎 APIFootball team_id exacto standings: {nombre} -> {team_name} ({team_id})")
            return str(team_id)

    for item in standings:
        team_name = item.get("team_name", "")
        team_id = item.get("team_id", "")
        tn = normalizar(team_name)

        if not team_id or not tn:
            continue

        if tn in n or n in tn:
            print(f"🔎 APIFootball team_id aproximado standings: {nombre} -> {team_name} ({team_id})")
            return str(team_id)

    print(f"⚠️ No se encontró team_id para {nombre} dentro de league_id {league_id}")
    return ""


def player_apifootball_a_json(player, equipo_nombre, equipo_id, equipo_liga):
    player_id = player.get("player_id") or player.get("player_key") or ""

    nombre = limpiar_texto(player.get("player_name"))
    numero = limpiar_texto(player.get("player_number"))
    pais = limpiar_texto(player.get("player_country"))
    posicion = normalizar_posicion(player.get("player_type"))
    edad = limpiar_texto(player.get("player_age"))
    fecha_nacimiento = fecha_api_a_ddmmyyyy(player.get("player_birthdate") or "")

    # La documentación de get_teams/get_players no muestra altura.
    # No inventamos altura. Si la API algún día trae player_height, se usa.
    altura = limpiar_texto(player.get("player_height") or player.get("height") or "")

    return {
        "id": str(player_id),
        "apifootball_player_id": str(player_id),
        "nombre": nombre,
        "club": equipo_nombre,
        "club_id": str(equipo_id),
        "apifootball_team_id": str(equipo_id),
        "pais": pais,
        "posicion": posicion,
        "competicion": equipo_liga,
        "numero": numero,
        "edad": edad,
        "fecha_nacimiento": fecha_nacimiento,
        "altura": altura,
        "fin_contrato": "",
        "imagen": "",
        "imagen_url": "",
        "url_365scores": "",
        "fuente": FUENTE,
    }


def elegir_team_obj_desde_lista(equipos_liga, equipo_nombre, team_id=""):
    if not isinstance(equipos_liga, list) or not equipos_liga:
        return None

    n = normalizar(equipo_nombre)
    team_id = str(team_id or "")

    if team_id:
        for item in equipos_liga:
            if str(item.get("team_key", "")) == team_id:
                return item

    for item in equipos_liga:
        if normalizar(item.get("team_name", "")) == n:
            return item

    for item in equipos_liga:
        tn = normalizar(item.get("team_name", ""))

        if tn and len(n) > 4 and (tn in n or n in tn):
            return item

    return None


def obtener_jugadores_apifootball(equipo):
    equipo_nombre_original = obtener_nombre_equipo(equipo)
    equipo_liga = obtener_liga_equipo(equipo)

    league_id = obtener_apifootball_league_id(equipo)
    team_id = obtener_apifootball_team_id(equipo, league_id)

    print(
        f"\n🌍 APIFootball datos: {equipo_nombre_original} | "
        f"team={team_id or 'sin team_id'} | league={league_id or 'sin league_id'}"
    )

    team_obj = None

    # Modo principal:
    # Si hay league_id, get_teams devuelve los equipos de esa liga y players dentro.
    if league_id:
        equipos_liga = cargar_equipos_de_liga_apifootball(league_id)
        team_obj = elegir_team_obj_desde_lista(equipos_liga, equipo_nombre_original, team_id)

    # Fallback:
    # Si no hay league_id o no matcheó, probar get_teams por team_id.
    if team_obj is None and team_id:
        data_team = apifootball_get("get_teams", {"team_id": team_id})

        if isinstance(data_team, list) and data_team:
            team_obj = elegir_team_obj_desde_lista(data_team, equipo_nombre_original, team_id) or data_team[0]

    if team_obj is None:
        print(f"⚠️ {equipo_nombre_original}: APIFootball no devolvió objeto de equipo.")
        return []

    equipo_nombre = limpiar_texto(team_obj.get("team_name") or equipo_nombre_original)
    equipo_id = limpiar_texto(team_obj.get("team_key") or team_id)
    players = team_obj.get("players") or []

    if not isinstance(players, list):
        players = []

    jugadores = []

    for p in players:
        if not isinstance(p, dict):
            continue

        jugador = player_apifootball_a_json(p, equipo_nombre, equipo_id, equipo_liga)

        if not jugador.get("nombre"):
            continue

        if es_staff_o_no_jugador(jugador.get("nombre", ""), f"{jugador.get('nombre')} {jugador.get('posicion')}"):
            print(f"🚫 Staff descartado desde APIFootball: {jugador.get('nombre')} ({jugador.get('club')})")
            continue

        jugadores.append(jugador)

    print(f"👥 Jugadores APIFootball encontrados en {equipo_nombre}: {len(jugadores)}")

    return jugadores


# ============================================================
# IMÁGENES 365SCORES
# ============================================================

def extraer_athlete_id_desde_imagen(url):
    if not url:
        return ""

    match = re.search(r"/Athletes/(\d+)", str(url), re.I)
    return match.group(1) if match else ""


def extraer_athlete_version_desde_imagen(url):
    if not url:
        return "v1"

    match = re.search(r"/(v\d+)/Athletes/\d+", str(url), re.I)
    return match.group(1) if match else "v1"


def imagen_365_alta_calidad(url):
    athlete_id = extraer_athlete_id_desde_imagen(url)

    if not athlete_id:
        return url or ""

    version = extraer_athlete_version_desde_imagen(url)

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


def descargar_imagen_365(url, nombre_archivo):
    existente = buscar_imagen_existente(nombre_archivo)

    if existente:
        print(f"♻️ Imagen ya cargada, omito descarga: {existente}")
        return existente

    url = imagen_365_alta_calidad(url)

    if not es_url_imagen_valida_365(url):
        return ""

    ext = extension_desde_url(url)
    game_path = GAME_IMAGES_DIR / f"{nombre_archivo}{ext}"
    rel_game_path = f"imagenes_jugadores_365/{nombre_archivo}{ext}"

    try:
        r = requests.get(url, headers=HEADERS_365, timeout=30)
        print(f"🖼️ {r.status_code} imagen 365Scores {url}")

        if not r.ok:
            return ""

        content_type = r.headers.get("content-type", "").lower()

        if "image" not in content_type:
            return ""

        game_path.write_bytes(r.content)

        return rel_game_path

    except Exception as e:
        print(f"❌ Error descargando imagen 365Scores {url}: {e}")
        return ""


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
        print(f"⚠️ {equipo_nombre}: sin URL 365Scores para imágenes.")
        return {}

    page = await context.new_page()

    try:
        print(f"🖼️ 365Scores imágenes: {equipo_nombre}")
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

        print(f"🖼️ Imágenes encontradas en 365Scores para {equipo_nombre}: {len(index)}")

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
        re.sub(r"^[A-ZÁÉÍÓÚÑ]\.\s+", "", jugador.get("nombre", "")),  # K. Benzema -> Benzema
    ]

    for nombre in nombres:
        key = normalizar(nombre)

        if key and key in index_imagenes:
            return index_imagenes[key]

    n_jugador = normalizar(jugador.get("nombre", ""))

    if not n_jugador:
        return None

    partes_jugador = [p for p in n_jugador.split() if len(p) >= 3]

    # Matching suave por inclusión.
    for key, datos in index_imagenes.items():
        if not key:
            continue

        if key == n_jugador:
            return datos

        if len(key) >= 8 and len(n_jugador) >= 8:
            if key in n_jugador or n_jugador in key:
                return datos

    # Matching por apellido/nombre importante.
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
        "id": str(j.get("id", "") or j.get("apifootball_player_id", "")),
        "apifootball_player_id": str(j.get("apifootball_player_id", "")),
        "nombre": j.get("nombre", ""),
        "club": club,
        "club_id": str(j.get("club_id", "")),
        "apifootball_team_id": str(j.get("apifootball_team_id", "")),
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
    equipo_nombre = obtener_nombre_equipo(equipo)

    jugadores_api = obtener_jugadores_apifootball(equipo)

    if not jugadores_api:
        print(f"⚠️ {equipo_nombre}: no se obtuvieron jugadores desde APIFootball.")
        return []

    index_imagenes_365 = await obtener_imagenes_365_equipo(context, equipo)

    resultados = []

    for i, jugador in enumerate(jugadores_api, start=1):
        print(f"[{i}/{len(jugadores_api)}] ⚽ {jugador.get('nombre')} - {jugador.get('club')}")

        existente = buscar_jugador_existente(jugador, existentes)

        if existente and imagen_local_existe(existente.get("imagen", "")):
            jugador["imagen"] = existente.get("imagen", "")
            jugador["imagen_url"] = existente.get("imagen_url", "")
            jugador["url_365scores"] = existente.get("url_365scores", "")
            print(f"♻️ Imagen existente reutilizada: {jugador.get('nombre')}")
        else:
            img_365 = buscar_imagen_365_para_jugador(jugador, index_imagenes_365)

            if img_365:
                jugador["imagen_url"] = img_365.get("imagen_url", "")
                jugador["url_365scores"] = img_365.get("url_365scores", "")

                nombre_archivo = f"{slugify(jugador.get('club'))}-{slugify(jugador.get('nombre'))}-{jugador.get('apifootball_player_id')}"
                jugador["imagen"] = descargar_imagen_365(jugador["imagen_url"], nombre_archivo)
            else:
                jugador["imagen"] = ""
                jugador["imagen_url"] = ""
                jugador["url_365scores"] = ""
                print(f"⚠️ Sin imagen 365Scores para: {jugador.get('nombre')} ({jugador.get('club')})")

        resultados.append(limpiar_jugador_final(jugador))

    return resultados


def deduplicar_jugadores(jugadores):
    vistos = set()
    salida = []

    for j in jugadores:
        key = j.get("apifootball_player_id") or f"{normalizar(j.get('club'))}|{normalizar(j.get('nombre'))}"

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
    print("✅ Modo activo: datos desde apifootball.com/get_teams, imágenes desde 365Scores.")

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
            user_agent=HEADERS_365["User-Agent"],
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
    print(f"✅ Con imagen 365Scores: {con_imagen}")
    print(f"⚠️ Sin imagen 365Scores: {sin_imagen}")
    print(f"🌍 Con país APIFootball: {con_pais}")
    print(f"📏 Con altura APIFootball: {con_altura}")
    print(f"🔢 Con dorsal APIFootball: {con_numero}")
    print(f"📌 Con posición APIFootball: {con_posicion}")


if __name__ == "__main__":
    asyncio.run(main())
