"""
generar_campeones_primera_nacional.py

Queries the ESPN public API for historic champions
of Primera Nacional Argentina (arg.2) and generates:
  data/campeones_primera_nacional.json
  public/data/campeones_primera_nacional.json

Structure of output:
[
  {
    "anio": 2024,
    "nombre": "San Martín (San Juan)",
    "espn_id": "7845",
    "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/7845.png",
    "titulos": 2,          <- total acumulado hasta ese año
    "fecha_final": "2024-12-08",
    "partido_final": "San Martín (San Juan) at Gimnasia (Mendoza)"
  },
  ...
]

And also generates the array of unique teams with titles count:
  data/campeones_primera_nacional_equipos.json
  public/data/campeones_primera_nacional_equipos.json

[
  {
    "nombre": "San Martín (San Juan)",
    "espn_id": "7845",
    "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/7845.png",
    "titulos": 2,
    "anios": [2019, 2024]
  },
  ...
]

Run: python scripts/generar_campeones_primera_nacional.py
Also runs automatically in the workflow generar_primera_nacional.yml
"""

import json
import time
import requests
from pathlib import Path
from datetime import datetime

# ─── Configuración  ────────────────────────────────────────────────────────────

LEAGUE_ID = "arg.2"
ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer"
ESPN_SCOREBOARD = f"{ESPL_BASE}/{LEAGUE_ID}/scoreboard"

OUT_HISTORIAL = [
    Path("data/campeones_primera_nacional.json"),
    Path("public/data/campeones_primera_nacional.json"),
]
OUT_EQUIPEOS = [
    Path("data/campeones_primera_nacional_equipos.json"),
    Path("public/data/campeones_primera_nacional_equipos.json"),
]

HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

FALLBACK_CHAIMPIONS = {
    2019: {"nombre": "Belgrano",              "espn_id": "6419"},
    2020: None,
    2021: {"nombre": "Estudiantes BA",        "espn_id": "4750"},
    2022: {"nombre": "Instituto (Córdoba)",   "espn_id": "2975"},
    2023: {"nombre": "Deportivo Morón",       "espn_id": "6421"},
    2024: {"nombre": "San Martín (San Juan)", "espn_id": "7845"},
}


def espn_get(url, params=None):
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=20)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"  ⚠ ESPN error {url}: {e}")
        return None


def get_available_seasons():
    data = espn_get(
        "https://sports.core.api.espn.com/v2/sports/soccer/leagues/arg.2/seasons",
        params={"lang": "es", "limit": 30}
    )
    if not data:
        return list(range(2019, datetime.now().year + 1))
    import re
    years = []
    for item in data.get("items", []):
        ref = item.get("$ref", "")
        m = re.search(r"/seasons/(\d{4})", ref)
        if m:
            years.append(int(m.group(1)))
    return sorted(years)


