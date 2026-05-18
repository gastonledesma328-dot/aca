"""
scraper_adivina_jugador.py — Scraper ESPN para /adivinajugador/jugadores.json

Versión arreglada:
- Consulta roster + detalle de atleta en ESPN.
- Corrige alturas inválidas: 79 se interpreta como pulgadas => 201 cm, no como 79 cm.
- No deja alturas fuera de 140–220 cm.
- Deduplica sin perder datos buenos del scrapeo nuevo.
- Permite corregir posiciones viejas cuando el nuevo detalle trae algo mejor.
- Genera solo jugadores aptos para el juego en "jugadores".
- Guarda una lista de "jugadores_no_aptos" para diagnóstico.
"""

from __future__ import annotations

import json
import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

# ─── Configuración ─────────────────────────────────────────────────────────────

OUTPUT_FILE = Path("adivinajugador/jugadores.json")

MIN_JUGADORES_VALIDOS = 100
MIN_ALTURA_CM = 140
MAX_ALTURA_CM = 220

REQUEST_TIMEOUT = 28
SLEEP_BETWEEN_REQUESTS = 0.03
SLEEP_AFTER_429 = 8.0
MAX_RETRIES = 3

MAX_WORKERS_EQUIPOS = 4
MAX_WORKERS_DETALLE = 8

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.espn.com/",
    "Origin": "https://www.espn.com",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)

# ─── Ligas y equipos ───────────────────────────────────────────────────────────

LIGAS: dict[str, dict[str, Any]] = {
    "Premier League": {
        "slug": "eng.1",
        "clubes": [
            "Arsenal", "Aston Villa", "Chelsea", "Liverpool", "Manchester City",
            "Manchester United", "Newcastle United", "Tottenham Hotspur",
            "Brighton & Hove Albion", "West Ham United",
        ],
    },
    "LaLiga": {
        "slug": "esp.1",
        "clubes": [
            "Real Madrid", "Barcelona", "Atlético Madrid", "Villarreal",
            "Real Betis", "Athletic Club", "Real Sociedad", "Sevilla",
        ],
    },
    "Serie A": {
        "slug": "ita.1",
        "clubes": [
            "Internazionale", "Juventus", "AC Milan", "Napoli", "AS Roma",
            "Lazio", "Atalanta", "Fiorentina",
        ],
    },
    "Bundesliga": {
        "slug": "ger.1",
        "clubes": [
            "Bayern Munich", "Borussia Dortmund", "Bayer Leverkusen",
            "RB Leipzig", "Eintracht Frankfurt", "VfB Stuttgart",
        ],
    },
    "Ligue 1": {
        "slug": "fra.1",
        "clubes": ["Paris Saint-Germain", "Marseille", "Lyon", "Lille", "Lens", "Monaco"],
    },
    "Brasileirão": {
        "slug": "bra.1",
        "clubes": [
            "Botafogo", "Flamengo", "Fluminense", "Palmeiras", "São Paulo",
            "Santos", "Corinthians", "Grêmio", "Cruzeiro", "Internacional",
            "Atlético Mineiro",
        ],
    },
    "Liga Profesional Argentina": {
        "slug": "arg.1",
        "clubes": [
            "Boca Juniors", "River Plate", "Racing Club", "Independiente",
            "San Lorenzo", "Estudiantes de La Plata", "Vélez Sarsfield", "Rosario Central",
        ],
    },
    "Eredivisie": {
        "slug": "ned.1",
        "clubes": [
            "Ajax Amsterdam", "PSV Eindhoven", "Feyenoord Rotterdam", "AZ Alkmaar", "FC Twente",
        ],
    },
    "Liga BetPlay": {
        "slug": "col.1",
        "clubes": [
            "América de Cali", "Atlético Nacional", "Atlético Junior", "Once Caldas",
            "Millonarios", "Santa Fe", "Deportes Tolima",
        ],
    },
    "MLS": {
        "slug": "usa.1",
        "clubes": [
            "Inter Miami CF", "LAFC", "LA Galaxy", "Atlanta United FC", "New York City FC",
        ],
    },
    "Saudi Pro League": {
        "slug": "ksa.1",
        "clubes": ["Al Nassr", "Al Hilal", "Al Ittihad", "Al Ahli"],
    },
    "Liga Portugal": {
        "slug": "por.1",
        "clubes": ["Benfica", "FC Porto", "Sporting CP", "Braga"],
    },
    "Süper Lig": {
        "slug": "tur.1",
        "clubes": ["Galatasaray", "Fenerbahçe", "Besiktas", "Trabzonspor"],
    },
    "Liga MX": {
        "slug": "mex.1",
        "clubes": ["América", "Cruz Azul", "Guadalajara", "Monterrey", "Tigres UANL"],
    },
}

