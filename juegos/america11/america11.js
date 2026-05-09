import json
import os
import re
import time
import unicodedata
from datetime import datetime, timezone

import requests

OUTPUT_FILE = "data/jugadores_america.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.espn.com.ar/",
}

# Empezamos con las ligas más estables. Después podemos sumar más.
AMERICA_LEAGUES = [
    {
        "slug": "arg.1",
        "nombre": "Liga Profesional Argentina",
        "pais_club": "Argentina",
    },
    {
        "slug": "bra.1",
        "nombre": "Brasileirão Serie A",
        "pais_club": "Brasil",
    },
    {
        "slug": "mex.1",
        "nombre": "Liga MX",
        "pais_club": "México",
    },
    {
        "slug": "usa.1",
        "nombre": "MLS",
        "pais_club": "Estados Unidos",
    },
    {
        "slug": "uru.1",
        "nombre": "Primera División Uruguay",
        "pais_club": "Uruguay",
    },
    {
        "slug": "chi.1",
        "nombre": "Primera División Chile",
        "pais_club": "Chile",
    },
    {
        "slug": "col.1",
        "nombre": "Primera A Colombia",
        "pais_club": "Colombia",
    },
]

POSICIONES_ESPECIFICAS = {
    # Arqueros
    "goalkeeper": "GK",
    "portero": "GK",
    "arquero": "GK",

    # Defensores
    "defender": "CB",
    "defensa": "CB",
    "center back": "CB",
    "centre back": "CB",
    "central": "CB",
    "left back": "LB",
    "lateral izquierdo": "LB",
    "right back": "RB",
    "lateral derecho": "RB",

    # Mediocampistas
    "midfielder": "CM",
    "mediocampista": "CM",
    "volante": "CM",
    "defensive midfielder": "CDM",
    "attacking midfielder": "CAM",

    # Delanteros
    "forward": "ST",
    "delantero": "ST",
    "attacker": "ST",
    "striker": "ST",
    "winger": "RW",
    "left wing": "LW",
    "right wing": "RW",
}

def slugify(texto):
    texto = str(texto or "").strip().lower()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = re.sub(r"[^a-z0-9]+", "-", texto)
    texto = re.sub(r"-+", "-", texto)
    return texto.strip("-")

def normalizar_texto(texto):
    texto = str(texto or "").strip().lower()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = re.sub(r"\s+", " ", texto)
    return texto

def get_json(url, retries=2, sleep=0.6):
    for intento in range(retries + 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=25)
            print(f"🌐 {r.status_code} {url}")

            if r.ok:
                return r.json()

            if intento < retries:
                time.sleep(sleep)

        except Exception as e:
            print(f"⚠️ Error leyendo URL: {url} / {e}")

            if intento < retries:
                time.sleep(sleep)

    return None

def extraer_logo(team):
    logos = team.get("logos") or []

    if isinstance(logos, list) and logos:
        return logos[0].get("href") or ""

    if team.get("logo"):
        return team.get("logo")

    return ""

def extraer_equipos(data):
    equipos = []

    raw_teams = data.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", [])

    if not raw_teams:
        raw_teams = data.get("teams") or []

    for item in raw_teams:
        team = item.get("team") if isinstance(item, dict) else None

        if not isinstance(team, dict):
            team = item if isinstance(item, dict) else {}

        team_id = str(team.get("id") or "").strip()
        nombre = (
            team.get("displayName")
            or team.get("name")
            or team.get("shortDisplayName")
            or ""
        ).strip()

        if not team_id or not nombre:
            continue

        equipos.append({
            "id": team_id,
            "nombre": nombre,
            "logo": extraer_logo(team),
        })

    return equipos

