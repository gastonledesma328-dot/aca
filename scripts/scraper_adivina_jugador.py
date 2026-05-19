# scraper_lista_curada_solo_actualiza_club_liga_edad.py
# Lee /adivinajugador/jugadores_base.json y genera /adivinajugador/jugadores.json
# Regla principal:
# - NO cambia nombre, altura ni posicion manual.
# - SOLO actualiza club, liga y edad cuando encuentra el jugador en ESPN.
# - Si no lo encuentra, conserva club/liga base y la edad anterior si existe.

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
CACHE_FILE = Path("adivinajugador/jugadores_espn_cache.json")

REQUEST_TIMEOUT = 25
SLEEP_BETWEEN_REQUESTS = 0.04
MAX_RETRIES = 3

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
    "Referer": "https://www.espn.com/",
    "Origin": "https://www.espn.com",
}

# Ligas donde se busca el club actual del jugador.
# Si un jugador se va fuera de estas ligas, no se pisa: queda con club/liga base y estado no_encontrado.
LIGAS = {
    "Premier League": "eng.1",
    "LaLiga": "esp.1",
    "Serie A": "ita.1",
    "Bundesliga": "ger.1",
    "Ligue 1": "fra.1",
    "Brasileirão": "bra.1",
    "Liga Profesional Argentina": "arg.1",
    "Eredivisie": "ned.1",
    "Liga BetPlay": "col.1",
    "MLS": "usa.1",
    "Saudi Pro League": "ksa.1",
    "Liga Portugal": "por.1",
    "Süper Lig": "tur.1",
    "Liga MX": "mex.1",
}

POS_MAP = {
    "GK": "G", "G": "G", "GOALKEEPER": "G",
    "DF": "D", "D": "D", "DEFENDER": "D",
    "MF": "M", "M": "M", "MIDFIELDER": "M",
    "FW": "F", "F": "F", "FORWARD": "F", "ATTACKER": "F",
}


