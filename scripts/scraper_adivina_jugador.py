# scraper_adivina_jugador.py
# Modo lista curada:
# - Lee /adivinajugador/jugadores_base.json
# - Mantiene SIEMPRE nombre, altura y posicion de tu lista manual
# - Actualiza SOLO club, liga, edad y país desde ESPN si encuentra al jugador
# - Acepta base plana o base por ligas/equipos/titulares/suplentes

from __future__ import annotations

import json
import re
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

BASE_FILE = Path("adivinajugador/jugadores_base.json")
OUTPUT_FILE = Path("adivinajugador/jugadores.json")

REQUEST_TIMEOUT = 25
SLEEP_BETWEEN_REQUESTS = 0.08
MIN_PLAYERS_SAFE = 50

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
    "Referer": "https://www.espn.com/",
}

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
            "Real Madrid", "Barcelona", "FC Barcelona", "Atlético Madrid",
            "Atlético de Madrid", "Villarreal", "Real Betis", "Athletic Club",
            "Real Sociedad", "Sevilla",
        ],
    },
    "Serie A": {
        "slug": "ita.1",
        "clubes": [
            "Internazionale", "Inter Milan", "Juventus", "AC Milan", "Napoli",
            "AS Roma", "Roma", "Lazio", "Atalanta", "Fiorentina",
        ],
    },
    "Bundesliga": {
        "slug": "ger.1",
        "clubes": [
            "Bayern Munich", "Bayern München", "Borussia Dortmund",
            "Bayer Leverkusen", "RB Leipzig", "Eintracht Frankfurt", "VfB Stuttgart",
        ],
    },
    "Ligue 1": {
        "slug": "fra.1",
        "clubes": [
            "Paris Saint-Germain", "PSG", "Marseille", "Olympique de Marseille",
            "Lyon", "Olympique Lyonnais", "Lille", "LOSC Lille", "Lens", "RC Lens",
            "Monaco",
        ],
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
            "San Lorenzo", "Estudiantes de La Plata", "Vélez Sarsfield",
            "Rosario Central",
        ],
    },
    "Eredivisie": {
        "slug": "ned.1",
        "clubes": [
            "Ajax Amsterdam", "AFC Ajax", "PSV Eindhoven", "Feyenoord Rotterdam",
            "Feyenoord", "AZ Alkmaar", "FC Twente", "NEC Nijmegen",
        ],
    },
    "Liga BetPlay": {
        "slug": "col.1",
        "clubes": [
            "América de Cali", "Atlético Nacional", "Atlético Junior", "Junior FC",
            "Once Caldas", "Millonarios", "Santa Fe", "Deportes Tolima",
        ],
    },
    "MLS": {
        "slug": "usa.1",
        "clubes": [
            "Inter Miami CF", "LAFC", "Los Angeles FC", "LA Galaxy",
            "Atlanta United FC", "New York City FC", "Seattle Sounders",
            "Philadelphia Union", "Columbus Crew",
        ],
    },
    "Saudi Pro League": {
        "slug": "ksa.1",
        "clubes": ["Al Nassr", "Al Hilal", "Al Ittihad", "Al Ahli", "Al Qadsiah"],
    },
    "Liga Portugal": {
        "slug": "por.1",
        "clubes": ["Benfica", "SL Benfica", "FC Porto", "Porto", "Sporting CP", "Braga", "SC Braga", "Vitória SC"],
    },
    "Süper Lig": {
        "slug": "tur.1",
        "clubes": ["Galatasaray", "Fenerbahçe", "Fenerbahce", "Besiktas", "Beşiktaş", "Trabzonspor", "Başakşehir"],
    },
    "Liga MX": {
        "slug": "mex.1",
        "clubes": [
            "América", "Club América", "Cruz Azul", "Guadalajara",
            "Chivas de Guadalajara", "Monterrey", "Tigres UANL", "Toluca FC",
        ],
    },
}