TEAM_ALIASES: dict[str, list[str]] = {
    "Internazionale": ["Inter Milan", "Internazionale"],
    "AC Milan": ["AC Milan", "Milan"],
    "AS Roma": ["AS Roma", "Roma"],
    "Atlético Madrid": ["Atletico Madrid", "Atlético Madrid", "Atletico de Madrid"],
    "Paris Saint-Germain": ["Paris Saint-Germain", "PSG", "Paris SG"],
    "Bayern Munich": ["Bayern Munich", "FC Bayern Munich", "Bayern München"],
    "Borussia Dortmund": ["Borussia Dortmund", "Dortmund", "BVB"],
    "RB Leipzig": ["RB Leipzig", "Leipzig"],
    "VfB Stuttgart": ["VfB Stuttgart", "Stuttgart"],
    "Feyenoord Rotterdam": ["Feyenoord Rotterdam", "Feyenoord"],
    "PSV Eindhoven": ["PSV Eindhoven", "PSV"],
    "Atlético Junior": ["Atlético Junior", "Junior", "Junior FC", "Atletico Junior"],
    "América": ["América", "Club América", "America"],
    "Guadalajara": ["Guadalajara", "Chivas", "Club Deportivo Guadalajara"],
    "Sporting CP": ["Sporting CP", "Sporting", "Sporting Clube de Portugal"],
    "FC Porto": ["FC Porto", "Porto"],
    "Besiktas": ["Besiktas", "Beşiktaş", "Besiktas JK"],
    "Brighton & Hove Albion": ["Brighton", "Brighton & Hove Albion", "Brighton and Hove Albion"],
    "West Ham United": ["West Ham", "West Ham United"],
    "Atlético Mineiro": ["Atletico Mineiro", "Atlético Mineiro", "Atletico MG"],
    "Ajax Amsterdam": ["Ajax", "Ajax Amsterdam", "AFC Ajax"],
    "AZ Alkmaar": ["AZ", "AZ Alkmaar"],
    "FC Twente": ["Twente", "FC Twente"],
}

FAMOSOS_FALLBACK = [
    {
        "nombre": "Lionel Messi", "pais": "Argentina", "club": "Inter Miami CF",
        "liga": "MLS", "competicion": "MLS", "posicion": "F",
        "posicion_detalle": "Forward", "edad": 38, "altura": 170,
        "imagen": "https://a.espncdn.com/i/headshots/soccer/players/full/45843.png",
        "espn_id": "45843",
    },
    {
        "nombre": "Cristiano Ronaldo", "pais": "Portugal", "club": "Al Nassr",
        "liga": "Saudi Pro League", "competicion": "Saudi Pro League", "posicion": "F",
        "posicion_detalle": "Forward", "edad": 41, "altura": 187,
        "imagen": "https://a.espncdn.com/i/headshots/soccer/players/full/22774.png",
        "espn_id": "22774",
    },
    {
        "nombre": "Kylian Mbappé", "pais": "France", "club": "Real Madrid",
        "liga": "LaLiga", "competicion": "LaLiga", "posicion": "F",
        "posicion_detalle": "Forward", "edad": 26, "altura": 178,
        "imagen": "https://a.espncdn.com/i/headshots/soccer/players/full/229285.png",
        "espn_id": "229285",
    },
    {
        "nombre": "Neymar", "pais": "Brazil", "club": "Santos",
        "liga": "Brasileirão", "competicion": "Brasileirão", "posicion": "F",
        "posicion_detalle": "Forward", "edad": 34, "altura": 175,
        "imagen": "https://a.espncdn.com/i/headshots/soccer/players/full/132948.png",
        "espn_id": "132948",
    },
]


# ─── Correcciones de posición ─────────────────────────────────────────────────
# ESPN a veces devuelve extremos como "Midfielder". Para el juego, estos
# jugadores se tratan como Delantero/Atacante (F). Además, podés sumar nombres
# sin tocar el script creando este archivo opcional:
# adivinajugador/correcciones_posiciones.json
# Ejemplo:
# {
#   "delanteros": ["Samuel Lino", "Francis Amuzu"],
#   "defensores": [],
#   "mediocampistas": [],
#   "arqueros": []
# }
CORRECCIONES_POSICIONES_FILE = Path("adivinajugador/correcciones_posiciones.json")

# Lista base de extremos / atacantes que ESPN suele clasificar como M.
# La clave se compara normalizada con slugify(), así que no importan tildes ni mayúsculas.
DELANTEROS_EXTREMOS_BASE = {
    # Casos detectados en tu JSON
    "samuel lino", "francis amuzu", "felipe anderson", "jhon arias",
    "andre carrillo", "bernard", "gustavo scarpa", "jorge carrascal",
    "luciano acosta", "david terans", "ganso", "alan patrick",
    "matheus pereira", "rodrigo garro", "luiz araujo", "giorgian de arrascaeta",

    # Premier League / Europa
    "michael olise", "bukayo saka", "phil foden", "cole palmer", "noni madueke",
    "jadon sancho", "marcus rashford", "alejandro garnacho", "mason mount",
    "bruno fernandes", "mohamed salah", "luis diaz", "cody gakpo", "diogo jota",
    "darwin nunez", "gabriel martinelli", "leandro trossard", "raheem sterling",
    "pedro neto", "christopher nkunku", "anthony gordon", "jarrod bowen",
    "mohammed kudus", "kaoru mitoma", "joao pedro", "ollie watkins",

    # LaLiga
    "vinicius junior", "vinicius jr", "rodrygo", "kylian mbappe", "jude bellingham",
    "lamine yamal", "raphinha", "ferran torres", "dani olmo", "anssu fati",
    "nico williams", "inaki williams", "oyarzabal", "mikel oyarzabal",
    "antoine griezmann", "julian alvarez", "alex baena", "giovani lo celso",

    # Serie A
    "rafael leao", "christian pulisic", "samuel chukwueze", "khvicha kvaratskhelia",
    "federico chiesa", "paulo dybala", "matias soule", "ademola lookman",
    "mateo retegui", "nicolo zaniolo", "domenico berardi", "lauriente",

    # Bundesliga / Ligue 1
    "jamal musiala", "leroy sane", "serge gnabry", "kingsley coman",
    "karim adeyemi", "julian brandt", "florian wirtz", "xavi simons",
    "ousmane dembele", "bradley barcola", "desire doue", "mason greenwood",
    "edon zhegrova", "georges mikautadze",

    # América / otras ligas
    "lionel messi", "cristiano ronaldo", "neymar", "memphis depay", "hulk",
    "dudu", "bruno henrique", "everton", "gonzalo plata", "yeferson soteldo",
    "cristian pavon", "mateus tete", "gabriel mec", "paulinho",
    "ramon sosa", "vitor roque", "benjamin rollheiser", "gabriel barbosa",
    "cucho hernandez", "luis suarez", "angel di maria", "keny arroyo",
}

