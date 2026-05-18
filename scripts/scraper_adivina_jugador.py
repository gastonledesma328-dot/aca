import json
import os
import re
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import requests

OUTPUT_FILE = Path("adivinajugador/jugadores.json")
MIN_PLAYERS_TO_SAVE = int(os.environ.get("MIN_PLAYERS_TO_SAVE", "60"))
REQUEST_SLEEP = float(os.environ.get("REQUEST_SLEEP", "0.35"))

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.espn.com.ar/",
}

LEAGUES = [
    {
        "competicion": "Premier League",
        "espn_slug": "eng.1",
        "clubes": [
            "Arsenal",
            "Manchester City",
            "Manchester United",
            "Aston Villa",
            "Liverpool",
        ],
    },
    {
        "competicion": "Serie A",
        "espn_slug": "ita.1",
        "clubes": [
            "Internazionale",
            "Napoli",
            "AC Milan",
            "AS Roma",
            "Juventus",
        ],
    },
    {
        "competicion": "Brasileirão",
        "espn_slug": "bra.1",
        "clubes": [
            "Palmeiras",
            "Flamengo",
            "Fluminense",
            "São Paulo",
            "Botafogo",
        ],
    },
    {
        "competicion": "Bundesliga",
        "espn_slug": "ger.1",
        "clubes": [
            "Bayern Munich",
            "Borussia Dortmund",
            "RB Leipzig",
            "Bayer Leverkusen",
            "VfB Stuttgart",
        ],
    },
    {
        "competicion": "LaLiga",
        "espn_slug": "esp.1",
        "clubes": [
            "Barcelona",
            "Real Madrid",
            "Atlético Madrid",
            "Villarreal",
            "Real Betis",
        ],
    },
    {
        "competicion": "Ligue 1",
        "espn_slug": "fra.1",
        "clubes": [
            "Paris Saint-Germain",
            "Lens",
            "Lille",
            "Lyon",
            "Marseille",
        ],
    },
    {
        "competicion": "Liga Profesional Argentina",
        "espn_slug": "arg.1",
        "clubes": [
            "River Plate",
            "Boca Juniors",
            "Racing Club",
            "Independiente",
            "San Lorenzo",
        ],
    },
    {
        "competicion": "Eredivisie",
        "espn_slug": "ned.1",
        "clubes": [
            "PSV",
            "Feyenoord Rotterdam",
            "Ajax Amsterdam",
            "FC Twente",
            "AZ Alkmaar",
        ],
    },
    {
        "competicion": "Liga BetPlay",
        "espn_slug": "col.1",
        "clubes": [
            "Atlético Nacional",
            "Junior",
            "Deportivo Pasto",
            "América de Cali",
            "Once Caldas",
        ],
    },
]

ALIASES = {
    "inter": ["internazionale", "inter milan", "fc internazionale milano"],
    "internazionale": ["inter", "inter milan", "fc internazionale milano"],
    "ac milan": ["milan"],
    "as roma": ["roma"],
    "bayern munich": ["bayern", "fc bayern munich"],
    "borussia dortmund": ["dortmund", "bvb"],
    "bayer leverkusen": ["leverkusen"],
    "rb leipzig": ["leipzig"],
    "vfb stuttgart": ["stuttgart"],
    "barcelona": ["fc barcelona", "barça", "barca"],
    "real madrid": ["real madrid cf"],
    "atletico madrid": ["atlético madrid", "atletico"],
    "atlético madrid": ["atletico madrid", "atletico"],
    "real betis": ["betis"],
    "paris saint germain": ["paris saint-germain", "psg"],
    "paris saint-germain": ["paris saint germain", "psg"],
    "olympique lyonnais": ["lyon"],
    "lyon": ["olympique lyonnais"],
    "olympique de marseille": ["marseille"],
    "marseille": ["olympique de marseille"],
    "feyenoord rotterdam": ["feyenoord"],
    "ajax amsterdam": ["ajax"],
    "psv eindhoven": ["psv"],
    "psv": ["psv eindhoven"],
    "fc twente": ["twente"],
    "az alkmaar": ["az"],
    "club atletico river plate": ["river plate"],
    "river plate": ["club atletico river plate"],
    "boca juniors": ["club atletico boca juniors"],
    "racing club": ["racing"],
    "independiente": ["ca independiente", "club atletico independiente"],
    "san lorenzo": ["club atletico san lorenzo"],
    "atlético nacional": ["atletico nacional", "nacional"],
    "atletico nacional": ["atlético nacional", "nacional"],
    "junior": ["atletico junior", "atlético junior", "junior barranquilla"],
    "américa de cali": ["america de cali"],
    "america de cali": ["américa de cali"],
}