TEAM_ALIASES: dict[str, list[str]] = {
    "FC Barcelona": ["Barcelona", "FC Barcelona"],
    "Barcelona": ["Barcelona", "FC Barcelona"],
    "Atlético de Madrid": ["Atlético Madrid", "Atletico Madrid", "Atlético de Madrid", "Atletico de Madrid"],
    "Atlético Madrid": ["Atlético Madrid", "Atletico Madrid", "Atlético de Madrid", "Atletico de Madrid"],
    "Inter Milan": ["Internazionale", "Inter Milan", "Inter"],
    "Internazionale": ["Internazionale", "Inter Milan", "Inter"],
    "Bayern München": ["Bayern Munich", "Bayern München", "FC Bayern Munich"],
    "Bayern Munich": ["Bayern Munich", "Bayern München", "FC Bayern Munich"],
    "Paris Saint-Germain": ["Paris Saint-Germain", "PSG", "Paris SG"],
    "PSG": ["Paris Saint-Germain", "PSG", "Paris SG"],
    "LOSC Lille": ["Lille", "LOSC Lille"],
    "RC Lens": ["Lens", "RC Lens"],
    "Olympique Lyonnais": ["Lyon", "Olympique Lyonnais"],
    "Olympique de Marseille": ["Marseille", "Olympique de Marseille"],
    "AFC Ajax": ["Ajax", "AFC Ajax", "Ajax Amsterdam"],
    "Ajax Amsterdam": ["Ajax", "AFC Ajax", "Ajax Amsterdam"],
    "Feyenoord": ["Feyenoord", "Feyenoord Rotterdam"],
    "Feyenoord Rotterdam": ["Feyenoord", "Feyenoord Rotterdam"],
    "Junior FC": ["Junior", "Junior FC", "Atlético Junior", "Atletico Junior"],
    "Atlético Junior": ["Junior", "Junior FC", "Atlético Junior", "Atletico Junior"],
    "LAFC": ["LAFC", "Los Angeles FC"],
    "Los Angeles FC": ["LAFC", "Los Angeles FC"],
    "SL Benfica": ["Benfica", "SL Benfica"],
    "Benfica": ["Benfica", "SL Benfica"],
    "SC Braga": ["Braga", "SC Braga"],
    "Braga": ["Braga", "SC Braga"],
    "Sporting CP": ["Sporting CP", "Sporting", "Sporting Clube de Portugal"],
    "FC Porto": ["FC Porto", "Porto"],
    "Porto": ["FC Porto", "Porto"],
    "Besiktas": ["Besiktas", "Beşiktaş", "Besiktas JK"],
    "Beşiktaş": ["Besiktas", "Beşiktaş", "Besiktas JK"],
    "Fenerbahçe": ["Fenerbahçe", "Fenerbahce"],
    "Fenerbahce": ["Fenerbahçe", "Fenerbahce"],
    "Club América": ["América", "Club América", "America"],
    "América": ["América", "Club América", "America"],
    "Guadalajara": ["Guadalajara", "Chivas", "Chivas de Guadalajara"],
    "Chivas de Guadalajara": ["Guadalajara", "Chivas", "Chivas de Guadalajara"],
}

POS_MAP = {
    "GK": "G",
    "G": "G",
    "ARQ": "G",
    "DF": "D",
    "D": "D",
    "DEF": "D",
    "MF": "M",
    "M": "M",
    "MID": "M",
    "F": "F",
    "FW": "F",
    "ST": "F",
}

def slugify(text: Any) -> str:
    text = str(text or "")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()