_POSICIONES_EXTERNAS_CACHE: dict[str, str] | None = None


def cargar_correcciones_posiciones() -> dict[str, str]:
    """Carga correcciones opcionales desde adivinajugador/correcciones_posiciones.json."""
    global _POSICIONES_EXTERNAS_CACHE
    if _POSICIONES_EXTERNAS_CACHE is not None:
        return _POSICIONES_EXTERNAS_CACHE

    out: dict[str, str] = {}
    if CORRECCIONES_POSICIONES_FILE.exists():
        try:
            data = json.loads(CORRECCIONES_POSICIONES_FILE.read_text(encoding="utf-8"))
            grupos = {
                "delanteros": "F", "atacantes": "F", "extremos": "F",
                "defensores": "D", "mediocampistas": "M", "medios": "M",
                "arqueros": "G", "porteros": "G",
            }
            if isinstance(data, dict):
                for key, code in grupos.items():
                    for nombre in data.get(key) or []:
                        if nombre:
                            out[slugify(nombre)] = code
        except Exception as exc:
            print(f"⚠️  No se pudo leer {CORRECCIONES_POSICIONES_FILE}: {exc}")

    _POSICIONES_EXTERNAS_CACHE = out
    return out


def posicion_override_por_nombre(nombre: Any) -> str:
    """Devuelve F/D/M/G si el nombre tiene corrección manual/base."""
    key = slugify(nombre)
    if not key:
        return ""
    externas = cargar_correcciones_posiciones()
    if key in externas:
        return externas[key]
    if key in DELANTEROS_EXTREMOS_BASE:
        return "F"
    return ""


def detalle_override_posicion(code: str) -> str:
    return {
        "F": "Winger / Forward",
        "M": "Midfielder",
        "D": "Defender",
        "G": "Goalkeeper",
    }.get(code, code)

# ─── Utilidades ────────────────────────────────────────────────────────────────

def slugify(text: Any) -> str:
    text = str(text or "")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def jugador_key(j: dict) -> str:
    return f"{slugify(j.get('nombre'))}|{slugify(j.get('club'))}|{slugify(j.get('liga'))}"


def first_valid(*values: Any) -> Any:
    for v in values:
        if isinstance(v, (dict, list)):
            continue
        if v in (None, "", "Sin datos", "-", 0, "0"):
            continue
        if isinstance(v, str) and not v.strip():
            continue
        return v
    return None


def get_nested(d: Any, *path: str) -> Any:
    cur = d
    for p in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(p)
    return cur


def extract_id_from_ref(ref: Any) -> str:
    ref = str(ref or "")
    for pattern in (r"/athletes/(\d+)", r"/players/(\d+)", r"[?&]id=(\d+)"):
        m = re.search(pattern, ref)
        if m:
            return m.group(1)
    return ""


def extract_athlete_id(obj: Any) -> str:
    if not isinstance(obj, dict):
        return ""
    return str(
        obj.get("id")
        or str(obj.get("uid") or "").split(":")[-1]
        or extract_id_from_ref(obj.get("$ref"))
        or extract_id_from_ref(obj.get("href"))
        or ""
    ).strip()


# ─── HTTP ──────────────────────────────────────────────────────────────────────

def get_json(url: str, retries: int = MAX_RETRIES) -> Any:
    for attempt in range(retries):
        try:
            r = SESSION.get(url, timeout=REQUEST_TIMEOUT)
            if r.status_code == 200:
                return r.json()
            if r.status_code in (429, 503):
                wait = SLEEP_AFTER_429 * (attempt + 1)
                print(f"    ⏳ Rate-limit {r.status_code}. Esperando {wait:.0f}s…")
                time.sleep(wait)
                continue
            if r.status_code == 404:
                return None
            time.sleep(1.5 * (attempt + 1))
        except requests.exceptions.Timeout:
            print(f"    ⏳ Timeout en {url} intento {attempt + 1}")
            time.sleep(2.0 * (attempt + 1))
        except Exception as exc:
            print(f"    ⚠️ Error HTTP: {exc}")
            break
    return None


