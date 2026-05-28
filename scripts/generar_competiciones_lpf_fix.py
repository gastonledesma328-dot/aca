import copy
import json
import os
import re
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from html import unescape
from urllib.parse import quote, urlencode

import generar_competiciones as g

ORIGINAL_CARGAR_EQUIPOS = g.cargar_equipos
ORIGINAL_CARGAR_PARTIDOS = g.cargar_partidos
ORIGINAL_CLASIFICAR_TABLAS = g.clasificar_tablas_liga_profesional
ORIGINAL_ARMAR_ELIMINATORIAS = g.armar_eliminatorias_liga_profesional
ORIGINAL_PARSE_COMPETITOR = g.parse_competitor
ORIGINAL_PARSE_EVENT = g.parse_event

TITULOS_DATA_FILE = "data/titulos-liga-profesional.json"
TITULOS_PUBLIC_FILE = "public/data/titulos-liga-profesional.json"
WIKIPEDIA_API_URL = "https://es.wikipedia.org/w/api.php"

CLUBES_WIKIPEDIA = {
    "argentinos-juniors": "Asociación Atlética Argentinos Juniors",
    "atletico-tucuman": "Club Atlético Tucumán",
    "banfield": "Club Atlético Banfield",
    "barracas-central": "Club Atlético Barracas Central",
    "belgrano": "Club Atlético Belgrano",
    "boca-juniors": "Club Atlético Boca Juniors",
    "central-cordoba-santiago": "Club Atlético Central Córdoba (Santiago del Estero)",
    "defensa-y-justicia": "Club Social y Deportivo Defensa y Justicia",
    "deportivo-riestra": "Deportivo Riestra Asociación de Fomento Barrio Colón",
    "estudiantes-de-la-plata": "Club Estudiantes de La Plata",
    "gimnasia-la-plata": "Club de Gimnasia y Esgrima La Plata",
    "godoy-cruz": "Club Deportivo Godoy Cruz Antonio Tomba",
    "huracan": "Club Atlético Huracán",
    "independiente": "Club Atlético Independiente",
    "independiente-rivadavia": "Club Sportivo Independiente Rivadavia",
    "instituto": "Instituto Atlético Central Córdoba",
    "lanus": "Club Atlético Lanús",
    "newells-old-boys": "Club Atlético Newell's Old Boys",
    "platense": "Club Atlético Platense",
    "racing-club": "Racing Club",
    "river-plate": "Club Atlético River Plate",
    "rosario-central": "Club Atlético Rosario Central",
    "san-lorenzo": "Club Atlético San Lorenzo de Almagro",
    "san-martin-san-juan": "Club Atlético San Martín (San Juan)",
    "sarmiento-junin": "Club Atlético Sarmiento (Junín)",
    "talleres-de-cordoba": "Club Atlético Talleres (Córdoba)",
    "tigre": "Club Atlético Tigre",
    "union-santa-fe": "Club Atlético Unión (Santa Fe)",
    "velez-sarsfield": "Club Atlético Vélez Sarsfield",
}

TITULOS_FALLBACK = {
    "river-plate": 38,
    "boca-juniors": 35,
    "racing-club": 18,
    "independiente": 16,
    "san-lorenzo": 15,
    "velez-sarsfield": 10,
    "estudiantes-de-la-plata": 6,
    "newells-old-boys": 6,
    "huracan": 5,
    "rosario-central": 4,
    "argentinos-juniors": 3,
    "lanus": 2,
    "banfield": 1,
    "gimnasia-la-plata": 1,
}


def ahora_iso():
    return datetime.now(timezone.utc).isoformat()


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
    except Exception:
        return None


def date_key(value):
    d = parse_date(value)
    return d.isoformat() if d else ""


def normalizar_wiki(texto):
    texto = str(texto or "").lower().strip()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = re.sub(r"[^a-z0-9]+", " ", texto)
    return re.sub(r"\s+", " ", texto).strip()


def slug_wiki(texto):
    return normalizar_wiki(texto).replace(" ", "-")


