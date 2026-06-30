"""
Debug v2 — busca la URL correcta de standings en ESPN.
python debug_standings2.py
"""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from scripts.core.http_client import HttpClient

http = HttpClient(cache_ttl=0)

# Candidatas a ser la URL real de standings
candidates = [
    ("site/v2 standings",         "https://site.api.espn.com/apis/site/v2/sports/soccer/ARG.1/standings"),
    ("site/v2 table",             "https://site.api.espn.com/apis/site/v2/sports/soccer/ARG.1/table"),
    ("site/v2 ?season=2025",      "https://site.api.espn.com/apis/site/v2/sports/soccer/ARG.1/standings?season=2025"),
    ("site/v2 ?dates=2025",       "https://site.api.espn.com/apis/site/v2/sports/soccer/ARG.1/standings?dates=2025"),
    ("site.web standings",        "https://site.web.api.espn.com/apis/v2/sports/soccer/ARG.1/standings"),
    ("site.web table",            "https://site.web.api.espn.com/apis/v2/sports/soccer/ARG.1/table"),
    ("sports.core standings",     "https://sports.core.api.espn.com/v2/sports/soccer/leagues/ARG.1/standings"),
    ("sports.core seasons",       "https://sports.core.api.espn.com/v2/sports/soccer/leagues/ARG.1/seasons/2025/types/2/groups"),
    ("cdn core standings",        "https://cdn.api.espn.com/v1/sports/soccer/ARG.1/standings"),
    ("ENG.1 site/v2 standings",   "https://site.api.espn.com/apis/site/v2/sports/soccer/ENG.1/standings"),
    ("ENG.1 sports.core",         "https://sports.core.api.espn.com/v2/sports/soccer/leagues/ENG.1/standings"),
    ("ENG.1 ?season=2025",        "https://site.api.espn.com/apis/site/v2/sports/soccer/ENG.1/standings?season=2025"),
]

for label, url in candidates:
    raw = http.get(url)
    if raw is None:
        print(f"  ✗ None   — {label}")
    elif raw == {}:
        print(f"  ⚠ Empty  — {label}")
    else:
        keys = list(raw.keys())[:8]
        print(f"  ✓ DATA   — {label}")
        print(f"           Keys: {keys}")
        # Mostrar un poco más de estructura
        for k in ["standings","children","groups","entries","leagues","seasons"]:
            v = raw.get(k)
            if v:
                sz = len(v) if isinstance(v, list) else "dict"
                print(f"           raw['{k}']: {sz}")
                if isinstance(v, list) and v:
                    print(f"           first item keys: {list(v[0].keys())[:6] if isinstance(v[0], dict) else '?'}")

http.close()