# ─── Parsers ───────────────────────────────────────────────────────────────────

def sanitizar_altura_cm(value: Any) -> int:
    """
    Acepta solo 140–220 cm.
    Si llega 55–90, lo toma como pulgadas y lo convierte.
    Esto arregla casos como 79 → 201 cm.
    """
    try:
        n = int(round(float(value or 0)))
    except Exception:
        return 0

    if 55 <= n <= 90:
        n = int(round(n * 2.54))

    if MIN_ALTURA_CM <= n <= MAX_ALTURA_CM:
        return n

    return 0


def parse_height_cm(value: Any) -> int:
    if value is None:
        return 0

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return sanitizar_altura_cm(value)

    s = str(value).strip()
    if not s or s in ("-", "0", "Sin datos"):
        return 0

    m = re.search(r"(\d+(?:\.\d+)?)\s*cm", s, re.I)
    if m:
        return sanitizar_altura_cm(float(m.group(1)))

    m = re.search(r"(\d+)[,.](\d+)\s*m\b", s, re.I)
    if m:
        return sanitizar_altura_cm((int(m.group(1)) + int(m.group(2)) / 100) * 100)

    m = re.search(r"(\d+)\s*(?:ft|'|′)\s*(\d+)", s, re.I)
    if m:
        inches = int(m.group(1)) * 12 + int(m.group(2))
        return sanitizar_altura_cm(inches)

    m = re.search(r"(\d+)\s*(?:ft|'|′)(?!\s*\d)", s, re.I)
    if m:
        inches = int(m.group(1)) * 12
        return sanitizar_altura_cm(inches)

    nums = re.findall(r"\d+", s)
    if nums:
        return sanitizar_altura_cm(int(nums[0]))

    return 0


def parse_age(value: Any) -> int:
    try:
        n = int(str(value or "").split(".")[0])
        if 13 <= n <= 55:
            return n
    except Exception:
        pass
    return 0


def parse_age_from_dob(dob_str: Any) -> int:
    if not dob_str:
        return 0
    try:
        dob = datetime.strptime(str(dob_str)[:10], "%Y-%m-%d")
        today = datetime.now()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except Exception:
        return 0


# ─── País ──────────────────────────────────────────────────────────────────────

def country_from_athlete(obj: dict) -> str | None:
    if not isinstance(obj, dict):
        return None

    candidates: list[str] = []

    bp = obj.get("birthPlace") or {}
    if isinstance(bp, dict):
        for k in ("country", "countryName", "countryDisplayName"):
            v = bp.get(k)
            if isinstance(v, str) and len(v.strip()) > 1:
                candidates.append(v.strip())

    for k in ("citizenship", "citizenshipCountry", "nationality", "nationalityCountry"):
        v = obj.get(k)
        if isinstance(v, str) and len(v.strip()) > 1:
            candidates.append(v.strip())
        elif isinstance(v, dict):
            for kk in ("displayName", "name", "abbreviation"):
                vv = v.get(kk)
                if isinstance(vv, str) and len(vv.strip()) > 1:
                    candidates.append(vv.strip())
                    break

    flag = obj.get("flag") or {}
    if isinstance(flag, dict):
        for k in ("alt", "description", "title"):
            v = flag.get(k)
            if isinstance(v, str) and len(v.strip()) > 1:
                candidates.append(v.strip())

    country_obj = obj.get("country") or {}
    if isinstance(country_obj, dict):
        for k in ("displayName", "name"):
            v = country_obj.get(k)
            if isinstance(v, str) and len(v.strip()) > 1:
                candidates.append(v.strip())
    elif isinstance(country_obj, str) and len(country_obj.strip()) > 1:
        candidates.append(country_obj.strip())

    for c in candidates:
        if c not in ("Sin datos", "-", "N/A"):
            return c
    return None


# ─── Posición ──────────────────────────────────────────────────────────────────

_POS_MAP = [
    (["goalkeeper", "keeper", "portero", "arquero", "golero", " gk "], "G"),
    ([
        "center back", "centre back", "central defender", "defender", "defensa",
        "defensor", "left back", "right back", "full back", "fullback",
        "wing back", "wingback", " cb ", " lb ", " rb ",
    ], "D"),
    ([
        "centre forward", "center forward", "striker", "second striker",
        "left wing", "right wing", "winger", "wide forward", "attacker",
        "forward", "delantero", "extremo", "punta", " cf ", " st ", " lw ", " rw ", " fw ",
    ], "F"),
    ([
        "attacking mid", "defensive mid", "holding mid", "central mid",
        "midfielder", "midfield", "mediocampista", "volante", "centrocampista",
        " cdm ", " cam ", " cm ", " am ", " dm ",
    ], "M"),
]


def _pos_to_str(v: Any) -> str:
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, dict):
        for k in ("displayName", "name", "abbreviation", "shortDisplayName"):
            val = v.get(k)
            if isinstance(val, str) and val.strip():
                return val.strip()
    return ""


