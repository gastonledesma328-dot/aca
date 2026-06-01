import json
import os
import time
from datetime import datetime, timezone

import requests

LEAGUE_SLUG = "arg.2"
SEASON = "2026"
OUTPUT_FILE = "data/primera_nacional_fechas.json"
PUBLIC_OUTPUT_FILE = "public/data/primera_nacional_fechas.json"
PARTIDOS_POR_FECHA = 18
TOTAL_FECHAS_REGULARES = 36
TOTAL_PARTIDOS_REGULARES = PARTIDOS_POR_FECHA * TOTAL_FECHAS_REGULARES

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.espn.com.ar/",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


def get_json(url):
    try:
        r = SESSION.get(url, timeout=30)
        print(f"ð {r.status_code} {url}")
        if not r.ok:
            return None
        return r.json()
    except Exception as e:
        print(f"â ï¸ Error leyendo JSON: {e} | {url}")
        return None


def extraer_logo_team(team):
    logos = team.get("logos") or team.get("logo") or []
    if isinstance(logos, str):
        return logos
    if isinstance(logos, list) and logos:
        primero = logos[0]
        if isinstance(primero, dict):
            return primero.get("href") or primero.get("url") or ""
        return str(primero)
    return ""


def limpiar_score(score):
    if score is None:
        return None
    if isinstance(score, dict):
        if score.get("displayValue") is not None:
            return str(score.get("displayValue"))
        if score.get("value") is not None:
            value = score.get("value")
            if isinstance(value, float) and value.is_integer():
                return str(int(value))
            return str(value)
        return None
    return str(score)


def formatear_fecha(fecha_iso):
    if not fecha_iso:
        return "Sin fecha"
    return str(fecha_iso).split("T")[0]


def parse_event(evento):
    competitions = evento.get("competitions") or []
    competition = competitions[0] if competitions else {}
    competitors = competition.get("competitors") or []

    local = "Local"
    visitante = "Visitante"
    local_id = ""
    visitante_id = ""
    local_score = None
    visitante_score = None
    local_logo = ""
    visitante_logo = ""

    for comp in competitors:
        team = comp.get("team") or {}
        name = team.get("displayName") or team.get("shortDisplayName") or team.get("name") or "Equipo"
        team_id = str(team.get("id") or "")
        score = limpiar_score(comp.get("score"))
        logo = extraer_logo_team(team)

        if comp.get("homeAway") == "home":
            local = name
            local_id = team_id
            local_score = score
            local_logo = logo
        elif comp.get("homeAway") == "away":
            visitante = name
            visitante_id = team_id
            visitante_score = score
            visitante_logo = logo

    status = (evento.get("status") or {}).get("type") or {}
    fecha_iso = evento.get("date") or ""
    hora = "Ver horario"
    if "T" in str(fecha_iso):
        hora = str(fecha_iso).split("T")[1][:5]

    return {
        "id": str(evento.get("id") or ""),
        "dia": formatear_fecha(fecha_iso),
        "fecha_iso": fecha_iso,
        "hora": hora,
        "local": local,
        "visitante": visitante,
        "local_id": local_id,
        "visitante_id": visitante_id,
        "local_logo": local_logo,
        "visitante_logo": visitante_logo,
        "marcador_local": local_score,
        "marcador_visitante": visitante_score,
        "estado": status.get("description") or status.get("name") or status.get("state") or "",
        "estado_tipo": status.get("state") or "",
        "completado": status.get("completed") is True,
        "url": (evento.get("links") or [{}])[0].get("href", ""),
    }


def cargar_scoreboard_rango(desde, hasta):
    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{LEAGUE_SLUG}/scoreboard?dates={desde}-{hasta}&limit=1000",
        f"https://site.web.api.espn.com/apis/v2/sports/soccer/{LEAGUE_SLUG}/scoreboard?dates={desde}-{hasta}&limit=1000",
    ]
    eventos = []
    for url in urls:
        data = get_json(url)
        if not data:
            continue
        eventos = data.get("events") or []
        if eventos:
            return eventos
    return []


def cargar_partidos_liga():
    rangos = [
        ("20260101", "20260131"),
        ("20260201", "20260229"),
        ("20260301", "20260331"),
        ("20260401", "20260430"),
        ("20260501", "20260531"),
        ("20260601", "20260630"),
        ("20260701", "20260731"),
        ("20260801", "20260831"),
        ("20260901", "20260930"),
        ("20261001", "20261031"),
        ("20261101", "20261130"),
        ("20261201", "20261231"),
    ]

    partidos = []
    vistos = set()

    for desde, hasta in rangos:
        eventos = cargar_scoreboard_rango(desde, hasta)
        for evento in eventos:
            partido = parse_event(evento)
            key = partido.get("id") or f'{partido.get("fecha_iso")}-{partido.get("local")}-{partido.get("visitante")}'
            if key in vistos:
                continue
            vistos.add(key)
            partidos.append(partido)
        time.sleep(0.2)

    partidos.sort(key=lambda x: x.get("fecha_iso") or x.get("dia") or "")
    return partidos


def separar_fase_regular(partidos):
    partidos_ordenados = sorted(partidos, key=lambda x: x.get("fecha_iso") or x.get("dia") or "")
    regulares = partidos_ordenados[:TOTAL_PARTIDOS_REGULARES]
    extras = partidos_ordenados[TOTAL_PARTIDOS_REGULARES:]
    if extras:
        print(f"â¹ï¸ Se separaron {len(extras)} partidos extra fuera de las 36 fechas regulares")
    return regulares, extras


