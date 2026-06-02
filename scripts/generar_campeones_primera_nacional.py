"""
generar_campeones_primera_nacional.py

Consulta la API pública de ESPN para detectar el campeón de cada
temporada reciente de Primera Nacional Argentina (arg.2) y actualiza:
  data/campeones_primera_nacional.json
  public/data/campeones_primera_nacional.json

IMPORTANTE: NO sobreescribe campeones_primera_nacional_equipos.json.
Ese archivo contiene el palmarés histórico completo (desde 1986) y se
mantiene manualmente. Este script sólo actualiza el historial por año.

Estrategias para detectar campeón:
  1. competitions[0].notes con "advance" → equipo que avanzó por agregado
  2. competitors[].winner === true en el último partido de playoff
"""

import json
import re
import time
import requests
from pathlib import Path
from datetime import datetime

# ─── Configuración ─────────────────────────────────────────────────────────────

LEAGUE_ID = "arg.2"
ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer"
ESPN_SCOREBOARD = f"{ESPN_BASE}/{LEAGUE_ID}/scoreboard"

OUT_HISTORIAL = [
    Path("data/campeones_primera_nacional.json"),
    Path("public/data/campeones_primera_nacional.json"),
]

HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

# Fallback para años sin datos ESPN claros
FALLBACK_CHAMPIONS = {
    2019: {"nombre": "Belgrano",               "espn_id": "4"},
    2021: {"nombre": "Estudiantes de La Plata","espn_id": "8"},
    2022: {"nombre": "Instituto (Córdoba)",    "espn_id": "2975"},
    2023: {"nombre": "Deportivo Morón",        "espn_id": "10154"},
    2024: {"nombre": "San Martín (San Juan)",  "espn_id": "7845"},
}


# ─── ESPN helpers ──────────────────────────────────────────────────────────────

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
    years = []
    for item in data.get("items", []):
        ref = item.get("$ref", "")
        m = re.search(r"/seasons/(\d{4})", ref)
        if m:
            years.append(int(m.group(1)))
    return sorted(years)


def get_champion_for_year(year):
    print(f"  Año {year}...", end=" ", flush=True)

    all_events = []
    date_ranges = [
        f"{year}1001-{year}1231",
        f"{year + 1}0101-{year + 1}0131",
    ]

    for dr in date_ranges:
        data = espn_get(ESPN_SCOREBOARD, params={"dates": dr, "limit": 100})
        if data and data.get("events"):
            all_events.extend(data["events"])
        time.sleep(0.3)

    if not all_events:
        print("sin datos ESPN")
        return None

    all_events.sort(key=lambda e: e.get("date", ""))

    # Estrategia 1: nota con "advance" (ganador por agregado)
    for event in reversed(all_events):
        comp = (event.get("competitions") or [{}])[0]
        for note in comp.get("notes") or []:
            headline = note.get("headline", "")
            if "advance" in headline.lower():
                team_name = headline.split(" advance")[0].strip()
                for c in comp.get("competitors") or []:
                    dn = (c.get("team") or {}).get("displayName") or ""
                    if team_name.lower() in dn.lower() or dn.lower() in team_name.lower():
                        team = c["team"]
                        tid = team.get("id")
                        print(f"✓ {team.get('displayName')} (nota advance)")
                        return {
                            "nombre": team.get("displayName"),
                            "espn_id": tid,
                            "logo": f"https://a.espncdn.com/i/teamlogos/soccer/500/{tid}.png",
                            "fecha_final": event.get("date", "")[:10],
                            "partido_final": event.get("name", ""),
                            "fuente": "espn_note",
                        }

    # Estrategia 2: winner=True en playoff (seasonType >= 10000)
    playoff_events = [
        e for e in all_events
        if e.get("season", {}).get("type", 0) >= 10000
    ]
    candidates = playoff_events if playoff_events else all_events

    for event in reversed(candidates):
        comp = (event.get("competitions") or [{}])[0]
        winner = next(
            (c for c in comp.get("competitors") or [] if c.get("winner") is True),
            None,
        )
        if winner:
            team = winner.get("team", {})
            tid = team.get("id")
            print(f"✓ {team.get('displayName')} (winner=True)")
            return {
                "nombre": team.get("displayName"),
                "espn_id": tid,
                "logo": f"https://a.espncdn.com/i/teamlogos/soccer/500/{tid}.png",
                "fecha_final": event.get("date", "")[:10],
                "partido_final": event.get("name", ""),
                "fuente": "espn_winner",
            }

    print("sin campeón detectado")
    return None


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Generando historial de campeones de Primera Nacional desde ESPN...\n")

    years = get_available_seasons()
    years = [y for y in years if 2019 <= y <= datetime.now().year]
    print(f"Temporadas a procesar: {years}\n")

    historial = []

    for year in sorted(years):
        if year == 2020:
            print(f"  Año {year}... temporada cancelada (COVID)")
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
                    "fecha_final": f"{year}-12-01",
                    "partido_final": "",
                    "fuente": "fallback",
                }
                print(f"  Año {year}... fallback: {result['nombre']}")

        if result:
            historial.append({"anio": year, **result})

        time.sleep(0.5)

    if not historial:
        print("✗ No se pudo obtener ningún campeón")
        return

    # Acumulado de títulos por año
    acumulado = {}
    for entry in sorted(historial, key=lambda e: e["anio"]):
        n = entry["nombre"]
        acumulado[n] = acumulado.get(n, 0) + 1
        entry["titulos_acumulados"] = acumulado[n]

    print(f"\n=== Resumen ===")
    for n, t in sorted(acumulado.items(), key=lambda x: -x[1]):
        print(f"  {n}: {t} título(s)")

    # Guardar SOLO el historial por año — NO tocar campeones_primera_nacional_equipos.json
    for path in OUT_HISTORIAL:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(historial, f, ensure_ascii=False, indent=2)
        print(f"Guardado: {path}")

    print("\n✓ Historial de campeones generado.")


if __name__ == "__main__":
    main()
