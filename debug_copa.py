"""
debug_copa.py — Encuentra el league code correcto de Copa Argentina en ESPN.
Copiar a la raíz del repo y correr: python debug_copa.py
"""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from scripts.core.http_client import HttpClient

http = HttpClient(cache_ttl=0)

candidates = [
    "arg.copa_argentina",
    "arg.copa",
    "arg.copaar",
    "arg.fa",
    "arg.cup",
    "arg.copar",
    "arg.copa-argentina",
    "arg.3",
    "arg.4",
]

print("Buscando league code de Copa Argentina...\n")
for code in candidates:
    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{code}/scoreboard"
    raw = http.get(url)
    if raw is None:
        print(f"  ✗ {code}")
    else:
        events = raw.get("events", [])
        print(f"  ✓ {code} — {len(events)} eventos")

# También intentar buscar en el scoreboard de arg.1 partidos que mencionen "Copa"
print("\nBuscando menciones de Copa Argentina en scoreboard ARG.1...")
raw = http.get("https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/scoreboard")
if raw:
    for event in raw.get("events", []):
        name = event.get("name", "")
        league = event.get("competitions", [{}])[0].get("league", {})
        if "copa" in name.lower() or "copa" in str(league).lower():
            print(f"  → {name} | league: {league}")

http.close()
