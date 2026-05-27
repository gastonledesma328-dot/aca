import json
import os
import re
import time
import unicodedata
from datetime import datetime, timezone
from urllib.parse import urlencode

import requests

OUTPUT_FILE = "data/competiciones.json"
PUBLIC_OUTPUT_FILE = "public/data/competiciones.json"
SEASON = os.getenv("ESPN_SEASON", "2026")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json,text/plain,*/*",
    "Referer": "https://www.espn.com.ar/futbol/",
}

COMPETICIONES = [
    {"id": "liga-profesional", "grupo": "Argentina", "nombre": "Liga Profesional", "nombre_largo": "Liga Profesional Argentina", "slug": "arg.1", "pais": "Argentina", "destacado": True},
    {"id": "primera-nacional", "grupo": "Argentina", "nombre": "Primera Nacional", "nombre_largo": "Primera Nacional Argentina", "slug": "arg.2", "pais": "Argentina", "destacado": True},
    {"id": "copa-argentina", "grupo": "Argentina", "nombre": "Copa Argentina", "nombre_largo": "Copa Argentina", "slug": "arg.copa", "pais": "Argentina", "destacado": True},

    {"id": "libertadores", "grupo": "Internacional", "nombre": "Libertadores", "nombre_largo": "Copa Libertadores", "slug": "conmebol.libertadores", "pais": "CONMEBOL", "destacado": True},
    {"id": "sudamericana", "grupo": "Internacional", "nombre": "Sudamericana", "nombre_largo": "Copa Sudamericana", "slug": "conmebol.sudamericana", "pais": "CONMEBOL", "destacado": True},
    {"id": "champions", "grupo": "Internacional", "nombre": "Champions", "nombre_largo": "UEFA Champions League", "slug": "uefa.champions", "pais": "Europa", "destacado": True},
    {"id": "europa-league", "grupo": "Internacional", "nombre": "Europa League", "nombre_largo": "UEFA Europa League", "slug": "uefa.europa", "pais": "Europa"},
    {"id": "conference-league", "grupo": "Internacional", "nombre": "Conference League", "nombre_largo": "UEFA Conference League", "slug": "uefa.europa.conf", "pais": "Europa"},
    {"id": "mundial-clubes", "grupo": "Internacional", "nombre": "Mundial de Clubes", "nombre_largo": "Mundial de Clubes FIFA", "slug": "fifa.cwc", "pais": "FIFA", "destacado": True},
    {"id": "eliminatorias-conmebol", "grupo": "Selecciones", "nombre": "Eliminatorias Conmebol", "nombre_largo": "Eliminatorias CONMEBOL", "slug": "fifa.worldq.conmebol", "pais": "CONMEBOL", "destacado": True},
    {"id": "eliminatorias-uefa", "grupo": "Selecciones", "nombre": "Eliminatorias UEFA", "nombre_largo": "Eliminatorias UEFA", "slug": "fifa.worldq.uefa", "pais": "Europa"},
    {"id": "mundial", "grupo": "Selecciones", "nombre": "Mundial", "nombre_largo": "Mundial FIFA", "slug": "fifa.world", "pais": "FIFA", "destacado": True},

    {"id": "premier-league", "grupo": "Inglaterra", "nombre": "Premier League", "nombre_largo": "Premier League", "slug": "eng.1", "pais": "Inglaterra"},
    {"id": "laliga", "grupo": "España", "nombre": "LaLiga", "nombre_largo": "LaLiga", "slug": "esp.1", "pais": "España"},
    {"id": "serie-a", "grupo": "Italia", "nombre": "Serie A", "nombre_largo": "Serie A", "slug": "ita.1", "pais": "Italia"},
    {"id": "bundesliga", "grupo": "Alemania", "nombre": "Bundesliga", "nombre_largo": "Bundesliga", "slug": "ger.1", "pais": "Alemania"},
    {"id": "primeira-liga", "grupo": "Portugal", "nombre": "Primeira Liga", "nombre_largo": "Primeira Liga", "slug": "por.1", "pais": "Portugal"},
    {"id": "ligue-1", "grupo": "Francia", "nombre": "Ligue 1", "nombre_largo": "Ligue 1", "slug": "fra.1", "pais": "Francia"},
    {"id": "brasileirao", "grupo": "Brasil", "nombre": "Brasileirão", "nombre_largo": "Brasileirão Serie A", "slug": "bra.1", "pais": "Brasil"},
    {"id": "uruguay", "grupo": "Uruguay", "nombre": "Primera división", "nombre_largo": "Campeonato Uruguayo", "slug": "uru.1", "pais": "Uruguay"},
    {"id": "paraguay", "grupo": "Paraguay", "nombre": "Copa de primera", "nombre_largo": "Liga de Paraguay", "slug": "par.1", "pais": "Paraguay"},
    {"id": "colombia", "grupo": "Colombia", "nombre": "Liga BetPlay", "nombre_largo": "Primera A Colombia", "slug": "col.1", "pais": "Colombia"},
    {"id": "chile", "grupo": "Chile", "nombre": "Primera división", "nombre_largo": "Primera División Chile", "slug": "chi.1", "pais": "Chile"},
    {"id": "mexico", "grupo": "México", "nombre": "Liga MX", "nombre_largo": "Liga MX", "slug": "mex.1", "pais": "México"},
    {"id": "mls", "grupo": "EEUU", "nombre": "MLS", "nombre_largo": "Major League Soccer", "slug": "usa.1", "pais": "Estados Unidos"},
]


def ahora_iso():
    return datetime.now(timezone.utc).isoformat()


def slug_text(texto):
    texto = str(texto or "").lower().strip()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = re.sub(r"[^a-z0-9]+", "-", texto)
    return texto.strip("-")


def get_json(url, params=None, tries=2):
    final_url = url
    if params:
        final_url = f"{url}?{urlencode(params)}"

    for intento in range(tries):
        try:
            response = requests.get(final_url, headers=HEADERS, timeout=25)
            print(f"🌐 {response.status_code} {final_url}")
            if response.ok:
                return response.json()
        except Exception as error:
            print(f"⚠️ {error}")

        if intento + 1 < tries:
            time.sleep(0.8)

    return None


def team_logo(team):
    logos = team.get("logos") or []
    if isinstance(logos, list) and logos:
        return logos[0].get("href") or ""
    return f"https://a.espncdn.com/i/teamlogos/soccer/500/{team.get('id')}.png" if team.get("id") else ""


def parse_team(team):
    if not isinstance(team, dict):
        return None
    return {
        "id": str(team.get("id") or ""),
        "uid": team.get("uid") or "",
        "nombre": team.get("displayName") or team.get("name") or team.get("shortDisplayName") or "Equipo",
        "nombre_corto": team.get("shortDisplayName") or team.get("abbreviation") or team.get("name") or "",
        "abreviatura": team.get("abbreviation") or "",
        "slug": team.get("slug") or slug_text(team.get("displayName") or team.get("name")),
        "logo": team_logo(team),
        "color": team.get("color") or "",
    }


def cargar_equipos(league_slug):
    data = get_json(f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams")
    equipos = []

    try:
        teams = data["sports"][0]["leagues"][0].get("teams") or []
        for item in teams:
            team = parse_team(item.get("team") or item)
            if team:
                equipos.append(team)
    except Exception:
        pass

    return equipos


def extraer_entries_standings(data):
    entries = []

    def walk(obj, grupo=""):
        if isinstance(obj, dict):
            nombre_grupo = obj.get("name") or obj.get("displayName") or obj.get("abbreviation") or grupo
            if isinstance(obj.get("entries"), list):
                for entry in obj.get("entries"):
                    if isinstance(entry, dict):
                        entry = dict(entry)
                        entry["_grupo"] = nombre_grupo
                        entries.append(entry)
            for value in obj.values():
                walk(value, nombre_grupo)
        elif isinstance(obj, list):
            for item in obj:
                walk(item, grupo)

    walk(data)
    return entries


def stat_value(stat):
    if not isinstance(stat, dict):
        return "-"
    for key in ["displayValue", "value", "summary", "total"]:
        value = stat.get(key)
        if value not in [None, ""]:
            if isinstance(value, float) and value.is_integer():
                return str(int(value))
            return str(value)
    return "-"


def stat_name(stat):
    return slug_text(stat.get("name") or stat.get("displayName") or stat.get("shortDisplayName") or stat.get("abbreviation") or "")


def map_stats(entry):
    salida = {
        "posicion": str(entry.get("rank") or "-"),
        "pj": "-",
        "g": "-",
        "e": "-",
        "p": "-",
        "gf": "-",
        "gc": "-",
        "dg": "-",
        "pts": "-",
        "racha": "-",
    }

    aliases = {
        "posicion": ["rank", "ranking", "position", "posicion"],
        "pj": ["gamesplayed", "games-played", "played", "partidos", "gp", "j"],
        "g": ["wins", "win", "ganados", "w"],
        "e": ["ties", "draws", "empates", "empatados", "d"],
        "p": ["losses", "lost", "perdidos", "l"],
        "gf": ["pointsfor", "goalsfor", "golesfavor", "gf", "f"],
        "gc": ["pointsagainst", "goalsagainst", "golescontra", "ga", "a"],
        "dg": ["pointdifferential", "goaldifference", "diferenciagol", "gd"],
        "pts": ["points", "puntos", "pts"],
        "racha": ["streak", "racha"],
    }

    for stat in entry.get("stats") or []:
        name = stat_name(stat)
        value = stat_value(stat)
        for key, names in aliases.items():
            if name in names:
                salida[key] = value

    return salida


def entry_team(entry):
    team = entry.get("team") or {}
    if not isinstance(team, dict):
        return {}

    if team.get("displayName") or team.get("name"):
        return team

    return {
        "id": str(team.get("id") or ""),
        "displayName": team.get("name") or "Equipo",
    }


def cargar_tabla(league_slug):
    urls = [
        f"https://site.web.api.espn.com/apis/v2/sports/soccer/{league_slug}/standings",
        f"https://site.api.espn.com/apis/v2/sports/soccer/{league_slug}/standings",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{league_slug}/standings",
    ]

    for url in urls:
        data = get_json(url)
        if not data:
            continue

        entries = extraer_entries_standings(data)
        tabla = []
        for index, entry in enumerate(entries, start=1):
            team = parse_team(entry_team(entry)) or {}
            stats = map_stats(entry)
            if stats.get("posicion") == "-":
                stats["posicion"] = str(index)
            tabla.append({
                "grupo": entry.get("_grupo") or "General",
                "equipo": team,
                "stats": stats,
            })

        if tabla:
            return tabla

    return []


def parse_competitor(comp):
    team = parse_team(comp.get("team") or {}) or {}
    return {
        "equipo": team,
        "localia": comp.get("homeAway") or "",
        "marcador": str(comp.get("score")) if comp.get("score") is not None else "",
        "ganador": comp.get("winner") is True,
    }


def parse_event(event):
    comp = (event.get("competitions") or [{}])[0]
    competitors = comp.get("competitors") or []
    local = next((c for c in competitors if c.get("homeAway") == "home"), competitors[0] if competitors else {})
    visitante = next((c for c in competitors if c.get("homeAway") == "away"), competitors[-1] if competitors else {})
    status = (event.get("status") or {}).get("type") or {}

    return {
        "id": str(event.get("id") or ""),
        "nombre": event.get("name") or event.get("shortName") or "",
        "fecha": event.get("date") or "",
        "estado": status.get("description") or status.get("name") or "",
        "estado_tipo": status.get("state") or "",
        "completado": status.get("completed") is True,
        "local": parse_competitor(local),
        "visitante": parse_competitor(visitante),
        "url": ((event.get("links") or [{}])[0] or {}).get("href") or "",
    }


def cargar_partidos(league_slug, limit=14):
    data = get_json(f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/scoreboard", {"limit": "300"})
    events = data.get("events") if isinstance(data, dict) else []
    partidos = [parse_event(e) for e in events or []]

    def sort_key(p):
        return p.get("fecha") or ""

    finalizados = [p for p in partidos if p.get("completado") or p.get("estado_tipo") == "post"]
    proximos = [p for p in partidos if not (p.get("completado") or p.get("estado_tipo") == "post")]

    finalizados.sort(key=sort_key, reverse=True)
    proximos.sort(key=sort_key)

    return {
        "ultimos": finalizados[:limit],
        "proximos": proximos[:limit],
        "total_scoreboard": len(partidos),
    }


def obtener_info_liga(config):
    slug = config["slug"]
    print(f"🏆 Cargando {config['nombre_largo']} ({slug})")

    equipos = cargar_equipos(slug)
    tabla = cargar_tabla(slug)
    partidos = cargar_partidos(slug)

    return {
        **config,
        "season": SEASON,
        "actualizado": ahora_iso(),
        "fuente": "ESPN API",
        "api": {
            "teams": f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/teams",
            "scoreboard": f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard",
            "standings": f"https://site.web.api.espn.com/apis/v2/sports/soccer/{slug}/standings",
        },
        "resumen": {
            "equipos": len(equipos),
            "posiciones": len(tabla),
            "partidos_scoreboard": partidos.get("total_scoreboard", 0),
            "ultimos": len(partidos.get("ultimos", [])),
            "proximos": len(partidos.get("proximos", [])),
        },
        "equipos": equipos,
        "tabla": tabla,
        "partidos": partidos,
    }


def main():
    os.makedirs("data", exist_ok=True)
    os.makedirs("public/data", exist_ok=True)

    ligas = []
    errores = []

    for config in COMPETICIONES:
        try:
            ligas.append(obtener_info_liga(config))
        except Exception as error:
            print(f"❌ Error cargando {config['slug']}: {error}")
            errores.append({"slug": config.get("slug"), "nombre": config.get("nombre"), "error": str(error)})

    payload = {
        "fuente": "ESPN API",
        "actualizado": ahora_iso(),
        "season": SEASON,
        "total": len(ligas),
        "errores": errores,
        "competiciones": ligas,
    }

    for path in [OUTPUT_FILE, PUBLIC_OUTPUT_FILE]:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"✅ Generado {path}")


if __name__ == "__main__":
    main()
