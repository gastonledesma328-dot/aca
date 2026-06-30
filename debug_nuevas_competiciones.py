"""
debug_nuevas_competiciones.py — Verifica qué competiciones nuevas existen en ESPN.
Copiar a la raíz del repo y correr: python debug_nuevas_competiciones.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from scripts.core.http_client import HttpClient

http = HttpClient(cache_ttl=0)

candidates = [
    # SELECCIONES
    ("Mundial Sub-20",              "fifa.world.u20"),
    ("Mundial Sub-20 alt",          "fifa.wwc.u20"),
    ("Copa América",                "conmebol.america"),
    ("Eurocopa",                    "uefa.euro"),
    ("UEFA Nations League",         "uefa.nations"),
    ("Elim. Eurocopa",              "fifa.worldq.uefa.euro"),
    ("Elim. Eurocopa alt",          "uefa.euro.qualifying"),
    ("Sudamericano Sub-20",         "conmebol.u20"),
    ("Sudamericano Sub-20 alt",     "conmebol.youth"),
    ("Elim. CONCACAF",              "fifa.worldq.concacaf"),
    ("Elim. CONCACAF alt",          "concacaf.worldq"),
    # INGLATERRA
    ("Carabao Cup",                 "eng.league_cup"),
    ("Carabao Cup alt",             "eng.efl_cup"),
    ("FA Cup",                      "eng.fa"),
    ("FA Cup alt",                  "eng.cup"),
    # ESPAÑA
    ("Copa del Rey",                "esp.copa_del_rey"),
    ("Copa del Rey alt",            "esp.copa"),
    ("Supercopa España",            "esp.super_cup"),
    ("Supercopa España alt",        "esp.supercopa"),
    # ITALIA
    ("Coppa Italia",                "ita.coppa_italia"),
    ("Coppa Italia alt",            "ita.cup"),
    ("Supercopa Italia",            "ita.super_cup"),
    ("Supercopa Italia alt",        "ita.supercopa"),
]

print(f"{'Competición':<30} {'Code':<35} {'Status'}")
print("-" * 80)

found = []
for name, code in candidates:
    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{code}/scoreboard"
    raw = http.get(url)
    if raw is None:
        status = "✗ Error/404"
    elif raw == {}:
        status = "⚠ Vacío"
    else:
        events = len(raw.get("events", []))
        status = f"✓ OK — {events} eventos"
        found.append((name, code))
    print(f"  {name:<30} {code:<35} {status}")

print(f"\n✓ Encontradas: {len(found)}")
for name, code in found:
    print(f"  {name}: {code}")

http.close()