def strip_html(html):
    html = re.sub(r"<script[\s\S]*?</script>", " ", str(html or ""), flags=re.I)
    html = re.sub(r"<style[\s\S]*?</style>", " ", html, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", unescape(text)).strip()


def wiki_get(params):
    url = f"{WIKIPEDIA_API_URL}?{urlencode(params)}"
    response = g.requests.get(url, headers={**g.HEADERS, "Accept": "application/json,text/plain,*/*"}, timeout=25)
    print(f"🌐 Wikipedia {response.status_code} {params.get('page') or ''}")
    if response.ok:
        return response.json()
    return None


def buscar_section_titulos(page):
    data = wiki_get({"action": "parse", "page": page, "prop": "sections", "format": "json", "redirects": "1"})
    sections = data.get("parse", {}).get("sections", []) if isinstance(data, dict) else []
    preferidas = []
    candidatas = []
    for section in sections:
        title = normalizar_wiki(section.get("line") or "")
        index = section.get("index")
        if not index:
            continue
        if "titulos oficiales" in title:
            preferidas.append(index)
        elif "titulos" in title or "palmares" in title:
            candidatas.append(index)
    return (preferidas or candidatas or [None])[0]


def leer_html_titulos(page):
    section = buscar_section_titulos(page)
    params = {"action": "parse", "page": page, "prop": "text", "format": "json", "redirects": "1"}
    if section:
        params["section"] = section
    data = wiki_get(params)
    return data.get("parse", {}).get("text", {}).get("*") if isinstance(data, dict) else ""


def extraer_titulos_primera(texto):
    limpio = normalizar_wiki(texto)
    patrones = [
        r"primera division[^()]{0,260}\((\d+)\s*/\s*\d+\)",
        r"liga argentina[^()]{0,260}\((\d+)\s*/\s*\d+\)",
        r"campeonato de primera[^()]{0,260}\((\d+)\s*/\s*\d+\)",
    ]
    for patron in patrones:
        match = re.search(patron, limpio, flags=re.I)
        if match:
            return int(match.group(1))

    match = re.search(r"\((\d+)\s*/\s*\d+\)", texto)
    if match:
        return int(match.group(1))
    return None


def obtener_titulos_club(slug, page):
    try:
        html = leer_html_titulos(page)
        text = strip_html(html)
        titulos = extraer_titulos_primera(text)
        fuente = "wikipedia"
        if titulos is None:
            titulos = TITULOS_FALLBACK.get(slug, 0)
            fuente = "fallback"
        return {
            "slug": slug,
            "pagina": page,
            "url": f"https://es.wikipedia.org/wiki/{quote(page.replace(' ', '_'))}#Títulos_oficiales",
            "titulos": int(titulos),
            "criterio": "Primer número del par títulos/subcampeonatos en Títulos oficiales. Ejemplo: (35/23) => 35.",
            "fuente": fuente,
            "actualizado": ahora_iso(),
        }
    except Exception as error:
        print(f"⚠️ Wikipedia falló para {page}: {error}")
        return {
            "slug": slug,
            "pagina": page,
            "titulos": int(TITULOS_FALLBACK.get(slug, 0)),
            "criterio": "Fallback por error al leer Wikipedia.",
            "fuente": "fallback",
            "error": str(error),
            "actualizado": ahora_iso(),
        }


def generar_titulos_wikipedia():
    os.makedirs("data", exist_ok=True)
    os.makedirs("public/data", exist_ok=True)
    clubes = {}
    for slug, page in CLUBES_WIKIPEDIA.items():
        clubes[slug] = obtener_titulos_club(slug, page)
        time.sleep(0.25)

    payload = {
        "actualizado": ahora_iso(),
        "criterio_general": "Se toma solo el primer número de los pares títulos/subcampeonatos. Ejemplo: (35/23) => 35.",
        "clubes": clubes,
    }
    for path in [TITULOS_DATA_FILE, TITULOS_PUBLIC_FILE]:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"✅ Generado {path}")
    return payload