def clean_player_name(name: Any) -> str:
    s = slugify(name)
    # Quita sufijos comunes para mejorar el match.
    s = re.sub(r"\b(jr|junior|sr|ii|iii|iv)\b", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def name_variants(name: Any) -> set[str]:
    raw = str(name or "").strip()
    clean = clean_player_name(raw)
    variants = {slugify(raw), clean}

    # Vinícius Jr. / Neymar Jr. / nombres con puntos
    no_dots = clean_player_name(raw.replace(".", " "))
    if no_dots:
        variants.add(no_dots)

    # Nombres tipo "Pedro Gonçalves (Pote)"
    no_parenthesis = re.sub(r"\([^)]*\)", "", raw).strip()
    if no_parenthesis:
        variants.add(clean_player_name(no_parenthesis))

    # Si es "Apellido, Nombre" no aplica casi nunca, pero ayuda.
    if "," in raw:
        parts = [p.strip() for p in raw.split(",")]
        if len(parts) == 2:
            variants.add(clean_player_name(parts[1] + " " + parts[0]))

    return {v for v in variants if v}

def parse_age(value: Any) -> int:
    try:
        n = int(str(value or "").split(".")[0])
        if 13 <= n <= 55:
            return n
    except Exception:
        pass
    return 0

def parse_age_from_dob(value: Any) -> int:
    if not value:
        return 0
    try:
        dob = datetime.strptime(str(value)[:10], "%Y-%m-%d")
        today = datetime.now()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except Exception:
        return 0

def norm_pos(value: Any) -> str:
    return POS_MAP.get(str(value or "").strip().upper(), str(value or "").strip().upper() or "M")

def get_json(url: str) -> Any:
    try:
        r = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        if r.status_code == 200:
            return r.json()
        if r.status_code in (429, 503):
            print(f"    ⏳ ESPN rate-limit {r.status_code}. Esperando 6s...")
            time.sleep(6)
            r = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            if r.status_code == 200:
                return r.json()
        return None
    except Exception as exc:
        print(f"    ⚠️ HTTP error: {exc}")
        return None

def extract_id_from_ref(ref: Any) -> str:
    ref = str(ref or "")
    for pattern in (r"/athletes/(\d+)", r"/players/(\d+)", r"/teams/(\d+)", r"[?&]id=(\d+)"):
        m = re.search(pattern, ref)
        if m:
            return m.group(1)
    return ""

def extract_athlete_id(obj: Any) -> str:
    if not isinstance(obj, dict):
        return ""
    return str(
        obj.get("id")
        or str(obj.get("uid", "")).split(":")[-1]
        or extract_id_from_ref(obj.get("$ref"))
        or extract_id_from_ref(obj.get("href"))
        or ""
    ).strip()

def flatten_base_data(data: Any) -> tuple[list[dict], list[dict]]:
    """
    Devuelve (jugadores_base, errores).

    Acepta:
    1) Lista plana:
       [{"nombre": "...", "altura": 178, "posicion": "F"}]

    2) Lista por ligas/equipos:
       [{"liga":"Premier League","equipos":[{"equipo":"Arsenal","titulares":[...],"suplentes":[...]}]}]

    3) Objeto contenedor:
       {"jugadores":[...]} o {"ligas":[...]} o {"data":[...]}
    """
    errores: list[dict] = []
    out: list[dict] = []

    def add_player(j: dict, liga_base: str = "", club_base: str = "", rol: str = "") -> None:
        if not isinstance(j, dict):
            return

        nombre = str(j.get("nombre") or j.get("name") or "").strip()
        if not nombre:
            errores.append({"motivo": "sin_nombre", "jugador": j})
            return

        try:
            altura = int(j.get("altura") or j.get("height") or 0)
        except Exception:
            altura = 0

        pos = norm_pos(j.get("posicion") or j.get("position") or "M")

        item = {
            "nombre": nombre,
            "altura": altura,
            "posicion": pos,
            "club_base": str(j.get("club_base") or j.get("club") or j.get("equipo") or club_base or "").strip(),
            "liga_base": str(j.get("liga_base") or j.get("liga") or liga_base or "").strip(),
            "rol_base": str(j.get("rol") or rol or "").strip(),
        }

        # Permitimos sin altura, pero lo marcamos para que sepas.
        if item["altura"] and not (140 <= item["altura"] <= 220):
            errores.append({"motivo": "altura_rara", "jugador": item})
            item["altura"] = 0

        out.append(item)

    def walk(obj: Any, liga_ctx: str = "", club_ctx: str = "") -> None:
        if isinstance(obj, list):
            for x in obj:
                walk(x, liga_ctx, club_ctx)
            return

        if not isinstance(obj, dict):
            return

        # Objeto contenedor común.
        for key in ("jugadores", "players", "ligas", "leagues", "data", "items"):
            if isinstance(obj.get(key), list):
                walk(obj[key], liga_ctx, club_ctx)
                return

        # Objeto liga.
        if isinstance(obj.get("equipos"), list) or isinstance(obj.get("teams"), list):
            liga = str(obj.get("liga") or obj.get("league") or liga_ctx or "").strip()
            equipos = obj.get("equipos") if isinstance(obj.get("equipos"), list) else obj.get("teams")
            for equipo_obj in equipos:
                walk(equipo_obj, liga, club_ctx)
            return

        # Objeto equipo.
        if any(isinstance(obj.get(k), list) for k in ("titulares", "suplentes", "starters", "subs", "bench")):
            club = str(obj.get("equipo") or obj.get("team") or obj.get("club") or club_ctx or "").strip()
            liga = str(obj.get("liga") or obj.get("league") or liga_ctx or "").strip()

            for key, rol in (
                ("titulares", "titular"),
                ("starters", "titular"),
                ("suplentes", "suplente"),
                ("subs", "suplente"),
                ("bench", "suplente"),
            ):
                if isinstance(obj.get(key), list):
                    for player in obj[key]:
                        add_player(player, liga, club, rol)
            return

        # Objeto jugador plano.
        if obj.get("nombre") or obj.get("name"):
            add_player(obj, liga_ctx, club_ctx)
            return

        errores.append({"motivo": "estructura_no_reconocida", "objeto": obj})

    walk(data)

    # Deduplicación por nombre. Si hay duplicado, conserva el primero con más datos base.
    dedup: dict[str, dict] = {}
    for j in out:
        key = clean_player_name(j["nombre"])
        if not key:
            continue
        if key not in dedup:
            dedup[key] = j
            continue

        old = dedup[key]
        # Si el viejo no tiene altura/club/liga y el nuevo sí, mejora esos campos.
        for campo in ("altura", "club_base", "liga_base", "rol_base"):
            if not old.get(campo) and j.get(campo):
                old[campo] = j[campo]
        dedup[key] = old

    return list(dedup.values()), errores

def cargar_base() -> tuple[list[dict], list[dict]]:
    if not BASE_FILE.exists():
        raise FileNotFoundError(f"No existe {BASE_FILE}. Subí jugadores_base.json en /adivinajugador/.")

    raw = BASE_FILE.read_text(encoding="utf-8-sig").strip()

    if not raw:
        raise ValueError("jugadores_base.json está vacío.")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"jugadores_base.json no es JSON válido. Línea {exc.lineno}, columna {exc.colno}: {exc.msg}"
        ) from exc

    jugadores, errores = flatten_base_data(data)

    if not jugadores:
        raise ValueError(
            "jugadores_base.json se pudo leer, pero no encontré jugadores. "
            "Debe tener una lista plana o una lista por ligas/equipos con titulares/suplentes."
        )

    return jugadores, errores

