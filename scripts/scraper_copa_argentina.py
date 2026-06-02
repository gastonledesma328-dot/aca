"""
scraper_copa_argentina.py

Scraper de Copa Argentina desde la API pública de ESPN (arg.copa).
Genera:
  data/copa_argentina_bracket.json
  public/data/copa_argentina_bracket.json

Estructura de cada partido:
  id, nombre, fecha, estado, completado, penaltis,
  local:    { nombre, nombre_corto, logo, marcador, penaltis, ganador }
  visitante: { nombre, nombre_corto, logo, marcador, penaltis, ganador }
  estadio, nota

Fases detectadas:
  treintaidosavos, dieciseisavos, octavos, cuartos, semis, final
"""

import json
import re
import time
import requests
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

# --- Config ---------------------------------------------------------------

LEAGUE   = "arg.copa"
ESPN_SB  = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{LEAGUE}/scoreboard"
ESPN_SUM = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{LEAGUE}/summary"
ESPN_CORE= f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{LEAGUE}"

OUTPUTS = [
    Path("data/copa_argentina_bracket.json"),
    Path("public/data/copa_argentina_bracket.json"),
]

TZ_ARG = ZoneInfo("America/Argentina/Buenos_Aires")
H = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

# Fases en orden ascendente de ronda
FASE_MAP = {
    "32": "treintaidosavos",
    "16": "dieciseisavos",
    "8":  "octavos",
    "4":  "cuartos",
    "2":  "semis",
    "1":  "final",
    # ESPN round labels (inglés)
    "round of 64":  "treintaidosavos",
    "round of 32":  "dieciseisavos",
    "round of 16":  "octavos",
    "quarterfinals":"cuartos",
    "semifinals":   "semis",
    "final":        "final",
    # ESPN Spanish labels
    "treinta y dos avos": "treintaidosavos",
    "dieciseisavos":      "dieciseisavos",
    "octavos":            "octavos",
    "cuartos":            "cuartos",
    "semifinal":          "semis",
    "semifinales":        "semis",
    "gran final":         "final",
}

FASE_LABEL = {
    "treintaidosavos": "32avos de Final",
    "dieciseisavos":   "16avos de Final",
    "octavos":         "Octavos de Final",
    "cuartos":         "Cuartos de Final",
    "semis":           "Semifinales",
    "final":           "Final",
}

FASE_SLOTS = {
    "treintaidosavos": 32,
    "dieciseisavos":   16,
    "octavos":          8,
    "cuartos":          4,
    "semis":            2,
    "final":            1,
}


# --- Helpers --------------------------------------------------------------

def get(url, params=None, retries=3):
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, headers=H, timeout=20)
            if r.status_code == 200:
                return r.json()
            time.sleep(1)
        except Exception as e:
            if attempt == retries - 1:
                print(f"  ERROR {url}: {e}")
            time.sleep(2)
    return None


def arg_date(iso_str):
    """Convert ISO date string to YYYY-MM-DD in Argentina timezone."""
    if not iso_str:
        return ""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.astimezone(TZ_ARG).strftime("%Y-%m-%d")
    except Exception:
        return str(iso_str)[:10]


def detect_fase(event):
    """Detect the phase of a Copa Argentina match from ESPN event data."""
    comp = (event.get("competitions") or [{}])[0]

    # 1. Check season type notes / groups
    for note in comp.get("notes") or []:
        headline = (note.get("headline") or "").lower().strip()
        for key, fase in FASE_MAP.items():
            if key in headline:
                return fase

    # 2. Check odds/series info
    for detail in comp.get("series") or []:
        label = (detail.get("type", {}).get("text") or "").lower()
        for key, fase in FASE_MAP.items():
            if key in label:
                return fase

    # 3. Number of competitors still in tournament → infer by date & season
    # Check season.type (playoff = type 3)
    season_type = event.get("season", {}).get("type")

    # 4. Check week number as proxy for round
    week = event.get("week", {}).get("number")
    if week:
        week_to_fase = {1: "treintaidosavos", 2: "dieciseisavos",
                        3: "octavos", 4: "cuartos", 5: "semis", 6: "final"}
        if week in week_to_fase:
            return week_to_fase[week]

    # 5. Check event name for round keywords
    name = (event.get("name") or "").lower()
    for key, fase in FASE_MAP.items():
        if key in name:
            return fase

    return "octavos"  # default fallback


def build_team(competitor):
    """Extract team info from a competitor dict."""
    team = competitor.get("team") or {}
    score_raw = competitor.get("score") or ""
    score = str(score_raw).strip() if score_raw not in ("", None) else ""
    winner = competitor.get("winner") is True

    # Penalty shootout score
    pen = None
    for stat in competitor.get("statistics") or []:
        if "penal" in (stat.get("name") or "").lower():
            pen = str(stat.get("displayValue") or "").strip() or None

    # Also from shootout object
    for linked in competitor.get("linescores") or []:
        pass  # Not needed for now

    logo = (team.get("logos") or [{}])[0].get("href") if team.get("logos") else team.get("logo") or ""

    return {
        "nombre":       team.get("displayName") or team.get("name") or "",
        "nombre_corto": team.get("shortDisplayName") or team.get("abbreviation") or "",
        "espn_id":      team.get("id") or "",
        "logo":         logo,
        "marcador":     score,
        "penaltis":     pen,
        "ganador":      winner,
    }