def normalizar_posicion(position_obj):
    if not isinstance(position_obj, dict):
        return "CM", "mediocampistas"

    texto = normalizar_texto(
        position_obj.get("displayName")
        or position_obj.get("name")
        or position_obj.get("abbreviation")
        or ""
    )

    abreviatura = str(position_obj.get("abbreviation") or "").upper().strip()

    if abreviatura in ["GK", "G"]:
        return "GK", "arqueros"

    if abreviatura in ["CB", "DF", "D", "DEF"]:
        return "CB", "defensores"

    if abreviatura in ["LB"]:
        return "LB", "defensores"

    if abreviatura in ["RB"]:
        return "RB", "defensores"

    if abreviatura in ["CM", "MF", "M", "MID"]:
        return "CM", "mediocampistas"

    if abreviatura in ["CDM", "DM"]:
        return "CDM", "mediocampistas"

    if abreviatura in ["CAM", "AM"]:
        return "CAM", "mediocampistas"

    if abreviatura in ["LW"]:
        return "LW", "delanteros"

    if abreviatura in ["RW"]:
        return "RW", "delanteros"

    if abreviatura in ["ST", "FW", "F", "ATT"]:
        return "ST", "delanteros"

    for key, pos in POSICIONES_ESPECIFICAS.items():
        if key in texto:
            if pos == "GK":
                return pos, "arqueros"
            if pos in ["CB", "LB", "RB"]:
                return pos, "defensores"
            if pos in ["CM", "CDM", "CAM"]:
                return pos, "mediocampistas"
            return pos, "delanteros"

    return "CM", "mediocampistas"

def extraer_athletes(data):
    athletes = data.get("athletes") or []

    salida = []

    for group in athletes:
        if not isinstance(group, dict):
            continue

        if isinstance(group.get("items"), list):
            for item in group.get("items") or []:
                if isinstance(item, dict):
                    salida.append(item.get("athlete") or item)
        else:
            salida.append(group)

    return [a for a in salida if isinstance(a, dict)]

def cargar_plantel(league_slug, liga_nombre, pais_club, equipo):
    team_id = equipo["id"]
    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams/{team_id}/roster"
    data = get_json(url)

    if not data:
        return []

    jugadores = []

    for athlete in extraer_athletes(data):
        nombre = (
            athlete.get("displayName")
            or athlete.get("fullName")
            or athlete.get("name")
            or ""
        ).strip()

        if not nombre:
            continue

        position_obj = athlete.get("position") or {}
        posicion, categoria = normalizar_posicion(position_obj)

        jugador_id = str(athlete.get("id") or "").strip()

        jugadores.append({
            "id": jugador_id,
            "nombre": nombre,
            "slug": slugify(nombre),
            "posicion": posicion,
            "categoria": categoria,
            "club": equipo["nombre"],
            "club_id": team_id,
            "club_logo": equipo.get("logo", ""),
            "liga": liga_nombre,
            "league_slug": league_slug,
            "pais_club": pais_club,
            "edad": athlete.get("age") or "",
            "altura": athlete.get("displayHeight") or athlete.get("height") or "",
            "fuente": "ESPN",
        })

    return jugadores

def cargar_liga(liga):
    league_slug = liga["slug"]
    liga_nombre = liga["nombre"]
    pais_club = liga["pais_club"]

    print(f"\n🏆 Liga: {liga_nombre} ({league_slug})")

    teams_url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams"
    data = get_json(teams_url)

    if not data:
        print(f"⚠️ No se pudo leer equipos de {liga_nombre}")
        return []

    equipos = extraer_equipos(data)

    print(f"✅ Equipos encontrados: {len(equipos)}")

    jugadores_liga = []

    for idx, equipo in enumerate(equipos, start=1):
        print(f"   👕 {idx}/{len(equipos)} {equipo['nombre']}")
        jugadores = cargar_plantel(league_slug, liga_nombre, pais_club, equipo)
        print(f"      Jugadores: {len(jugadores)}")
        jugadores_liga.extend(jugadores)
        time.sleep(0.35)

    return jugadores_liga

def deduplicar_jugadores(jugadores):
    salida = []
    vistos = set()

    for jugador in jugadores:
        key = f"{jugador.get('slug')}::{jugador.get('club_id')}::{jugador.get('league_slug')}"

        if key in vistos:
            continue

        vistos.add(key)
        salida.append(jugador)

    return salida

def main():
    os.makedirs("data", exist_ok=True)

    todos = []

    for liga in AMERICA_LEAGUES:
        jugadores_liga = cargar_liga(liga)
        todos.extend(jugadores_liga)

    todos = deduplicar_jugadores(todos)

    todos.sort(key=lambda j: (
        j.get("pais_club", ""),
        j.get("liga", ""),
        j.get("club", ""),
        j.get("nombre", ""),
    ))

    payload = {
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "total": len(todos),
        "ligas": AMERICA_LEAGUES,
        "jugadores": todos,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Generado {OUTPUT_FILE}")
    print(f"👥 Total jugadores: {len(todos)}")

if __name__ == "__main__":
    main()