def cargar_equipos_liga(league_slug: str) -> list[dict]:
    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams?limit=700",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{league_slug}/teams?limit=700&lang=en&region=us",
    ]

    for url in urls:
        data = get_json(url)
        if not isinstance(data, dict):
            continue

        raw_items: list[Any] = []

        # site.api
        for sport in data.get("sports") or []:
            for league in sport.get("leagues") or []:
                raw_items.extend(league.get("teams") or [])

        # core api
        raw_items.extend(data.get("items") or [])
        raw_items.extend(data.get("teams") or [])

        equipos: list[dict] = []
        for item in raw_items:
            team = item.get("team") if isinstance(item, dict) else None
            if not isinstance(team, dict):
                team = item if isinstance(item, dict) else {}

            if not team:
                continue

            tid = str(team.get("id") or extract_id_from_ref(team.get("$ref")) or "").strip()
            name = str(
                team.get("displayName")
                or team.get("name")
                or team.get("shortDisplayName")
                or team.get("location")
                or ""
            ).strip()

            if tid and name:
                equipos.append({"id": tid, "nombre": name, "slug": slugify(name)})

        if equipos:
            return equipos

    return []

def buscar_equipo(equipos: list[dict], nombre: str) -> dict | None:
    posibles = [nombre] + TEAM_ALIASES.get(nombre, [])
    posibles_slug = [slugify(x) for x in posibles if x]

    for p in posibles_slug:
        for e in equipos:
            if e["slug"] == p:
                return e

    for p in posibles_slug:
        for e in equipos:
            if p and (p in e["slug"] or e["slug"] in p):
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