def build_partido(event):
    """Build a partido dict from an ESPN event."""
    comp = (event.get("competitions") or [{}])[0]
    competitors = comp.get("competitors") or []

    home = next((c for c in competitors if c.get("homeAway") == "home"), competitors[0] if competitors else {})
    away = next((c for c in competitors if c.get("homeAway") == "away"), competitors[1] if len(competitors) > 1 else {})

    status = event.get("status") or {}
    status_type = status.get("type") or {}
    completed = status_type.get("completed") is True
    estado = status_type.get("shortDetail") or status_type.get("description") or ""

    venue = comp.get("venue") or {}
    estadio = venue.get("fullName") or ""
    city = (venue.get("address") or {}).get("city") or ""
    if city and estadio:
        estadio = f"{estadio}, {city}"

    # Penalty info from notes
    pen_nota = ""
    for note in comp.get("notes") or []:
        h = note.get("headline") or ""
        if "penal" in h.lower() or "penalty" in h.lower() or "penalt" in h.lower():
            pen_nota = h

    return {
        "id":          event.get("id") or "",
        "nombre":      event.get("name") or "",
        "fecha":       arg_date(event.get("date") or ""),
        "fecha_iso":   event.get("date") or "",
        "estado":      estado,
        "completado":  completed,
        "penaltis":    bool(pen_nota),
        "local":       build_team(home),
        "visitante":   build_team(away),
        "estadio":     estadio,
        "nota":        pen_nota,
    }


def get_current_season():
    """Get the current Copa Argentina season year."""
    d = get(f"{ESPN_CORE}/seasons", params={"lang": "es", "limit": 5})
    if d and d.get("items"):
        years = []
        for item in d["items"]:
            ref = item.get("$ref", "")
            m = re.search(r"/(\d{4})$", ref)
            if m:
                years.append(int(m.group(1)))
        if years:
            return max(years)
    return datetime.now().year


def scrape_season(year):
    """Scrape all Copa Argentina events for a given season year."""
    print(f"  Scrapeando temporada {year}...")
    all_events = []

    # Try multiple date ranges for the season
    ranges = [
        f"{year}0101-{year}0630",
        f"{year}0701-{year}1231",
    ]

    for dr in ranges:
        data = get(ESPN_SB, params={"dates": dr, "limit": 200})
        if data and data.get("events"):
            all_events.extend(data["events"])
            print(f"    {dr}: {len(data['events'])} events")
        time.sleep(0.4)

    # Deduplicate by event ID
    seen = set()
    unique = []
    for ev in all_events:
        eid = ev.get("id")
        if eid and eid not in seen:
            seen.add(eid)
            unique.append(ev)

    print(f"  Total eventos únicos: {len(unique)}")
    return unique


def classify_events(events):
    """Classify events into fases."""
    fases = {k: [] for k in FASE_SLOTS}

    for ev in events:
        fase = detect_fase(ev)
        partido = build_partido(ev)
        if fase in fases:
            fases[fase].append(partido)

    # Sort each fase by date
    for fase in fases:
        fases[fase].sort(key=lambda p: p.get("fecha_iso") or p.get("fecha") or "")

    return fases


def find_campeon(fases):
    """Find the champion from the final match."""
    final_matches = fases.get("final") or []
    for match in final_matches:
        if match.get("completado"):
            # Winner is the team with ganador=True
            local = match.get("local") or {}
            visitante = match.get("visitante") or {}
            if local.get("ganador"):
                return {"id": local["espn_id"], "nombre": local["nombre"], "logo": local["logo"]}
            elif visitante.get("ganador"):
                return {"id": visitante["espn_id"], "nombre": visitante["nombre"], "logo": visitante["logo"]}
    return None


# --- Main -----------------------------------------------------------------

def main():
    print("Scrapeando Copa Argentina desde ESPN API...\n")

    season = get_current_season()
    print(f"Temporada detectada: {season}")

    events = scrape_season(season)

    if not events:
        # Try previous year as fallback
        season -= 1
        print(f"  Sin datos, probando temporada {season}...")
        events = scrape_season(season)

    if not events:
        print("ERROR: No se encontraron eventos de Copa Argentina")
        return

    fases = classify_events(events)
    campeon = find_campeon(fases)

    # Stats
    total = sum(len(v) for v in fases.values())
    print(f"\n=== Resumen ===")
    for fase_key, partidos in fases.items():
        label = FASE_LABEL.get(fase_key, fase_key)
        completados = sum(1 for p in partidos if p.get("completado"))
        print(f"  {label}: {len(partidos)} partidos ({completados} completados)")
    print(f"  Total: {total} partidos")
    if campeon:
        print(f"  Campeon: {campeon['nombre']}")

    result = {
        "competicion":  "Copa Argentina",
        "league_slug":  LEAGUE,
        "season":       season,
        "actualizado":  datetime.utcnow().isoformat() + "Z",
        "campeon":      campeon,
        "fases":        fases,
        "total_partidos": total,
    }

    for path in OUTPUTS:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"Guardado: {path}")

    print("\nScraper Copa Argentina completado.")


if __name__ == "__main__":
    main()
