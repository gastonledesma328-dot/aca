"""
Scraper Copa Argentina - ESPN API
Genera copa_argentina_bracket.json con mapeo de cruces real.

LOGICA DE CRUCES (sorteo abierto):
Copa Argentina NO tiene llaves fijas. Cada fase se define por sorteo.
Solucion: al parsear cada fase, buscamos en la fase anterior cual
partido produjo a cada equipo (por nombre de ganador) y guardamos
src_local y src_visitante (indices de los partidos fuente).
El bracket JS usa estos indices para dibujar las lineas correctas.
"""

import requests, json, os
from datetime import datetime

BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/arg.copa/scoreboard"
SEASONS = [2026]
OUT_DATA   = os.path.join(os.path.dirname(__file__), "../data/copa_argentina_bracket.json")
OUT_PUBLIC = os.path.join(os.path.dirname(__file__), "../public/data/copa_argentina_bracket.json")

ORDEN = ["treintaidosavos","dieciseisavos","octavos","cuartos","semis","final"]

ROUND_MAP = {
    "round of 64":"treintaidosavos","32avos":"treintaidosavos","primera ronda":"treintaidosavos",
    "round of 32":"dieciseisavos","16avos":"dieciseisavos","dieciseisavos":"dieciseisavos","segunda ronda":"dieciseisavos",
    "round of 16":"octavos","octavos":"octavos","tercera ronda":"octavos",
    "quarterfinal":"cuartos","cuartos":"cuartos",
    "semifinal":"semis","semifinales":"semis","semis":"semis",
    "final":"final","gran final":"final",
}

def clasificar(texto):
    if not texto: return None
    t = texto.lower()
    for k,v in ROUND_MAP.items():
        if k in t: return v
    return None

def parse_team(c, completado):
    t = c.get("team",{})
    logos = t.get("logos",[])
    logo = logos[0].get("href","") if logos else ""
    return {
        "id": t.get("id",""),
        "nombre": t.get("displayName", t.get("name","")),
        "nombre_corto": t.get("abbreviation", t.get("shortDisplayName","")),
        "logo": logo,
        "marcador": c.get("score","") if completado else "",
        "ganador": bool(c.get("winner")) if completado else False,
    }

def parse_evento(ev):
    comp = (ev.get("competitions") or [{}])[0]
    comps = comp.get("competitors",[])
    local    = next((c for c in comps if c.get("homeAway")=="home"), comps[0] if comps else {})
    visitante= next((c for c in comps if c.get("homeAway")=="away"), comps[1] if len(comps)>1 else {})
    completado = ev.get("status",{}).get("type",{}).get("completed",False)

    pen = False
    nota_txt = ""
    for n in comp.get("notes",[]):
        h = n.get("headline","")
        if h:
            nota_txt = h
            if any(x in h.lower() for x in ["pen","penalt","penales"]): pen=True

    fase = clasificar(nota_txt) or clasificar(ev.get("name",""))

    venue = comp.get("venue",{})
    estadio = venue.get("fullName","") or venue.get("shortName","")
    ciudad  = venue.get("address",{}).get("city","")
    if ciudad and estadio: estadio = f"{estadio}, {ciudad}"

    fecha_iso = ev.get("date","")
    return {
        "id":       ev.get("id",""),
        "fase":     fase,
        "nombre":   ev.get("name",""),
        "fecha":    fecha_iso[:10] if fecha_iso else "",
        "fecha_iso":fecha_iso,
        "local":    parse_team(local, completado),
        "visitante":parse_team(visitante, completado),
        "completado": completado,
        "penaltis": pen,
        "estadio":  estadio,
        "nota":     nota_txt,
        # campos de cruce (se calculan despuÃ©s)
        "src_local":    None,
        "src_visitante":None,
    }