def normalizar_posicion(*sources: Any) -> str:
    parts: list[str] = []
    for s in sources:
        if isinstance(s, dict):
            for k in ("displayName", "name", "abbreviation", "shortDisplayName"):
                if s.get(k):
                    parts.append(str(s.get(k)))
        elif s:
            parts.append(str(s))

    combined = " " + slugify(" ".join(parts)) + " "
    for keywords, code in _POS_MAP:
        if any(kw in combined for kw in keywords):
            return code

    abbr = slugify(" ".join(parts)).strip()
    return {"g": "G", "d": "D", "f": "F", "m": "M"}.get(abbr, "M")


def posicion_detalle_legible(*sources: Any) -> str:
    for s in sources:
        txt = _pos_to_str(s)
        if txt and txt not in ("G", "D", "M", "F"):
            return txt
    return ""


def elegir_posicion_mejor(actual: dict, nuevo: dict) -> str:
    """
    Corrige duplicados. Si el nuevo detalle dice Forward/Winger/Striker,
    permite cambiar M → F. Si dice Defender/Goalkeeper, también corrige.
    """
    override = posicion_override_por_nombre(nuevo.get("nombre") or actual.get("nombre"))
    if override in ("G", "D", "M", "F"):
        return override

    cur = str(actual.get("posicion") or "").upper()
    new = str(nuevo.get("posicion") or "").upper()

    det = str(nuevo.get("posicion_detalle") or "")
    pos_from_det = normalizar_posicion(det)

    if det and det not in ("G", "D", "M", "F") and pos_from_det in ("G", "D", "M", "F"):
        return pos_from_det

    if new in ("G", "D", "M", "F"):
        return new

    if cur in ("G", "D", "M", "F"):
        return cur

    return "M"


# ─── Imagen ───────────────────────────────────────────────────────────────────

def headshot_url(athlete_id: str, obj: dict | None = None) -> str:
    if isinstance(obj, dict):
        hs = obj.get("headshot")
        if isinstance(hs, dict):
            href = hs.get("href") or hs.get("url")
            if href:
                return href
        if isinstance(hs, str) and hs.startswith("http"):
            return hs

        for img in obj.get("images") or []:
            if isinstance(img, dict):
                href = img.get("href") or img.get("url")
                if href:
                    return href

    if athlete_id:
        return f"https://a.espncdn.com/i/headshots/soccer/players/full/{athlete_id}.png"
    return ""


# ─── ESPN: detalle atleta ──────────────────────────────────────────────────────

def _is_empty(v: Any) -> bool:
    if isinstance(v, (dict, list)):
        return False
    return v in (None, "", "Sin datos", "-", 0, "0")


def _merge_into(base: dict, extra: dict) -> None:
    for k, v in extra.items():
        if k not in base or _is_empty(base[k]):
            base[k] = v
        elif isinstance(v, dict) and isinstance(base.get(k), dict):
            _merge_into(base[k], v)


def cargar_detalle_atleta(league_slug: str, athlete_id: str) -> dict:
    if not athlete_id:
        return {}

    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/athletes/{athlete_id}",
        f"https://site.web.api.espn.com/apis/common/v3/sports/soccer/{league_slug}/athletes/{athlete_id}?region=us&lang=en",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{league_slug}/athletes/{athlete_id}?lang=en&region=us",
        f"https://sports.core.api.espn.com/v3/sports/soccer/{league_slug}/athletes/{athlete_id}?lang=en&region=us",
    ]

    merged: dict = {}

    for url in urls:
        data = get_json(url)
        time.sleep(SLEEP_BETWEEN_REQUESTS)
        if not isinstance(data, dict):
            continue

        candidates = [data]
        for wrapper_key in ("athlete", "player", "person"):
            wrapped = data.get(wrapper_key)
            if isinstance(wrapped, dict):
                candidates.append(wrapped)

        for candidate in candidates:
            _merge_into(merged, candidate)

        has_core = (
            merged.get("displayName")
            and country_from_athlete(merged)
            and parse_height_cm(merged.get("displayHeight") or merged.get("height")) > 0
            and (merged.get("position") or merged.get("defaultPosition"))
        )
        if has_core:
            break

    return merged


# ─── ESPN: equipos y planteles ─────────────────────────────────────────────────

def cargar_equipos_liga(league_slug: str) -> list[dict]:
    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams?limit=500",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{league_slug}/teams?limit=500&lang=en&region=us",
    ]

    for url in urls:
        data = get_json(url)
        if not isinstance(data, dict):
            continue

        raw: list[Any] = []
        for sport in data.get("sports") or []:
            for league in sport.get("leagues") or []:
                raw.extend(league.get("teams") or [])
        raw.extend(data.get("items") or [])
        raw.extend(data.get("teams") or [])

        equipos: list[dict] = []
        for item in raw:
            team = item.get("team") if isinstance(item, dict) else None
            if not isinstance(team, dict):
                team = item if isinstance(item, dict) else {}
            if not team:
                continue

            tid = str(team.get("id") or extract_id_from_ref(team.get("$ref")) or "").strip()
            name = first_valid(
                team.get("displayName"), team.get("name"),
                team.get("shortDisplayName"), team.get("location"),
            )
            if tid and name:
                equipos.append({"id": tid, "nombre": name, "slug": slugify(name)})

        if equipos:
            return equipos

    return []


