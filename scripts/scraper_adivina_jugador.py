"""
scraper_jugadores.py — ESPN Soccer Roster Scraper (versión optimizada)

Mejoras sobre la versión original:
- Cadena de endpoints de detalle más completa y ordenada por calidad de datos
- parse_height_cm robusto: maneja pulgadas enteras, feet'inches, cm y strings mixtos
- country_from_athlete robusto: birthPlace.country → citizenship → nationality → flag
- position_real: prioriza position.displayName del detalle (más preciso que el grupo)
- Retry automático en 429/503 con backoff exponencial
- Logging de calidad por jugador: detecta campos vacíos y los reporta al final
- Deduplicación estable por (nombre_slug, club_slug)
- Compatible con la estructura de salida existente (jugadores.json)
"""

from __future__ import annotations

import json
import re
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

# ─── Configuración ─────────────────────────────────────────────────────────────

OUTPUT_FILE = Path("adivinajugador/jugadores.json")
MIN_JUGADORES_VALIDOS = 100
REQUEST_TIMEOUT = 28
SLEEP_BETWEEN_REQUESTS = 0.10   # segundos entre GETs normales
SLEEP_AFTER_429 = 8.0           # pausa tras rate-limit
MAX_RETRIES = 3

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

# ─── Ligas y equipos ───────────────────────────────────────────────────────────

LIGAS: dict[str, dict] = {
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
    "Internazionale":       ["Inter Milan", "Internazionale"],
    "AC Milan":             ["AC Milan", "Milan"],
    "AS Roma":              ["AS Roma", "Roma"],
    "Atlético Madrid":      ["Atletico Madrid", "Atlético Madrid", "Atletico de Madrid"],
    "Paris Saint-Germain":  ["Paris Saint-Germain", "PSG", "Paris SG"],
    "Bayern Munich":        ["Bayern Munich", "FC Bayern Munich", "Bayern München"],
    "Borussia Dortmund":    ["Borussia Dortmund", "Dortmund", "BVB"],
    "RB Leipzig":           ["RB Leipzig", "Leipzig"],
    "VfB Stuttgart":        ["VfB Stuttgart", "Stuttgart"],
    "Feyenoord Rotterdam":  ["Feyenoord Rotterdam", "Feyenoord"],
    "PSV Eindhoven":        ["PSV Eindhoven", "PSV"],
    "Atlético Junior":      ["Atlético Junior", "Junior", "Junior FC", "Atletico Junior"],
    "América":              ["América", "Club América", "America"],
    "Guadalajara":          ["Guadalajara", "Chivas", "Club Deportivo Guadalajara"],
    "Sporting CP":          ["Sporting CP", "Sporting", "Sporting Clube de Portugal"],
    "FC Porto":             ["FC Porto", "Porto"],
    "Besiktas":             ["Besiktas", "Beşiktaş", "Besiktas JK"],
    "Brighton & Hove Albion": ["Brighton", "Brighton & Hove Albion", "Brighton and Hove Albion"],
    "West Ham United":      ["West Ham", "West Ham United"],
    "Atlético Mineiro":     ["Atletico Mineiro", "Atlético Mineiro", "Atletico MG"],
    "Ajax Amsterdam":       ["Ajax", "Ajax Amsterdam", "AFC Ajax"],
    "AZ Alkmaar":           ["AZ", "AZ Alkmaar"],
    "FC Twente":            ["Twente", "FC Twente"],
}

FAMOSOS_FALLBACK = [
    {
        "nombre": "Lionel Messi", "pais": "Argentina", "club": "Inter Miami CF",
        "liga": "MLS", "competicion": "MLS", "posicion": "F", "edad": 38,
        "altura": 170, "espn_id": "45843",
        "imagen": "https://a.espncdn.com/i/headshots/soccer/players/full/45843.png",
        "posicion_detalle": "Forward",
    },
    {
        "nombre": "Cristiano Ronaldo", "pais": "Portugal", "club": "Al Nassr",
        "liga": "Saudi Pro League", "competicion": "Saudi Pro League", "posicion": "F",
        "edad": 41, "altura": 187, "espn_id": "22774",
        "imagen": "https://a.espncdn.com/i/headshots/soccer/players/full/22774.png",
        "posicion_detalle": "Forward",
    },
    {
        "nombre": "Kylian Mbappé", "pais": "France", "club": "Real Madrid",
        "liga": "LaLiga", "competicion": "LaLiga", "posicion": "F",
        "edad": 26, "altura": 178, "espn_id": "229285",
        "imagen": "https://a.espncdn.com/i/headshots/soccer/players/full/229285.png",
        "posicion_detalle": "Forward",
    },
]

