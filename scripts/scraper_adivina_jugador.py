import json
import re
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import requests

OUTPUT_FILE = Path("adivinajugador/jugadores.json")
TIMEOUT = 25
SLEEP_BETWEEN_REQUESTS = 0.25
MAX_JUGADORES_POR_CLUB = 36
MIN_EDAD = 18
MAX_EDAD = 45

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.espn.com/",
}

# Objetivo: que el juego tenga jugadores famosos y actuales.
# Se agregan ligas necesarias para cracks que no están en Europa top:
# MLS, Saudi Pro League, Liga Portugal, Turquía, Liga MX y más clubes de Brasil.
LEAGUES = [
    {
        "slug": "eng.1",
        "competicion": "Premier League",
        "teams": [
            ["Arsenal"],
            ["Aston Villa"],
            ["Chelsea"],
            ["Liverpool"],
            ["Manchester City", "Man City"],
            ["Manchester United", "Man United"],
            ["Newcastle United", "Newcastle"],
            ["Tottenham Hotspur", "Tottenham", "Spurs"],
        ],
    },
    {
        "slug": "esp.1",
        "competicion": "LaLiga",
        "teams": [
            ["Athletic Club", "Athletic Bilbao"],
            ["Atlético Madrid", "Atletico Madrid"],
            ["Barcelona", "FC Barcelona"],
            ["Real Betis", "Betis"],
            ["Real Madrid"],
            ["Real Sociedad"],
            ["Sevilla"],
            ["Villarreal"],
        ],
    },
    {
        "slug": "ita.1",
        "competicion": "Serie A",
        "teams": [
            ["AC Milan", "Milan"],
            ["AS Roma", "Roma"],
            ["Atalanta"],
            ["Fiorentina"],
            ["Internazionale", "Inter", "Inter Milan"],
            ["Juventus"],
            ["Lazio"],
            ["Napoli"],
        ],
    },
    {
        "slug": "ger.1",
        "competicion": "Bundesliga",
        "teams": [
            ["Bayer Leverkusen"],
            ["Bayern Munich", "Bayern München"],
            ["Borussia Dortmund", "Dortmund"],
            ["Eintracht Frankfurt"],
            ["RB Leipzig"],
            ["VfB Stuttgart", "Stuttgart"],
        ],
    },
    {
        "slug": "fra.1",
        "competicion": "Ligue 1",
        "teams": [
            ["Lens", "RC Lens"],
            ["Lille", "LOSC Lille"],
            ["Lyon", "Olympique Lyon"],
            ["Marseille", "Olympique Marseille"],
            ["Monaco", "AS Monaco"],
            ["Paris Saint-Germain", "PSG"],
        ],
    },
    {
        "slug": "bra.1",
        "competicion": "Brasileirão",
        "teams": [
            ["Atlético Mineiro", "Atletico Mineiro"],
            ["Botafogo"],
            ["Corinthians"],
            ["Cruzeiro"],
            ["Flamengo"],
            ["Fluminense"],
            ["Grêmio", "Gremio"],
            ["Internacional"],
            ["Palmeiras"],
            ["Santos"],
            ["São Paulo", "Sao Paulo"],
        ],
    },
    {
        "slug": "arg.1",
        "competicion": "Liga Profesional Argentina",
        "teams": [
            ["Boca Juniors"],
            ["Estudiantes de La Plata", "Estudiantes"],
            ["Independiente"],
            ["Racing Club"],
            ["River Plate"],
            ["San Lorenzo"],
            ["Vélez Sarsfield", "Velez"],
        ],
    },
    {
        "slug": "ned.1",
        "competicion": "Eredivisie",
        "teams": [
            ["Ajax Amsterdam", "Ajax"],
            ["AZ Alkmaar", "AZ"],
            ["FC Twente", "Twente"],
            ["Feyenoord Rotterdam", "Feyenoord"],
            ["PSV Eindhoven", "PSV"],
        ],
    },
    {
        "slug": "col.1",
        "competicion": "Liga BetPlay",
        "teams": [
            ["América de Cali", "America de Cali"],
            ["Atlético Junior", "Junior", "Junior FC"],
            ["Atlético Nacional", "Atletico Nacional"],
            ["Deportivo Cali"],
            ["Deportivo Pasto"],
            ["Independiente Medellín", "Independiente Medellin", "Medellin"],
            ["Millonarios"],
            ["Once Caldas"],
            ["Santa Fe", "Independiente Santa Fe"],
        ],
    },
    {
        "slug": "por.1",
        "competicion": "Liga Portugal",
        "teams": [
            ["Benfica", "SL Benfica"],
            ["FC Porto", "Porto"],
            ["Sporting CP", "Sporting Lisbon", "Sporting"],
            ["Braga", "SC Braga"],
        ],
    },
    {
        "slug": "usa.1",
        "competicion": "MLS",
        "teams": [
            ["Inter Miami CF", "Inter Miami"],
            ["LAFC", "Los Angeles FC"],
            ["LA Galaxy"],
            ["Atlanta United FC", "Atlanta United"],
            ["New York City FC", "NYCFC"],
        ],
    },
    {
        "slug": "ksa.1",
        "competicion": "Saudi Pro League",
        "teams": [
            ["Al Nassr", "Al-Nassr"],
            ["Al Hilal", "Al-Hilal"],
            ["Al Ittihad", "Al-Ittihad"],
            ["Al Ahli", "Al-Ahli"],
            ["Al Qadsiah", "Al-Qadsiah"],
        ],
    },
    {
        "slug": "tur.1",
        "competicion": "Süper Lig",
        "teams": [
            ["Besiktas", "Beşiktaş"],
            ["Fenerbahce", "Fenerbahçe"],
            ["Galatasaray"],
            ["Trabzonspor"],
        ],
    },
    {
        "slug": "mex.1",
        "competicion": "Liga MX",
        "teams": [
            ["América", "Club América", "Club America"],
            ["Cruz Azul"],
            ["Guadalajara", "Chivas"],
            ["Monterrey"],
            ["Tigres UANL", "Tigres"],
            ["Toluca"],
        ],
    },
]

