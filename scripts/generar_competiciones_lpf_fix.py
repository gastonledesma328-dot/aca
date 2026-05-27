import copy
from datetime import datetime, timedelta

import generar_competiciones as g

ORIGINAL_CARGAR_PARTIDOS = g.cargar_partidos
ORIGINAL_CLASIFICAR_TABLAS = g.clasificar_tablas_liga_profesional
ORIGINAL_ARMAR_ELIMINATORIAS = g.armar_eliminatorias_liga_profesional
ORIGINAL_PARSE_COMPETITOR = g.parse_competitor
ORIGINAL_PARSE_EVENT = g.parse_event


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


g.parse_competitor = parse_competitor_patched
g.parse_event = parse_event_patched
g.cargar_partidos = cargar_partidos_patched
g.clasificar_tablas_liga_profesional = patched_clasificar_tablas_liga_profesional
g.armar_eliminatorias_liga_profesional = patched_armar_eliminatorias_liga_profesional
g.especial_liga_profesional = patched_especial_liga_profesional

if __name__ == "__main__":
    g.main()