# ─── Utilidades generales ──────────────────────────────────────────────────────

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
    """Devuelve el primer valor no-nulo, no-vacío y no-centinela."""
    SKIP_SCALARS = {None, "", "Sin datos", "-", 0, "0"}
    for v in values:
        # dict/list no son hashables — no podemos usar `in` con el set
        if isinstance(v, (dict, list)):
            continue
        try:
            if v in SKIP_SCALARS:
                continue
        except TypeError:
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
        or obj.get("uid", "").split(":")[-1]
        or extract_id_from_ref(obj.get("$ref"))
        or extract_id_from_ref(obj.get("href"))
        or ""
    ).strip()

# ─── HTTP con reintentos ───────────────────────────────────────────────────────

def get_json(url: str, retries: int = MAX_RETRIES) -> Any:
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            if r.status_code == 200:
                return r.json()
            if r.status_code in (429, 503):
                wait = SLEEP_AFTER_429 * (attempt + 1)
                print(f"    ⏳ Rate-limit ({r.status_code}). Esperando {wait:.0f}s…")
                time.sleep(wait)
                continue
            if r.status_code == 404:
                return None   # No reintentar 404
            # Otros errores: reintento corto
            time.sleep(1.5 * (attempt + 1))
        except requests.exceptions.Timeout:
            print(f"    ⏳ Timeout en {url} (intento {attempt+1})")
            time.sleep(2.0 * (attempt + 1))
        except Exception as exc:
            print(f"    ⚠️ Error HTTP: {exc}")
            break
    return None

# ─── Parsers de datos de atleta ───────────────────────────────────────────────

def parse_height_cm(value: Any) -> int:
    """
    Convierte cualquier formato de altura de ESPN a centímetros.
    ESPN puede devolver:
      - Un número float en pulgadas (ej: 72.0 → 182 cm)
      - Un número en cm (ej: 182)
      - Un string "5' 11\"" o "5'11" o "180 cm" o "1.80 m"
      - None / 0
    """
    if value is None:
        return 0

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        n = float(value)
        if n <= 0:
            return 0
        # ESPN usa pulgadas para rosters anglosajones (rango 60–85)
        if 55 <= n <= 90:
            return int(round(n * 2.54))
        # Ya está en cm
        if 120 <= n <= 240:
            return int(round(n))
        return 0

    s = str(value).strip()
    if not s or s in ["-", "0"]:
        return 0

    # "180 cm" o "180cm"
    m = re.search(r"(\d+(?:\.\d+)?)\s*cm", s, re.I)
    if m:
        return int(round(float(m.group(1))))

    # "1.80 m" o "1,80 m"
    m = re.search(r"(\d+)[,.](\d+)\s*m\b", s, re.I)
    if m:
        return int(round((int(m.group(1)) + int(m.group(2)) / 100) * 100))

    # Feet + pulgadas: "5' 11\"" / "6'2" / "5 ft 10 in"
    m = re.search(r"(\d+)\s*(?:ft|'|′)\s*(\d+)", s, re.I)
    if m:
        return int(round((int(m.group(1)) * 12 + int(m.group(2))) * 2.54))

    # Solo feet: "6 ft" / "6'"
    m = re.search(r"(\d+)\s*(?:ft|'|′)(?!\s*\d)", s, re.I)
    if m:
        return int(round(int(m.group(1)) * 12 * 2.54))

    # Número suelto
    nums = re.findall(r"\d+", s)
    if nums:
        n = int(nums[0])
        if 120 <= n <= 240:
            return n
        if 55 <= n <= 90:
            return int(round(n * 2.54))

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
    """Calcula edad desde fecha de nacimiento ISO (YYYY-MM-DD o similares)."""
    if not dob_str:
        return 0
    try:
        dob_str = str(dob_str)[:10]
        dob = datetime.strptime(dob_str, "%Y-%m-%d")
        today = datetime.now()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except Exception:
        return 0

# ─── Extracción de país ───────────────────────────────────────────────────────