def slugify(text: Any) -> str:
    text = str(text or "")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = text.replace("ø", "o").replace("đ", "d").replace("ß", "ss")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def normalizar_nombre_para_match(nombre: Any) -> str:
    s = slugify(nombre)
    # Quita sufijos comunes que ESPN puede tener distinto.
    s = re.sub(r"\b(jr|junior|sr|iii|ii)\b", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalizar_posicion(pos: Any) -> str:
    p = str(pos or "").strip().upper()
    return POS_MAP.get(p, p if p in {"G", "D", "M", "F"} else "M")


def get_json(url: str) -> Any:
    for attempt in range(MAX_RETRIES):
        try:
            r = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            if r.status_code == 200:
                return r.json()
            if r.status_code in (429, 503):
                wait = 5 * (attempt + 1)
                print(f"Rate limit {r.status_code}. Esperando {wait}s")
                time.sleep(wait)
                continue
            if r.status_code == 404:
                return None
        except Exception as exc:
            print(f"Error HTTP: {exc}")
        time.sleep(1.2 * (attempt + 1))
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
    uid = str(obj.get("uid") or "")
    return str(
        obj.get("id")
        or (uid.split(":")[-1] if uid else "")
        or extract_id_from_ref(obj.get("$ref"))
        or extract_id_from_ref(obj.get("href"))
        or ""
    ).strip()


def parse_age(value: Any) -> int:
    try:
        n = int(str(value or "").split(".")[0])
        if 13 <= n <= 55:
            return n
    except Exception:
        pass
    return 0


def parse_age_from_dob(dob: Any) -> int:
    if not dob:
        return 0
    try:
        raw = str(dob)[:10]
        y, m, d = [int(x) for x in raw.split("-")]
        today = datetime.now(timezone.utc).date()
        age = today.year - y - ((today.month, today.day) < (m, d))
        if 13 <= age <= 55:
            return age
    except Exception:
        pass
    return 0


def extraer_edad(athlete: dict) -> int:
    edad = parse_age(athlete.get("age"))
    if edad:
        return edad
    return parse_age_from_dob(
        athlete.get("dateOfBirth")
        or athlete.get("dob")
        or get_nested(athlete, "birthDate")
    )


def cargar_base() -> list[dict]:
    data = json.loads(BASE_FILE.read_text(encoding="utf-8"))
    jugadores: list[dict] = []

    # Formato 1: lista plana [{nombre, altura, posicion, club_base, liga_base}]
    if isinstance(data, list) and all(isinstance(x, dict) and "nombre" in x for x in data):
        for j in data:
            jugadores.append({
                **j,
                "nombre": str(j.get("nombre", "")).strip(),
                "altura": int(j.get("altura") or 0),
                "posicion": normalizar_posicion(j.get("posicion")),
                "club_base": j.get("club_base") or j.get("club") or "Sin datos",
                "liga_base": j.get("liga_base") or j.get("liga") or "Sin datos",
            })
        return dedupe_base(jugadores)

    # Formato 2: lista por ligas/equipos/titulares/suplentes
    if isinstance(data, list):
        for liga_obj in data:
            liga = liga_obj.get("liga", "Sin datos") if isinstance(liga_obj, dict) else "Sin datos"
            for equipo_obj in liga_obj.get("equipos", []) if isinstance(liga_obj, dict) else []:
                equipo = equipo_obj.get("equipo", "Sin datos")
                for grupo in ("titulares", "suplentes"):
                    for j in equipo_obj.get(grupo, []) or []:
                        if not isinstance(j, dict) or not j.get("nombre"):
                            continue
                        jugadores.append({
                            "nombre": str(j.get("nombre", "")).strip(),
                            "altura": int(j.get("altura") or 0),
                            "posicion": normalizar_posicion(j.get("posicion")),
                            "club_base": equipo,
                            "liga_base": liga,
                            "rol_base": grupo,
                        })
        return dedupe_base(jugadores)

    raise ValueError("jugadores_base.json debe ser una lista plana o una lista por ligas/equipos.")


def dedupe_base(jugadores: list[dict]) -> list[dict]:
    out: dict[str, dict] = {}
    for j in jugadores:
        nombre = j.get("nombre")
        if not nombre:
            continue
        key = normalizar_nombre_para_match(nombre)
        if key not in out:
            out[key] = j
            continue
        # Si está duplicado, conserva el primero, pero completa datos base si faltaban.
        cur = out[key]
        if not cur.get("club_base") or cur.get("club_base") == "Sin datos":
            cur["club_base"] = j.get("club_base")
        if not cur.get("liga_base") or cur.get("liga_base") == "Sin datos":
            cur["liga_base"] = j.get("liga_base")
        if not cur.get("altura") and j.get("altura"):
            cur["altura"] = j.get("altura")
        if not cur.get("posicion") and j.get("posicion"):
            cur["posicion"] = j.get("posicion")
    return list(out.values())


def cargar_cache() -> dict:
    if not CACHE_FILE.exists():
        return {}
    try:
        data = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def guardar_cache(cache: dict) -> None:
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def cargar_equipos_liga(league_slug: str) -> list[dict]:
    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams?limit=500",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{league_slug}/teams?limit=500&lang=en&region=us",
    ]
    for url in urls:
        data = get_json(url)
        time.sleep(SLEEP_BETWEEN_REQUESTS)
        if not isinstance(data, dict):
            continue

        raw = []
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
            tid = str(team.get("id") or extract_id_from_ref(team.get("$ref")) or "").strip()
            name = team.get("displayName") or team.get("name") or team.get("shortDisplayName")
            if tid and name:
                equipos.append({"id": tid, "nombre": name})
        if equipos:
            return equipos
    return []


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


def crear_indice_espn() -> dict[str, list[dict]]:
    indice: dict[str, list[dict]] = {}
    total = 0

    for liga, slug in LIGAS.items():
        print(f"\nLiga: {liga} ({slug})")
        equipos = cargar_equipos_liga(slug)
        print(f"  Equipos ESPN encontrados: {len(equipos)}")

        for equipo in equipos:
            roster = cargar_roster(slug, equipo["id"])
            atletas = list(iter_athletes(roster))
            if not atletas:
                continue
            total += len(atletas)

            for athlete in atletas:
                nombre = athlete.get("displayName") or athlete.get("fullName") or athlete.get("name")
                if not nombre:
                    continue
                key = normalizar_nombre_para_match(nombre)
                item = {
                    "nombre_espn": nombre,
                    "espn_id": extract_athlete_id(athlete),
                    "club": equipo["nombre"],
                    "liga": liga,
                    "edad": extraer_edad(athlete),
                }
                indice.setdefault(key, []).append(item)

    print(f"\nAtletas indexados desde ESPN: {total}")
    return indice