# Si ESPN no encuentra un club o un jugador muy famoso queda afuera por error del roster,
# estos jugadores se agregan igual y luego se deduplican por nombre + club.
# Mantener solo jugadores actuales, no retirados.
FAMOUS_FALLBACK = [
    {
        "nombre": "Lionel Messi",
        "pais": "Argentina",
        "club": "Inter Miami CF",
        "liga": "MLS",
        "competicion": "MLS",
        "posicion": "F",
        "edad": 38,
        "altura": 170,
        "imagen": "https://a.espncdn.com/i/headshots/soccer/players/full/45843.png",
    },
    {
        "nombre": "Cristiano Ronaldo",
        "pais": "Portugal",
        "club": "Al Nassr",
        "liga": "Saudi Pro League",
        "competicion": "Saudi Pro League",
        "posicion": "F",
        "edad": 41,
        "altura": 187,
        "imagen": "https://a.espncdn.com/i/headshots/soccer/players/full/22774.png",
    },
    {
        "nombre": "Neymar",
        "pais": "Brazil",
        "club": "Santos",
        "liga": "Brasileirão",
        "competicion": "Brasileirão",
        "posicion": "F",
        "edad": 34,
        "altura": 175,
        "imagen": "https://a.espncdn.com/i/headshots/soccer/players/full/132948.png",
    },
]


def normalizar_texto(texto):
    texto = str(texto or "")
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = texto.lower()
    texto = re.sub(r"[^a-z0-9]+", " ", texto)
    return re.sub(r"\s+", " ", texto).strip()


