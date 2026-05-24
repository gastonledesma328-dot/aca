import asyncio
import json
import os
import re
import time
import unicodedata
from pathlib import Path

import requests
from playwright.async_api import async_playwright


EQUIPOS_FILE = "equipos.json"
BLACKLIST_FILE = "blacklist_jugadores.json"

DATA_DIR = Path("data/adivina-jugador")
GAME_DIR = Path("juegos/adivinajugador")

OUTPUT_JSON = DATA_DIR / "plantilla_365_jugadores.json"
OUTPUT_SIMPLE_JSON = DATA_DIR / "plantilla_365_jugadores_simple.json"

GAME_IMAGES_DIR = GAME_DIR / "imagenes_jugadores_365"
GAME_JSON = GAME_DIR / "jugadores.json"

# Ahora los DATOS salen de API-Football.
# 365Scores queda solo para imágenes.
FUENTE = "API-Football datos + 365Scores imágenes"

# Te dejo la key puesta porque me lo pediste.
# Mejor práctica: regenerar la key y usar variable de entorno API_FOOTBALL_KEY.
API_FOOTBALL_KEY = os.environ.get("API_FOOTBALL_KEY", "f8d6138db2d0f658eb99c22cd2ed91e9")
API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io"
API_FOOTBALL_SEASON = int(os.environ.get("API_FOOTBALL_SEASON", "2025"))
API_FOOTBALL_DELAY = float(os.environ.get("API_FOOTBALL_DELAY", "0.35"))

API_FOOTBALL_HEADERS = {
    "x-apisports-key": API_FOOTBALL_KEY,
}

HEADERS_365 = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Referer": "https://www.365scores.com/",
}

# Si el equipo no trae api_football_team_id en equipos.json,
# se intenta usar este mapa o buscar automáticamente con /teams?search=.
API_FOOTBALL_TEAM_IDS = {
    "arsenal": 42,
    "manchester city": 50,
    "liverpool": 40,
    "chelsea": 49,
    "manchester united": 33,
    "tottenham hotspur": 47,

    "real madrid": 541,
    "barcelona": 529,
    "fc barcelona": 529,
    "atletico madrid": 530,
    "atletico de madrid": 530,
    "atlético de madrid": 530,
    "sevilla": 536,
    "real sociedad": 548,
    "villarreal": 533,

    "inter milan": 505,
    "inter": 505,
    "juventus": 496,
    "ac milan": 489,
    "milan": 489,
    "napoli": 492,
    "roma": 497,
    "lazio": 487,

    "bayern munchen": 157,
    "bayern münchen": 157,
    "bayern munich": 157,
    "borussia dortmund": 165,
    "bayer leverkusen": 168,
    "rb leipzig": 173,

    "paris saint-germain": 85,
    "psg": 85,
    "olympique de marseille": 81,
    "marseille": 81,
    "as monaco": 91,
    "monaco": 91,
    "olympique lyonnais": 80,
    "lyon": 80,

    "benfica": 211,
    "fc porto": 212,
    "sporting cp": 228,
    "sporting lisbon": 228,

    "ajax": 194,
    "ajax amsterdam": 194,
    "psv eindhoven": 197,
    "psv": 197,
    "feyenoord": 209,

    "boca juniors": 451,
    "river plate": 435,
    "racing club": 436,
    "independiente": 442,
    "san lorenzo": 438,

    "flamengo": 127,
    "palmeiras": 121,
    "santos": 128,
    "corinthians": 131,
    "sao paulo": 126,
    "são paulo": 126,

    "atlético nacional": 1127,
    "atletico nacional": 1127,
    "millonarios": 1138,
    "junior fc": 1136,

    "inter miami": 9568,
    "inter miami cf": 9568,
    "lafc": 1616,
    "los angeles fc": 1616,
    "seattle sounders": 1595,

    "al nassr": 2939,
    "al hilal": 2932,
    "al ahli": 2929,

    "galatasaray": 645,
    "fenerbahce": 611,
    "fenerbahçe": 611,
    "besiktas": 549,
    "beşiktaş": 549,

    "club america": 2287,
    "club américa": 2287,
    "cruz azul": 2295,
    "tigres uanl": 2279,
}

