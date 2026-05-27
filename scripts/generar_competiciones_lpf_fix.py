import copy
from datetime import datetime, timedelta

import generar_competiciones as g

ORIGINAL_CARGAR_PARTIDOS = g.cargar_partidos
ORIGINAL_CLASIFICAR_TABLAS = g.clasificar_tablas_liga_profesional
ORIGINAL_ARMAR_ELIMINATORIAS = g.armar_eliminatorias_liga_profesional


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


def fetch_scoreboard_range(league_slug, start, end):
    matches = []
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

    # Torneo Apertura 2026: calendario de playoffs informado públicamente.
    # Si ESPN no etiqueta la fase, la inferimos por fecha.
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

    # Default actual + rango completo de playoffs del Apertura.
    base = ORIGINAL_CARGAR_PARTIDOS(league_slug, limit=300)
    extra = fetch_scoreboard_range(league_slug, datetime(2026, 5, 1), datetime(2026, 5, 25))
    partidos = dedupe_matches((base.get("todos") or []) + extra)

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
            # No usamos "General" como anual si contiene 30 equipos repetidos de zonas mezcladas sin grupo claro.
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

    # Último fallback: si ESPN entrega una sola tabla de 30, se separa 15/15 solo para no dejar vacío.
    if (not zonas["zona_a"] or not zonas["zona_b"]) and len(tabla or []) >= 30:
        zonas["zona_a"] = (tabla or [])[:15]
        zonas["zona_b"] = (tabla or [])[15:30]

    zonas["zona_a"] = renumber(sort_table(zonas["zona_a"]), "Zona A")
    zonas["zona_b"] = renumber(sort_table(zonas["zona_b"]), "Zona B")

    if anual:
        anual = renumber(sort_table(anual), "Tabla anual")
        anual_estimado = False
    else:
        # Como el Clausura todavía no empezó, la anual correcta sale de sumar/ordenar la fase de zonas disponible.
        # Cuando ESPN publique Clausura, este mismo bloque tomará los puntos disponibles que traiga la API.
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


g.cargar_partidos = cargar_partidos_patched
g.clasificar_tablas_liga_profesional = patched_clasificar_tablas_liga_profesional
g.armar_eliminatorias_liga_profesional = patched_armar_eliminatorias_liga_profesional

if __name__ == "__main__":
    g.main()