def country_from_athlete(obj: dict) -> str | None:
    """
    Extrae el país del jugador con una cascada de fuentes, del más confiable
    al menos confiable. ESPN tiene datos en múltiples lugares según el endpoint.
    """
    if not isinstance(obj, dict):
        return None

    candidates = []

    # 1. birthPlace.country (más confiable — país real de nacimiento)
    bp = obj.get("birthPlace") or {}
    if isinstance(bp, dict):
        for k in ("country", "countryName", "countryDisplayName"):
            v = bp.get(k)
            if v and isinstance(v, str) and len(v) > 1:
                candidates.append(v.strip())

    # 2. citizenship (campo explícito de ESPN)
    for k in ("citizenship", "citizenshipCountry"):
        v = obj.get(k)
        if isinstance(v, str) and len(v) > 1:
            candidates.append(v.strip())
        elif isinstance(v, dict):
            for kk in ("displayName", "name", "abbreviation"):
                vv = v.get(kk)
                if vv and isinstance(vv, str) and len(vv) > 1:
                    candidates.append(vv.strip())
                    break

    # 3. nationality (a veces es una abreviatura como "BRA", "ARG")
    for k in ("nationality", "nationalityCountry"):
        v = obj.get(k)
        if isinstance(v, str) and len(v) > 1:
            candidates.append(v.strip())
        elif isinstance(v, dict):
            for kk in ("displayName", "name"):
                vv = v.get(kk)
                if vv and isinstance(vv, str) and len(vv) > 1:
                    candidates.append(vv.strip())
                    break

    # 4. flag.alt / flag.description (ESPN pone el nombre del país como alt text)
    flag = obj.get("flag") or {}
    if isinstance(flag, dict):
        for k in ("alt", "description", "title"):
            v = flag.get(k)
            if v and isinstance(v, str) and len(v) > 1:
                candidates.append(v.strip())

    # 5. country top-level (Core API a veces lo pone directamente)
    country_obj = obj.get("country") or {}
    if isinstance(country_obj, dict):
        for k in ("displayName", "name"):
            v = country_obj.get(k)
            if v and isinstance(v, str) and len(v) > 1:
                candidates.append(v.strip())
    elif isinstance(country_obj, str) and len(country_obj) > 1:
        candidates.append(country_obj.strip())

    # Devuelve el primero válido (no vacío, no "Sin datos", no una sola letra)
    for c in candidates:
        if c and c not in ("Sin datos", "-", "N/A") and len(c) > 1:
            return c

    return None

# ─── Extracción de posición ───────────────────────────────────────────────────

# Mapas de términos ESPN → código de posición del juego
_POS_MAP = [
    # Guardameta — máxima prioridad
    (["goalkeeper", "keeper", "portero", "arquero", "golero", " gk", "portière"], "G"),
    # Defensa
    (["center back", "centre back", "central def", "cb", " cb ",
      "left back", "right back", "full back", "fullback",
      "wing back", "wingback", "carrilero",
      "defender", "defensa", "defensor", " lb ", " rb "], "D"),
    # Delantero / extremo
    (["centre forward", "center forward", "striker", "second striker",
      "left wing", "right wing", "winger", "extremo",
      "forward", "delantero", "punta", " cf ", " st ", " lw ", " rw ", " fw "], "F"),
    # Centrocampista — todo lo que queda
    (["defensive mid", "holding mid", "pivot",
      "central mid", "attacking mid", "trequartista",
      "midfielder", "midfield", "mediocampista", "volante", "centrocampista",
      " cdm", " cam", " cm ", " am ", " dm "], "M"),
]

def normalizar_posicion(*sources: Any) -> str:
    """
    Recibe cualquier cantidad de strings/objetos de posición y devuelve
    el código G/D/M/F más apropiado.
    """
    raw_parts = []
    for s in sources:
        if isinstance(s, dict):
            for k in ("displayName", "name", "abbreviation", "shortDisplayName"):
                v = s.get(k)
                if v:
                    raw_parts.append(str(v))
        elif s:
            raw_parts.append(str(s))

    combined = " " + slugify(" ".join(raw_parts)) + " "

    for keywords, code in _POS_MAP:
        if any(kw in combined for kw in keywords):
            return code

    # Letras sueltas que ESPN devuelve en el grupo del roster
    abbr = slugify(" ".join(raw_parts)).strip()
    if abbr == "g":
        return "G"
    if abbr == "d":
        return "D"
    if abbr == "f":
        return "F"
    if abbr == "m":
        return "M"

    return "M"   # fallback seguro