def buscar_equipo(equipos: list[dict], nombre: str) -> dict | None:
    posibles = [nombre] + TEAM_ALIASES.get(nombre, [])
    posibles_slug = [slugify(x) for x in posibles]

    for p in posibles_slug:
        for e in equipos:
            if e["slug"] == p:
                return e

    for p in posibles_slug:
        for e in equipos:
            if p in e["slug"] or e["slug"] in p:
                return e

    return None


def cargar_roster(league_slug: str, team_id: str) -> dict:
    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams/{team_id}/roster",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{league_slug}/teams/{team_id}/roster?lang=en&region=us",
    ]

    for url in urls:
        data = get_json(url)
        time.sleep(SLEEP_BETWEEN_REQUESTS)
        if isinstance(data, dict) and data.get("athletes"):
            return data

    return {}


def iter_athletes_from_roster(roster: dict):
    for group in roster.get("athletes") or []:
        if not isinstance(group, dict):
            continue

        group_pos = (
            _pos_to_str(group.get("position"))
            or _pos_to_str(group.get("name"))
            or _pos_to_str(group.get("displayName"))
            or ""
        )

        items = group.get("items") or []
        if items:
            for item in items:
                if not isinstance(item, dict):
                    continue
                athlete = item.get("athlete") or item
                if isinstance(athlete, dict):
                    yield athlete, group_pos
        else:
            yield group, group_pos


# ─── Jugador final ─────────────────────────────────────────────────────────────

def construir_jugador(athlete: dict, detalle: dict, group_pos: str, club: str, liga: str) -> dict | None:
    athlete_id = extract_athlete_id(detalle) or extract_athlete_id(athlete)

    nombre = first_valid(
        detalle.get("displayName"), detalle.get("fullName"),
        athlete.get("displayName"), athlete.get("fullName"), athlete.get("name"),
    )
    if not nombre:
        return None

    det_pos_obj = detalle.get("position") or detalle.get("defaultPosition") or {}
    ros_pos_obj = athlete.get("position") or athlete.get("defaultPosition") or {}

    det_pos_str = (
        detalle.get("displayPosition")
        or detalle.get("positionType")
        or detalle.get("positionDisplayName")
        or ""
    )
    ros_pos_str = athlete.get("displayPosition") or athlete.get("positionType") or ""

    posicion_codigo = normalizar_posicion(
        det_pos_obj, det_pos_str,
        ros_pos_obj, ros_pos_str,
        group_pos,
    )
    detalle_legible = posicion_detalle_legible(
        det_pos_obj, det_pos_str,
        ros_pos_obj, ros_pos_str,
        group_pos,
    )

    pais = country_from_athlete(detalle) or country_from_athlete(athlete) or "Sin datos"

    edad = first_valid(
        parse_age(detalle.get("age")),
        parse_age(athlete.get("age")),
        parse_age_from_dob(detalle.get("dateOfBirth") or detalle.get("dob")),
        parse_age_from_dob(athlete.get("dateOfBirth") or athlete.get("dob")),
    ) or 0

    altura = first_valid(
        parse_height_cm(detalle.get("displayHeight")),
        parse_height_cm(detalle.get("height")),
        parse_height_cm(athlete.get("displayHeight")),
        parse_height_cm(athlete.get("height")),
    ) or 0

    imagen = headshot_url(athlete_id, detalle) or headshot_url(athlete_id, athlete)

    return sanitizar_jugador({
        "nombre": str(nombre).strip(),
        "pais": str(pais).strip(),
        "club": club,
        "liga": liga,
        "competicion": liga,
        "posicion": posicion_codigo,
        "posicion_detalle": detalle_legible or posicion_codigo,
        "edad": int(edad or 0),
        "altura": altura,
        "imagen": imagen,
        "espn_id": athlete_id,
    })


# ─── Persistencia y limpieza ───────────────────────────────────────────────────