POSITION_MAP = {
    "goalkeeper": "GK",
    "portero": "GK",
    "arquero": "GK",
    "keeper": "GK",
    "defender": "DEF",
    "defensa": "DEF",
    "centre back": "CB",
    "center back": "CB",
    "central defender": "CB",
    "left back": "LB",
    "right back": "RB",
    "midfielder": "MID",
    "mediocampista": "MID",
    "volante": "MID",
    "defensive midfielder": "CDM",
    "central midfielder": "CM",
    "attacking midfielder": "CAM",
    "forward": "FW",
    "delantero": "FW",
    "striker": "ST",
    "winger": "W",
    "left wing": "LW",
    "right wing": "RW",
}


def slug(text):
    text = str(text or "").strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def possible_names(name):
    base = slug(name)
    names = {base}
    for value in ALIASES.get(base, []):
        names.add(slug(value))
    return names


def get_json(url):
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        print(f"{response.status_code} {url}")
        if not response.ok:
            return None
        return response.json()
    except Exception as exc:
        print(f"ERROR leyendo {url}: {exc}")
        return None


def extract_teams(data):
    teams = []

    def walk(obj):
        if isinstance(obj, dict):
            team = obj.get("team")
            if isinstance(team, dict) and (team.get("id") or team.get("$ref")):
                teams.append(team)
            if obj.get("id") and (obj.get("displayName") or obj.get("name") or obj.get("shortDisplayName")):
                teams.append(obj)
            for value in obj.values():
                walk(value)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(data)
    unique = {}
    for team in teams:
        team_id = str(team.get("id") or "").strip()
        if team_id:
            unique[team_id] = team
    return list(unique.values())


def load_league_teams(league_slug):
    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams",
        f"https://site.web.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams",
    ]

    for url in urls:
        data = get_json(url)
        if not data:
            continue
        teams = extract_teams(data)
        if teams:
            return teams

    return []


def team_names(team):
    names = [
        team.get("displayName"),
        team.get("name"),
        team.get("shortDisplayName"),
        team.get("location"),
        team.get("nickname"),
        team.get("abbreviation"),
    ]
    return {slug(n) for n in names if n}


def resolve_team(teams, wanted_name):
    wanted = possible_names(wanted_name)

    for team in teams:
        names = team_names(team)
        if wanted & names:
            return team

    for team in teams:
        names = team_names(team)
        for w in wanted:
            if any(w in n or n in w for n in names if len(n) >= 3):
                return team

    return None


def first_text(*values, default=""):
    for value in values:
        if value is not None and str(value).strip():
            return str(value).strip()
    return default


def parse_height_to_cm(athlete):
    raw = first_text(
        athlete.get("displayHeight"),
        athlete.get("height"),
        athlete.get("heightCm"),
        athlete.get("height_cm"),
        default="",
    )

    if not raw:
        return None

    if isinstance(raw, str):
        text = raw.strip().lower()

        cm_match = re.search(r"(\d{2,3})\s*cm", text)
        if cm_match:
            return int(cm_match.group(1))

        feet_match = re.search(r"(\d)'\s*(\d{1,2})", text)
        if feet_match:
            feet = int(feet_match.group(1))
            inches = int(feet_match.group(2))
            return round((feet * 12 + inches) * 2.54)

        number_match = re.search(r"\d+(?:\.\d+)?", text)
        if number_match:
            number = float(number_match.group(0))
            if number > 100:
                return round(number)
            if 50 <= number <= 95:
                return round(number * 2.54)

    try:
        number = float(raw)
        if number > 100:
            return round(number)
        if 50 <= number <= 95:
            return round(number * 2.54)
    except Exception:
        pass

    return None


def normalize_position(athlete):
    position = athlete.get("position") or {}
    raw = first_text(
        position.get("abbreviation") if isinstance(position, dict) else "",
        position.get("displayName") if isinstance(position, dict) else "",
        position.get("name") if isinstance(position, dict) else "",
        athlete.get("position"),
        default="",
    )

    if not raw:
        return "MID"

    upper = raw.upper().strip()
    if upper in {"GK", "CB", "LB", "RB", "LWB", "RWB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"}:
        return upper

    normalized = slug(raw)
    for key, value in POSITION_MAP.items():
        if key in normalized:
            return value

    if "def" in normalized:
        return "DEF"
    if "mid" in normalized:
        return "MID"
    if "for" in normalized or "att" in normalized:
        return "FW"

    return upper[:4] if upper else "MID"


def extract_country(athlete):
    candidates = [
        athlete.get("country"),
        athlete.get("nationality"),
        athlete.get("citizenship"),
    ]

    birth_place = athlete.get("birthPlace")
    if isinstance(birth_place, dict):
        candidates.extend([
            birth_place.get("country"),
            birth_place.get("countryName"),
            birth_place.get("region"),
        ])

    for value in candidates:
        if isinstance(value, dict):
            value = first_text(value.get("displayName"), value.get("name"), value.get("abbreviation"))
        if value and str(value).strip():
            return str(value).strip()

    return "Sin datos"


