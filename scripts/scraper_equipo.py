import json
import os
import re
import unicodedata
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import requests

try:
    from playwright.sync_api import sync_playwright
except Exception:
    sync_playwright = None


OUTPUT_FILE = "data/equipos.json"
MAX_PROXIMOS_PARTIDOS = 5

LEAGUE_SLUG = "arg.1"
SEASON = "2026"

COMPETICION_PRINCIPAL = "Liga Profesional de Futbol - Torneo Apertura 2026"

COMPETICIONES = [
    {
        "nombre": "Liga Profesional de Futbol - Torneo Apertura 2026",
        "league_slug": "arg.1",
        "season": "2026",
        "fase": "apertura",
        "fecha_desde": "2026-01-01",
        "fecha_hasta": "2026-06-30",
    },
    {
        "nombre": "Liga Profesional de Futbol - Torneo Clausura 2026",
        "league_slug": "arg.1",
        "season": "2026",
        "fase": "clausura",
        "fecha_desde": "2026-07-01",
        "fecha_hasta": "2026-12-31",
    },
    {
        "nombre": "Copa Libertadores 2026",
        "league_slug": "conmebol.libertadores",
        "season": "2026",
        "fase": "",
        "fecha_desde": "",
        "fecha_hasta": "",
    },
    {
        "nombre": "Copa Sudamericana 2026",
        "league_slug": "conmebol.sudamericana",
        "season": "2026",
        "fase": "",
        "fecha_desde": "",
        "fecha_hasta": "",
    },
]


