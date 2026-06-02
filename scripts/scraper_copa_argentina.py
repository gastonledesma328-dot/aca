"""
scraper_copa_argentina.py
Scraper de Copa Argentina desde la API pública de ESPN (arg.copa).
"""

import json, re, time, requests
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

LEAGUE   = "arg.copa"
ESPN_SB  = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{LEAGUE}/scoreboard"
ESPN_CORE= f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{LEAGUE}"

OUTPUTS = [
    Path("data/copa_argentina_bracket.json"),
    Path("public/data/copa_argentina_bracket.json"),
]

TZ_ARG = ZoneInfo("America/Argentina/Buenos_Aires")
H = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

FASE_SLOTS  = [
    ("treintaidosavos", "32avos de Final",   32),
    ("dieciseisavos",   "16avos de Final",   16),
    ("octavos",         "Octavos de Final",   8),
    ("cuartos",         "Cuartos de Final",   4),
    ("semis",           "Semifinales",         2),
    ("final",           "Final",               1),
]

def get(url, params=None):
    for _ in range(3):
        try:
            r = requests.get(url, params=params, headers=H, timeout=20)
            if r.status_code == 200:
                return r.json()
        except Exception as e:
            print(f"  WARN {url}: {e}")
        time.sleep(1.5)
    return None

def arg_date(iso_str):
    if not iso_str: return ""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.astimezone(TZ_ARG).strftime("%Y-%m-%d")
    except Exception:
        return str(iso_str)[:10]

def build_team(competitor):
    team = competitor.get("team") or {}
    score = str(competitor.get("score") or "").strip()
    winner = competitor.get("winner") is True
    logo_url = ""
    logos = team.get("logos") or []
    if logos:
        logo_url = logos[0].get("href", "")
    elif team.get("logo"):
        logo_url = team["logo"]
    return {
        "nombre":       team.get("displayName") or team.get("name") or "",
        "nombre_corto": team.get("shortDisplayName") or team.get("abbreviation") or "",
        "espn_id":      str(team.get("id") or ""),
        "logo":         logo_url,
        "marcador":     score,
        "penaltis":     None,
        "ganador":      winner,
    }

def build_partido(event):
    comp = (event.get("competitions") or [{}])[0]
    competitors = comp.get("competitors") or []
    home = next((c for c in competitors if c.get("homeAway") == "home"), competitors[0] if competitors else {})
    away = next((c for c in competitors if c.get("homeAway") == "away"), competitors[1] if len(competitors) > 1 else {})
    status_type = (event.get("status") or {}).get("type") or {}
    completed = status_type.get("completed") is True
    estado = status_type.get("shortDetail") or status_type.get("description") or ""
    venue = comp.get("venue") or {}
    estadio = venue.get("fullName") or ""
    city = (venue.get("address") or {}).get("city") or ""
    if city and estadio:
        estadio = f"{estadio}, {city}"
    pen_nota = ""
    pen = False
    for note in comp.get("notes") or []:
        h = note.get("headline") or ""
        if "penal" in h.lower() or "penalty" in h.lower() or "penalt" in h.lower():
            pen_nota = h
            pen = True
    return {
        "id":         event.get("id") or "",
        "nombre":     event.get("name") or "",
        "fecha":      arg_date(event.get("date") or ""),
        "fecha_iso":  event.get("date") or "",
        "estado":     estado,
        "completado": completed,
        "penaltis":   pen,
        "local":      build_team(home),
        "visitante":  build_team(away),
        "estadio":    estadio,
        "nota":       pen_nota,
    }

def get_current_season():
    d = get(f"{ESPN_CORE}/seasons", params={"lang": "es", "limit": 5})
    if d and d.get("items"):
        years = []
        for item in d["items"]:
            m = re.search(r"/(\d{4})$", item.get("$ref", ""))
            if m: years.append(int(m.group(1)))
        if years: return max(years)
    return datetime.now().year