def posicion_detalle_legible(pos_obj: Any, group_pos: str = "") -> str:
    """Devuelve el nombre legible de la posición para mostrar en el juego."""
    if isinstance(pos_obj, dict):
        for k in ("displayName", "name", "shortDisplayName"):
            v = pos_obj.get(k)
            if v and isinstance(v, str) and len(v) > 1 and v not in ("G", "D", "M", "F"):
                return v.strip()
    if isinstance(group_pos, str) and len(group_pos) > 1:
        return group_pos.strip()
    return ""

# ─── Imagen del jugador ───────────────────────────────────────────────────────

def headshot_url(athlete_id: str, obj: dict | None = None) -> str:
    """Busca la URL de la foto en el objeto ESPN; genera CDN URL si no hay."""
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
                if href and "headshot" in href.lower():
                    return href
        # Fallback: cualquier imagen
        for img in obj.get("images") or []:
            if isinstance(img, dict):
                href = img.get("href") or img.get("url")
                if href:
                    return href
    if athlete_id:
        return f"https://a.espncdn.com/i/headshots/soccer/players/full/{athlete_id}.png"
    return ""

# ─── Carga de detalle de atleta ───────────────────────────────────────────────

def cargar_detalle_atleta(league_slug: str, athlete_id: str) -> dict:
    """
    Intenta varios endpoints ESPN en orden de calidad de datos.
    Fusiona todos los campos en un único dict, priorizando los más completos.
    """
    if not athlete_id:
        return {}

    # Orden: site.api (mejor para headshots y posiciones), luego core API
    urls = [
        # Site API — datos de presentación (mejor nombre, headshot, posición display)
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/athletes/{athlete_id}",
        # Site Web API — a veces trae birthPlace y citizenship que site.api no tiene
        f"https://site.web.api.espn.com/apis/common/v3/sports/soccer/{league_slug}/athletes/{athlete_id}?region=us&lang=en",
        # Core API v2 — datos estructurados, a veces mejor altura y país
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{league_slug}/athletes/{athlete_id}?lang=en&region=us",
        # Core API v3 — backup extra
        f"https://sports.core.api.espn.com/v3/sports/soccer/{league_slug}/athletes/{athlete_id}?lang=en&region=us",
    ]

    merged: dict = {}

    for url in urls:
        data = get_json(url)
        time.sleep(SLEEP_BETWEEN_REQUESTS)
        if not isinstance(data, dict):
            continue

        # Algunos endpoints envuelven al atleta
        candidates = [data]
        for wrapper_key in ("athlete", "player", "person"):
            wrapped = data.get(wrapper_key)
            if isinstance(wrapped, dict):
                candidates.append(wrapped)

        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            _merge_into(merged, candidate)

        # Si ya tenemos los datos clave no seguimos pidiendo endpoints
        if (
            merged.get("displayName")
            and country_from_athlete(merged)
            and parse_height_cm(merged.get("displayHeight") or merged.get("height")) > 0
            and merged.get("position")
        ):
            break

    return merged


def _merge_into(base: dict, extra: dict) -> None:
    """Fusiona extra en base: solo sobreescribe si base tiene un valor vacío/centinela."""
    SKIP = {None, "", "Sin datos", "-", 0, "0"}
    for k, v in extra.items():
        if k not in base or base[k] in SKIP:
            base[k] = v
        elif isinstance(v, dict) and isinstance(base.get(k), dict):
            # Merge recursivo para objetos anidados como "birthPlace", "position"
            _merge_into(base[k], v)

# ─── Carga de equipos de la liga ─────────────────────────────────────────────

def cargar_equipos_liga(league_slug: str) -> list[dict]:
    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams?limit=500",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{league_slug}/teams?limit=500&lang=en&region=us",
    ]
    for url in urls:
        data = get_json(url)
        if not isinstance(data, dict):
            continue

        raw: list = []
        # Estructura site.api: sports[].leagues[].teams[]
        for sport in data.get("sports") or []:
            for league in sport.get("leagues") or []:
                raw.extend(league.get("teams") or [])
        raw.extend(data.get("items") or [])
        raw.extend(data.get("teams") or [])

        equipos = []
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

    # Coincidencia exacta
    for p in posibles_slug:
        for e in equipos:
            if e["slug"] == p:
                return e

    # Coincidencia parcial
    for p in posibles_slug:
        for e in equipos:
            if p in e["slug"] or e["slug"] in p:
                return e

    return None

# ─── Carga de roster ─────────────────────────────────────────────────────────

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