def get_json(url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        print(f"🌐 {r.status_code} {url}")
        if not r.ok:
            return None
        return r.json()
    except Exception as e:
        print(f"⚠️ Error leyendo {url}: {e}")
        return None


def buscar_valor(obj, keys):
    if isinstance(obj, dict):
        for key in keys:
            if key in obj and obj[key] not in [None, ""]:
                return obj[key]
        for value in obj.values():
            found = buscar_valor(value, keys)
            if found not in [None, ""]:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = buscar_valor(item, keys)
            if found not in [None, ""]:
                return found
    return None


def equipos_desde_respuesta(data):
    equipos = []

    def walk(obj):
        if isinstance(obj, dict):
            if "team" in obj and isinstance(obj["team"], dict):
                team = obj["team"]
                if team.get("id") and (team.get("displayName") or team.get("name")):
                    equipos.append(team)
            elif obj.get("id") and (obj.get("displayName") or obj.get("name")) and (obj.get("logos") or obj.get("abbreviation")):
                equipos.append(obj)
            for value in obj.values():
                walk(value)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(data)

    vistos = set()
    salida = []
    for team in equipos:
        tid = str(team.get("id") or "")
        if not tid or tid in vistos:
            continue
        vistos.add(tid)
        salida.append(team)
    return salida


def cargar_equipos_liga(league_slug):
    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams",
        f"https://site.web.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams",
    ]

    for url in urls:
        data = get_json(url)
        if not data:
            continue
        equipos = equipos_desde_respuesta(data)
        if equipos:
            print(f"✅ {league_slug}: {len(equipos)} equipos encontrados")
            return equipos
    print(f"⚠️ {league_slug}: no se encontraron equipos")
    return []


def match_equipo(team, aliases):
    valores = [
        team.get("displayName"),
        team.get("name"),
        team.get("shortDisplayName"),
        team.get("abbreviation"),
        team.get("nickname"),
        team.get("location"),
    ]
    team_norms = {normalizar_texto(v) for v in valores if v}

    for alias in aliases:
        a = normalizar_texto(alias)
        if not a:
            continue
        for t in team_norms:
            if a == t or a in t or t in a:
                return True
    return False


def encontrar_equipo(equipos, aliases):
    for team in equipos:
        if match_equipo(team, aliases):
            return team
    return None


def limpiar_altura(value):
    if value in [None, "", "-"]:
        return 0
    if isinstance(value, (int, float)):
        # ESPN a veces entrega pulgadas.
        if 55 <= value <= 90:
            return int(round(value * 2.54))
        if 140 <= value <= 220:
            return int(round(value))
        return 0

    text = str(value)
    nums = re.findall(r"\d+(?:\.\d+)?", text)
    if not nums:
        return 0

    n = float(nums[0])
    if "cm" in text.lower() and 140 <= n <= 220:
        return int(round(n))
    if "m" in text.lower() and 1.4 <= n <= 2.2:
        return int(round(n * 100))
    if 55 <= n <= 90:
        return int(round(n * 2.54))
    if 140 <= n <= 220:
        return int(round(n))
    return 0


def limpiar_edad(value):
    try:
        edad = int(value)
        if MIN_EDAD <= edad <= MAX_EDAD:
            return edad
    except Exception:
        pass
    return 0


def map_posicion(pos):
    text = normalizar_texto(pos)
    if not text:
        return ""
    if text in ["g", "gk"] or "goal" in text or "arquero" in text or "portero" in text:
        return "G"
    if text in ["d", "df"] or "def" in text or "back" in text or "defensa" in text:
        return "D"
    if text in ["m", "mf"] or "mid" in text or "volante" in text or "medioc" in text:
        return "M"
    if text in ["f", "fw", "st"] or "forw" in text or "delanter" in text or "wing" in text or "attack" in text:
        return "F"
    return pos if str(pos).upper() in ["G", "D", "M", "F"] else ""


def foto_jugador(athlete):
    headshot = athlete.get("headshot")
    if isinstance(headshot, dict):
        href = headshot.get("href")
        if href:
            return href

    headshots = athlete.get("headshots")
    if isinstance(headshots, list) and headshots:
        href = headshots[0].get("href")
        if href:
            return href

    links = athlete.get("links") or []
    if isinstance(links, list) and links:
        href = links[0].get("href")
        if href:
            return href

    player_id = athlete.get("id")
    if player_id:
        return f"https://a.espncdn.com/i/headshots/soccer/players/full/{player_id}.png"

    return ""