def iter_athletes(roster: dict):
    for group in roster.get("athletes") or []:
        if not isinstance(group, dict):
            continue

        items = group.get("items") or []
        if items:
            for item in items:
                if not isinstance(item, dict):
                    continue
                athlete = item.get("athlete") or item
                if isinstance(athlete, dict):
                    yield athlete
        else:
            yield group

def athlete_display_name(athlete: dict) -> str:
    return str(
        athlete.get("displayName")
        or athlete.get("fullName")
        or athlete.get("name")
        or athlete.get("shortName")
        or ""
    ).strip()

def age_from_athlete(athlete: dict) -> int:
    return (
        parse_age(athlete.get("age"))
        or parse_age_from_dob(athlete.get("dateOfBirth") or athlete.get("dob"))
        or 0
    )

def country_from_athlete(athlete: dict) -> str:
    """
    Extrae país desde los campos que ESPN suele traer en roster/detail.
    No modifica nombre/altura/posición manual; solo completa pais para el JSON final.
    """
    if not isinstance(athlete, dict):
        return ""

    candidates: list[str] = []

    # birthPlace puede venir como dict: {country, countryName, ...}
    birth_place = athlete.get("birthPlace") or athlete.get("birthplace") or {}
    if isinstance(birth_place, dict):
        for key in ("country", "countryName", "countryDisplayName", "displayName", "name"):
            val = birth_place.get(key)
            if isinstance(val, str) and val.strip():
                candidates.append(val.strip())
    elif isinstance(birth_place, str) and birth_place.strip():
        candidates.append(birth_place.strip())

    # nationality / citizenship pueden venir como str o dict
    for key in ("country", "nationality", "nationalityCountry", "citizenship", "citizenshipCountry"):
        val = athlete.get(key)
        if isinstance(val, str) and val.strip():
            candidates.append(val.strip())
        elif isinstance(val, dict):
            for sub in ("displayName", "name", "country", "abbreviation"):
                subval = val.get(sub)
                if isinstance(subval, str) and subval.strip():
                    candidates.append(subval.strip())
                    break

    # flag.alt a veces trae el país
    flag = athlete.get("flag") or {}
    if isinstance(flag, dict):
        for key in ("alt", "description", "title"):
            val = flag.get(key)
            if isinstance(val, str) and val.strip():
                candidates.append(val.strip())

    for value in candidates:
        value = value.strip()
        if value and value not in ("Sin datos", "-", "N/A", "0") and len(value) > 1:
            return value

    return ""

def construir_indice_espn() -> tuple[dict[str, dict], list[dict]]:
    """
    Indexa jugadores actuales por nombre.
    Cada entrada trae SOLO lo que queremos actualizar:
    club, liga, edad, pais, espn_id.
    """
    index: dict[str, dict] = {}
    no_encontrados_equipos: list[dict] = []

    for liga, cfg in LIGAS.items():
        league_slug = cfg["slug"]
        print(f"\nLiga: {liga} ({league_slug})")

        equipos_espn = cargar_equipos_liga(league_slug)
        if not equipos_espn:
            print("  ⚠️ No se pudo listar equipos.")
            no_encontrados_equipos.append({"liga": liga, "equipo": "*lista_equipos*"})
            continue

        vistos_team_ids: set[str] = set()

        for club in cfg["clubes"]:
            equipo = buscar_equipo(equipos_espn, club)
            if not equipo:
                print(f"  ✗ No encontrado: {club}")
                no_encontrados_equipos.append({"liga": liga, "equipo": club})
                continue

            if equipo["id"] in vistos_team_ids:
                continue
            vistos_team_ids.add(equipo["id"])

            print(f"  ✓ {club} → {equipo['nombre']} ({equipo['id']})")
            roster = cargar_roster(league_slug, equipo["id"])

            count = 0
            for athlete in iter_athletes(roster):
                nombre = athlete_display_name(athlete)
                if not nombre:
                    continue

                item = {
                    "nombre_espn": nombre,
                    "club": club,
                    "club_espn": equipo["nombre"],
                    "liga": liga,
                    "edad": age_from_athlete(athlete),
                    "pais": country_from_athlete(athlete) or "Sin datos",
                    "espn_id": extract_athlete_id(athlete),
                }

                for key in name_variants(nombre):
                    if key not in index:
                        index[key] = item

                count += 1

            print(f"      {count} jugadores indexados")

    return index, no_encontrados_equipos