def _pos_to_str(v: Any) -> str:
    """Convierte un valor de posición ESPN (str o dict) a string legible."""
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, dict):
        for k in ("displayName", "name", "abbreviation", "shortDisplayName"):
            val = v.get(k)
            if isinstance(val, str) and val.strip():
                return val.strip()
    return ""


def iter_athletes_from_roster(roster: dict):
    """Yield (athlete_dict, group_position_str) para cada jugador del roster."""
    for group in roster.get("athletes") or []:
        if not isinstance(group, dict):
            continue
        # group.get("position") puede ser str o dict — normalizamos a str
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
            # Algunos rosters no agrupan
            yield group, group_pos

# ─── Construcción del jugador ─────────────────────────────────────────────────

def construir_jugador(
    athlete: dict,
    detalle: dict,
    group_pos: str,
    club: str,
    liga: str,
) -> dict | None:
    """
    Construye el dict final del jugador fusionando roster + detalle ESPN.
    Prioridad: detalle (más completo) > roster > group_pos.
    """
    athlete_id = extract_athlete_id(detalle) or extract_athlete_id(athlete)

    nombre = first_valid(
        detalle.get("displayName"), detalle.get("fullName"),
        athlete.get("displayName"), athlete.get("fullName"), athlete.get("name"),
    )
    if not nombre:
        return None

    # ── Posición ──
    # El campo "position" del detalle es la posición REAL (no el grupo del roster)
    det_pos_obj = detalle.get("position") or detalle.get("defaultPosition") or {}
    ros_pos_obj = athlete.get("position") or athlete.get("defaultPosition") or {}
    det_pos_str = detalle.get("displayPosition") or detalle.get("positionType") or ""
    ros_pos_str = athlete.get("displayPosition") or ""

    posicion_codigo = normalizar_posicion(det_pos_obj, ros_pos_obj, det_pos_str, ros_pos_str, group_pos)
    detalle_legible = posicion_detalle_legible(det_pos_obj or ros_pos_obj, group_pos)

    # ── País ──
    pais = (
        country_from_athlete(detalle)
        or country_from_athlete(athlete)
        or "Sin datos"
    )

    # ── Edad ──
    edad = first_valid(
        parse_age(detalle.get("age")),
        parse_age(athlete.get("age")),
        parse_age_from_dob(detalle.get("dateOfBirth") or detalle.get("dob") or athlete.get("dateOfBirth")),
    ) or 0

    # ── Altura ──
    # ESPN devuelve "displayHeight" (string legible) y "height" (número en pulgadas)
    # Probamos ambos en ambas fuentes.
    altura = first_valid(
        parse_height_cm(detalle.get("displayHeight")),    # "5' 11\""
        parse_height_cm(detalle.get("height")),           # 71.0 (pulgadas)
        parse_height_cm(athlete.get("displayHeight")),
        parse_height_cm(athlete.get("height")),
    ) or 0

    # ── Imagen ──
    imagen = headshot_url(athlete_id, detalle) or headshot_url(athlete_id, athlete)

    return {
        "nombre": str(nombre).strip(),
        "pais": str(pais).strip(),
        "club": club,
        "liga": liga,
        "competicion": liga,
        "posicion": posicion_codigo,
        "posicion_detalle": detalle_legible or posicion_codigo,
        "edad": int(edad or 0),
        "altura": int(altura or 0),
        "imagen": imagen,
        "espn_id": athlete_id,
    }

# ─── Persistencia ────────────────────────────────────────────────────────────

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


def merge_jugadores(*listas: list[dict]) -> list[dict]:
    out: dict[str, dict] = {}
    for lista in listas:
        for j in lista or []:
            if not isinstance(j, dict) or not j.get("nombre"):
                continue
            key = jugador_key(j)
            if key not in out:
                out[key] = j.copy()
                continue
            merged = out[key].copy()
            for campo in j:
                val = j[campo]
                cur = merged.get(campo)
                if campo in ("edad", "altura"):
                    if int(val or 0) > int(cur or 0):
                        merged[campo] = val
                else:
                    if val and cur in (None, "", "Sin datos", 0, "0"):
                        merged[campo] = val
            out[key] = merged
    return sorted(
        out.values(),
        key=lambda x: (slugify(x.get("liga")), slugify(x.get("club")), slugify(x.get("nombre"))),
    )

# ─── Diagnóstico de calidad ───────────────────────────────────────────────────