def nacionalidad_jugador(athlete):
    for key in ["country", "nationality", "birthPlace"]:
        value = athlete.get(key)
        if isinstance(value, dict):
            for subkey in ["displayName", "name", "country", "abbreviation"]:
                if value.get(subkey):
                    return value[subkey]
        elif isinstance(value, str) and value.strip():
            return value.strip()

    flag = buscar_valor(athlete, ["country", "nationality"])
    if isinstance(flag, str) and flag.strip():
        return flag.strip()
    return "Sin datos"


def extraer_athletes(data):
    athletes = []

    raw = data.get("athletes") if isinstance(data, dict) else None
    if isinstance(raw, list):
        for group in raw:
            if isinstance(group, dict) and isinstance(group.get("items"), list):
                for item in group.get("items") or []:
                    athlete = item.get("athlete") if isinstance(item, dict) else None
                    if isinstance(athlete, dict):
                        if "position" not in athlete and group.get("position"):
                            athlete["position"] = group.get("position")
                        athletes.append(athlete)
                    elif isinstance(item, dict):
                        athletes.append(item)
            elif isinstance(group, dict):
                athletes.append(group.get("athlete") or group)

    # Fallback para respuestas con estructura distinta.
    if not athletes:
        def walk(obj):
            if isinstance(obj, dict):
                if obj.get("displayName") and (obj.get("position") or obj.get("age") or obj.get("headshot")):
                    athletes.append(obj)
                for value in obj.values():
                    walk(value)
            elif isinstance(obj, list):
                for item in obj:
                    walk(item)
        walk(data)

    vistos = set()
    salida = []
    for athlete in athletes:
        aid = str(athlete.get("id") or athlete.get("uid") or athlete.get("displayName") or "")
        if not aid or aid in vistos:
            continue
        vistos.add(aid)
        salida.append(athlete)
    return salida


def cargar_roster(league_slug, team_id):
    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams/{team_id}/roster",
        f"https://site.web.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams/{team_id}/roster",
    ]
    for url in urls:
        data = get_json(url)
        if not data:
            continue
        athletes = extraer_athletes(data)
        if athletes:
            return athletes
    return []


def jugador_desde_athlete(athlete, club, competicion):
    nombre = athlete.get("displayName") or athlete.get("fullName") or athlete.get("name")
    if not nombre:
        return None

    # No descartamos por edad/altura faltante porque ESPN a veces no los entrega.
    # El juego puede usar esos datos como "Sin datos" o filtrarlos si hace falta.
    edad = limpiar_edad(athlete.get("age"))
    altura = limpiar_altura(athlete.get("displayHeight") or athlete.get("height"))

    position = athlete.get("position") or {}
    if isinstance(position, dict):
        posicion = map_posicion(position.get("abbreviation") or position.get("displayName") or position.get("name"))
    else:
        posicion = map_posicion(position)

    if not posicion:
        return None

    pais = nacionalidad_jugador(athlete)
    if not pais or normalizar_texto(pais) in ["unknown"]:
        pais = "Sin datos"

    return {
        "nombre": str(nombre).strip(),
        "pais": str(pais).strip(),
        "club": club,
        "liga": competicion,
        "competicion": competicion,
        "posicion": posicion,
        "edad": edad,
        "altura": altura,
        "imagen": foto_jugador(athlete),
    }


def clave_jugador(j):
    return f"{normalizar_texto(j.get('nombre'))}|{normalizar_texto(j.get('club'))}"


def dedupe(jugadores):
    vistos = set()
    salida = []
    for j in jugadores:
        key = clave_jugador(j)
        if key in vistos:
            continue
        vistos.add(key)
        salida.append(j)
    return salida