def cargar_titulos_guardados():
    if not os.path.exists(TITULOS_DATA_FILE):
        return {}
    try:
        with open(TITULOS_DATA_FILE, "r", encoding="utf-8") as f:
            return (json.load(f).get("clubes") or {})
    except Exception:
        return {}


def buscar_titulo_para_equipo(team, titulos):
    keys = [team.get("slug"), team.get("id"), team.get("nombre"), team.get("nombre_corto")]
    for key in keys:
        slug = slug_wiki(key)
        if slug in titulos:
            return titulos[slug]
    return {"titulos": 0, "fuente": "sin-datos"}


def cargar_equipos_patched(league_slug):
    equipos = ORIGINAL_CARGAR_EQUIPOS(league_slug)
    if league_slug != "arg.1":
        return equipos

    titulos = cargar_titulos_guardados()
    for team in equipos:
        info = buscar_titulo_para_equipo(team, titulos)
        total = int(info.get("titulos") or 0)
        team["titulos"] = {
            "total": total,
            "liga": total,
            "fuente": info.get("fuente") or "wikipedia",
            "url": info.get("url") or "",
            "criterio": info.get("criterio") or "",
        }
    return equipos


def clean_score(value):
    if value in [None, ""]:
        return ""
    if isinstance(value, bool):
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def first_score_from_obj(obj):
    if not isinstance(obj, dict):
        return clean_score(obj)

    for key in [
        "shootoutScore",
        "shootoutscore",
        "penaltyScore",
        "penaltyscore",
        "penalties",
        "penaltyShootoutScore",
        "shootout",
        "pkScore",
        "pkscore",
        "score",
        "displayValue",
        "value",
    ]:
        value = obj.get(key)
        if value not in [None, ""] and not isinstance(value, (dict, list)):
            return clean_score(value)

    return ""


def penalty_score_from_competitor(comp):
    if not isinstance(comp, dict):
        return ""

    direct = first_score_from_obj(comp)
    if direct and any(k in comp for k in ["shootoutScore", "penaltyScore", "penalties", "penaltyShootoutScore", "shootout", "pkScore"]):
        return direct

    for key in ["shootout", "shootoutResult", "penalty", "penalties", "penaltyShootout", "statistics"]:
        value = comp.get(key)
        if isinstance(value, dict):
            score = first_score_from_obj(value)
            if score:
                return score
        elif isinstance(value, list):
            for item in value:
                score = first_score_from_obj(item)
                if score:
                    return score

    return ""


def texto_indica_penales(*values):
    text = g.normalizar(" ".join(str(v or "") for v in values))
    return any(term in text for term in ["penal", "penales", "penalty", "penalties", "shootout", "tanda"])


def parse_competitor_patched(comp):
    parsed = ORIGINAL_PARSE_COMPETITOR(comp)
    parsed["penales"] = penalty_score_from_competitor(comp)
    return parsed


def extraer_numero_fecha(event):
    candidates = []
    week = event.get("week") if isinstance(event.get("week"), dict) else {}
    season = event.get("season") if isinstance(event.get("season"), dict) else {}
    competitions = event.get("competitions") or []
    comp = competitions[0] if competitions and isinstance(competitions[0], dict) else {}

    for source in [week, season, comp.get("type") if isinstance(comp.get("type"), dict) else {}, event]:
        if not isinstance(source, dict):
            continue
        for key in ["number", "week", "round", "matchday", "value"]:
            value = source.get(key)
            if isinstance(value, int) and value > 0:
                return value
            if isinstance(value, str) and value.strip().isdigit():
                return int(value.strip())
        for key in ["text", "name", "displayName", "description", "shortName"]:
            value = str(source.get(key) or "")
            candidates.append(value)

    for text in candidates:
        clean = g.normalizar(text)
        for marker in ["fecha", "jornada", "matchday", "round"]:
            if marker in clean:
                parts = clean.replace("-", " ").split()
                for i, part in enumerate(parts):
                    if part == marker and i + 1 < len(parts) and parts[i + 1].isdigit():
                        return int(parts[i + 1])
                    if part.startswith(marker) and part.replace(marker, "").isdigit():
                        return int(part.replace(marker, ""))
    return None