def scrape_season(year):
    all_events = []
    for dr in [f"{year}0101-{year}0630", f"{year}0701-{year}1231"]:
        d = get(ESPN_SB, params={"dates": dr, "limit": 200})
        if d and d.get("events"):
            all_events.extend(d["events"])
        time.sleep(0.4)
    seen = set()
    unique = []
    for ev in all_events:
        eid = ev.get("id")
        if eid and eid not in seen:
            seen.add(eid); unique.append(ev)
    return unique

def assign_fases(events):
    """
    Asigna fases a los partidos usando una estrategia multi-nivel:
    1. Si el partido tiene nota 'advance' de una ronda específica, usa esa ronda.
    2. Ordena todos los partidos por fecha y asigna fases en bloques
       según los FASE_SLOTS definidos (32, 16, 8, 4, 2, 1).
    """
    partidos = [build_partido(ev) for ev in events]
    partidos.sort(key=lambda p: (p.get("fecha_iso") or p.get("fecha") or ""))

    total = len(partidos)
    print(f"  Total partidos: {total}")

    # Strategy: assign by chronological blocks
    # Copa Argentina is single-elimination, so:
    # - If we have ~32+ matches early: those are 32avos
    # - Then ~16: dieciseisavos, etc.
    # We use cumulative count to decide the round

    # First pass: detect explicitly tagged matches (advance notes)
    # Map from event_id to detected fase
    explicit_fase = {}
    for ev in events:
        comp = (ev.get("competitions") or [{}])[0]
        for note in comp.get("notes") or []:
            h = (note.get("headline") or "").lower()
            # ESPN Copa Argentina advance notes don't specify round, just "X advance Y-Z on penalties"
            # So we can't use notes alone for round detection

    # Strategy: group by date clusters, then assign rounds
    # First cluster = 32avos (expect 32 matches)
    # We define breakpoints based on cumulative count
    cumulative_slots = []
    acc = 0
    for key, label, slots in FASE_SLOTS:
        acc += slots
        cumulative_slots.append((key, label, acc))

    fases_dict = {k: [] for k, _, _ in FASE_SLOTS}

    # Sort and assign
    assigned = 0
    for key, label, cum_limit in cumulative_slots:
        while assigned < cum_limit and assigned < len(partidos):
            fases_dict[key].append(partidos[assigned])
            assigned += 1

    # Any overflow goes to the last fase
    while assigned < len(partidos):
        fases_dict["final"].append(partidos[assigned])
        assigned += 1

    return fases_dict

def find_campeon(fases):
    for p in fases.get("final") or []:
        if p.get("completado"):
            local = p.get("local") or {}
            visit = p.get("visitante") or {}
            if local.get("ganador"):
                return {"id": local["espn_id"], "nombre": local["nombre"], "logo": local["logo"]}
            elif visit.get("ganador"):
                return {"id": visit["espn_id"], "nombre": visit["nombre"], "logo": visit["logo"]}
    return None

def main():
    print("Scrapeando Copa Argentina desde ESPN API...\n")
    season = get_current_season()
    print(f"Temporada: {season}")
    events = scrape_season(season)
    if not events:
        season -= 1
        print(f"  Sin datos, probando {season}...")
        events = scrape_season(season)
    if not events:
        print("ERROR: Sin datos"); return

    fases = assign_fases(events)
    campeon = find_campeon(fases)
    total = sum(len(v) for v in fases.values())

    print(f"\n=== Resumen ===")
    for key, label, _ in FASE_SLOTS:
        partidos = fases.get(key, [])
        done = sum(1 for p in partidos if p.get("completado"))
        print(f"  {label}: {len(partidos)} partidos ({done} completados)")
    if campeon:
        print(f"  Campeon: {campeon['nombre']}")

    result = {
        "competicion": "Copa Argentina",
        "league_slug": LEAGUE,
        "season": season,
        "actualizado": datetime.utcnow().isoformat() + "Z",
        "campeon": campeon,
        "fases": fases,
        "total_partidos": total,
    }

    for path in OUTPUTS:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"Guardado: {path}")

if __name__ == "__main__":
    main()