def cargar_jugadores_existentes():
    """Lee el jugadores.json actual para no perder la base si ESPN falla."""
    if not OUTPUT_FILE.exists():
        return []
    try:
        data = json.loads(OUTPUT_FILE.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and isinstance(data.get("jugadores"), list):
            return data["jugadores"]
    except Exception as e:
        print(f"⚠️ No pude leer JSON existente: {e}")
    return []


def normalizar_jugador_existente(j):
    """Asegura que los jugadores viejos tengan las claves que usa el juego."""
    if not isinstance(j, dict):
        return None
    nombre = str(j.get("nombre") or "").strip()
    club = str(j.get("club") or "").strip()
    liga = str(j.get("liga") or j.get("competicion") or "").strip()
    if not nombre or not club or not liga:
        return None
    return {
        "nombre": nombre,
        "pais": str(j.get("pais") or "Sin datos").strip(),
        "club": club,
        "liga": liga,
        "competicion": str(j.get("competicion") or liga).strip(),
        "posicion": map_posicion(j.get("posicion")) or str(j.get("posicion") or "").strip(),
        "edad": limpiar_edad(j.get("edad")),
        "altura": limpiar_altura(j.get("altura")),
        "imagen": str(j.get("imagen") or "").strip(),
    }


def main():
    jugadores = []
    no_encontrados = []
    existentes = []

    # Primero guardamos la base anterior. Esto evita que el JSON quede en 3 jugadores
    # si ESPN falla, cambia una estructura o no devuelve planteles en GitHub Actions.
    existentes_raw = cargar_jugadores_existentes()
    for j in existentes_raw:
        jj = normalizar_jugador_existente(j)
        if jj:
            existentes.append(jj)

    print(f"📦 Jugadores existentes antes del scraping: {len(existentes)}")

    for league in LEAGUES:
        slug = league["slug"]
        competicion = league["competicion"]
        equipos = cargar_equipos_liga(slug)

        for aliases in league["teams"]:
            team = encontrar_equipo(equipos, aliases)
            nombre_objetivo = aliases[0]

            if not team:
                print(f"⚠️ No encontré equipo: {nombre_objetivo} ({competicion})")
                no_encontrados.append({"liga": competicion, "equipo": nombre_objetivo})
                continue

            team_id = str(team.get("id"))
            club = team.get("displayName") or team.get("name") or nombre_objetivo
            print(f"🏟️ {competicion}: {club} ({team_id})")

            athletes = cargar_roster(slug, team_id)
            count = 0

            for athlete in athletes:
                jugador = jugador_desde_athlete(athlete, club, competicion)
                if not jugador:
                    continue
                jugadores.append(jugador)
                count += 1
                if count >= MAX_JUGADORES_POR_CLUB:
                    break

            print(f"   ✅ {count} jugadores útiles")
            time.sleep(SLEEP_BETWEEN_REQUESTS)

    scraped_count = len(jugadores)
    print(f"🧲 Jugadores scrapeados nuevos: {scraped_count}")

    # Si el scraping trae muy poco, NO pisamos la base buena.
    # Mezclamos lo existente + famosos de respaldo.
    if scraped_count < 100 and len(existentes) >= 100:
        print("⚠️ Scraping demasiado bajo. Mantengo la base existente y solo agrego fallback famosos.")
        jugadores = existentes + FAMOUS_FALLBACK
        fuente = "ESPN site.api / rosters + base existente protegida + fallback famosos"
    else:
        # Caso normal: usamos lo scrapeado y también agregamos famosos por seguridad.
        jugadores = jugadores + FAMOUS_FALLBACK
        # Si existe una base anterior, la sumamos para no perder jugadores por fallas parciales.
        if existentes:
            jugadores = jugadores + existentes
        fuente = "ESPN site.api / rosters + fallback famosos"

    jugadores = dedupe(jugadores)
    jugadores.sort(key=lambda x: (x.get("competicion", ""), x.get("club", ""), x.get("nombre", "")))

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "fuente": fuente,
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "total": len(jugadores),
        "scrapeados_nuevos": scraped_count,
        "existentes_previos": len(existentes),
        "ligas": sorted({j.get("competicion") for j in jugadores if j.get("competicion")}),
        "no_encontrados": no_encontrados,
        "jugadores": jugadores,
    }

    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"✅ Generado {OUTPUT_FILE} con {len(jugadores)} jugadores")
    if no_encontrados:
        print("⚠️ Equipos no encontrados:")
        for item in no_encontrados:
            print(f" - {item['liga']}: {item['equipo']}")


if __name__ == "__main__":
    main()
