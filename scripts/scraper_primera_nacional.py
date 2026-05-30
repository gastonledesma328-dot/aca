import json
import os
import re
import unicodedata
from datetime import datetime, timezone

import requests

OUTPUT_FILE = "data/equipos_primera_nacional.json"
PUBLIC_OUTPUT_FILE = "public/data/equipos_primera_nacional.json"
MAX_PROXIMOS_PARTIDOS = 5
MAX_RESULTADOS = 10

LEAGUE_SLUG = "arg.2"
SEASON = "2026"
COMPETICION_PRINCIPAL = "Primera Nacional 2026"

COMPETICIONES = [
    {
        "nombre": "Primera Nacional 2026",
        "league_slug": "arg.2",
        "season": "2026",
        "fase": "primera-nacional",
        "fecha_desde": "2026-01-01",
        "fecha_hasta": "2026-12-31",
    },
    {
        "nombre": "Copa Argentina 2026",
        "league_slug": "arg.copa_argentina",
        "season": "2026",
        "fase": "",
        "fecha_desde": "2026-01-01",
        "fecha_hasta": "2026-12-31",
    },
]

# Correcciones manuales opcionales. El scraper respeta estos datos por encima de ESPN.
MANUAL_EQUIPOS = {
    # "colon-santa-fe": {
    #     "apodo": "Sabalero",
    #     "fundacion": "1905",
    #     "estadio": "Brigadier General Estanislao López",
    #     "ciudad": "Santa Fe",
    # },
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.espn.com.ar/",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)
PREVIOUS_DATA = []


def slug(texto):
    texto = str(texto or "").lower().strip()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = re.sub(r"[^a-z0-9]+", "-", texto)
    texto = re.sub(r"-+", "-", texto)
    return texto.strip("-")


def get_json(url):
    try:
        r = SESSION.get(url, timeout=30)
        print(f"🌐 {r.status_code} {url}")
        if not r.ok:
            return None
        return r.json()
    except Exception as e:
        print(f"⚠️ Error leyendo JSON: {e} | {url}")
        return None


def cargar_ref(ref):
    if isinstance(ref, str) and ref.startswith(("http://", "https://")):
        return get_json(ref)
    return None


def formatear_fecha(fecha_iso):
    if not fecha_iso:
        return "Sin fecha"
    return str(fecha_iso).split("T")[0]


def fecha_en_rango(fecha, fecha_desde="", fecha_hasta=""):
    fecha = str(fecha or "")
    if not fecha or fecha == "Sin fecha":
        return False
    if fecha_desde and fecha < fecha_desde:
        return False
    if fecha_hasta and fecha > fecha_hasta:
        return False
    return True


def fecha_iso_pasada(fecha_iso):
    if not fecha_iso:
        return False
    try:
        dt = datetime.fromisoformat(str(fecha_iso).replace("Z", "+00:00"))
        return dt < datetime.now(timezone.utc)
    except Exception:
        return False


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


def valor_stat(stat):
    if not isinstance(stat, dict):
        return "-"
    for key in ["displayValue", "value", "total", "stat"]:
        value = stat.get(key)
        if value is not None and value != "":
            if isinstance(value, float) and value.is_integer():
                return str(int(value))
            return str(value)
    return "-"


def estadisticas_vacias():
    return {"goles": [], "asistencias": [], "amarillas": [], "rojas": []}


def estadisticas_generales_vacias():
    return {
        "posicion": "-",
        "partidos": "-",
        "ganados": "-",
        "empatados": "-",
        "perdidos": "-",
        "golesFavor": "-",
        "golesContra": "-",
        "diferenciaGol": "-",
        "puntos": "-",
        "racha": "-",
        "zona": "-",
    }


def equipo_vacio(base):
    return {
        "id": base.get("id", ""),
        "espn_id": str(base.get("espn_id", "")),
        "scores365_id": base.get("scores365_id", ""),
        "scores365_slug": base.get("scores365_slug", ""),
        "nombre": base.get("nombre", ""),
        "liga": base.get("liga", "Primera Nacional"),
        "logo": base.get("logo", ""),
        "apodo": base.get("apodo", "Sin datos"),
        "fundacion": base.get("fundacion", "Sin datos"),
        "estadio": base.get("estadio", "Sin datos"),
        "ciudad": base.get("ciudad", "Sin datos"),
        "zona": base.get("zona", "-"),
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "proximosPartidos": [],
        "resultados": [],
        "plantel": {
            "arqueros": [],
            "defensores": [],
            "mediocampistas": [],
            "delanteros": [],
        },
        "estadisticas": estadisticas_vacias(),
        "estadisticasGenerales": estadisticas_generales_vacias(),
        "estadisticasPorCompeticion": {},
    }


def extraer_entries_standings(data):
    entries = []

    def caminar(obj):
        if isinstance(obj, dict):
            if isinstance(obj.get("entries"), list):
                entries.extend(obj.get("entries"))
            for value in obj.values():
                caminar(value)
        elif isinstance(obj, list):
            for item in obj:
                caminar(item)

    caminar(data)
    return entries


def extraer_team_id_desde_entry(entry):
    team = entry.get("team") or {}
    if isinstance(team, dict):
        if team.get("id"):
            return str(team.get("id"))
        ref = team.get("$ref") or team.get("href") or ""
        if "/teams/" in ref:
            return ref.split("/teams/")[1].split("?")[0].split("/")[0]
    return ""


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


def extraer_zona_entry(entry):
    for key in ["group", "groupName", "division", "divisionName"]:
        value = entry.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            nombre = value.get("displayName") or value.get("name") or value.get("abbreviation")
            if nombre:
                return str(nombre)
    return "-"


def mapear_stats_generales(entry):
    stats = entry.get("stats") or []
    salida = estadisticas_generales_vacias()
    if entry.get("rank"):
        salida["posicion"] = str(entry.get("rank"))

    zona = extraer_zona_entry(entry)
    if zona != "-":
        salida["zona"] = zona

    for stat in stats:
        if not isinstance(stat, dict):
            continue
        name = slug(
            stat.get("name")
            or stat.get("displayName")
            or stat.get("shortDisplayName")
            or stat.get("abbreviation")
            or ""
        )
        value = valor_stat(stat)

        if name in ["rank", "ranking", "position", "posicion"]:
            salida["posicion"] = value
        elif name in ["gamesplayed", "games-played", "played", "partidos", "gp"]:
            salida["partidos"] = value
        elif name in ["wins", "win", "ganados", "w"]:
            salida["ganados"] = value
        elif name in ["ties", "draws", "empates", "empatados", "d"]:
            salida["empatados"] = value
        elif name in ["losses", "lost", "perdidos", "l"]:
            salida["perdidos"] = value
        elif name in ["points", "puntos", "pts"]:
            salida["puntos"] = value
        elif name in ["pointsfor", "goalsfor", "golesfavor", "gf", "f"]:
            salida["golesFavor"] = value
        elif name in ["pointsagainst", "goalsagainst", "golescontra", "ga", "a"]:
            salida["golesContra"] = value
        elif name in ["pointdifferential", "goaldifference", "diferenciagol", "gd"]:
            salida["diferenciaGol"] = value
        elif name in ["streak", "racha"]:
            salida["racha"] = value

    return salida


def cargar_estadisticas_generales_por_equipo():
    urls = [
        f"https://site.api.espn.com/apis/v2/sports/soccer/{LEAGUE_SLUG}/standings?season={SEASON}",
        f"https://site.web.api.espn.com/apis/v2/sports/soccer/{LEAGUE_SLUG}/standings?season={SEASON}",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{LEAGUE_SLUG}/seasons/{SEASON}/types/1/standings",
    ]
    salida = {}
    for url in urls:
        data = get_json(url)
        if not data:
            continue
        for entry in extraer_entries_standings(data):
            if not isinstance(entry, dict):
                continue
            team_id = extraer_team_id_desde_entry(entry)
            if team_id:
                salida[team_id] = mapear_stats_generales(entry)
        if salida:
            return salida
    return salida


def cargar_equipos_desde_standings():
    urls = [
        f"https://site.api.espn.com/apis/v2/sports/soccer/{LEAGUE_SLUG}/standings?season={SEASON}",
        f"https://site.web.api.espn.com/apis/v2/sports/soccer/{LEAGUE_SLUG}/standings?season={SEASON}",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{LEAGUE_SLUG}/seasons/{SEASON}/types/1/standings",
    ]

    equipos = []
    vistos = set()

    for url in urls:
        data = get_json(url)
        if not data:
            continue

        for entry in extraer_entries_standings(data):
            if not isinstance(entry, dict):
                continue

            team = entry.get("team") or {}
            team_id = extraer_team_id_desde_entry(entry)
            team_data = team

            if team_id and (not isinstance(team_data, dict) or not team_data.get("displayName")):
                ref = team.get("$ref") if isinstance(team, dict) else ""
                team_data = cargar_ref(ref) or {}

            if not isinstance(team_data, dict):
                team_data = {}

            nombre = (
                team_data.get("displayName")
                or team_data.get("name")
                or team_data.get("shortDisplayName")
                or team.get("displayName")
                or team.get("name")
                or ""
            )

            if not team_id and team_data.get("id"):
                team_id = str(team_data.get("id"))

            if not team_id or not nombre:
                continue

            if team_id in vistos:
                continue
            vistos.add(team_id)

            equipo_slug = slug(nombre)
            manual = MANUAL_EQUIPOS.get(equipo_slug, {})
            generales = mapear_stats_generales(entry)

            equipos.append(
                {
                    "id": manual.get("id", equipo_slug),
                    "espn_id": team_id,
                    "scores365_id": manual.get("scores365_id", ""),
                    "scores365_slug": manual.get("scores365_slug", equipo_slug),
                    "nombre": manual.get("nombre", nombre),
                    "liga": "Primera Nacional",
                    "logo": manual.get("logo", extraer_logo_team(team_data)),
                    "apodo": manual.get("apodo", team_data.get("nickname") or "Sin datos"),
                    "fundacion": manual.get("fundacion", "Sin datos"),
                    "estadio": manual.get("estadio", "Sin datos"),
                    "ciudad": manual.get("ciudad", "Sin datos"),
                    "zona": manual.get("zona", generales.get("zona", "-")),
                    "estadisticasGeneralesBase": generales,
                }
            )

        if equipos:
            equipos.sort(key=lambda x: (x.get("zona", "-"), x.get("nombre", "")))
            print(f"✅ Equipos descubiertos desde standings: {len(equipos)}")
            return equipos

    print("⚠️ No se encontraron equipos desde standings")
    return []


def cargar_datos_club(base, league_slug):
    espn_id = base.get("espn_id")
    if not espn_id:
        return base

    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams/{espn_id}"
    data = get_json(url)
    if not data:
        return base

    team = data.get("team") or data
    if not isinstance(team, dict):
        return base

    actualizado = dict(base)
    nombre = team.get("displayName") or team.get("name") or team.get("shortDisplayName")
    if nombre:
        actualizado["nombre"] = nombre
        actualizado["id"] = actualizado.get("id") or slug(nombre)
        actualizado["scores365_slug"] = actualizado.get("scores365_slug") or slug(nombre)

    logo = extraer_logo_team(team)
    if logo:
        actualizado["logo"] = logo

    venue = team.get("venue") or {}
    if isinstance(venue, dict):
        estadio = venue.get("fullName") or venue.get("name")
        ciudad = (venue.get("address") or {}).get("city") or venue.get("city")
        if estadio:
            actualizado["estadio"] = estadio
        if ciudad:
            actualizado["ciudad"] = ciudad

    if team.get("nickname"):
        actualizado["apodo"] = team.get("nickname")

    manual = MANUAL_EQUIPOS.get(slug(actualizado.get("nombre")), {})
    actualizado.update({k: v for k, v in manual.items() if v not in [None, ""]})
    return actualizado


def normalizar_posicion(nombre_posicion):
    pos = slug(nombre_posicion)
    if "goalkeeper" in pos or "arquero" in pos or "portero" in pos:
        return "arqueros"
    if "defender" in pos or "defensa" in pos:
        return "defensores"
    if "midfielder" in pos or "mediocampista" in pos or "volante" in pos:
        return "mediocampistas"
    if "forward" in pos or "delantero" in pos or "attacker" in pos:
        return "delanteros"
    return "mediocampistas"


def cargar_plantel(equipo, league_slug):
    espn_id = equipo.get("espn_id")
    plantel = {"arqueros": [], "defensores": [], "mediocampistas": [], "delanteros": []}
    if not espn_id:
        return plantel

    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams/{espn_id}/roster"
    data = get_json(url)
    if not data:
        return plantel

    athletes = data.get("athletes") or []
    for group in athletes:
        if isinstance(group, dict) and "items" in group:
            categoria = normalizar_posicion(group.get("position") or group.get("name") or "")
            items = group.get("items") or []
        elif isinstance(group, dict):
            position = group.get("position") or {}
            categoria = normalizar_posicion(position.get("displayName") or position.get("name") or "")
            items = [group]
        else:
            continue

        for item in items:
            athlete = item.get("athlete") or item
            nombre = athlete.get("displayName") or athlete.get("fullName") or athlete.get("name")
            if not nombre:
                continue
            plantel[categoria].append(
                {
                    "nombre": nombre,
                    "edad": athlete.get("age") or "-",
                    "altura": athlete.get("displayHeight") or athlete.get("height") or "-",
                }
            )

    return plantel


def parse_score_event(evento):
    competitions = evento.get("competitions") or []
    competition = competitions[0] if competitions else {}
    competitors = competition.get("competitors") or []

    local = "Local"
    visitante = "Visitante"
    local_score = None
    visitante_score = None
    local_logo = ""
    visitante_logo = ""

    for comp in competitors:
        team = comp.get("team") or {}
        name = team.get("displayName") or team.get("shortDisplayName") or team.get("name") or "Equipo"
        score = limpiar_score(comp.get("score"))
        logo = extraer_logo_team(team)

        if comp.get("homeAway") == "home":
            local = name
            local_score = score
            local_logo = logo
        elif comp.get("homeAway") == "away":
            visitante = name
            visitante_score = score
            visitante_logo = logo

    status = (evento.get("status") or {}).get("type") or {}
    estado_nombre = status.get("name") or ""
    estado_detalle = status.get("description") or ""
    estado_estado = status.get("state") or ""
    estado_id = str(status.get("id") or "")
    completado = status.get("completed") is True
    fecha_iso = evento.get("date") or ""
    fecha = formatear_fecha(fecha_iso)
    hora = "Ver horario"

    if "T" in str(fecha_iso):
        try:
            hora = str(fecha_iso).split("T")[1][:5]
        except Exception:
            hora = "Ver horario"

    return {
        "id": str(evento.get("id") or ""),
        "fecha": fecha,
        "fecha_iso": fecha_iso,
        "hora": hora,
        "local": local,
        "visitante": visitante,
        "local_logo": local_logo,
        "visitante_logo": visitante_logo,
        "marcador_local": local_score,
        "marcador_visitante": visitante_score,
        "completado": completado,
        "estado": estado_detalle or estado_nombre or estado_estado,
        "estado_tipo": estado_estado,
        "estado_nombre": estado_nombre,
        "estado_id": estado_id,
        "url": (evento.get("links") or [{}])[0].get("href", ""),
    }


def tiene_marcador_real(partido):
    return partido.get("marcador_local") is not None and partido.get("marcador_visitante") is not None


def es_partido_finalizado(partido):
    estado_tipo = str(partido.get("estado_tipo") or "").lower()
    estado_nombre = str(partido.get("estado_nombre") or "").lower()
    estado = str(partido.get("estado") or "").lower()
    estado_id = str(partido.get("estado_id") or "")

    if partido.get("completado") is True or estado_tipo == "post" or estado_id in ["3"]:
        return True

    palabras_final = ["final", "full time", "ft", "finalizado", "terminado", "post-game"]
    if any(p in estado_nombre for p in palabras_final) or any(p in estado for p in palabras_final):
        return True

    return fecha_iso_pasada(partido.get("fecha_iso")) and tiene_marcador_real(partido)


def es_partido_proximo(partido):
    estado_tipo = str(partido.get("estado_tipo") or "").lower()
    estado_nombre = str(partido.get("estado_nombre") or "").lower()
    estado = str(partido.get("estado") or "").lower()
    estado_id = str(partido.get("estado_id") or "")

    if es_partido_finalizado(partido):
        return False
    if estado_tipo == "pre" or estado_id in ["1"]:
        return True

    palabras_pre = ["scheduled", "pre-game", "programado", "por jugar", "not started"]
    if any(p in estado_nombre for p in palabras_pre) or any(p in estado for p in palabras_pre):
        return True

    return bool(partido.get("fecha_iso") and not fecha_iso_pasada(partido.get("fecha_iso")))


def cargar_partidos_equipo(equipo, league_slug):
    espn_id = equipo.get("espn_id")
    if not espn_id:
        return [], []

    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams/{espn_id}/schedule?season={SEASON}"
    data = get_json(url)
    if not data:
        return [], []

    eventos = data.get("events") or data.get("items") or []
    proximos = []
    resultados = []

    for evento in eventos:
        partido = parse_score_event(evento)
        if es_partido_finalizado(partido):
            resultado = "-"
            if tiene_marcador_real(partido):
                resultado = f'{partido["marcador_local"]} - {partido["marcador_visitante"]}'
            resultados.append(
                {
                    "id": partido["id"],
                    "dia": partido["fecha"],
                    "fecha_iso": partido["fecha_iso"],
                    "local": partido["local"],
                    "visitante": partido["visitante"],
                    "local_logo": partido["local_logo"],
                    "visitante_logo": partido["visitante_logo"],
                    "url": partido["url"],
                    "resultado": resultado,
                    "estado": partido["estado"],
                }
            )
        elif es_partido_proximo(partido):
            proximos.append(
                {
                    "id": partido["id"],
                    "dia": partido["fecha"],
                    "fecha_iso": partido["fecha_iso"],
                    "local": partido["local"],
                    "visitante": partido["visitante"],
                    "local_logo": partido["local_logo"],
                    "visitante_logo": partido["visitante_logo"],
                    "url": partido["url"],
                    "hora": partido["hora"],
                    "estado": partido["estado"],
                }
            )

    proximos.sort(key=lambda x: x.get("fecha_iso") or x.get("dia") or "")
    resultados.sort(key=lambda x: x.get("fecha_iso") or x.get("dia") or "", reverse=True)
    return proximos[:MAX_PROXIMOS_PARTIDOS], resultados[:MAX_RESULTADOS]


def filtrar_partidos_por_fecha(partidos, competicion):
    return [
        partido
        for partido in partidos
        if fecha_en_rango(partido.get("dia"), competicion.get("fecha_desde", ""), competicion.get("fecha_hasta", ""))
    ]


def cargar_datos_por_competicion(base, equipo, competicion):
    league_slug = competicion["league_slug"]
    nombre_competicion = competicion["nombre"]
    print(f"🏆 Cargando competición: {nombre_competicion} para {base['nombre']}")

    proximos, resultados = cargar_partidos_equipo(base, league_slug)
    proximos = filtrar_partidos_por_fecha(proximos, competicion)
    resultados = filtrar_partidos_por_fecha(resultados, competicion)

    generales = estadisticas_generales_vacias()
    if league_slug == LEAGUE_SLUG:
        generales = dict(base.get("estadisticasGeneralesBase") or estadisticas_generales_vacias())
        if base.get("zona"):
            generales["zona"] = base.get("zona")

    return {
        "nombre": nombre_competicion,
        "league_slug": league_slug,
        "season": competicion["season"],
        "fase": competicion.get("fase", ""),
        "fecha_desde": competicion.get("fecha_desde", ""),
        "fecha_hasta": competicion.get("fecha_hasta", ""),
        "proximosPartidos": proximos,
        "resultados": resultados,
        "estadisticas": estadisticas_vacias(),
        "generales": generales,
    }


def completar_equipo(base):
    print(f"🏟️ Actualizando equipo: {base['nombre']}")
    base = cargar_datos_club(base, LEAGUE_SLUG)
    equipo = equipo_vacio(base)
    equipo["plantel"] = cargar_plantel(base, LEAGUE_SLUG)

    estadisticas_por_competicion = {}
    for competicion in COMPETICIONES:
        datos = cargar_datos_por_competicion(base, equipo, competicion)
        estadisticas_por_competicion[competicion["nombre"]] = datos

    equipo["estadisticasPorCompeticion"] = estadisticas_por_competicion
    principal = estadisticas_por_competicion.get(COMPETICION_PRINCIPAL)

    if principal:
        equipo["liga"] = principal["nombre"]
        equipo["proximosPartidos"] = principal["proximosPartidos"]
        equipo["resultados"] = principal["resultados"]
        equipo["estadisticas"] = principal["estadisticas"]
        equipo["estadisticasGenerales"] = principal["generales"]

    return equipo


def cargar_json_previo():
    if not os.path.exists(OUTPUT_FILE):
        return []
    try:
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
    except Exception as e:
        print(f"⚠️ No se pudo leer JSON previo: {e}")
    return []


def guardar_json(equipos):
    for path in [OUTPUT_FILE, PUBLIC_OUTPUT_FILE]:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(equipos, f, ensure_ascii=False, indent=2)
        print(f"✅ Generado {path} con {len(equipos)} equipos")


def main():
    global PREVIOUS_DATA
    PREVIOUS_DATA = cargar_json_previo()
    equipos_base = cargar_equipos_desde_standings()

    if not equipos_base:
        raise SystemExit(
            "No se pudieron descubrir equipos desde ESPN standings. Revisá si ESPN cambió el endpoint o si arg.2 todavía no tiene tabla cargada."
        )

    equipos = []
    for base in equipos_base:
        try:
            equipos.append(completar_equipo(base))
        except Exception as e:
            print(f"⚠️ Error completando {base.get('nombre')}: {e}")

    if not equipos:
        raise SystemExit("No se pudo completar ningún equipo de Primera Nacional")

    guardar_json(equipos)


if __name__ == "__main__":
    main()