EQUIPOS_BASE = [
    {
        "id": "estudiantes-de-la-plata",
        "espn_id": "8",
        "scores365_id": "867",
        "scores365_slug": "estudiantes-de-la-plata",
        "nombre": "Estudiantes de La Plata",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/8.png",
        "apodo": "Pincha",
        "fundacion": "Sin datos",
        "estadio": "Sin datos",
        "ciudad": "La Plata",
    },
    {
        "id": "boca-juniors",
        "espn_id": "5",
        "scores365_id": "866",
        "scores365_slug": "boca-juniors",
        "nombre": "Boca Juniors",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/5.png",
        "apodo": "Xeneizes",
        "fundacion": "1905",
        "estadio": "Alberto J. Armando",
        "ciudad": "Buenos Aires",
    },
    {
        "id": "velez-sarsfield",
        "espn_id": "21",
        "scores365_id": "872",
        "scores365_slug": "velez-sarsfield",
        "nombre": "Vélez Sarsfield",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/21.png",
        "apodo": "Fortín",
        "fundacion": "Sin datos",
        "estadio": "José Amalfitani",
        "ciudad": "Buenos Aires",
    },
    {
        "id": "talleres-cordoba",
        "espn_id": "19",
        "scores365_id": "9274",
        "scores365_slug": "talleres-cordoba",
        "nombre": "Talleres de Córdoba",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/19.png",
        "apodo": "La T",
        "fundacion": "Sin datos",
        "estadio": "Mario Alberto Kempes",
        "ciudad": "Córdoba",
    },
    {
        "id": "independiente",
        "espn_id": "11",
        "scores365_id": "874",
        "scores365_slug": "independiente",
        "nombre": "Independiente",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/11.png",
        "apodo": "Rojo",
        "fundacion": "Sin datos",
        "estadio": "Libertadores de América",
        "ciudad": "Avellaneda",
    },
    {
        "id": "lanus",
        "espn_id": "12",
        "scores365_id": "869",
        "scores365_slug": "lanus",
        "nombre": "Lanús",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/12.png",
        "apodo": "Granate",
        "fundacion": "Sin datos",
        "estadio": "Ciudad de Lanús",
        "ciudad": "Lanús",
    },
    {
        "id": "san-lorenzo",
        "espn_id": "18",
        "scores365_id": "865",
        "scores365_slug": "san-lorenzo",
        "nombre": "San Lorenzo",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/18.png",
        "apodo": "Ciclón",
        "fundacion": "Sin datos",
        "estadio": "Pedro Bidegain",
        "ciudad": "Buenos Aires",
    },
    {
        "id": "union-santa-fe",
        "espn_id": "20",
        "scores365_id": "7206",
        "scores365_slug": "union-santa-fe",
        "nombre": "Unión de Santa Fe",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/20.png",
        "apodo": "Tatengue",
        "fundacion": "Sin datos",
        "estadio": "15 de Abril",
        "ciudad": "Santa Fe",
    },
    {
        "id": "instituto-cordoba",
        "espn_id": "2975",
        "scores365_id": "7272",
        "scores365_slug": "instituto-ac-cordoba",
        "nombre": "Instituto AC Córdoba",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/2975.png",
        "apodo": "Gloria",
        "fundacion": "Sin datos",
        "estadio": "Juan Domingo Perón",
        "ciudad": "Córdoba",
    },
    {
        "id": "defensa-y-justicia",
        "espn_id": "8950",
        "scores365_id": "7217",
        "scores365_slug": "defensa-y-justicia",
        "nombre": "Defensa y Justicia",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/8950.png",
        "apodo": "Halcón",
        "fundacion": "Sin datos",
        "estadio": "Norberto Tomaghello",
        "ciudad": "Florencio Varela",
    },
    {
        "id": "gimnasia-mendoza",
        "espn_id": "11972",
        "scores365_id": "11915",
        "scores365_slug": "gimnasia-mendoza",
        "nombre": "Gimnasia de Mendoza",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/11972.png",
        "apodo": "Lobo mendocino",
        "fundacion": "Sin datos",
        "estadio": "Víctor Antonio Legrotaglie",
        "ciudad": "Mendoza",
    },
    {
        "id": "platense",
        "espn_id": "7764",
        "scores365_id": "7207",
        "scores365_slug": "platense",
        "nombre": "Platense",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/7764.png",
        "apodo": "Calamar",
        "fundacion": "Sin datos",
        "estadio": "Ciudad de Vicente López",
        "ciudad": "Vicente López",
    },
    {
        "id": "central-cordoba-santiago-del-estero",
        "espn_id": "11989",
        "scores365_id": "14057",
        "scores365_slug": "central-cordoba-sde",
        "nombre": "Central Córdoba SdE",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/11989.png",
        "apodo": "Ferroviario",
        "fundacion": "Sin datos",
        "estadio": "Único Madre de Ciudades",
        "ciudad": "Santiago del Estero",
    },
    {
        "id": "newells-old-boys",
        "espn_id": "14",
        "scores365_id": "877",
        "scores365_slug": "newell's-old-boys",
        "nombre": "Newell's Old Boys",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/14.png",
        "apodo": "Leproso",
        "fundacion": "Sin datos",
        "estadio": "Marcelo Bielsa",
        "ciudad": "Rosario",
    },
    {
        "id": "deportivo-riestra",
        "espn_id": "17702",
        "scores365_id": "11940",
        "scores365_slug": "riestra",
        "nombre": "Deportivo Riestra",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/17702.png",
        "apodo": "Malevo",
        "fundacion": "Sin datos",
        "estadio": "Guillermo Laza",
        "ciudad": "Buenos Aires",
    },
    {
        "id": "independiente-rivadavia",
        "espn_id": "9744",
        "scores365_id": "7227",
        "scores365_slug": "independiente-rivadavia",
        "nombre": "Independiente Rivadavia",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/9744.png",
        "apodo": "Lepra mendocina",
        "fundacion": "Sin datos",
        "estadio": "Bautista Gargantini",
        "ciudad": "Mendoza",
    },
    {
        "id": "river-plate",
        "espn_id": "16",
        "scores365_id": "868",
        "scores365_slug": "river-plate",
        "nombre": "River Plate",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/16.png",
        "apodo": "Millonario",
        "fundacion": "1901",
        "estadio": "Monumental",
        "ciudad": "Buenos Aires",
    },
    {
        "id": "argentinos-juniors",
        "espn_id": "3",
        "scores365_id": "871",
        "scores365_slug": "argentinos-juniors",
        "nombre": "Argentinos Juniors",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/3.png",
        "apodo": "Bicho",
        "fundacion": "Sin datos",
        "estadio": "Diego Armando Maradona",
        "ciudad": "Buenos Aires",
    },
    {
        "id": "rosario-central",
        "espn_id": "17",
        "scores365_id": "875",
        "scores365_slug": "rosario-central",
        "nombre": "Rosario Central",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/17.png",
        "apodo": "Canalla",
        "fundacion": "Sin datos",
        "estadio": "Gigante de Arroyito",
        "ciudad": "Rosario",
    },
    {
        "id": "belgrano-cordoba",
        "espn_id": "4",
        "scores365_id": "5783",
        "scores365_slug": "belgrano",
        "nombre": "Belgrano de Córdoba",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/4.png",
        "apodo": "Pirata",
        "fundacion": "Sin datos",
        "estadio": "Julio César Villagra",
        "ciudad": "Córdoba",
    },
    {
        "id": "gimnasia-la-plata",
        "espn_id": "9",
        "scores365_id": "880",
        "scores365_slug": "gimnasia-la-plata",
        "nombre": "Gimnasia La Plata",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/9.png",
        "apodo": "Lobo",
        "fundacion": "Sin datos",
        "estadio": "Juan Carmelo Zerillo",
        "ciudad": "La Plata",
    },
    {
        "id": "huracan",
        "espn_id": "10",
        "scores365_id": "884",
        "scores365_slug": "huracan",
        "nombre": "Huracán",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/10.png",
        "apodo": "Globo",
        "fundacion": "Sin datos",
        "estadio": "Tomás Adolfo Ducó",
        "ciudad": "Buenos Aires",
    },
    {
        "id": "racing-club",
        "espn_id": "15",
        "scores365_id": "876",
        "scores365_slug": "racing-club",
        "nombre": "Racing Club",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/15.png",
        "apodo": "La Academia",
        "fundacion": "1903",
        "estadio": "Presidente Perón",
        "ciudad": "Avellaneda",
    },
    {
        "id": "barracas-central",
        "espn_id": "10060",
        "scores365_id": "9051",
        "scores365_slug": "barracas-central",
        "nombre": "Barracas Central",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/10060.png",
        "apodo": "Guapo",
        "fundacion": "Sin datos",
        "estadio": "Claudio Chiqui Tapia",
        "ciudad": "Buenos Aires",
    },
    {
        "id": "tigre",
        "espn_id": "7767",
        "scores365_id": "883",
        "scores365_slug": "tigre",
        "nombre": "Tigre",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/7767.png",
        "apodo": "Matador",
        "fundacion": "Sin datos",
        "estadio": "José Dellagiovanna",
        "ciudad": "Victoria",
    },
    {
        "id": "sarmiento-junin",
        "espn_id": "10158",
        "scores365_id": "7117",
        "scores365_slug": "sarmiento-junin",
        "nombre": "Sarmiento de Junín",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/10158.png",
        "apodo": "Verde",
        "fundacion": "Sin datos",
        "estadio": "Eva Perón",
        "ciudad": "Junín",
    },
    {
        "id": "banfield",
        "espn_id": "235",
        "scores365_id": "878",
        "scores365_slug": "banfield",
        "nombre": "Banfield",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/235.png",
        "apodo": "Taladro",
        "fundacion": "Sin datos",
        "estadio": "Florencio Sola",
        "ciudad": "Banfield",
    },
    {
        "id": "atletico-tucuman",
        "espn_id": "9785",
        "scores365_id": "6152",
        "scores365_slug": "atletico-tucuman",
        "nombre": "Atlético Tucumán",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/9785.png",
        "apodo": "Decano",
        "fundacion": "Sin datos",
        "estadio": "Monumental José Fierro",
        "ciudad": "San Miguel de Tucumán",
    },
    {
        "id": "aldosivi",
        "espn_id": "9739",
        "scores365_id": "7223",
        "scores365_slug": "aldosivi",
        "nombre": "Aldosivi",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/9739.png",
        "apodo": "Tiburón",
        "fundacion": "Sin datos",
        "estadio": "José María Minella",
        "ciudad": "Mar del Plata",
    },
    {
        "id": "estudiantes-de-rio-cuarto",
        "espn_id": "19685",
        "scores365_id": "17405",
        "scores365_slug": "estudiantes-rio-cuarto",
        "nombre": "Estudiantes de Río Cuarto",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/19685.png",
        "apodo": "Celeste",
        "fundacion": "Sin datos",
        "estadio": "Antonio Candini",
        "ciudad": "Río Cuarto",
    },
]


PREVIOUS_DATA = []
TEXT_CACHE_365 = {}

JSON_CACHE = {}
STATS_CACHE_365 = {}
MATCHES_CACHE_365 = {}


def slug(texto):
    texto = str(texto or "").lower().strip()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")

    limpio = []
    anterior_guion = False

    for c in texto:
        if c.isalnum():
            limpio.append(c)
            anterior_guion = False
        else:
            if not anterior_guion:
                limpio.append("-")
                anterior_guion = True

    return "".join(limpio).strip("-")


def normalizar_texto(texto):
    texto = str(texto or "")
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = texto.lower()
    texto = re.sub(r"\s+", " ", texto)
    return texto.strip()


def slug_jugador(nombre):
    value = slug(nombre)

    correcciones = {
        "lautaruo-rivero": "lautaro-rivero",
        "joaquin-freitas": "joaquin-freitas",
        "adrian-martinez": "adrian-martinez",
        "tomas-conechny": "tomas-conechny",
        "duvan-vergara": "duvan-vergara",
        "matias-zaracho": "matias-zaracho",
        "ignacio-agustin-rodriguez": "ignacio-rodriguez",
        "milton-gimenez": "milton-gimenez",
    }

    return correcciones.get(value, value)