def cargar_existente() -> list[dict]:
    if not OUTPUT_FILE.exists():
        return []
    try:
        data = json.loads(OUTPUT_FILE.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return data.get("jugadores") or []
    except Exception:
        pass
    return []


def sanitizar_jugador(j: dict) -> dict:
    j = dict(j or {})

    j["nombre"] = str(j.get("nombre") or "").strip()
    j["pais"] = str(j.get("pais") or "Sin datos").strip() or "Sin datos"
    j["club"] = str(j.get("club") or "").strip()
    j["liga"] = str(j.get("liga") or "").strip()
    j["competicion"] = str(j.get("competicion") or j.get("liga") or "").strip()

    j["edad"] = parse_age(j.get("edad"))
    j["altura"] = sanitizar_altura_cm(j.get("altura"))

    det = str(j.get("posicion_detalle") or "").strip()
    pos = str(j.get("posicion") or "").strip().upper()
    pos_from_det = normalizar_posicion(det) if det else ""
    j["posicion"] = pos_from_det if pos_from_det in ("G", "D", "M", "F") else (pos if pos in ("G", "D", "M", "F") else "M")
    j["posicion_detalle"] = det or j["posicion"]

    # Corrección final por nombre: si ESPN lo devuelve como M pero es extremo/atacante,
    # lo pasamos a F. También permite correcciones externas desde JSON.
    override_pos = posicion_override_por_nombre(j.get("nombre"))
    if override_pos in ("G", "D", "M", "F"):
        j["posicion"] = override_pos
        j["posicion_detalle"] = detalle_override_posicion(override_pos)

    if not j.get("imagen") and j.get("espn_id"):
        j["imagen"] = headshot_url(str(j.get("espn_id")))

    return j


def posicion_score(j: dict) -> int:
    score = 0
    if j.get("pais") and j.get("pais") != "Sin datos":
        score += 3
    if parse_age(j.get("edad")):
        score += 2
    if sanitizar_altura_cm(j.get("altura")):
        score += 3
    if j.get("imagen"):
        score += 1
    if j.get("espn_id"):
        score += 1
    if j.get("posicion_detalle") not in (None, "", "G", "D", "M", "F"):
        score += 3
    return score


def merge_jugadores(*listas: list[dict]) -> list[dict]:
    out: dict[str, dict] = {}

    for lista in listas:
        for item in lista or []:
            if not isinstance(item, dict) or not item.get("nombre"):
                continue

            j = sanitizar_jugador(item)
            key = jugador_key(j)

            if key not in out:
                out[key] = j
                continue

            cur = sanitizar_jugador(out[key])
            merged = cur.copy()

            # Priorizar nuevos datos válidos.
            for campo in ("pais", "imagen", "espn_id", "club", "liga", "competicion"):
                val = j.get(campo)
                if val and val not in ("Sin datos", "-", "0"):
                    if campo in ("pais", "imagen", "espn_id") or _is_empty(merged.get(campo)):
                        merged[campo] = val

            edad_cur = parse_age(cur.get("edad"))
            edad_new = parse_age(j.get("edad"))
            merged["edad"] = edad_new or edad_cur or 0

            altura_cur = sanitizar_altura_cm(cur.get("altura"))
            altura_new = sanitizar_altura_cm(j.get("altura"))
            merged["altura"] = altura_new or altura_cur or 0

            merged["posicion"] = elegir_posicion_mejor(cur, j)

            det_new = str(j.get("posicion_detalle") or "").strip()
            det_cur = str(cur.get("posicion_detalle") or "").strip()
            if det_new and det_new not in ("G", "D", "M", "F"):
                merged["posicion_detalle"] = det_new
            else:
                merged["posicion_detalle"] = det_cur or merged["posicion"]

            # Si el nuevo es más completo, usarlo para completar vacíos.
            if posicion_score(j) > posicion_score(cur):
                for campo, val in j.items():
                    if _is_empty(merged.get(campo)) and not _is_empty(val):
                        merged[campo] = val

            out[key] = sanitizar_jugador(merged)

    return sorted(
        out.values(),
        key=lambda x: (slugify(x.get("liga")), slugify(x.get("club")), slugify(x.get("nombre"))),
    )


def jugador_apto_para_juego(j: dict) -> tuple[bool, list[str]]:
    faltantes = []
    if not j.get("nombre"):
        faltantes.append("nombre")
    if not j.get("pais") or j.get("pais") == "Sin datos":
        faltantes.append("pais")
    if not parse_age(j.get("edad")):
        faltantes.append("edad")
    if not sanitizar_altura_cm(j.get("altura")):
        faltantes.append("altura")
    if j.get("posicion") not in ("G", "D", "M", "F"):
        faltantes.append("posicion")
    if not j.get("imagen"):
        faltantes.append("imagen")
    return len(faltantes) == 0, faltantes


def calidad_stats(jugadores: list[dict], todos: list[dict] | None = None) -> dict:
    base = todos or jugadores
    total = len(base)

    def pct(n: int) -> str:
        return f"{n}/{total} ({100 * n // total if total else 0}%)"

    con_pais = sum(1 for j in base if j.get("pais") and j.get("pais") != "Sin datos")
    con_edad = sum(1 for j in base if parse_age(j.get("edad")) > 0)
    con_altura = sum(1 for j in base if sanitizar_altura_cm(j.get("altura")) > 0)
    con_pos_det = sum(1 for j in base if j.get("posicion_detalle") not in (None, "", "G", "D", "M", "F"))
    con_imagen = sum(1 for j in base if j.get("imagen"))
    aptos = len(jugadores)

    return {
        "con_pais": pct(con_pais),
        "con_edad": pct(con_edad),
        "con_altura": pct(con_altura),
        "con_posicion_detalle": pct(con_pos_det),
        "con_imagen": pct(con_imagen),
        "aptos_para_juego": f"{aptos}/{total} ({100 * aptos // total if total else 0}%)",
    }


# ─── Procesamiento ─────────────────────────────────────────────────────────────

def procesar_atleta(athlete: dict, group_pos: str, club: str, liga: str, league_slug: str) -> tuple[dict | None, dict | None]:
    athlete_id = extract_athlete_id(athlete)
    detalle = cargar_detalle_atleta(league_slug, athlete_id) if athlete_id else {}
    jugador = construir_jugador(athlete, detalle, group_pos, club, liga)
    if not jugador:
        return None, None

    ok, faltantes = jugador_apto_para_juego(jugador)
    incompleto = None
    if not ok:
        incompleto = {
            "nombre": jugador.get("nombre"),
            "club": club,
            "liga": liga,
            "faltantes": faltantes,
            "espn_id": athlete_id,
        }

    return jugador, incompleto


def procesar_equipo(club: str, equipo: dict, liga: str, league_slug: str) -> tuple[list[dict], list[dict], int]:
    roster = cargar_roster(league_slug, equipo["id"])
    athletes_list = list(iter_athletes_from_roster(roster))

    jugadores_equipo: list[dict] = []
    incompletos_equipo: list[dict] = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS_DETALLE) as pool:
        futures = [
            pool.submit(procesar_atleta, athlete, group_pos, club, liga, league_slug)
            for athlete, group_pos in athletes_list
        ]
        for future in as_completed(futures):
            try:
                jugador, incompleto = future.result()
                if jugador:
                    jugadores_equipo.append(jugador)
                if incompleto:
                    incompletos_equipo.append(incompleto)
            except Exception as exc:
                print(f"    ⚠️ Error procesando atleta: {exc}")

    return jugadores_equipo, incompletos_equipo, len(jugadores_equipo)