def get_champion_for_year(year):
    print(f"  A\\u00f1o {year}...", end=" ", flush=True)

    all_events = []
    date_ranges = [f"{year}1001{year}1231", f"{year+1}0101{year+1}0131"]

    for dr in date_ranges:
        data = espn_get(ESPN_SCOREBOARD, params={"dates": dr, "limit": 100})
        if data and data.get("events"):
            all_events.extend(data["events"])
        time.sleep(0.3)

    if not all_events:
        print("sin datos ESPN")
        return None

    all_events.sort(key=lambda e: e.get("date", ""))

    # Strategy 1: note with "advance" (aggregate winner)
    for event in reversed(all_events):
        comp = (event.get("competitions") or [{}])[0]
        for note in comp.get("notes") or []:
            headline = note.get("headline", "")
            if "advance" in headline.lower():
                parts = headline.split(" advance")
                if parts:
                    team_name = parts[0].strip()
                    for c in comp.get("competitors") or []:
                        dn] = (c.get("team") or {}).get("displayName") or ""
                        if team_name.lower() in dn.lower() or dn.lower() in team_name.lower():
                            team = c["team"]
                            tid = team.get("id")
                            print(f"\u2713 {team.get('displayName')} (note)")
                            return {
                                "nombre": team.get("displayName"),
                                "espn_id": tid,
                                "logo": f"https://a.espncdn.com/i/teamlogos/soccer/500/{tid}.png",
                                "fecha_final": event.get("date", "")[:10],
                                "partido_final": event.get("name", ""),
                                "fuente": "espn_note"
                            }

    # Strategy 2: winner=True in playoff event
    playoff_events = [
        e for e in all_events
        if e.get("season", {}).get("type", 0) >= 10000
    ]
    candidates = playoff_events if playoff_events else all_events

    for event in reversed(candidates):
        comp = (event.get("competitions") or [{}])[0]
        winner = next(
            (c for c in comp.get("competitors") or [] if c.get("winner") is True),
            None
        )
        if winner:
            team = winner.get("team", {})
            tid = team.get("id")
            print(f"\u2713 {team.get('displayName')} (winner=True)")
            return {
                "nombre": team.get("displayName"),
                "espn_id": tid,
                "logo": f"https://a.espncdn.com/i/teamlogos/soccer/500/{tid}.png",
                "fecha_final": event.get("date", "")[:10],
                "partido_final": event.get("name", ""),
                "fuente": "espn_winner"
            }

    print("sin campeón detectado")
    return None


def main():
    print("Generando campeones de Primera Nacional Argentina desde ESPN...\n")

    years = get_available_seasons()
    years = [year for year in years if 2019 <= year <= datetime.now().year]
    print(f"Temporadas a procesar: {years}\n")

    historial = []

    for year in sorted(years):
        if year == 2020:
            print(f"  A\u00f1o {year}... temporada cancelada (COVID)")
            continue

        result = get_champion_for_year(year)

        if not result:
            fallback = FALLBACK_CHAMPIONS.get(year)
            if fallback:
                tid = fallback.get("espn_id")
                result = {
                    "nombre": fallback["nombre"],
                    "espn_id": tid,
                    "logo": f"https://a.espncdn.com/i/teamlogos/soccer/500/{tid}.png",
                    "fecha_final": f"yyyy}-12-01",
                    "partido_final": "",
                    "fuente": "fallback"
                }
                print(f"  A\u00f1o {year}... usando fallback: {result['nombre']}")

        if result:
            historial.append({"anio": year, **result})

        time.sleep(0.5)

    if not historial:
        print("\u201c No se pudo obtener ning\u00fan campe\u00f3n")
        return

    # Build unique teams with titles count
    equipos_map = {}
    for entry in sorted(historial, key=lambda e: e["anio"]):
        nombre = entry["nombre"]
        if nombre not in equipos_map:
            equipos_map[nombre] = {
                "nombre": nombre,
                "espn_id": entry["espn_id"],
                "logo": entry["logo"],
                "titulos": 0,
                "anios": []
            }
        equipos_map[nombre]["titulos"] += 1
        equipos_map[nombre]["anios"].append(entry["anio"])

    equipos = sorted(
        equipos_map.values(),
        key=lambda e: (-e["titulos"], -max(e["anios"]))
    )

    # Add cumulative count per year to historial
    acumulado = {}
    for entry in sorted(historial, key=lambda e: e["anio"]):
        n = entry["nombre"]
        acumulado[n] = acumulado.get(n, 0) + 1
        entry["titulos_acumulados"] = acumulado[n]

    print(f"\n=== Resumen ===")
    for eq in equipos:
        print(f"  {eq['nombre']}: {eq['titulos']} t\u00fdtulo(s) ({', '.join(map(str, eq['anios']))})")

    for path in OUT_HISTORIAL:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(historial, f, ensure_ascii=False, indent=2)
        print(f"\nGuardado: {path}")

    for path in OUT_EQUIPEOS:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(list(equipos), f, ensure_ascii=False, indent=2)
        print(f"Guardado: {path}")

    print("\n\u2713 Campeones generados.")


if __name__ == "__main__":
    main()