def calidad_stats(jugadores: list[dict]) -> dict:
    total = len(jugadores)
    def pct(n): return f"{n}/{total} ({100*n//total if total else 0}%)"
    con_pais    = sum(1 for j in jugadores if j.get("pais") and j.get("pais") != "Sin datos")
    con_edad    = sum(1 for j in jugadores if int(j.get("edad") or 0) > 0)
    con_altura  = sum(1 for j in jugadores if int(j.get("altura") or 0) > 0)
    con_pos_det = sum(1 for j in jugadores if j.get("posicion_detalle") not in (None, "", "G", "D", "M", "F"))
    con_imagen  = sum(1 for j in jugadores if j.get("imagen"))
    return {
        "con_pais":           pct(con_pais),
        "con_edad":           pct(con_edad),
        "con_altura":         pct(con_altura),
        "con_posicion_detalle": pct(con_pos_det),
        "con_imagen":         pct(con_imagen),
    }

# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    existentes = cargar_existente()
    nuevos: list[dict] = []
    no_encontrados: list[dict] = []
    jugadores_sin_datos: list[dict] = []

    for liga, config in LIGAS.items():
        league_slug = config["slug"]
        print(f"\n{'─'*60}")
        print(f"Liga: {liga}  ({league_slug})")

        equipos_espn = cargar_equipos_liga(league_slug)
        if not equipos_espn:
            print(f"  ⚠️  No se pudo listar equipos para {liga}")

        for club in config["clubes"]:
            equipo = buscar_equipo(equipos_espn, club)
            if not equipo:
                print(f"  ✗  No encontrado: {club}")
                no_encontrados.append({"liga": liga, "equipo": club})
                continue

            print(f"  ✓  {club}  →  ESPN id={equipo['id']}  ({equipo['nombre']})")
            roster = cargar_roster(league_slug, equipo["id"])
            count = 0
            sin_datos_local = 0

            for athlete, group_pos in iter_athletes_from_roster(roster):
                athlete_id = extract_athlete_id(athlete)
                detalle = cargar_detalle_atleta(league_slug, athlete_id) if athlete_id else {}
                jugador = construir_jugador(athlete, detalle, group_pos, club, liga)

                if not jugador:
                    continue

                nuevos.append(jugador)
                count += 1

                # Registro de calidad individual
                campos_faltantes = []
                if not jugador["pais"] or jugador["pais"] == "Sin datos":
                    campos_faltantes.append("pais")
                if not jugador["edad"]:
                    campos_faltantes.append("edad")
                if not jugador["altura"]:
                    campos_faltantes.append("altura")
                if campos_faltantes:
                    sin_datos_local += 1
                    jugadores_sin_datos.append({
                        "nombre": jugador["nombre"],
                        "club": club,
                        "liga": liga,
                        "faltantes": campos_faltantes,
                        "espn_id": athlete_id,
                    })

            missing_pct = f" ({sin_datos_local} con datos incompletos)" if sin_datos_local else ""
            print(f"      Jugadores: {count}{missing_pct}")

    # ── Merge final ──
    combinados = merge_jugadores(existentes, nuevos, FAMOSOS_FALLBACK)

    if len(nuevos) < MIN_JUGADORES_VALIDOS and len(existentes) >= MIN_JUGADORES_VALIDOS:
        print("\n⚠️  ESPN devolvió pocos jugadores. Conservando base anterior + fallback.")
        combinados = merge_jugadores(existentes, FAMOSOS_FALLBACK)

    # Solo jugadores con posición válida
    jugables = [j for j in combinados if j.get("posicion") in ("G", "D", "M", "F")]

    payload = {
        "fuente": "ESPN site.api + site.web.api + sports.core.api (v2/v3)",
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "total": len(jugables),
        "scrapeados_nuevos": len(nuevos),
        "existentes_previos": len(existentes),
        "ligas": sorted({j.get("liga") for j in jugables if j.get("liga")}),
        "no_encontrados": no_encontrados,
        "calidad": calidad_stats(jugables),
        "jugadores_incompletos": jugadores_sin_datos[:50],  # solo los primeros 50 para diagnóstico
        "jugadores": jugables,
    }

    OUTPUT_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"\n{'═'*60}")
    print(f"✅  Guardado en {OUTPUT_FILE}")
    print(f"    Total jugadores: {payload['total']}")
    print(f"    Calidad:")
    for k, v in payload["calidad"].items():
        print(f"      {k}: {v}")
    if no_encontrados:
        print(f"    Equipos no encontrados: {len(no_encontrados)}")
        for item in no_encontrados:
            print(f"      - {item['liga']}: {item['equipo']}")


if __name__ == "__main__":
    main()