API_FOOTBALL_LEAGUE_IDS = {
    "Premier League": 39,
    "LaLiga": 140,
    "Serie A": 135,
    "Bundesliga": 78,
    "Ligue 1": 61,
    "Primeira Liga": 94,
    "Eredivisie": 88,
    "Liga Profesional Argentina": 128,
    "Brasileirão": 71,
    "Brasileirao": 71,
    "Categoría Primera A": 239,
    "MLS": 253,
    "Saudi Pro League": 307,
    "Süper Lig": 203,
    "Super Lig": 203,
    "Liga MX": 262,
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

    if any(x in p for x in ["arquero", "portero", "goalkeeper"]):
        return "Portero"

    if any(x in p for x in ["defensa", "defensor", "defender", "centre back", "center back", "left back", "right back", "lateral"]):
        return "Defensa"

    if any(x in p for x in ["mediocampista", "medio", "volante", "midfielder"]):
        return "Mediocampista"

    if any(x in p for x in ["delantero", "forward", "striker", "extremo", "winger", "attacker"]):
        return "Delantero"

    return limpiar_texto(pos)


def altura_a_cm(valor):
    raw = limpiar_texto(valor).lower()
    raw = raw.replace("cm", "").replace(",", ".").strip()

    if not raw:
        return ""

    m = re.search(r"\d+(?:\.\d+)?", raw)
    if not m:
        return ""

    try:
        n = float(m.group(0))
    except Exception:
        return ""

    if 1.0 <= n <= 2.5:
        return int(round(n * 100))

    if 100 <= n <= 250:
        return int(round(n))

    return ""


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


def obtener_api_league_id(liga):
    liga = limpiar_competicion(liga)

    if not liga:
        return ""

    for key, value in API_FOOTBALL_LEAGUE_IDS.items():
        if normalizar(key) == normalizar(liga):
            return value

    return ""


def asegurar_carpetas():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    GAME_DIR.mkdir(parents=True, exist_ok=True)
    GAME_IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def cargar_equipos():
    if not os.path.exists(EQUIPOS_FILE):
        ejemplo = [
            {
                "equipo": "Arsenal",
                "url": "https://www.365scores.com/es/football/team/arsenal-104/squad",
                "api_football_team_id": 42,
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


def jugador_en_blacklist(jugador, blacklist):
    if not blacklist:
        return False

    jugador_id = limpiar_texto(jugador.get("id", ""))
    api_id = limpiar_texto(jugador.get("api_football_id", ""))
    nombre = normalizar(jugador.get("nombre", ""))
    club = normalizar(jugador.get("club", ""))

    for item in blacklist:
        item_id = limpiar_texto(item.get("id", ""))
        item_api_id = limpiar_texto(item.get("api_football_id", ""))
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
            f"api:{j.get('api_football_id', '')}",
            f"{normalizar(j.get('club'))}|{normalizar(j.get('nombre'))}",
        ]

        for key in keys:
            if key.strip() and not key.endswith(":"):
                existentes[key] = j

    return existentes


def buscar_jugador_existente(jugador, existentes):
    keys = [
        f"api:{jugador.get('api_football_id', '')}",
        f"{normalizar(jugador.get('club'))}|{normalizar(jugador.get('nombre'))}",
    ]

    for key in keys:
        if key in existentes:
            return existentes[key]

    return None


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


def api_football_get(endpoint, params=None):
    params = params or {}

    if not API_FOOTBALL_KEY:
        print("❌ Falta API_FOOTBALL_KEY.")
        return None

    url = API_FOOTBALL_BASE_URL.rstrip("/") + endpoint

    try:
        time.sleep(API_FOOTBALL_DELAY)

        r = requests.get(
            url,
            headers=API_FOOTBALL_HEADERS,
            params={k: v for k, v in params.items() if v not in [None, ""]},
            timeout=40,
        )

        if r.status_code == 429:
            print("⚠️ API-Football: límite de requests alcanzado.")
            return None

        if not r.ok:
            print(f"⚠️ API-Football HTTP {r.status_code}: {r.text[:300]}")
            return None

        data = r.json()
        errores = data.get("errors") or {}

        if errores:
            print(f"⚠️ API-Football errores: {errores}")

        return data

    except Exception as e:
        print(f"⚠️ Error consultando API-Football {endpoint}: {e}")
        return None


def obtener_api_team_id_desde_equipo(equipo):
    for key in ["api_football_team_id", "api_team_id", "team_id", "api_id"]:
        valor = equipo.get(key)

        if valor:
            try:
                return int(valor)
            except Exception:
                pass

    nombre = obtener_nombre_equipo(equipo)
    n = normalizar(nombre)

    if n in API_FOOTBALL_TEAM_IDS:
        return API_FOOTBALL_TEAM_IDS[n]

    data = api_football_get("/teams", {"search": nombre})

    if not data:
        return ""

    response = data.get("response") or []

    if not response:
        print(f"⚠️ API-Football no encontró team_id para: {nombre}")
        return ""

    for item in response:
        team = item.get("team") or {}

        if normalizar(team.get("name")) == n:
            team_id = team.get("id")

            if team_id:
                print(f"🔎 API-Football team_id exacto: {nombre} -> {team_id}")
                return int(team_id)

    team = response[0].get("team") or {}
    team_id = team.get("id")

    if team_id:
        print(f"🔎 API-Football team_id aproximado: {nombre} -> {team.get('name')} ({team_id})")
        return int(team_id)

    return ""


def jugador_api_a_json(item, equipo_nombre="", equipo_liga=""):
    player = item.get("player") or {}
    stats = item.get("statistics") or []
    stat = stats[0] if stats else {}

    team = stat.get("team") or {}
    league = stat.get("league") or {}
    games = stat.get("games") or {}

    player_id = player.get("id") or ""
    api_nombre = limpiar_texto(player.get("name"))
    firstname = limpiar_texto(player.get("firstname"))
    lastname = limpiar_texto(player.get("lastname"))
    nombre_completo = limpiar_texto(f"{firstname} {lastname}") if firstname or lastname else api_nombre

    club = limpiar_texto(team.get("name") or equipo_nombre)
    club_id = team.get("id") or ""

    competicion = limpiar_competicion(league.get("name") or equipo_liga)
    posicion = normalizar_posicion(games.get("position") or "")
    numero = games.get("number")
    numero = str(numero) if numero not in [None, ""] else ""

    birth = player.get("birth") or {}

    pais = limpiar_texto(player.get("nationality") or birth.get("country"))
    edad = player.get("age")
    edad = str(edad) if edad not in [None, ""] else ""

    fecha_nacimiento = fecha_api_a_ddmmyyyy(birth.get("date") or "")
    altura = altura_a_cm(player.get("height") or "")

    return {
        "id": str(player_id),
        "api_football_id": str(player_id),
        "nombre": api_nombre,
        "nombre_completo": nombre_completo,
        "firstname": firstname,
        "lastname": lastname,
        "club": club,
        "club_id": str(club_id),
        "api_football_team_id": str(club_id),
        "pais": pais,
        "posicion": posicion,
        "competicion": competicion,
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


def obtener_jugadores_api_football(equipo):
    equipo_nombre = obtener_nombre_equipo(equipo)
    equipo_liga = obtener_liga_equipo(equipo)
    team_id = obtener_api_team_id_desde_equipo(equipo)

    if not team_id:
        print(f"⚠️ Sin team_id de API-Football para {equipo_nombre}. No se pueden traer datos.")
        return []

    league_id = obtener_api_league_id(equipo_liga)

    print(f"\n🌍 API-Football datos: {equipo_nombre} | team={team_id} | league={league_id or 'auto'} | season={API_FOOTBALL_SEASON}")

    jugadores = []
    page = 1
    total_pages = 1

    while page <= total_pages:
        params = {
            "team": team_id,
            "season": API_FOOTBALL_SEASON,
            "page": page,
        }

        if league_id:
            params["league"] = league_id

        data = api_football_get("/players", params)

        if not data:
            break

        paging = data.get("paging") or {}
        total_pages = int(paging.get("total") or 1)

        response = data.get("response") or []

        for item in response:
            jugador = jugador_api_a_json(item, equipo_nombre, equipo_liga)

            if jugador.get("nombre"):
                jugadores.append(jugador)

        print(f"📘 API-Football {equipo_nombre}: página {page}/{total_pages}, jugadores acumulados {len(jugadores)}")

        page += 1

    if not jugadores and league_id:
        print(f"↪️ API-Football: reintento sin league para {equipo_nombre}")

        page = 1
        total_pages = 1

        while page <= total_pages:
            data = api_football_get("/players", {
                "team": team_id,
                "season": API_FOOTBALL_SEASON,
                "page": page,
            })

            if not data:
                break

            paging = data.get("paging") or {}
            total_pages = int(paging.get("total") or 1)

            response = data.get("response") or []

            for item in response:
                jugador = jugador_api_a_json(item, equipo_nombre, equipo_liga)

                if jugador.get("nombre"):
                    jugadores.append(jugador)

            print(f"📘 API-Football {equipo_nombre} sin league: página {page}/{total_pages}, jugadores acumulados {len(jugadores)}")

            page += 1

    salida = []
    vistos = set()

    for j in jugadores:
        key = j.get("api_football_id") or f"{normalizar(j.get('club'))}|{normalizar(j.get('nombre'))}"

        if key in vistos:
            continue

        vistos.add(key)

        if es_staff_o_no_jugador(j.get("nombre", ""), f"{j.get('nombre')} {j.get('posicion')}"):
            print(f"🚫 Staff descartado desde API: {j.get('nombre')} ({j.get('club')})")
            continue

        salida.append(j)

    return salida


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
    """
    Solo abre 365Scores para extraer:
    - nombre detectado
    - imagen_url
    - url_365scores

    NO usa país, edad, altura, dorsal, posición ni competición de 365Scores.
    """
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
        jugador.get("nombre_completo", ""),
        f"{jugador.get('firstname', '')} {jugador.get('lastname', '')}",
    ]

    for nombre in nombres:
        key = normalizar(nombre)

        if key and key in index_imagenes:
            return index_imagenes[key]

    n_jugador = normalizar(jugador.get("nombre", ""))

    if not n_jugador:
        return None

    # Matching suave.
    for key, datos in index_imagenes.items():
        if not key:
            continue

        if key == n_jugador:
            return datos

        if len(key) >= 8 and len(n_jugador) >= 8:
            if key in n_jugador or n_jugador in key:
                return datos

    return None


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
        "id": str(j.get("id", "") or j.get("api_football_id", "")),
        "api_football_id": str(j.get("api_football_id", "")),
        "nombre": j.get("nombre", ""),
        "club": club,
        "club_id": str(j.get("club_id", "")),
        "api_football_team_id": str(j.get("api_football_team_id", "")),
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

    jugadores_api = obtener_jugadores_api_football(equipo)

    if not jugadores_api:
        print(f"⚠️ {equipo_nombre}: no se obtuvieron jugadores desde API-Football.")
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

                nombre_archivo = f"{slugify(jugador.get('club'))}-{slugify(jugador.get('nombre'))}-{jugador.get('api_football_id')}"
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
        key = j.get("api_football_id") or f"{normalizar(j.get('club'))}|{normalizar(j.get('nombre'))}"

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
    print(f"🌍 API-Football season: {API_FOOTBALL_SEASON}")
    print("✅ Modo activo: datos solo desde API-Football, imágenes solo desde 365Scores.")

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

    limpiar_imagenes_huerfanas(simple)

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
    print(f"🌍 Con país API: {con_pais}")
    print(f"📏 Con altura API: {con_altura}")
    print(f"🔢 Con dorsal API: {con_numero}")
    print(f"📌 Con posición API: {con_posicion}")


if __name__ == "__main__":
    asyncio.run(main())