# ─── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    existentes = cargar_existente()
    nuevos: list[dict] = []
    no_encontrados: list[dict] = []
    jugadores_incompletos: list[dict] = []

    t0 = time.time()

    for liga, config in LIGAS.items():
        league_slug = config["slug"]
        print(f"\n{'─' * 60}")
        print(f"Liga: {liga} ({league_slug})")

        equipos_espn = cargar_equipos_liga(league_slug)
        if not equipos_espn:
            print(f"  ⚠️ No se pudo listar equipos para {liga}")

        equipos_validos: list[tuple[str, dict]] = []
        for club in config["clubes"]:
            equipo = buscar_equipo(equipos_espn, club)
            if not equipo:
                print(f"  ✗ No encontrado: {club}")
                no_encontrados.append({"liga": liga, "equipo": club})
            else:
                print(f"  ✓ {club} → ESPN id={equipo['id']} ({equipo['nombre']})")
                equipos_validos.append((club, equipo))

        with ThreadPoolExecutor(max_workers=MAX_WORKERS_EQUIPOS) as pool:
            futures = {
                pool.submit(procesar_equipo, club, equipo, liga, league_slug): club
                for club, equipo in equipos_validos
            }
            for future in as_completed(futures):
                club = futures[future]
                try:
                    jug_eq, inc_eq, count = future.result()
                    print(f"      {club}: {count} jugadores" + (f" ({len(inc_eq)} incompletos)" if inc_eq else ""))
                    nuevos.extend(jug_eq)
                    jugadores_incompletos.extend(inc_eq)
                except Exception as exc:
                    print(f"    ⚠️ Error procesando {club}: {exc}")

    elapsed = time.time() - t0
    print(f"\n⏱ Scraping completado en {elapsed:.0f}s ({elapsed / 60:.1f} min)")

    combinados = merge_jugadores(existentes, nuevos, FAMOSOS_FALLBACK)

    if len(nuevos) < MIN_JUGADORES_VALIDOS and len(existentes) >= MIN_JUGADORES_VALIDOS:
        print("\n⚠️ ESPN devolvió pocos jugadores. Conservando base anterior + fallback.")
        combinados = merge_jugadores(existentes, FAMOSOS_FALLBACK)

    todos_sanitizados = [sanitizar_jugador(j) for j in combinados]

    jugables: list[dict] = []
    jugadores_no_aptos: list[dict] = []

    for j in todos_sanitizados:
        ok, faltantes = jugador_apto_para_juego(j)
        if ok:
            jugables.append(j)
        else:
            jugadores_no_aptos.append({
                "nombre": j.get("nombre"),
                "club": j.get("club"),
                "liga": j.get("liga"),
                "faltantes": faltantes,
                "espn_id": j.get("espn_id", ""),
            })

    payload = {
        "fuente": "ESPN site.api + site.web.api + sports.core.api (v2/v3) [paralelo] + filtros juego",
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "total": len(jugables),
        "scrapeados_nuevos": len(nuevos),
        "existentes_previos": len(existentes),
        "tiempo_segundos": round(elapsed, 1),
        "ligas": sorted({j.get("liga") for j in jugables if j.get("liga")}),
        "no_encontrados": no_encontrados,
        "calidad": calidad_stats(jugables, todos_sanitizados),
        "correcciones_posicion_base": len(DELANTEROS_EXTREMOS_BASE),
        "correcciones_posicion_externas": len(cargar_correcciones_posiciones()),
        "jugadores_incompletos": jugadores_incompletos[:80],
        "jugadores_no_aptos": jugadores_no_aptos[:120],
        "jugadores": jugables,
    }

    OUTPUT_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"\n{'═' * 60}")
    print(f"✅ Guardado en {OUTPUT_FILE}")
    print(f"    Total jugadores aptos: {payload['total']}")
    print("    Calidad:")
    for k, v in payload["calidad"].items():
        print(f"      {k}: {v}")

    if no_encontrados:
        print(f"    Equipos no encontrados: {len(no_encontrados)}")
        for item in no_encontrados:
            print(f"      - {item['liga']}: {item['equipo']}")


if __name__ == "__main__":
    main()
