import json
import os
import re
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import requests

OUTPUT_FILE = Path("adivinajugador/jugadores.json")
MIN_JUGADORES_VALIDOS = 100
REQUEST_TIMEOUT = 25
SLEEP_BETWEEN_REQUESTS = 0.08

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
    "Referer": "https://www.espn.com/",
}

# IMPORTANTE:
# No dependemos solo de nombres especiales. Primero consultamos el roster,
# después consultamos el detalle del atleta en ESPN para conseguir mejor posición,
# país, altura y foto. Si ESPN trae solo una letra o un grupo general, usamos reglas.

LIGAS = {
    "Premier League": {
        "slug": "eng.1",
        "clubes": [
            "Arsenal", "Aston Villa", "Chelsea", "Liverpool", "Manchester City",
            "Manchester United", "Newcastle United", "Tottenham Hotspur",
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
        "clubes": [
            "Paris Saint-Germain", "Marseille", "Lyon", "Lille", "Lens", "Monaco",
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
            "Deportivo Pasto", "Millonarios", "Santa Fe", "Deportes Tolima",
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

# Fallback solo para asegurar que los cracks muy conocidos estén si ESPN falla justo en ese equipo.
FAMOSOS_FALLBACK = [
    {
        "nombre": "Neymar", "pais": "Brazil", "club": "Santos", "liga": "Brasileirão",
        "competicion": "Brasileirão", "posicion": "F", "edad": 34, "altura": 175,
        "imagen": "https://a.espncdn.com/i/headshots/soccer/players/full/132948.png",
        "espn_id": "132948", "posicion_detalle": "Forward",
    },
    {
        "nombre": "Lionel Messi", "pais": "Argentina", "club": "Inter Miami CF", "liga": "MLS",
        "competicion": "MLS", "posicion": "F", "edad": 38, "altura": 170,
        "imagen": "https://a.espncdn.com/i/headshots/soccer/players/full/45843.png",
        "espn_id": "45843", "posicion_detalle": "Forward",
    },
    {
        "nombre": "Cristiano Ronaldo", "pais": "Portugal", "club": "Al Nassr", "liga": "Saudi Pro League",
        "competicion": "Saudi Pro League", "posicion": "F", "edad": 41, "altura": 187,
        "imagen": "https://a.espncdn.com/i/headshots/soccer/players/full/22774.png",
        "espn_id": "22774", "posicion_detalle": "Forward",
    },
]

TEAM_ALIASES = {
    "Internazionale": ["Inter Milan", "Internazionale"],
    "AC Milan": ["AC Milan", "Milan"],
    "AS Roma": ["AS Roma", "Roma"],
    "Atlético Madrid": ["Atletico Madrid", "Atlético Madrid"],
    "Paris Saint-Germain": ["Paris Saint-Germain", "PSG"],
    "Bayern Munich": ["Bayern Munich", "Bayern München"],
    "Borussia Dortmund": ["Borussia Dortmund", "Dortmund"],
    "RB Leipzig": ["RB Leipzig", "Leipzig"],
    "VfB Stuttgart": ["VfB Stuttgart", "Stuttgart"],
    "Feyenoord Rotterdam": ["Feyenoord Rotterdam", "Feyenoord"],
    "PSV Eindhoven": ["PSV Eindhoven", "PSV"],
    "Atlético Junior": ["Atlético Junior", "Junior", "Junior FC"],
    "América": ["América", "Club América", "America"],
    "Guadalajara": ["Guadalajara", "Chivas"],
    "Sporting CP": ["Sporting CP", "Sporting"],
    "FC Porto": ["FC Porto", "Porto"],
    "Besiktas": ["Besiktas", "Beşiktaş"],
}


def slug(text):
    text = str(text or "")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def jugador_key(j):
    return f"{slug(j.get('nombre'))}|{slug(j.get('club'))}|{slug(j.get('liga'))}"


def get_json(url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        if r.status_code != 200:
            return None
        return r.json()
    except Exception:
        return None


def first_valid(*values):
    for v in values:
        if v is None:
            continue
        if isinstance(v, str) and not v.strip():
            continue
        if v in ["Sin datos", "-", 0, "0"]:
            continue
        return v
    return None


def parse_height_cm(value):
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        # ESPN a veces entrega pulgadas.
        if 50 <= value <= 90:
            return int(round(value * 2.54))
        if 120 <= value <= 230:
            return int(round(value))
        return 0

    s = str(value).strip()
    if not s:
        return 0

    m = re.search(r"(\d+)\s*cm", s, re.I)
    if m:
        return int(m.group(1))

    # Formatos como 5' 9" o 6'2"
    m = re.search(r"(\d+)\s*'\s*(\d+)", s)
    if m:
        feet = int(m.group(1))
        inches = int(m.group(2))
        return int(round((feet * 12 + inches) * 2.54))

    nums = re.findall(r"\d+", s)
    if nums:
        n = int(nums[0])
        if 120 <= n <= 230:
            return n
        if 50 <= n <= 90:
            return int(round(n * 2.54))

    return 0


def parse_age(value):
    try:
        n = int(value)
        if 14 <= n <= 50:
            return n
    except Exception:
        pass
    return 0


def extract_id_from_ref(ref):
    ref = str(ref or "")
    m = re.search(r"/athletes/(\d+)", ref)
    if m:
        return m.group(1)
    m = re.search(r"/players/(\d+)", ref)
    if m:
        return m.group(1)
    return ""


def extract_athlete_id(athlete):
    if not isinstance(athlete, dict):
        return ""
    return str(
        athlete.get("id")
        or athlete.get("uid")
        or extract_id_from_ref(athlete.get("$ref"))
        or extract_id_from_ref(athlete.get("href"))
        or ""
    ).strip()


def get_nested(d, *path):
    cur = d
    for p in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(p)
    return cur


def country_from_obj(obj):
    if not isinstance(obj, dict):
        return None
    return first_valid(
        obj.get("displayName"), obj.get("name"), obj.get("abbreviation"),
        get_nested(obj, "country", "displayName"),
        get_nested(obj, "country", "name"),
        get_nested(obj, "birthPlace", "country"),
    )


def position_text_from_obj(obj):
    if not isinstance(obj, dict):
        return ""
    pos = obj.get("position") or obj.get("defaultPosition") or {}
    texts = []
    if isinstance(pos, dict):
        for k in ["displayName", "name", "abbreviation", "shortDisplayName"]:
            if pos.get(k):
                texts.append(str(pos.get(k)))
    for k in ["position", "displayPosition"]:
        v = obj.get(k)
        if isinstance(v, str):
            texts.append(v)
    return " ".join(texts).strip()


def normalizar_posicion_detallada(*texts):
    raw = " ".join(str(t or "") for t in texts)
    s = slug(raw)

    # Primero arqueros.
    if any(x in s for x in ["goalkeeper", "keeper", "portero", "arquero", "golero", "gk"]):
        return "G"

    # Laterales y carrileros son defensores, aunque ESPN diga wing back.
    if any(x in s for x in [
        "left back", "right back", "full back", "fullback", "wing back", "wingback",
        "center back", "centre back", "defender", "defensa", "defensor", "cb", "lb", "rb",
    ]):
        return "D"

    # Extremos, atacantes y delanteros siempre van como delantero para el juego.
    if any(x in s for x in [
        "left wing", "right wing", "winger", "wing", "forward", "attacker", "striker",
        "delantero", "extremo", "punta", "centre forward", "center forward", "cf", "st", "lw", "rw",
    ]):
        return "F"

    if any(x in s for x in [
        "midfielder", "midfield", "mediocampista", "volante", "centrocampista",
        "defensive midfielder", "attacking midfielder", "central midfielder", "cam", "cdm", "cm", "am", "dm",
    ]):
        return "M"

    # Letras simples de ESPN.
    if s in ["g"]:
        return "G"
    if s in ["d"]:
        return "D"
    if s in ["f"]:
        return "F"
    if s in ["m"]:
        return "M"

    return "M"


def headshot_url(athlete_id, athlete=None):
    if isinstance(athlete, dict):
        h = athlete.get("headshot")
        if isinstance(h, dict):
            href = h.get("href")
            if href:
                return href
        if isinstance(h, str) and h:
            return h
        for img in athlete.get("images") or []:
            if isinstance(img, dict) and img.get("href"):
                return img.get("href")
    if athlete_id:
        return f"https://a.espncdn.com/i/headshots/soccer/players/full/{athlete_id}.png"
    return ""


def cargar_detalle_atleta(league_slug, athlete_id):
    if not athlete_id:
        return {}

    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/athletes/{athlete_id}",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{league_slug}/athletes/{athlete_id}?lang=en&region=us",
        f"https://sports.core.api.espn.com/v3/sports/soccer/{league_slug}/athletes/{athlete_id}?lang=en&region=us",
        f"https://site.web.api.espn.com/apis/common/v3/sports/soccer/{league_slug}/athletes/{athlete_id}?region=us&lang=en",
    ]

    merged = {}
    for url in urls:
        data = get_json(url)
        time.sleep(SLEEP_BETWEEN_REQUESTS)
        if not isinstance(data, dict):
            continue

        # Algunos endpoints envuelven el atleta en "athlete".
        candidates = [data]
        if isinstance(data.get("athlete"), dict):
            candidates.append(data.get("athlete"))
        if isinstance(data.get("player"), dict):
            candidates.append(data.get("player"))

        for c in candidates:
            if not isinstance(c, dict):
                continue
            for k, v in c.items():
                if k not in merged or merged.get(k) in [None, "", "Sin datos", 0]:
                    merged[k] = v

    return merged


def cargar_equipos_liga(league_slug):
    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams?limit=500",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{league_slug}/teams?limit=500&lang=en&region=us",
    ]
    equipos = []
    for url in urls:
        data = get_json(url)
        if not isinstance(data, dict):
            continue
        raw = []
        if isinstance(data.get("sports"), list):
            for sport in data.get("sports", []):
                for league in sport.get("leagues", []) or []:
                    raw.extend(league.get("teams", []) or [])
        raw.extend(data.get("items") or [])
        raw.extend(data.get("teams") or [])

        for item in raw:
            team = item.get("team") if isinstance(item, dict) else None
            if not isinstance(team, dict):
                team = item if isinstance(item, dict) else {}
            if not team:
                continue
            tid = str(team.get("id") or extract_id_from_ref(team.get("$ref")) or "").strip()
            name = first_valid(team.get("displayName"), team.get("name"), team.get("shortDisplayName"), team.get("location"))
            if tid and name:
                equipos.append({"id": tid, "nombre": name, "slug": slug(name)})
        if equipos:
            break
    return equipos


def buscar_equipo(equipos, nombre):
    posibles = [nombre] + TEAM_ALIASES.get(nombre, [])
    posibles_slug = [slug(x) for x in posibles]

    for p in posibles_slug:
        for e in equipos:
            if e["slug"] == p:
                return e

    for p in posibles_slug:
        for e in equipos:
            if p in e["slug"] or e["slug"] in p:
                return e

    return None


def cargar_roster(league_slug, team_id):
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


def iter_athletes_from_roster(roster):
    athletes = roster.get("athletes") or []
    for group in athletes:
        if not isinstance(group, dict):
            continue
        group_pos = first_valid(group.get("position"), group.get("name"), group.get("displayName"), "") or ""
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


def construir_jugador(athlete, detalle, group_pos, club, liga, league_slug):
    athlete_id = extract_athlete_id(athlete) or extract_athlete_id(detalle)
    nombre = first_valid(
        athlete.get("displayName"), athlete.get("fullName"), athlete.get("name"),
        detalle.get("displayName"), detalle.get("fullName"), detalle.get("name"),
    )
    if not nombre:
        return None

    detalle_pos = position_text_from_obj(detalle)
    roster_pos = position_text_from_obj(athlete)
    posicion = normalizar_posicion_detallada(detalle_pos, roster_pos, group_pos)

    pais = first_valid(
        country_from_obj(detalle), country_from_obj(athlete),
        detalle.get("citizenship"), detalle.get("nationality"), athlete.get("citizenship"), athlete.get("nationality"),
    ) or "Sin datos"

    edad = parse_age(first_valid(detalle.get("age"), athlete.get("age")))
    altura = parse_height_cm(first_valid(
        detalle.get("displayHeight"), detalle.get("height"), athlete.get("displayHeight"), athlete.get("height")
    ))

    imagen = first_valid(headshot_url(athlete_id, detalle), headshot_url(athlete_id, athlete)) or ""

    return {
        "nombre": str(nombre).strip(),
        "pais": str(pais).strip(),
        "club": club,
        "liga": liga,
        "competicion": liga,
        "posicion": posicion,
        "posicion_detalle": first_valid(detalle_pos, roster_pos, group_pos, posicion) or posicion,
        "edad": edad,
        "altura": altura,
        "imagen": imagen,
        "espn_id": athlete_id,
    }


def cargar_existente():
    if not OUTPUT_FILE.exists():
        return []
    try:
        data = json.loads(OUTPUT_FILE.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and isinstance(data.get("jugadores"), list):
            return data.get("jugadores")
    except Exception:
        pass
    return []


def merge_jugadores(*listas):
    out = {}
    for lista in listas:
        for j in lista or []:
            if not isinstance(j, dict) or not j.get("nombre"):
                continue
            key = jugador_key(j)
            old = out.get(key)
            if not old:
                out[key] = j.copy()
                continue
            # Merge: conservar el dato más completo.
            merged = old.copy()
            for campo in ["pais", "posicion", "posicion_detalle", "edad", "altura", "imagen", "espn_id"]:
                val = j.get(campo)
                if campo in ["edad", "altura"]:
                    if int(val or 0) > int(merged.get(campo) or 0):
                        merged[campo] = val
                else:
                    if val and merged.get(campo) in [None, "", "Sin datos", 0, "0"]:
                        merged[campo] = val
            out[key] = merged
    return sorted(out.values(), key=lambda x: (slug(x.get("liga")), slug(x.get("club")), slug(x.get("nombre"))))


def calidad_jugador(j):
    score = 0
    if j.get("pais") and j.get("pais") != "Sin datos":
        score += 1
    if int(j.get("edad") or 0) > 0:
        score += 1
    if int(j.get("altura") or 0) > 0:
        score += 1
    if j.get("posicion") in ["G", "D", "M", "F"]:
        score += 1
    return score


def main():
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    existentes = cargar_existente()
    nuevos = []
    no_encontrados = []

    for liga, config in LIGAS.items():
        league_slug = config["slug"]
        print(f"\nLiga: {liga} ({league_slug})")
        equipos_espn = cargar_equipos_liga(league_slug)
        if not equipos_espn:
            print(f"  ⚠️ No se pudo listar equipos ESPN para {liga}")

        for club in config["clubes"]:
            equipo = buscar_equipo(equipos_espn, club)
            if not equipo:
                print(f"  ⚠️ No encontrado: {club}")
                no_encontrados.append({"liga": liga, "equipo": club})
                continue

            print(f"  Equipo: {club} -> ESPN {equipo['id']} ({equipo['nombre']})")
            roster = cargar_roster(league_slug, equipo["id"])
            count = 0

            for athlete, group_pos in iter_athletes_from_roster(roster):
                athlete_id = extract_athlete_id(athlete)
                detalle = cargar_detalle_atleta(league_slug, athlete_id) if athlete_id else {}
                jugador = construir_jugador(athlete, detalle, group_pos, club, liga, league_slug)
                if jugador:
                    nuevos.append(jugador)
                    count += 1

            print(f"    Jugadores: {count}")

    # Fallback famosos se suma, pero nunca reemplaza toda la base.
    combinados = merge_jugadores(existentes, nuevos, FAMOSOS_FALLBACK)

    # Si ESPN vino demasiado mal, no pisamos una base grande existente.
    if len(nuevos) < MIN_JUGADORES_VALIDOS and len(existentes) >= MIN_JUGADORES_VALIDOS:
        print("\n⚠️ ESPN devolvió pocos jugadores. Conservo base anterior + fallback famosos.")
        combinados = merge_jugadores(existentes, FAMOSOS_FALLBACK)

    # Filtro suave para el juego: quedan jugadores con posición y edad o país útil.
    jugables = [j for j in combinados if j.get("posicion") in ["G", "D", "M", "F"]]

    payload = {
        "fuente": "ESPN site.api rosters + ESPN athlete detail endpoints + fallback famosos",
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "total": len(jugables),
        "scrapeados_nuevos": len(nuevos),
        "existentes_previos": len(existentes),
        "ligas": sorted({j.get("liga") for j in jugables if j.get("liga")}),
        "no_encontrados": no_encontrados,
        "calidad": {
            "con_pais": sum(1 for j in jugables if j.get("pais") and j.get("pais") != "Sin datos"),
            "con_edad": sum(1 for j in jugables if int(j.get("edad") or 0) > 0),
            "con_altura": sum(1 for j in jugables if int(j.get("altura") or 0) > 0),
            "con_posicion_detalle": sum(1 for j in jugables if j.get("posicion_detalle")),
        },
        "jugadores": jugables,
    }

    OUTPUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ Guardado: {OUTPUT_FILE}")
    print(f"Total final: {payload['total']}")
    print(f"Calidad: {payload['calidad']}")


if __name__ == "__main__":
    main()