def elegir_mejor_match(jugador_base: dict, candidatos: list[dict]) -> dict | None:
    if not candidatos:
        return None

    club_base = slugify(jugador_base.get("club_base"))
    liga_base = slugify(jugador_base.get("liga_base"))

    # Si hay varios nombres iguales, prioriza el que coincide con club/liga base.
    def score(c: dict) -> int:
        s = 0
        if club_base and slugify(c.get("club")) == club_base:
            s += 50
        if liga_base and slugify(c.get("liga")) == liga_base:
            s += 20
        if c.get("edad"):
            s += 5
        if c.get("espn_id"):
            s += 5
        return s

    return sorted(candidatos, key=score, reverse=True)[0]


def main() -> None:
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    base = cargar_base()
    cache = cargar_cache()
    print(f"Jugadores base: {len(base)}")

    indice = crear_indice_espn()

    jugadores_finales = []
    actualizados = []
    no_encontrados = []

    for j in base:
        key = normalizar_nombre_para_match(j.get("nombre"))
        match = elegir_mejor_match(j, indice.get(key, []))

        # No se toca nombre, altura ni posicion manual.
        final = {
            "nombre": j.get("nombre"),
            "altura": int(j.get("altura") or 0),
            "posicion": normalizar_posicion(j.get("posicion")),
            "club_base": j.get("club_base") or "Sin datos",
            "liga_base": j.get("liga_base") or "Sin datos",
            "rol_base": j.get("rol_base", ""),
        }

        edad_anterior = int(j.get("edad") or cache.get(key, {}).get("edad") or 0)
        club_anterior = j.get("club") or j.get("club_base") or "Sin datos"
        liga_anterior = j.get("liga") or j.get("liga_base") or "Sin datos"

        if match:
            final["club"] = match.get("club") or club_anterior
            final["liga"] = match.get("liga") or liga_anterior
            final["edad"] = int(match.get("edad") or edad_anterior or 0)
            final["estado"] = "actualizado_espn"
            final["espn_id"] = match.get("espn_id") or cache.get(key, {}).get("espn_id", "")

            cambios = {}
            if final["club"] != club_anterior:
                cambios["club"] = {"antes": club_anterior, "ahora": final["club"]}
            if final["liga"] != liga_anterior:
                cambios["liga"] = {"antes": liga_anterior, "ahora": final["liga"]}
            if final["edad"] and final["edad"] != edad_anterior:
                cambios["edad"] = {"antes": edad_anterior, "ahora": final["edad"]}
            if cambios:
                actualizados.append({"nombre": final["nombre"], "cambios": cambios})

            cache[key] = {
                "espn_id": final.get("espn_id", ""),
                "club": final["club"],
                "liga": final["liga"],
                "edad": final["edad"],
            }
        else:
            # Si no lo encuentra, NO inventa club/liga. Conserva base.
            final["club"] = club_anterior
            final["liga"] = liga_anterior
            final["edad"] = edad_anterior
            final["estado"] = "no_encontrado_espn"
            final["espn_id"] = cache.get(key, {}).get("espn_id", "")
            no_encontrados.append(final["nombre"])

        jugadores_finales.append(final)

    guardar_cache(cache)

    payload = {
        "fuente": "jugadores_base.json + ESPN rosters; solo actualiza club, liga y edad",
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "total": len(jugadores_finales),
        "regla": "nombre, altura y posicion son manuales; el scraper solo cambia club, liga y edad si ESPN devuelve otro dato",
        "ligas_buscadas": list(LIGAS.keys()),
        "actualizados": actualizados,
        "no_encontrados_total": len(no_encontrados),
        "no_encontrados": no_encontrados[:100],
        "jugadores": jugadores_finales,
    }

    OUTPUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\nListo")
    print(f"Guardado: {OUTPUT_FILE}")
    print(f"Total jugadores: {len(jugadores_finales)}")
    print(f"Actualizados con cambios: {len(actualizados)}")
    print(f"No encontrados ESPN: {len(no_encontrados)}")


if __name__ == "__main__":
    main()