def parse_event_patched(event):
    parsed = ORIGINAL_PARSE_EVENT(event)
    comp = (event.get("competitions") or [{}])[0]
    competitors = comp.get("competitors") or [] if isinstance(comp, dict) else []
    local_raw = next((c for c in competitors if c.get("homeAway") == "home"), competitors[0] if competitors else {})
    visitante_raw = next((c for c in competitors if c.get("homeAway") == "away"), competitors[-1] if competitors else {})
    status = (event.get("status") or {}).get("type") or {}

    local_pen = penalty_score_from_competitor(local_raw)
    visitante_pen = penalty_score_from_competitor(visitante_raw)

    status_text = " ".join([
        status.get("description") or "",
        status.get("detail") or "",
        status.get("shortDetail") or "",
        status.get("name") or "",
        parsed.get("estado") or "",
        parsed.get("clasificacion_texto") or "",
    ])

    hay_penales = bool(local_pen and visitante_pen) or texto_indica_penales(status_text)

    if local_pen:
        parsed.setdefault("local", {})["penales"] = local_pen
    if visitante_pen:
        parsed.setdefault("visitante", {})["penales"] = visitante_pen

    parsed["penales"] = {
        "definicion": hay_penales,
        "local": local_pen,
        "visitante": visitante_pen,
        "texto": f"Penales {local_pen} - {visitante_pen}" if local_pen and visitante_pen else "Definido por penales" if hay_penales else "",
    }
    parsed["fecha_numero"] = extraer_numero_fecha(event)
    parsed["fecha_grupo"] = date_key(parsed.get("fecha"))

    return parsed


def dedupe_matches(matches):
    seen = set()
    out = []
    for match in matches or []:
        key = match.get("id") or f"{match.get('nombre')}|{match.get('fecha')}"
        if key in seen:
            continue
        seen.add(key)
        out.append(match)
    return out


def fetch_scoreboard_date_range_param(league_slug, start, end):
    data = g.get_json(
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/scoreboard",
        {"limit": "1000", "dates": f"{start.strftime('%Y%m%d')}-{end.strftime('%Y%m%d')}"},
        tries=1,
    )
    events = data.get("events") if isinstance(data, dict) else []
    return dedupe_matches([g.parse_event(e) for e in events or []])


def fetch_scoreboard_range(league_slug, start, end):
    matches = fetch_scoreboard_date_range_param(league_slug, start, end)
    if matches:
        return matches

    current = start
    while current <= end:
        dates = current.strftime("%Y%m%d")
        data = g.get_json(
            f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/scoreboard",
            {"limit": "100", "dates": dates},
            tries=1,
        )
        events = data.get("events") if isinstance(data, dict) else []
        matches.extend([g.parse_event(e) for e in events or []])
        current += timedelta(days=1)

    return dedupe_matches(matches)


def phase_by_date(match):
    d = parse_date(match.get("fecha"))
    if not d:
        return match.get("fase") or ""

    if datetime(2026, 5, 9).date() <= d <= datetime(2026, 5, 10).date():
        return "octavos"
    if datetime(2026, 5, 12).date() <= d <= datetime(2026, 5, 14).date():
        return "cuartos"
    if datetime(2026, 5, 16).date() <= d <= datetime(2026, 5, 18).date():
        return "semis"
    if datetime(2026, 5, 23).date() <= d <= datetime(2026, 5, 25).date():
        return "final"

    return match.get("fase") or ""