def crear_fechas_desde_mapa(partidos):
    """
    Asigna el número de fecha a cada partido usando el mapa oficial de Promiedos.

    El mapa (data/promiedos_fixture_map.json) se genera UNA SOLA VEZ por temporada
    ejecutando scripts/generar_fixture_map_promiedos.py.
    En cada run del workflow solo se lee el archivo — sin consultas externas.

    Si el mapa no existe o un partido no está en él, se usa el orden cronológico
    como fallback (mismo comportamiento que antes).
    """
    import os

    FIXTURE_MAP_PATH = "data/promiedos_fixture_map.json"

    # Cargar mapa si existe
    fixture_map = {}
    if os.path.exists(FIXTURE_MAP_PATH):
        try:
            with open(FIXTURE_MAP_PATH, encoding="utf-8") as f:
                map_data = json.load(f)
            fixture_map = map_data.get("fixture_map", {})
            print(f"  Fixture map cargado: {len(fixture_map)} pares local|visitante")
        except Exception as e:
            print(f"  ⚠ No se pudo leer fixture map: {e}. Usando orden cronológico.")
    else:
        print(f"  ⚠ {FIXTURE_MAP_PATH} no existe. Usando orden cronológico.")
        print("    Para generarlo: python scripts/generar_fixture_map_promiedos.py")

    if not fixture_map:
        # Fallback: orden cronológico (comportamiento original)
        return crear_fechas_por_bloques_cronologico(partidos)

    # Inicializar fechas vacías
    new_fechas_map = {}
    for i in range(1, TOTAL_FECHAS_REGULARES + 1):
        new_fechas_map[i] = {"numero": i, "nombre": f"Fecha {i}", "partidos": []}

    mapped = 0
    not_found = []

    for partido in partidos:
        local = partido.get("local", "")
        visitante = partido.get("visitante", "")
        key = f"{local}|{visitante}"
        fecha_num = fixture_map.get(key)

        if fecha_num is not None:
            partido["numero_fecha"] = fecha_num
            partido["fecha_torneo"] = fecha_num
            new_fechas_map[fecha_num]["partidos"].append(partido)
            mapped += 1
        else:
            not_found.append(f"{local} vs {visitante}")

    if not_found:
        print(f"  ⚠ {len(not_found)} partidos no encontrados en el mapa:")
        for item in not_found[:5]:
            print(f"    - {item}")

    # Filtrar fechas con partidos y ordenar
    fechas = [f for f in sorted(new_fechas_map.values(), key=lambda x: x["numero"]) if f["partidos"]]
    print(f"  ✓ {mapped} partidos asignados a {len(fechas)} fechas usando mapa Promiedos")
    return fechas


def crear_fechas_por_bloques_cronologico(partidos):
    """
    Fallback: agrupa partidos en bloques de 18 por orden cronológico.
    Solo se usa si no hay fixture_map disponible.
    """
    partidos_ordenados = sorted(partidos, key=lambda x: x.get("fecha_iso") or x.get("dia") or "")[:TOTAL_PARTIDOS_REGULARES]
    fechas = []
    for numero in range(1, TOTAL_FECHAS_REGULARES + 1):
        start = (numero - 1) * PARTIDOS_POR_FECHA
        end = start + PARTIDOS_POR_FECHA
        bloque = partidos_ordenados[start:end]
        if not bloque:
            continue
        for partido in bloque:
            partido["numero_fecha"] = numero
            partido["fecha_torneo"] = numero
        fechas.append({"numero": numero, "nombre": f"Fecha {numero}", "partidos": bloque})
    return fechas


def guardar(data):
    for path in [OUTPUT_FILE, PUBLIC_OUTPUT_FILE]:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"â Generado {path}")


def main():
    partidos_totales = cargar_partidos_liga()
    partidos_regulares, partidos_extra = separar_fase_regular(partidos_totales)
    fechas = crear_fechas_desde_mapa(partidos_regulares)

    data = {
        "competicion": "Primera Nacional",
        "league_slug": LEAGUE_SLUG,
        "season": SEASON,
        "formato": "Fase de grupos",
        "partidos_por_fecha": PARTIDOS_POR_FECHA,
        "total_fechas_regulares_esperadas": TOTAL_FECHAS_REGULARES,
        "total_partidos_regulares_esperados": TOTAL_PARTIDOS_REGULARES,
        "total_partidos_espn": len(partidos_totales),
        "total_partidos": sum(len(f.get("partidos", [])) for f in fechas),
        "total_partidos_extra": len(partidos_extra),
        "total_fechas": len(fechas),
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "fechas": fechas,
        "partidos": [p for f in fechas for p in f.get("partidos", [])],
        "partidos_extra": partidos_extra,
    }

    if len(fechas) != TOTAL_FECHAS_REGULARES:
        print(f"â ï¸ Se generaron {len(fechas)} fechas. Esperadas: {TOTAL_FECHAS_REGULARES}.")
    else:
        print(f"â Calendario regular estable: {len(fechas)} fechas, {data['total_partidos']} partidos")

    guardar(data)


if __name__ == "__main__":
    main()