def cargar_json_actual() -> dict:
    if not OUTPUT_FILE.exists():
        return {}
    try:
        data = json.loads(OUTPUT_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}

def main() -> None:
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    print(f"Leyendo base: {BASE_FILE}")
    base, errores_base = cargar_base()
    print(f"Jugadores base detectados: {len(base)}")

    if len(base) < MIN_PLAYERS_SAFE:
        raise ValueError(
            f"La base tiene solo {len(base)} jugadores. Reviso por seguridad para no generar un JSON roto."
        )

    t0 = time.time()
    index_espn, equipos_no_encontrados = construir_indice_espn()

    actualizaciones: list[dict] = []
    no_encontrados: list[dict] = []
    jugadores_finales: list[dict] = []

    for j in base:
        nombre = j["nombre"]
        match = None

        for key in name_variants(nombre):
            if key in index_espn:
                match = index_espn[key]
                break

        if match:
            club_nuevo = match.get("club") or j.get("club_base") or "Sin datos"
            liga_nueva = match.get("liga") or j.get("liga_base") or "Sin datos"
            edad_nueva = int(match.get("edad") or 0)
            pais_nuevo = match.get("pais") or "Sin datos"

            if (
                club_nuevo != (j.get("club_base") or "")
                or liga_nueva != (j.get("liga_base") or "")
            ):
                actualizaciones.append({
                    "nombre": nombre,
                    "club_base": j.get("club_base") or "Sin datos",
                    "liga_base": j.get("liga_base") or "Sin datos",
                    "club_actual": club_nuevo,
                    "liga_actual": liga_nueva,
                    "edad": edad_nueva,
                    "pais": pais_nuevo,
                    "espn_id": match.get("espn_id") or "",
                })

            jugadores_finales.append({
                "nombre": nombre,
                "altura": int(j.get("altura") or 0),
                "posicion": j.get("posicion") or "M",
                "club": club_nuevo,
                "liga": liga_nueva,
                "competicion": liga_nueva,
                "edad": edad_nueva,
                "pais": pais_nuevo,
                "estado": "actualizado_espn",
                "espn_id": match.get("espn_id") or "",
            })
        else:
            no_encontrados.append({
                "nombre": nombre,
                "club_base": j.get("club_base") or "Sin datos",
                "liga_base": j.get("liga_base") or "Sin datos",
            })

            jugadores_finales.append({
                "nombre": nombre,
                "altura": int(j.get("altura") or 0),
                "posicion": j.get("posicion") or "M",
                "club": j.get("club_base") or "Sin datos",
                "liga": j.get("liga_base") or "Sin datos",
                "competicion": j.get("liga_base") or "Sin datos",
                "edad": 0,
                "pais": "Sin datos",
                "estado": "no_encontrado_espn",
                "espn_id": "",
            })

    elapsed = round(time.time() - t0, 1)

    payload = {
        "fuente": "jugadores_base.json curado + ESPN rosters",
        "modo": "solo_actualiza_club_liga_edad_pais",
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "total": len(jugadores_finales),
        "base_detectados": len(base),
        "tiempo_segundos": elapsed,
        "reglas": {
            "mantiene_manual": ["nombre", "altura", "posicion"],
            "actualiza_espn": ["club", "liga", "edad", "pais"],
        },
        "actualizaciones": actualizaciones,
        "no_encontrados": no_encontrados,
        "equipos_no_encontrados": equipos_no_encontrados,
        "errores_base": errores_base[:100],
        "jugadores": jugadores_finales,
    }

    OUTPUT_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("\n" + "═" * 60)
    print(f"✅ Guardado: {OUTPUT_FILE}")
    print(f"Jugadores finales: {payload['total']}")
    print(f"Actualizaciones club/liga detectadas: {len(actualizaciones)}")
    print(f"No encontrados en ESPN: {len(no_encontrados)}")
    print(f"Tiempo: {elapsed}s")

if __name__ == "__main__":
    main()