def cargar_partidos_patched(league_slug, limit=14):
    if league_slug != "arg.1":
        return ORIGINAL_CARGAR_PARTIDOS(league_slug, limit)

    base = ORIGINAL_CARGAR_PARTIDOS(league_slug, limit=300)
    extra = fetch_scoreboard_range(league_slug, datetime(2026, 5, 1), datetime(2026, 5, 25))
    clausura_futuro = fetch_scoreboard_range(league_slug, datetime(2026, 7, 1), datetime(2026, 12, 31))
    partidos = dedupe_matches((base.get("todos") or []) + extra + clausura_futuro)

    for match in partidos:
        if not match.get("fase"):
            match["fase"] = phase_by_date(match)

    finalizados = [p for p in partidos if p.get("completado") or p.get("estado_tipo") == "post"]
    proximos = [p for p in partidos if not (p.get("completado") or p.get("estado_tipo") == "post")]

    finalizados.sort(key=lambda p: p.get("fecha") or "", reverse=True)
    proximos.sort(key=lambda p: p.get("fecha") or "")
    partidos.sort(key=lambda p: p.get("fecha") or "")

    return {
        "ultimos": finalizados[:limit],
        "proximos": proximos[:limit],
        "todos": partidos,
        "total_scoreboard": len(partidos),
    }


def num_stat(stats, key):
    try:
        return int(float(str((stats or {}).get(key, 0)).replace("-", "0").replace(",", ".")))
    except Exception:
        return 0


def sort_table(rows):
    return sorted(
        [copy.deepcopy(r) for r in rows or []],
        key=lambda r: (
            num_stat(r.get("stats"), "pts"),
            num_stat(r.get("stats"), "dg"),
            num_stat(r.get("stats"), "gf"),
            -num_stat(r.get("stats"), "gc"),
        ),
        reverse=True,
    )


def renumber(rows, group_name):
    final = []
    for index, row in enumerate(rows or [], start=1):
        row = copy.deepcopy(row)
        row["grupo"] = group_name
        row["stats"] = dict(row.get("stats") or {})
        row["stats"]["posicion"] = str(index)
        final.append(row)
    return final


def patched_clasificar_tablas_liga_profesional(tabla):
    zonas = {"zona_a": [], "zona_b": []}
    anual = []
    otras = []

    for row in tabla or []:
        grupo = g.normalizar(row.get("grupo", ""))

        if "anual" in grupo or "acumul" in grupo or "overall" in grupo or "general" in grupo:
            if grupo != "general":
                anual.append(row)
            else:
                otras.append(row)
        elif grupo in ["a", "zona a", "grupo a", "zone a"] or grupo.endswith(" a"):
            zonas["zona_a"].append(row)
        elif grupo in ["b", "zona b", "grupo b", "zone b"] or grupo.endswith(" b"):
            zonas["zona_b"].append(row)
        else:
            otras.append(row)

    if not zonas["zona_a"] or not zonas["zona_b"]:
        grupos = {}
        for row in tabla or []:
            grupos.setdefault(row.get("grupo") or "General", []).append(row)
        grupos_validos = [items for items in grupos.values() if 8 <= len(items) <= 16]
        if len(grupos_validos) >= 2:
            zonas["zona_a"] = grupos_validos[0]
            zonas["zona_b"] = grupos_validos[1]

    if (not zonas["zona_a"] or not zonas["zona_b"]) and len(tabla or []) >= 30:
        zonas["zona_a"] = (tabla or [])[:15]
        zonas["zona_b"] = (tabla or [])[15:30]

    zonas["zona_a"] = renumber(sort_table(zonas["zona_a"]), "Zona A")
    zonas["zona_b"] = renumber(sort_table(zonas["zona_b"]), "Zona B")

    if anual:
        anual = renumber(sort_table(anual), "Tabla anual")
        anual_estimado = False
    else:
        base = zonas["zona_a"] + zonas["zona_b"]
        anual = renumber(sort_table(base), "Tabla anual")
        anual_estimado = True

    return {
        "zona_a": zonas["zona_a"],
        "zona_b": zonas["zona_b"],
        "tabla_anual": anual,
        "tabla_anual_estimado": anual_estimado,
        "otras_tablas": otras,
    }