def nombre_visible(nombre):
    correcciones = {
        "Lautaruo Rivero": "Lautaro Rivero",
        "Joaquin Freitas": "Joaquín Freitas",
        "Aníbal Moreno": "Aníbal Moreno",
        "Adrián Martínez": "Adrián Martínez",
        "Duván Vergara": "Duván Vergara",
        "Matías Zaracho": "Matías Zaracho",
        "Ignacio Agustin Rodríguez": "Ignacio Agustín Rodríguez",
        "Milton Gimenez": "Milton Giménez",
    }

    return correcciones.get(nombre, nombre)


def get_json(url):
    if url in JSON_CACHE:
        print(f"♻️ JSON cache {url}")
        return JSON_CACHE[url]

    try:
        r = requests.get(
            url,
            timeout=25,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json, text/plain, */*",
                "Referer": "https://www.espn.com.ar/",
            },
        )

        print(f"🌐 {r.status_code} {url}")

        if not r.ok:
            return None

        data = r.json()
        JSON_CACHE[url] = data
        return data

    except Exception as e:
        print(f"⚠️ Error leyendo ESPN: {e}")
        return None


def estadisticas_vacias():
    return {
        "goles": [],
        "asistencias": [],
        "amarillas": [],
        "rojas": [],
    }


def stats_vacias(stats):
    if not isinstance(stats, dict):
        return True

    return (
        not stats.get("goles")
        and not stats.get("asistencias")
        and not stats.get("amarillas")
        and not stats.get("rojas")
    )


def estadisticas_generales_vacias():
    return {
        "posicion": "-",
        "partidos": "-",
        "ganados": "-",
        "empatados": "-",
        "perdidos": "-",
        "golesFavor": "-",
        "golesContra": "-",
        "diferenciaGol": "-",
        "puntos": "-",
        "racha": "-",
    }


def equipo_vacio(equipo):
    return {
        "id": equipo.get("id", ""),
        "espn_id": equipo.get("espn_id", ""),
        "scores365_id": equipo.get("scores365_id", ""),
        "scores365_slug": equipo.get("scores365_slug", ""),
        "nombre": equipo.get("nombre", ""),
        "liga": equipo.get("liga", "Liga no disponible"),
        "logo": equipo.get("logo", ""),
        "apodo": equipo.get("apodo", "Sin datos"),
        "fundacion": equipo.get("fundacion", "Sin datos"),
        "estadio": equipo.get("estadio", "Sin datos"),
        "ciudad": equipo.get("ciudad", "Sin datos"),
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "proximosPartidos": [],
        "resultados": [],
        "plantel": {
            "arqueros": [],
            "defensores": [],
            "mediocampistas": [],
            "delanteros": [],
        },
        "estadisticas": estadisticas_vacias(),
        "estadisticasGenerales": estadisticas_generales_vacias(),
        "estadisticasPorCompeticion": {},
    }


def formatear_fecha(fecha):
    if not fecha:
        return "Sin fecha"

    return str(fecha).split("T")[0]


def fecha_argentina_desde_iso(fecha_iso):
    if not fecha_iso:
        return "Sin fecha"

    try:
        dt = datetime.fromisoformat(str(fecha_iso).replace("Z", "+00:00"))
        dt_arg = dt.astimezone(ZoneInfo("America/Argentina/Buenos_Aires"))
        return dt_arg.strftime("%Y-%m-%d")
    except Exception:
        return formatear_fecha(fecha_iso)


def hora_argentina_desde_iso(fecha_iso):
    if not fecha_iso or "T" not in str(fecha_iso):
        return "Ver horario"

    try:
        dt = datetime.fromisoformat(str(fecha_iso).replace("Z", "+00:00"))
        dt_arg = dt.astimezone(ZoneInfo("America/Argentina/Buenos_Aires"))
        return dt_arg.strftime("%H:%M")
    except Exception:
        return "Ver horario"


def fecha_iso_argentina_ordenable(fecha_iso):
    if not fecha_iso:
        return ""

    try:
        dt = datetime.fromisoformat(str(fecha_iso).replace("Z", "+00:00"))
        dt_arg = dt.astimezone(ZoneInfo("America/Argentina/Buenos_Aires"))
        return dt_arg.strftime("%Y-%m-%dT%H:%M:%S")
    except Exception:
        return str(fecha_iso or "")


def fecha_en_rango(fecha, fecha_desde="", fecha_hasta=""):
    if not fecha_desde and not fecha_hasta:
        return True

    fecha = str(fecha or "")

    if not fecha or fecha == "Sin fecha":
        return False

    if fecha_desde and fecha < fecha_desde:
        return False

    if fecha_hasta and fecha > fecha_hasta:
        return False

    return True


def fecha_iso_pasada(fecha_iso):
    if not fecha_iso:
        return False

    try:
        dt = datetime.fromisoformat(str(fecha_iso).replace("Z", "+00:00"))

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=ZoneInfo("America/Argentina/Buenos_Aires"))

        return dt.astimezone(timezone.utc) < datetime.now(timezone.utc)
    except Exception:
        return False


def fecha_yyyy_mm_dd_pasada(fecha):
    try:
        dt = datetime.strptime(fecha, "%Y-%m-%d").replace(
            tzinfo=ZoneInfo("America/Argentina/Buenos_Aires")
        )
        hoy = datetime.now(ZoneInfo("America/Argentina/Buenos_Aires")).replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )
        return dt < hoy
    except Exception:
        return False


def filtrar_partidos_por_fecha(partidos, competicion):
    fecha_desde = competicion.get("fecha_desde", "")
    fecha_hasta = competicion.get("fecha_hasta", "")

    if not fecha_desde and not fecha_hasta:
        return partidos

    return [
        partido
        for partido in partidos
        if fecha_en_rango(partido.get("dia"), fecha_desde, fecha_hasta)
    ]


def limpiar_score(score):
    if score is None:
        return None

    if isinstance(score, dict):
        if score.get("displayValue") is not None:
            return str(score.get("displayValue"))

        if score.get("value") is not None:
            value = score.get("value")

            if isinstance(value, float) and value.is_integer():
                return str(int(value))

            return str(value)

        return None

    return str(score)


def valor_stat(stat):
    if not isinstance(stat, dict):
        return "-"

    for key in ["displayValue", "value", "total", "stat"]:
        value = stat.get(key)

        if value is not None and value != "":
            if isinstance(value, float) and value.is_integer():
                return str(int(value))
            return str(value)

    return "-"


# =========================
# ESPN - CLUB / PARTIDOS / PLANTEL
# =========================

def cargar_datos_club(base):
    espn_id = base.get("espn_id")

    if not espn_id:
        return base

    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{LEAGUE_SLUG}/teams/{espn_id}"
    data = get_json(url)

    if not data:
        return base

    team = data.get("team") or data

    if not isinstance(team, dict):
        return base

    actualizado = dict(base)

    nombre = (
        team.get("displayName")
        or team.get("name")
        or team.get("shortDisplayName")
        or base.get("nombre")
    )

    if nombre:
        actualizado["nombre"] = nombre

    logos = team.get("logos") or []

    if logos and isinstance(logos, list):
        logo = logos[0].get("href")
        if logo:
            actualizado["logo"] = logo

    venue = team.get("venue") or {}

    if isinstance(venue, dict):
        estadio = venue.get("fullName") or venue.get("name")
        ciudad = (venue.get("address") or {}).get("city") or venue.get("city")

        if estadio:
            actualizado["estadio"] = estadio

        if ciudad:
            actualizado["ciudad"] = ciudad

    if team.get("nickname"):
        actualizado["apodo"] = team.get("nickname")

    return actualizado


def parse_score_event(evento):
    competitions = evento.get("competitions") or []
    competition = competitions[0] if competitions else {}
    competitors = competition.get("competitors") or []

    local = "Local"
    visitante = "Visitante"
    local_score = None
    visitante_score = None
    local_logo = ""
    visitante_logo = ""

    for comp in competitors:
        team = comp.get("team") or {}
        name = team.get("displayName") or team.get("shortDisplayName") or "Equipo"
        score = limpiar_score(comp.get("score"))

        logos = team.get("logos") or []
        logo = ""

        if isinstance(logos, list) and logos:
            logo = logos[0].get("href") or ""

        if comp.get("homeAway") == "home":
            local = name
            local_score = score
            local_logo = logo
        elif comp.get("homeAway") == "away":
            visitante = name
            visitante_score = score
            visitante_logo = logo

    status = (evento.get("status") or {}).get("type") or {}

    estado_nombre = status.get("name") or ""
    estado_detalle = status.get("description") or ""
    estado_estado = status.get("state") or ""
    estado_id = str(status.get("id") or "")

    completado = status.get("completed") is True

    fecha_iso_utc = evento.get("date") or ""
    fecha = fecha_argentina_desde_iso(fecha_iso_utc)
    hora = hora_argentina_desde_iso(fecha_iso_utc)
    fecha_iso_local = fecha_iso_argentina_ordenable(fecha_iso_utc)

    return {
        "id": str(evento.get("id") or ""),
        "fecha": fecha,
        "fecha_iso": fecha_iso_local,
        "fecha_iso_utc": fecha_iso_utc,
        "hora": hora,
        "local": local,
        "visitante": visitante,
        "local_logo": local_logo,
        "visitante_logo": visitante_logo,
        "marcador_local": local_score,
        "marcador_visitante": visitante_score,
        "completado": completado,
        "estado": estado_detalle or estado_nombre or estado_estado,
        "estado_tipo": estado_estado,
        "estado_nombre": estado_nombre,
        "estado_id": estado_id,
        "url": (evento.get("links") or [{}])[0].get("href", ""),
    }


def tiene_marcador_real(partido):
    local = partido.get("marcador_local")
    visitante = partido.get("marcador_visitante")

    return local is not None and visitante is not None


def es_partido_finalizado(partido):
    estado_tipo = str(partido.get("estado_tipo") or "").lower()
    estado_nombre = str(partido.get("estado_nombre") or "").lower()
    estado = str(partido.get("estado") or "").lower()
    estado_id = str(partido.get("estado_id") or "")

    if partido.get("completado") is True:
        return True

    if estado_tipo == "post":
        return True

    if estado_id in ["3"]:
        return True

    palabras_final = [
        "final",
        "full time",
        "ft",
        "finalizado",
        "terminado",
        "post-game",
    ]

    if any(p in estado_nombre for p in palabras_final):
        return True

    if any(p in estado for p in palabras_final):
        return True

    fecha_para_estado = partido.get("fecha_iso_utc") or partido.get("fecha_iso")

    if fecha_iso_pasada(fecha_para_estado) and tiene_marcador_real(partido):
        return True

    return False


def es_partido_proximo(partido):
    estado_tipo = str(partido.get("estado_tipo") or "").lower()
    estado_nombre = str(partido.get("estado_nombre") or "").lower()
    estado = str(partido.get("estado") or "").lower()
    estado_id = str(partido.get("estado_id") or "")

    if es_partido_finalizado(partido):
        return False

    if estado_tipo == "pre":
        return True

    if estado_id in ["1"]:
        return True

    palabras_pre = [
        "scheduled",
        "pre-game",
        "programado",
        "por jugar",
        "not started",
    ]

    if any(p in estado_nombre for p in palabras_pre):
        return True

    if any(p in estado for p in palabras_pre):
        return True

    fecha_para_estado = partido.get("fecha_iso_utc") or partido.get("fecha_iso")

    if fecha_para_estado and not fecha_iso_pasada(fecha_para_estado):
        return True

    return False


def cargar_partidos_equipo(equipo):
    espn_id = equipo.get("espn_id")

    if not espn_id:
        return [], []

    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{LEAGUE_SLUG}/teams/{espn_id}/schedule"
    data = get_json(url)

    if not data:
        return [], []

    eventos = data.get("events") or data.get("items") or []

    proximos = []
    resultados = []

    for evento in eventos:
        partido = parse_score_event(evento)

        if es_partido_finalizado(partido):
            resultado = "-"

            if tiene_marcador_real(partido):
                resultado = f'{partido["marcador_local"]} - {partido["marcador_visitante"]}'

            resultados.append(
                {
                    "id": partido["id"],
                    "dia": partido["fecha"],
                    "fecha_iso": partido["fecha_iso"],
                    "fecha_iso_utc": partido.get("fecha_iso_utc", ""),
                    "local": partido["local"],
                    "visitante": partido["visitante"],
                    "local_logo": partido["local_logo"],
                    "visitante_logo": partido["visitante_logo"],
                    "url": partido["url"],
                    "resultado": resultado,
                    "estado": partido["estado"],
                    "hora": partido["hora"],
                }
            )

        elif es_partido_proximo(partido):
            proximos.append(
                {
                    "id": partido["id"],
                    "dia": partido["fecha"],
                    "fecha_iso": partido["fecha_iso"],
                    "fecha_iso_utc": partido.get("fecha_iso_utc", ""),
                    "local": partido["local"],
                    "visitante": partido["visitante"],
                    "local_logo": partido["local_logo"],
                    "visitante_logo": partido["visitante_logo"],
                    "url": partido["url"],
                    "hora": partido["hora"],
                    "estado": partido["estado"],
                }
            )

    proximos.sort(key=lambda x: x.get("fecha_iso") or x.get("dia") or "")
    resultados.sort(key=lambda x: x.get("fecha_iso") or x.get("dia") or "", reverse=True)

    return proximos[:20], resultados[:20]


def normalizar_posicion(nombre_posicion):
    pos = slug(nombre_posicion)

    if "goalkeeper" in pos or "arquero" in pos or "portero" in pos:
        return "arqueros"

    if "defender" in pos or "defensa" in pos:
        return "defensores"

    if "midfielder" in pos or "mediocampista" in pos or "volante" in pos:
        return "mediocampistas"

    if "forward" in pos or "delantero" in pos or "attacker" in pos:
        return "delanteros"

    return "mediocampistas"


def cargar_plantel(equipo):
    espn_id = equipo.get("espn_id")

    plantel = {
        "arqueros": [],
        "defensores": [],
        "mediocampistas": [],
        "delanteros": [],
    }

    if not espn_id:
        return plantel

    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{LEAGUE_SLUG}/teams/{espn_id}/roster"
    data = get_json(url)

    if not data:
        return plantel

    athletes = data.get("athletes") or []

    for group in athletes:
        if isinstance(group, dict) and "items" in group:
            posicion_nombre = group.get("position") or group.get("name") or ""
            categoria = normalizar_posicion(posicion_nombre)

            for item in group.get("items") or []:
                athlete = item.get("athlete") or item
                nombre = (
                    athlete.get("displayName")
                    or athlete.get("fullName")
                    or athlete.get("name")
                )

                if not nombre:
                    continue

                plantel[categoria].append(
                    {
                        "nombre": nombre,
                        "edad": athlete.get("age") or "-",
                        "altura": athlete.get("displayHeight") or athlete.get("height") or "-",
                    }
                )

        elif isinstance(group, dict):
            nombre = group.get("displayName") or group.get("fullName") or group.get("name")

            if not nombre:
                continue

            position = group.get("position") or {}
            categoria = normalizar_posicion(
                position.get("displayName") or position.get("name") or ""
            )

            plantel[categoria].append(
                {
                    "nombre": nombre,
                    "edad": group.get("age") or "-",
                    "altura": group.get("displayHeight") or group.get("height") or "-",
                }
            )

    return plantel


def lista_jugadores_plantel(plantel):
    jugadores = []

    for grupo in plantel.values():
        if not isinstance(grupo, list):
            continue

        for jugador in grupo:
            if not isinstance(jugador, dict):
                continue

            nombre = jugador.get("nombre")

            if nombre:
                jugadores.append(nombre)

    return jugadores


def nombres_validos_plantel(plantel):
    return {slug_jugador(nombre) for nombre in lista_jugadores_plantel(plantel)}


def filtrar_estadisticas_por_plantel(estadisticas, plantel):
    validos = nombres_validos_plantel(plantel)

    if not validos:
        return estadisticas

    limpias = estadisticas_vacias()

    for categoria in ["goles", "asistencias", "amarillas", "rojas"]:
        for item in estadisticas.get(categoria, []):
            jugador = item.get("jugador", "")

            if slug_jugador(jugador) in validos:
                limpias[categoria].append(item)

    return limpias


# =========================
# PLAYWRIGHT / 365SCORES
# =========================

TITULOS_365 = [
    "Goles",
    "Goles esperados",
    "Asistencias",
    "Asistencias esperadas",
    "Goles y Asistencias",
    "Goles esperados y asistencias",
    "Rating 365",
    "Penaltis convertidos",
    "Barridas ganadas por partido",
    "Intercepciones por partido",
    "Tarjetas Rojas",
    "Tarjetas Amarillas",
    "Porterías a cero",
    "Goles recibidos",
    "Atajadas por partido",
    "Penaltis parados",
    "Faltas",
    "Faltas cometidas",
    "Duelos ganados",
]


def texto_a_lineas_365(texto):
    lineas = []

    for linea in str(texto or "").splitlines():
        linea = re.sub(r"\s+", " ", linea).strip()

        if not linea:
            continue

        if linea.lower() in [
            "ver más",
            "ver todos",
            "favoritos",
            "resumen",
            "partidos",
            "plantilla",
            "estadísticas",
            "estadisticas",
            "clasificación",
            "clasificacion",
            "transferencias",
            "noticias",
        ]:
            continue

        lineas.append(linea)

    return lineas


def cargar_texto_renderizado_365(url, wait_texts=None):
    if sync_playwright is None:
        print("⚠️ Playwright no está instalado.")
        return ""

    if url in TEXT_CACHE_365:
        return TEXT_CACHE_365[url]

    wait_texts = wait_texts or ["Goles", "Asistencias", "Partidos"]

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ],
            )

            context = browser.new_context(
                locale="es-AR",
                timezone_id="America/Argentina/Buenos_Aires",
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1366, "height": 1200},
            )

            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=60000)

            try:
                page.wait_for_load_state("networkidle", timeout=30000)
            except Exception:
                pass

            for selector_text in wait_texts:
                try:
                    page.get_by_text(selector_text, exact=False).first.wait_for(timeout=15000)
                    break
                except Exception:
                    continue

            textos = []

            for y in [0, 500, 1000, 1600, 2200, 3000, 4000, 5500, 7000, 9000]:
                try:
                    page.evaluate(f"window.scrollTo(0, {y})")
                    page.wait_for_timeout(800)

                    parcial = page.locator("body").inner_text(timeout=15000)

                    if parcial:
                        textos.append(parcial)

                except Exception:
                    pass

            try:
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

                parcial = page.locator("body").inner_text(timeout=15000)

                if parcial:
                    textos.append(parcial)

            except Exception:
                pass

            browser.close()

            texto_final = "\n".join(textos)

            lineas = []

            for linea in texto_final.splitlines():
                limpia = re.sub(r"\s+", " ", linea).strip()

                if limpia:
                    lineas.append(limpia)

            texto = "\n".join(lineas)
            TEXT_CACHE_365[url] = texto

            return texto

    except Exception as e:
        print(f"⚠️ Error renderizando 365Scores con Playwright: {e}")
        return ""


# =========================
# 365SCORES - PRÓXIMOS PARTIDOS
# =========================

def parse_fecha_365(linea):
    m = re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b", str(linea or ""))

    if not m:
        return ""

    dia = int(m.group(1))
    mes = int(m.group(2))
    anio = int(m.group(3))

    return f"{anio:04d}-{mes:02d}-{dia:02d}"


def normalizar_competicion_365(texto):
    n = normalizar_texto(texto)

    if "libertadores" in n:
        return "Copa Libertadores 2026"

    if "sudamericana" in n:
        return "Copa Sudamericana 2026"

    if "liga profesional" in n or "primera division" in n or "argentina" in n:
        return "Liga Profesional de Futbol"

    if "copa argentina" in n:
        return "Copa Argentina"

    return ""


def competicion_365_coincide(comp_detectada, competicion_obj, fecha, permitir_liga_sin_rango=False):
    nombre = competicion_obj.get("nombre", "")

    if not comp_detectada:
        return False

    if comp_detectada == "Copa Libertadores 2026":
        return "Libertadores" in nombre

    if comp_detectada == "Copa Sudamericana 2026":
        return "Sudamericana" in nombre

    if comp_detectada == "Liga Profesional de Futbol":
        if "Liga Profesional" not in nombre:
            return False

        if permitir_liga_sin_rango:
            return True

        return fecha_en_rango(
            fecha,
            competicion_obj.get("fecha_desde", ""),
            competicion_obj.get("fecha_hasta", ""),
        )

    return False


def limpiar_equipo_365(nombre):
    nombre = re.sub(r"\s+", " ", str(nombre or "")).strip()
    nombre = re.sub(r"\b\d{1,2}:\d{2}\b", "", nombre).strip()
    return nombre


def cargar_proximos_365scores(equipo, competicion):
    scores365_id = equipo.get("scores365_id")
scores365_slug = equipo.get("scores365_slug") or equipo.get("id")

if not scores365_id or sync_playwright is None:
    return []

cache_key = f"{scores365_id}-{competicion.get('nombre', '')}"

if cache_key in MATCHES_CACHE_365:
    print(f"♻️ Matches 365Scores cache {equipo.get('nombre')} / {competicion.get('nombre')}")
    return MATCHES_CACHE_365[cache_key]

url = f"https://www.365scores.com/es/football/team/{scores365_slug}-{scores365_id}/matches"

    print(f"📅 365Scores Matches DOM {url}")

    partidos = []
    vistos = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ],
            )

            context = browser.new_context(
                locale="es-AR",
                timezone_id="America/Argentina/Buenos_Aires",
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1366, "height": 1400},
            )

            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=60000)

            try:
                page.wait_for_load_state("networkidle", timeout=30000)
            except Exception:
                pass

            for selector_text in [
                "Partidos",
                "Liga Profesional",
                "Copa Libertadores",
                "Copa Sudamericana",
            ]:
                try:
                    page.get_by_text(selector_text, exact=False).first.wait_for(timeout=15000)
                    break
                except Exception:
                    continue

            for y in [0, 600, 1200, 2000, 3000, 4500, 6000, 8000, 10000, 13000, 16000]:
                try:
                    page.evaluate(f"window.scrollTo(0, {y})")
                    page.wait_for_timeout(700)
                except Exception:
                    pass

            grupos = page.locator("div[class*='entity-scores-widget-group_container']").all()

            print(f"🔎 Grupos 365Scores encontrados: {len(grupos)}")

            for grupo in grupos:
                try:
                    competicion_txt = grupo.locator(
                        "div[class*='entity-scores-widget-group_competition']"
                    ).first.inner_text(timeout=3000).strip()

                    pais_txt = grupo.locator(
                        "div[class*='entity-scores-widget-group_country']"
                    ).first.inner_text(timeout=3000).strip()

                    fecha_txt = grupo.locator(
                        "div[class*='entity-scores-widget-group_header_date']"
                    ).first.inner_text(timeout=3000).strip()

                    fecha = parse_fecha_365(fecha_txt)

                    if not fecha:
                        continue

                    if fecha_yyyy_mm_dd_pasada(fecha):
                        continue

                    comp_detectada = normalizar_competicion_365(
                        f"{competicion_txt} {pais_txt}"
                    )

                    permitir_liga_sin_rango = "Liga Profesional" in competicion.get("nombre", "")

                    if not competicion_365_coincide(
                        comp_detectada,
                        competicion,
                        fecha,
                        permitir_liga_sin_rango=permitir_liga_sin_rango,
                    ):
                        continue

                    cards = grupo.locator("a[class*='game-card_game_card_link']").all()

                    for card in cards:
                        try:
                            href = card.get_attribute("href") or ""
                            full_url = "https://www.365scores.com" + href if href.startswith("/") else href

                            hora = card.locator(
                                "div[class*='game-card-center_center_score']"
                            ).first.inner_text(timeout=3000).strip()

                            nombres = card.locator(
                                "div[class*='game-card-competitor_name']"
                            ).all_inner_texts()

                            nombres = [
                                limpiar_equipo_365(n)
                                for n in nombres
                                if limpiar_equipo_365(n)
                            ]

                            if len(nombres) < 2:
                                continue

                            local = nombres[0]
                            visitante = nombres[-1]

                            logos = card.locator(
                                "img[class*='game-card-competitor_logo_wrap']"
                            ).all()

                            local_logo = ""
                            visitante_logo = ""

                            if len(logos) >= 1:
                                local_logo = logos[0].get_attribute("src") or ""

                            if len(logos) >= 2:
                                visitante_logo = logos[1].get_attribute("src") or ""

                            key = f"{fecha}-{hora}-{local}-{visitante}"

                            if key in vistos:
                                continue

                            vistos.add(key)

                            partidos.append(
                                {
                                    "id": key,
                                    "dia": fecha,
                                    "fecha_iso": f"{fecha}T{hora}:00",
                                    "local": local,
                                    "visitante": visitante,
                                    "local_logo": local_logo,
                                    "visitante_logo": visitante_logo,
                                    "url": full_url,
                                    "hora": hora,
                                    "estado": "Programado",
                                    "competicion": competicion.get("nombre", ""),
                                }
                            )

                        except Exception as e:
                            print(f"⚠️ Error leyendo partido 365Scores: {e}")

                except Exception as e:
                    print(f"⚠️ Error leyendo grupo 365Scores: {e}")
                    continue

            browser.close()

    except Exception as e:
        print(f"⚠️ Error leyendo próximos 365Scores DOM: {e}")
        return []

    partidos.sort(key=lambda x: x.get("fecha_iso") or x.get("dia") or "")

    print(
        f"✅ Próximos 365Scores DOM {equipo.get('nombre')} / "
        f"{competicion.get('nombre')}: {len(partidos)}"
    )

    partidos = partidos[:MAX_PROXIMOS_PARTIDOS]
MATCHES_CACHE_365[cache_key] = partidos
return partidos


# =========================
# 365SCORES - ESTADÍSTICAS PERSONALES
# =========================

def obtener_bloques_texto_365(texto, titulo):
    if not texto:
        return []

    lineas = texto_a_lineas_365(texto)
    titulo_slug = slug(titulo)
    bloques = []
    indices = []

    for i, linea in enumerate(lineas):
        if slug(linea) == titulo_slug:
            indices.append(i)

    for inicio_idx in indices:
        fin = len(lineas)

        for i in range(inicio_idx + 1, len(lineas)):
            linea_slug = slug(lineas[i])

            for otro in TITULOS_365:
                if slug(otro) == titulo_slug:
                    continue

                if linea_slug == slug(otro):
                    fin = i
                    break

            if fin != len(lineas):
                break

        bloque_lineas = lineas[inicio_idx + 1:fin]

        if bloque_lineas:
            bloques.append("\n".join(bloque_lineas).strip())

    return bloques


def parse_numero_365(valor):
    valor = str(valor or "").replace(",", ".").strip()

    if "/" in valor:
        valor = valor.split("/")[0]

    try:
        numero = float(valor)

        if numero.is_integer():
            return int(numero)

        return numero

    except Exception:
        return 0


def es_linea_numero_365(linea):
    linea = str(linea or "").strip()

    if not linea:
        return False

    if "/" in linea:
        linea = linea.split("/")[0]

    linea = linea.replace(",", ".")

    return bool(re.fullmatch(r"\d+(?:\.\d+)?", linea))


def matchea_jugador_365(linea, nombre):
    linea_slug = slug_jugador(linea)
    nombre_slug = slug_jugador(nombre)

    candidatos = {nombre_slug}

    if nombre_slug == "lautaruo-rivero":
        candidatos.add("lautaro-rivero")

    if nombre_slug == "joaquin-freitas":
        candidatos.add("joaquin-freitas")

    if nombre_slug == "ignacio-agustin-rodriguez":
        candidatos.add("ignacio-rodriguez")

    if linea_slug in candidatos:
        return "exacto"

    for candidato in candidatos:
        if candidato and candidato in linea_slug:
            return "incluido"

    return False


def extraer_ranking_de_bloque_365(bloque, titulo, plantel, max_items=10):
    lineas = texto_a_lineas_365(bloque)
    jugadores = lista_jugadores_plantel(plantel)

    resultados = []
    vistos = set()

    for idx, linea in enumerate(lineas):
        for nombre in jugadores:
            match_tipo = matchea_jugador_365(linea, nombre)

            if not match_tipo:
                continue

            total = 0

            if match_tipo == "incluido":
                for i in range(idx + 1, min(len(lineas), idx + 5)):
                    if es_linea_numero_365(lineas[i]):
                        total = parse_numero_365(lineas[i])
                        break

            if match_tipo == "exacto":
                if idx - 1 >= 0 and es_linea_numero_365(lineas[idx - 1]):
                    total = parse_numero_365(lineas[idx - 1])

                if not total:
                    for i in range(idx + 1, min(len(lineas), idx + 6)):
                        if es_linea_numero_365(lineas[i]):
                            total = parse_numero_365(lineas[i])
                            break

            if not total or total <= 0:
                continue

            key = slug_jugador(nombre)

            if key in vistos:
                continue

            vistos.add(key)

            resultados.append(
                {
                    "jugador": nombre_visible(nombre),
                    "total": total,
                }
            )

    resultados.sort(key=lambda x: x.get("total", 0), reverse=True)

    return resultados[:max_items]


def extraer_ranking_365_desde_texto(texto, titulo, plantel, max_items=10):
    bloques = obtener_bloques_texto_365(texto, titulo)

    if not bloques:
        print(f"⚠️ 365Scores: no encontré bloque {titulo}")
        return []

    mejor = []

    for bloque in bloques:
        resultados = extraer_ranking_de_bloque_365(
            bloque,
            titulo,
            plantel,
            max_items=max_items,
        )

        if len(resultados) > len(mejor):
            mejor = resultados

    print(f"🔎 365Scores bloque {titulo} resultados:", mejor[:max_items])

    return mejor[:max_items]


def cargar_estadisticas_365scores(equipo, plantel):
    scores365_id = equipo.get("scores365_id")
scores365_slug = equipo.get("scores365_slug") or equipo.get("id")

if not scores365_id:
    STATS_CACHE_365[cache_key] = estadisticas
return estadisticas

cache_key = str(scores365_id)

if cache_key in STATS_CACHE_365:
    print(f"♻️ Stats 365Scores cache {equipo.get('nombre')}")
    return STATS_CACHE_365[cache_key]

    url = f"https://www.365scores.com/es/football/team/{scores365_slug}-{scores365_id}/stats"

    try:
        print(f"📊 365Scores Stats {url}")

        texto = cargar_texto_renderizado_365(
            url,
            wait_texts=["Goles", "Asistencias", "Tarjetas Amarillas", "Tarjetas Rojas"],
        )

        print("🔎 365Scores stats texto length:", len(texto))
        print("🔎 Tiene Goles:", "Goles" in texto)
        print("🔎 Tiene Asistencias:", "Asistencias" in texto)
        print("🔎 Tiene Tarjetas Amarillas:", "Tarjetas Amarillas" in texto)
        print("🔎 Tiene Tarjetas Rojas:", "Tarjetas Rojas" in texto)

        if not texto:
            return estadisticas_vacias()

        goles = extraer_ranking_365_desde_texto(texto, "Goles", plantel)
        asistencias = extraer_ranking_365_desde_texto(texto, "Asistencias", plantel)
        amarillas = extraer_ranking_365_desde_texto(texto, "Tarjetas Amarillas", plantel)
        rojas = extraer_ranking_365_desde_texto(texto, "Tarjetas Rojas", plantel)

        estadisticas = {
            "goles": goles,
            "asistencias": asistencias,
            "amarillas": amarillas,
            "rojas": rojas,
        }

        print(f"✅ Estadísticas 365Scores {equipo.get('nombre')}:", estadisticas)

        return estadisticas

    except Exception as e:
        print(f"⚠️ Error leyendo 365Scores para {equipo.get('nombre')}: {e}")
        return estadisticas_vacias()


def obtener_estadisticas_previas(equipo_id, nombre_competicion):
    if not isinstance(PREVIOUS_DATA, list):
        return estadisticas_vacias()

    for equipo in PREVIOUS_DATA:
        if not isinstance(equipo, dict):
            continue

        if equipo.get("id") != equipo_id:
            continue

        comp = (equipo.get("estadisticasPorCompeticion") or {}).get(nombre_competicion)

        if isinstance(comp, dict):
            stats = comp.get("estadisticas") or {}

            if not stats_vacias(stats):
                return stats

        stats = equipo.get("estadisticas") or {}

        if not stats_vacias(stats):
            return stats

    return estadisticas_vacias()


# =========================
# ESPN - TABLA / GENERALES
# =========================

def extraer_team_id_desde_entry(entry):
    team = entry.get("team") or {}

    if isinstance(team, dict):
        if team.get("id"):
            return str(team.get("id"))

        ref = team.get("$ref") or team.get("href") or ""

        if "/teams/" in ref:
            return ref.split("/teams/")[1].split("?")[0].split("/")[0]

    return ""


def extraer_entries_standings(data):
    entries = []

    def caminar(obj):
        if isinstance(obj, dict):
            if isinstance(obj.get("entries"), list):
                entries.extend(obj.get("entries"))

            for value in obj.values():
                caminar(value)

        elif isinstance(obj, list):
            for item in obj:
                caminar(item)

    caminar(data)
    return entries


def mapear_stats_generales(entry):
    stats = entry.get("stats") or []
    salida = estadisticas_generales_vacias()

    if entry.get("rank"):
        salida["posicion"] = str(entry.get("rank"))

    for stat in stats:
        if not isinstance(stat, dict):
            continue

        name = slug(
            stat.get("name")
            or stat.get("displayName")
            or stat.get("shortDisplayName")
            or stat.get("abbreviation")
            or ""
        )

        value = valor_stat(stat)

        if name in ["rank", "ranking", "position", "posicion"]:
            salida["posicion"] = value

        elif name in ["gamesplayed", "games-played", "played", "partidos", "gp"]:
            salida["partidos"] = value

        elif name in ["wins", "win", "ganados", "w"]:
            salida["ganados"] = value

        elif name in ["ties", "draws", "empates", "empatados", "d"]:
            salida["empatados"] = value

        elif name in ["losses", "lost", "perdidos", "l"]:
            salida["perdidos"] = value

        elif name in ["points", "puntos", "pts"]:
            salida["puntos"] = value

        elif name in ["pointsfor", "goalsfor", "golesfavor", "gf", "f"]:
            salida["golesFavor"] = value

        elif name in ["pointsagainst", "goalsagainst", "golescontra", "ga", "a"]:
            salida["golesContra"] = value

        elif name in ["pointdifferential", "goaldifference", "diferenciagol", "gd"]:
            salida["diferenciaGol"] = value

        elif name in ["streak", "racha"]:
            salida["racha"] = value

    return salida


def cargar_estadisticas_generales(equipo):
    espn_id = str(equipo.get("espn_id") or "")

    if not espn_id:
        return estadisticas_generales_vacias()

    urls = [
        f"https://site.api.espn.com/apis/v2/sports/soccer/{LEAGUE_SLUG}/standings",
        f"https://site.web.api.espn.com/apis/v2/sports/soccer/{LEAGUE_SLUG}/standings",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{LEAGUE_SLUG}/standings",
    ]

    for url in urls:
        data = get_json(url)

        if not data:
            continue

        entries = extraer_entries_standings(data)

        for entry in entries:
            if not isinstance(entry, dict):
                continue

            team_id = extraer_team_id_desde_entry(entry)

            if team_id == espn_id:
                print(f"📈 Estadísticas generales encontradas para {equipo.get('nombre')}")
                return mapear_stats_generales(entry)

    return estadisticas_generales_vacias()


# =========================
# ARMADO FINAL
# =========================

def combinar_proximos_partidos(principales, fallback, max_items=5):
    combinados = []
    vistos = set()

    for partido in (principales or []) + (fallback or []):
        local = slug(partido.get("local", ""))
        visitante = slug(partido.get("visitante", ""))
        dia = partido.get("dia", "")
        hora = partido.get("hora", "")
        fecha_iso = partido.get("fecha_iso", "")

        key = f"{dia}-{fecha_iso}-{hora}-{local}-{visitante}"

        if key in vistos:
            continue

        vistos.add(key)
        combinados.append(partido)

    combinados.sort(key=lambda x: x.get("fecha_iso") or x.get("dia") or "")

    return combinados[:max_items]


def cargar_datos_por_competicion(base, equipo, competicion):
    global LEAGUE_SLUG, SEASON

    league_original = LEAGUE_SLUG
    season_original = SEASON

    LEAGUE_SLUG = competicion["league_slug"]
    SEASON = competicion["season"]

    nombre_competicion = competicion["nombre"]

    print(f"🏆 Cargando competición: {nombre_competicion} para {base['nombre']}")

    proximos_espn, resultados = cargar_partidos_equipo(base)

    proximos_espn = filtrar_partidos_por_fecha(proximos_espn, competicion)
    resultados = filtrar_partidos_por_fecha(resultados, competicion)

    proximos_365 = cargar_proximos_365scores(base, competicion)

    proximos = combinar_proximos_partidos(
        proximos_365,
        proximos_espn,
        max_items=MAX_PROXIMOS_PARTIDOS,
    )

    print(
        f"📅 Próximos finales {base.get('nombre')} / {nombre_competicion}: "
        f"{len(proximos)} partidos"
    )

    if competicion.get("league_slug") == "arg.1":
    if resultados or proximos:
        # Las estadísticas personales de 365Scores se leen una sola vez por equipo.
        estadisticas = cargar_estadisticas_365scores(base, equipo["plantel"])

            if stats_vacias(estadisticas):
                previas = obtener_estadisticas_previas(base.get("id"), nombre_competicion)

                if not stats_vacias(previas):
                    print(f"♻️ Usando estadísticas previas para {base['nombre']}")
                    estadisticas = previas
        else:
            estadisticas = estadisticas_vacias()
    else:
        estadisticas = estadisticas_vacias()

    estadisticas = filtrar_estadisticas_por_plantel(
        estadisticas,
        equipo["plantel"]
    )

    if resultados or proximos:
        generales = cargar_estadisticas_generales(base)
    else:
        generales = estadisticas_generales_vacias()

    LEAGUE_SLUG = league_original
    SEASON = season_original

    return {
        "nombre": nombre_competicion,
        "league_slug": competicion["league_slug"],
        "season": competicion["season"],
        "fase": competicion.get("fase", ""),
        "fecha_desde": competicion.get("fecha_desde", ""),
        "fecha_hasta": competicion.get("fecha_hasta", ""),
        "proximosPartidos": proximos[:MAX_PROXIMOS_PARTIDOS],
        "resultados": resultados[:10],
        "estadisticas": estadisticas,
        "generales": generales,
    }


def completar_equipo(base):
    print(f"🏟️ Actualizando equipo: {base['nombre']}")

    base = cargar_datos_club(base)
    equipo = equipo_vacio(base)

    equipo["plantel"] = cargar_plantel(base)

    estadisticas_por_competicion = {}

    for competicion in COMPETICIONES:
        datos_competicion = cargar_datos_por_competicion(
            base,
            equipo,
            competicion
        )

        estadisticas_por_competicion[competicion["nombre"]] = datos_competicion

    equipo["estadisticasPorCompeticion"] = estadisticas_por_competicion

    principal = estadisticas_por_competicion.get(COMPETICION_PRINCIPAL)

    if principal:
        equipo["liga"] = principal["nombre"]
        equipo["proximosPartidos"] = principal["proximosPartidos"]
        equipo["resultados"] = principal["resultados"]
        equipo["estadisticas"] = principal["estadisticas"]
        equipo["estadisticasGenerales"] = principal["generales"]

    return equipo


def cargar_json_previo():
    if not os.path.exists(OUTPUT_FILE):
        return []

    try:
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, list):
            return data

    except Exception as e:
        print(f"⚠️ No se pudo leer JSON previo: {e}")

    return []


def main():
    global PREVIOUS_DATA

    os.makedirs("data", exist_ok=True)

    PREVIOUS_DATA = cargar_json_previo()

    equipos = []

    for base in EQUIPOS_BASE:
        equipos.append(completar_equipo(base))

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(equipos, f, ensure_ascii=False, indent=2)

    print(f"✅ Generado {OUTPUT_FILE} con {len(equipos)} equipos")


if __name__ == "__main__":
    main()