def fetch_year(year):
    events = []
    for start,end in [(f"{year}0101",f"{year}0630"),(f"{year}0701",f"{year}1231")]:
        url = f"{BASE}?dates={start}-{end}&limit=200"
        try:
            r = requests.get(url, timeout=15)
            r.raise_for_status()
            evs = r.json().get("events",[])
            events.extend(evs)
            print(f"  {start}-{end}: {len(evs)} ev")
        except Exception as e:
            print(f"  ERROR {start}-{end}: {e}")
    seen, unique = set(), []
    for ev in events:
        eid = ev.get("id")
        if eid and eid not in seen:
            seen.add(eid); unique.append(ev)
    return unique

def build_winner_index(partidos):
    """Mapa: nombre_normalizado -> indice del partido donde ese equipo fue ganador."""
    idx = {}
    for i, p in enumerate(partidos):
        for team_key in ["local","visitante"]:
            t = p.get(team_key,{})
            if t.get("ganador"):
                for nombre in [t.get("nombre_corto",""), t.get("nombre","")]:
                    n = nombre.strip()
                    if n: idx[n] = i
    return idx

def nombres_equipo(p, key):
    t = p.get(key,{})
    names = []
    for k in ["nombre_corto","nombre"]:
        n = t.get(k,"").strip()
        if n: names.append(n)
    return names

def calcular_cruces(por_fase):
    """
    Para cada partido de cada fase (desde la segunda),
    busca en la fase anterior cuÃ¡l partido produjo cada equipo
    (por nombre de ganador) y guarda el Ã­ndice como src_local / src_visitante.
    """
    for fi in range(1, len(ORDEN)):
        fase_actual   = ORDEN[fi]
        fase_anterior = ORDEN[fi-1]
        partidos_act  = por_fase.get(fase_actual, [])
        partidos_ant  = por_fase.get(fase_anterior, [])
        win_idx       = build_winner_index(partidos_ant)

        for p in partidos_act:
            # buscar src_local
            for n in nombres_equipo(p,"local"):
                if n in win_idx:
                    p["src_local"] = win_idx[n]; break
            # buscar src_visitante
            for n in nombres_equipo(p,"visitante"):
                if n in win_idx:
                    p["src_visitante"] = win_idx[n]; break

    return por_fase

def build(year):
    print(f"\n=== Copa Argentina {year} ===")
    evs_raw = fetch_year(year)
    print(f"Total: {len(evs_raw)} eventos Ãºnicos")
    if not evs_raw: return None

    partidos = []
    for ev in evs_raw:
        p = parse_evento(ev)
        if p["fase"]: partidos.append(p)
        else: print(f"  Sin fase: {ev.get('name',''[:60])} | id={ev.get('id')}")

    por_fase = {k:[] for k in ORDEN}
    for p in partidos:
        if p["fase"] in por_fase:
            por_fase[p["fase"]].append(p)

    # Ordenar cada fase por fecha + id (orden cronolÃ³gico dentro de la fase)
    for fase in ORDEN:
        por_fase[fase].sort(key=lambda p: (p.get("fecha",""), p.get("id","")))

    # Calcular cruces
    por_fase = calcular_cruces(por_fase)

    for fase in ORDEN:
        n = len(por_fase[fase])
        j = sum(1 for p in por_fase[fase] if p.get("completado"))
        mapeados = sum(1 for p in por_fase[fase] if p.get("src_local") is not None)
        if n: print(f"  {fase}: {n} partidos, {j} jugados, {mapeados} con src mapeado")

    # CampeÃ³n
    campeon = None
    for p in por_fase.get("final",[]):
        if p.get("completado"):
            t = p["local"] if p["local"].get("ganador") else p["visitante"]
            campeon = {"nombre": t["nombre"], "logo": t["logo"]}

    return {
        "season": year,
        "campeon": campeon,
        "actualizado": datetime.utcnow().isoformat()+"Z",
        "fases": por_fase,
    }

def save(data, path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path,"w",encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Guardado: {path}")

if __name__ == "__main__":
    for year in SEASONS:
        data = build(year)
        if data:
            save(data, OUT_DATA)
            save(data, OUT_PUBLIC)