def patched_armar_eliminatorias_liga_profesional(partidos):
    fases = {
        "octavos": [],
        "cuartos": [],
        "semis": [],
        "final": [],
    }

    all_matches = partidos.get("todos", []) if isinstance(partidos, dict) else []

    for match in all_matches:
        fase = match.get("fase") or phase_by_date(match)
        if fase in fases:
            item = copy.deepcopy(match)
            item["fase"] = fase
            item["ganador"] = g.ganador_partido(match)
            fases[fase].append(item)

    for fase in fases:
        fases[fase] = dedupe_matches(sorted(fases[fase], key=lambda x: x.get("fecha") or ""))

    return {
        "nombre": "Playoffs Torneo Apertura",
        "fases": fases,
        "orden": ["octavos", "cuartos", "semis", "final"],
        "tiene_datos": any(len(v) for v in fases.values()),
        "nota": "Los cruces se completan con ESPN. Si ESPN no etiqueta la fase, se infiere por fecha del calendario del Apertura 2026.",
    }


def pertenece_rango(match, inicio, fin):
    d = parse_date(match.get("fecha"))
    return bool(d and inicio.date() <= d <= fin.date())


def agrupar_fechas(matches):
    matches = sorted(matches or [], key=lambda p: p.get("fecha") or "")
    grupos = {}

    for match in matches:
        numero = match.get("fecha_numero")
        if numero:
            key = f"fecha-{numero:02d}"
            label = f"Fecha {numero}"
        else:
            key = match.get("fecha_grupo") or date_key(match.get("fecha")) or "sin-fecha"
            label = "Fecha por confirmar" if key == "sin-fecha" else f"Fecha {len(grupos) + 1}"

        if key not in grupos:
            grupos[key] = {"id": key, "nombre": label, "partidos": []}
        grupos[key]["partidos"].append(match)

    fechas = list(grupos.values())
    fechas.sort(key=lambda item: item["partidos"][0].get("fecha") if item["partidos"] else "")

    if not any(m.get("fecha_numero") for m in matches):
        for index, item in enumerate(fechas, start=1):
            item["nombre"] = f"Fecha {index}"

    return fechas


def cargar_fechas_liga_profesional(partidos):
    todos = partidos.get("todos", []) if isinstance(partidos, dict) else []
    apertura_inicio = datetime(2026, 1, 1)
    apertura_fin = datetime(2026, 6, 30)
    clausura_inicio = datetime(2026, 7, 1)
    clausura_fin = datetime(2026, 12, 31)

    apertura = [m for m in todos if pertenece_rango(m, apertura_inicio, apertura_fin) and not (m.get("fase") in ["octavos", "cuartos", "semis", "final"])]
    clausura = [m for m in todos if pertenece_rango(m, clausura_inicio, clausura_fin) and not (m.get("fase") in ["octavos", "cuartos", "semis", "final"])]

    return {
        "apertura": agrupar_fechas(apertura),
        "clausura": agrupar_fechas(clausura),
        "rangos": {
            "apertura": "20260101-20260630",
            "clausura": "20260701-20261231",
        },
        "fuente": "ESPN scoreboard arg.1 con parámetro dates",
        "nota": "Las fechas se llenan automáticamente cuando ESPN publica partidos en el scoreboard. Si ESPN no trae número de fecha, se agrupa por día/calendario.",
    }


def patched_especial_liga_profesional(tabla, partidos):
    tablas = patched_clasificar_tablas_liga_profesional(tabla)
    return {
        "tipo": "liga_profesional_argentina",
        "torneo_actual": "Clausura",
        "torneo_anterior": "Apertura",
        "zonas": {
            "a": tablas["zona_a"],
            "b": tablas["zona_b"],
        },
        "tabla_anual": tablas["tabla_anual"],
        "tabla_anual_estimado": tablas["tabla_anual_estimado"],
        "eliminatorias": patched_armar_eliminatorias_liga_profesional(partidos),
        "fechas": cargar_fechas_liga_profesional(partidos),
    }


g.cargar_equipos = cargar_equipos_patched
g.parse_competitor = parse_competitor_patched
g.parse_event = parse_event_patched
g.cargar_partidos = cargar_partidos_patched
g.clasificar_tablas_liga_profesional = patched_clasificar_tablas_liga_profesional
g.armar_eliminatorias_liga_profesional = patched_armar_eliminatorias_liga_profesional
g.especial_liga_profesional = patched_especial_liga_profesional

if __name__ == "__main__":
    generar_titulos_wikipedia()
    g.main()