def extract_image(athlete):
    headshot = athlete.get("headshot")
    if isinstance(headshot, dict):
        href = headshot.get("href")
        if href:
            return href

    links = athlete.get("links")
    if isinstance(links, list):
        for link in links:
            if isinstance(link, dict) and link.get("rel") and "athlete" in link.get("rel", []):
                return link.get("href", "")

    return ""


def extract_athletes(data):
    athletes = []

    def add_athlete(item):
        if not isinstance(item, dict):
            return

        athlete = item.get("athlete") if isinstance(item.get("athlete"), dict) else item

        name = first_text(
            athlete.get("displayName"),
            athlete.get("fullName"),
            athlete.get("name"),
            athlete.get("shortName"),
            default="",
        )

        if name:
            athletes.append(athlete)

    raw = data.get("athletes") if isinstance(data, dict) else []

    if isinstance(raw, list):
        for group in raw:
            if isinstance(group, dict) and isinstance(group.get("items"), list):
                for item in group["items"]:
                    add_athlete(item)
            else:
                add_athlete(group)

    if not athletes:
        def walk(obj):
            if isinstance(obj, dict):
                if obj.get("displayName") and (obj.get("position") or obj.get("jersey")):
                    add_athlete(obj)
                for value in obj.values():
                    walk(value)
            elif isinstance(obj, list):
                for item in obj:
                    walk(item)
        walk(data)

    unique = {}
    for athlete in athletes:
        name = first_text(
            athlete.get("displayName"),
            athlete.get("fullName"),
            athlete.get("name"),
            athlete.get("shortName"),
            default="",
        )
        if name:
            unique[slug(name)] = athlete
    return list(unique.values())


def load_roster(league_slug, team_id):
    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams/{team_id}/roster",
        f"https://site.web.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams/{team_id}/roster",
    ]

    for url in urls:
        data = get_json(url)
        if not data:
            continue
        athletes = extract_athletes(data)
        if athletes:
            return athletes

    return []


def athlete_to_player(athlete, club, competition):
    name = first_text(
        athlete.get("displayName"),
        athlete.get("fullName"),
        athlete.get("name"),
        athlete.get("shortName"),
        default="",
    )

    if not name:
        return None

    age = athlete.get("age")
    try:
        age = int(age) if age not in [None, ""] else None
    except Exception:
        age = None

    return {
        "nombre": name,
        "pais": extract_country(athlete),
        "club": club,
        "liga": competition,
        "competicion": competition,
        "posicion": normalize_position(athlete),
        "edad": age,
        "altura": parse_height_to_cm(athlete),
        "imagen": extract_image(athlete),
    }


def clean_player(player):
    if not player:
        return None

    if not player["nombre"] or player["nombre"].lower() in {"team", "unknown"}:
        return None

    if player["edad"] is None:
        player["edad"] = 0

    if player["altura"] is None:
        player["altura"] = 0

    return player


def main():
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    all_players = []
    seen = set()

    for league in LEAGUES:
        competition = league["competicion"]
        league_slug = league["espn_slug"]

        print(f"\n=== {competition} / {league_slug} ===")
        league_teams = load_league_teams(league_slug)

        if not league_teams:
            print(f"ADVERTENCIA: no se pudieron cargar equipos para {competition}")
            continue

        for wanted_club in league["clubes"]:
            team = resolve_team(league_teams, wanted_club)

            if not team:
                print(f"ADVERTENCIA: no encontré el equipo: {wanted_club}")
                continue

            team_id = str(team.get("id"))
            club_name = first_text(team.get("displayName"), team.get("name"), default=wanted_club)

            print(f"\nEquipo: {club_name} ({team_id})")
            roster = load_roster(league_slug, team_id)
            print(f"Jugadores encontrados: {len(roster)}")

            for athlete in roster:
                player = clean_player(athlete_to_player(athlete, club_name, competition))
                if not player:
                    continue

                key = f"{slug(player['nombre'])}|{slug(player['club'])}|{slug(player['competicion'])}"
                if key in seen:
                    continue

                seen.add(key)
                all_players.append(player)

            time.sleep(REQUEST_SLEEP)

    all_players.sort(key=lambda p: (p["competicion"], p["club"], p["nombre"]))

    output = {
        "fuente": "ESPN site.api / rosters",
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "total": len(all_players),
        "jugadores": all_players,
    }

    print(f"\nTOTAL JUGADORES: {len(all_players)}")

    if len(all_players) < MIN_PLAYERS_TO_SAVE:
        if OUTPUT_FILE.exists():
            print(
                f"ERROR: se encontraron solo {len(all_players)} jugadores. "
                f"No se pisa el JSON anterior: {OUTPUT_FILE}"
            )
        else:
            print(
                f"ERROR: se encontraron solo {len(all_players)} jugadores y no existe JSON previo."
            )
        raise SystemExit(1)

    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"OK: generado {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
