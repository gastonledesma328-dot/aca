import json
import os
import unicodedata
from datetime import datetime, timezone

import requests


OUTPUT_FILE = "data/equipos.json"

LEAGUE_SLUG = "arg.1"
SEASON = "2026"

COMPETICION_PRINCIPAL = "Liga Profesional de Futbol - Torneo Apertura 2026"

# FotMob:
# id=112      -> Liga Profesional Argentina
# season=28207 -> temporada actual detectada en Network
FOTMOB_LEAGUE_ID = "112"
FOTMOB_SEASON_ID = "28207"

COMPETICIONES = [
    {
        "nombre": "Liga Profesional de Futbol - Torneo Apertura 2026",
        "league_slug": "arg.1",
        "season": "2026",
        "fase": "apertura",
        "fecha_desde": "2026-01-01",
        "fecha_hasta": "2026-06-30",
        "fotmob_league_id": FOTMOB_LEAGUE_ID,
        "fotmob_season_id": FOTMOB_SEASON_ID,
    },
    {
        "nombre": "Liga Profesional de Futbol - Torneo Clausura 2026",
        "league_slug": "arg.1",
        "season": "2026",
        "fase": "clausura",
        "fecha_desde": "2026-07-01",
        "fecha_hasta": "2026-12-31",
        "fotmob_league_id": FOTMOB_LEAGUE_ID,
        "fotmob_season_id": FOTMOB_SEASON_ID,
    },
    {
        "nombre": "Copa Libertadores 2026",
        "league_slug": "conmebol.libertadores",
        "season": "2026",
        "fase": "",
        "fecha_desde": "",
        "fecha_hasta": "",
        "fotmob_league_id": "",
        "fotmob_season_id": "",
    },
    {
        "nombre": "Copa Sudamericana 2026",
        "league_slug": "conmebol.sudamericana",
        "season": "2026",
        "fase": "",
        "fecha_desde": "",
        "fecha_hasta": "",
        "fotmob_league_id": "",
        "fotmob_season_id": "",
    },
]


EQUIPOS_BASE = [
    {
        "id": "river-plate",
        "espn_id": "16",
        "fotmob_id": "10076",
        "fotmob_slug": "river-plate",
        "nombre": "River Plate",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/16.png",
        "apodo": "Millonario",
        "fundacion": "1901",
        "estadio": "Monumental",
        "ciudad": "Buenos Aires",
    },
    {
        "id": "boca-juniors",
        "espn_id": "5",
        "fotmob_id": "10077",
        "fotmob_slug": "boca-juniors",
        "nombre": "Boca Juniors",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/5.png",
        "apodo": "Xeneizes",
        "fundacion": "1905",
        "estadio": "Alberto J. Armando",
        "ciudad": "Buenos Aires",
    },
    {
        "id": "racing-club",
        "espn_id": "15",
        "fotmob_id": "10080",
        "fotmob_slug": "racing-club",
        "nombre": "Racing Club",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/15.png",
        "apodo": "La Academia",
        "fundacion": "1903",
        "estadio": "Presidente Perón",
        "ciudad": "Avellaneda",
    },
]


def slug(texto):
    texto = str(texto or "").lower().strip()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")

    limpio = []
    anterior_guion = False

    for c in texto:
        if c.isalnum():
            limpio.append(c)
            anterior_guion = False
        else:
            if not anterior_guion:
                limpio.append("-")
                anterior_guion = True

    return "".join(limpio).strip("-")


def get_json(url):
    try:
        r = requests.get(
            url,
            timeout=25,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json, text/plain, */*",
                "Referer": "https://www.espn.com.ar/",
            },
        )

        print(f"🌐 {r.status_code} {url}")

        if not r.ok:
            return None

        return r.json()

    except Exception as e:
        print(f"⚠️ Error leyendo ESPN: {e}")
        return None


def estadisticas_vacias():
    return {
        "goles": [],
        "asistencias": [],
        "amarillas": [],
        "rojas": [],
    }


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
    }


def equipo_vacio(equipo):
    return {
        "id": equipo.get("id", ""),
        "espn_id": equipo.get("espn_id", ""),
        "fotmob_id": equipo.get("fotmob_id", ""),
        "fotmob_slug": equipo.get("fotmob_slug", ""),
        "nombre": equipo.get("nombre", ""),
        "liga": equipo.get("liga", "Liga no disponible"),
        "logo": equipo.get("logo", ""),
        "apodo": equipo.get("apodo", "Sin datos"),
        "fundacion": equipo.get("fundacion", "Sin datos"),
        "estadio": equipo.get("estadio", "Sin datos"),
        "ciudad": equipo.get("ciudad", "Sin datos"),
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


def formatear_fecha(fecha):
    if not fecha:
        return "Sin fecha"

    return str(fecha).split("T")[0]


def fecha_en_rango(fecha, fecha_desde="", fecha_hasta=""):
    if not fecha_desde and not fecha_hasta:
        return True

    fecha = str(fecha or "")

    if not fecha or fecha == "Sin fecha":
        return False

    if fecha_desde and fecha < fecha_desde:
        return False

    if fecha_hasta and fecha > fecha_hasta:
        return False

    return True


def filtrar_partidos_por_fecha(partidos, competicion):
    fecha_desde = competicion.get("fecha_desde", "")
    fecha_hasta = competicion.get("fecha_hasta", "")

    if not fecha_desde and not fecha_hasta:
        return partidos

    return [
        partido
        for partido in partidos
        if fecha_en_rango(partido.get("dia"), fecha_desde, fecha_hasta)
    ]


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


def parse_score_event(evento):
    competitions = evento.get("competitions") or []
    competition = competitions[0] if competitions else {}
    competitors = competition.get("competitors") or []

    local = "Local"
    visitante = "Visitante"
    local_score = None
    visitante_score = None

    for comp in competitors:
        team = comp.get("team") or {}
        name = team.get("displayName") or team.get("shortDisplayName") or "Equipo"
        score = limpiar_score(comp.get("score"))

        if comp.get("homeAway") == "home":
            local = name
            local_score = score
        elif comp.get("homeAway") == "away":
            visitante = name
            visitante_score = score

    status = (evento.get("status") or {}).get("type") or {}
    completado = status.get("completed") is True

    return {
        "fecha": formatear_fecha(evento.get("date")),
        "local": local,
        "visitante": visitante,
        "marcador_local": local_score,
        "marcador_visitante": visitante_score,
        "completado": completado,
        "estado": status.get("description") or status.get("name") or "",
        "url": (evento.get("links") or [{}])[0].get("href", ""),
    }


def cargar_datos_club(base):
    espn_id = base.get("espn_id")

    if not espn_id:
        return base

    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{LEAGUE_SLUG}/teams/{espn_id}"
    data = get_json(url)

    if not data:
        return base

    team = data.get("team") or data

    if not isinstance(team, dict):
        return base

    actualizado = dict(base)

    nombre = (
        team.get("displayName")
        or team.get("name")
        or team.get("shortDisplayName")
        or base.get("nombre")
    )

    if nombre:
        actualizado["nombre"] = nombre

    logos = team.get("logos") or []

    if logos and isinstance(logos, list):
        logo = logos[0].get("href")
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

    return actualizado


def cargar_partidos_equipo(equipo):
    espn_id = equipo.get("espn_id")

    if not espn_id:
        return [], []

    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{LEAGUE_SLUG}/teams/{espn_id}/schedule"
    data = get_json(url)

    if not data:
        return [], []

    eventos = data.get("events") or data.get("items") or []

    proximos = []
    resultados = []

    for evento in eventos:
        partido = parse_score_event(evento)

        tiene_marcador = (
            partido["marcador_local"] is not None
            and partido["marcador_visitante"] is not None
        )

        if partido["completado"] or tiene_marcador:
            resultado = "-"

            if tiene_marcador:
                resultado = f'{partido["marcador_local"]} - {partido["marcador_visitante"]}'

            resultados.append(
                {
                    "dia": partido["fecha"],
                    "local": partido["local"],
                    "visitante": partido["visitante"],
                    "url": partido["url"],
                    "resultado": resultado,
                }
            )
        else:
            proximos.append(
                {
                    "dia": partido["fecha"],
                    "local": partido["local"],
                    "visitante": partido["visitante"],
                    "url": partido["url"],
                    "hora": "Ver horario",
                }
            )

    return proximos[:20], resultados[:20]


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


def cargar_plantel(equipo):
    espn_id = equipo.get("espn_id")

    plantel = {
        "arqueros": [],
        "defensores": [],
        "mediocampistas": [],
        "delanteros": [],
    }

    if not espn_id:
        return plantel

    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{LEAGUE_SLUG}/teams/{espn_id}/roster"
    data = get_json(url)

    if not data:
        return plantel

    athletes = data.get("athletes") or []

    for group in athletes:
        if isinstance(group, dict) and "items" in group:
            posicion_nombre = group.get("position") or group.get("name") or ""
            categoria = normalizar_posicion(posicion_nombre)

            for item in group.get("items") or []:
                athlete = item.get("athlete") or item
                nombre = (
                    athlete.get("displayName")
                    or athlete.get("fullName")
                    or athlete.get("name")
                )

                if not nombre:
                    continue

                plantel[categoria].append(
                    {
                        "nombre": nombre,
                        "edad": athlete.get("age") or "-",
                        "altura": athlete.get("displayHeight") or athlete.get("height") or "-",
                    }
                )

        elif isinstance(group, dict):
            nombre = group.get("displayName") or group.get("fullName") or group.get("name")

            if not nombre:
                continue

            position = group.get("position") or {}
            categoria = normalizar_posicion(
                position.get("displayName") or position.get("name") or ""
            )

            plantel[categoria].append(
                {
                    "nombre": nombre,
                    "edad": group.get("age") or "-",
                    "altura": group.get("displayHeight") or group.get("height") or "-",
                }
            )

    return plantel


def nombres_validos_plantel(plantel):
    nombres = set()

    for grupo in plantel.values():
        if not isinstance(grupo, list):
            continue

        for jugador in grupo:
            if not isinstance(jugador, dict):
                continue

            nombre = jugador.get("nombre")

            if nombre:
                nombres.add(slug(nombre))

    return nombres


def filtrar_estadisticas_por_plantel(estadisticas, plantel):
    validos = nombres_validos_plantel(plantel)

    if not validos:
        return estadisticas

    limpias = estadisticas_vacias()

    for categoria in ["goles", "asistencias", "amarillas", "rojas"]:
        for item in estadisticas.get(categoria, []):
            jugador = item.get("jugador", "")

            if slug(jugador) in validos:
                limpias[categoria].append(item)

    return limpias


# =========================
# FOTMOB API - ESTADÍSTICAS PERSONALES
# =========================

def normalizar_numero(valor):
    if valor is None:
        return 0

    if isinstance(valor, (int, float)):
        if isinstance(valor, float) and valor.is_integer():
            return int(valor)
        return valor

    valor = str(valor or "").strip()
    valor = valor.replace(",", "")
    valor = valor.replace("%", "")

    try:
        numero = float(valor)

        if numero.is_integer():
            return int(numero)

        return numero

    except Exception:
        return valor


def extraer_lista_fotmob_api(data):
    """
    FotMob puede cambiar la envoltura del JSON.
    Esta función busca la lista real de filas/jugadores.
    """
    if isinstance(data, list):
        return data

    if not isinstance(data, dict):
        return []

    posibles = [
        data.get("stats"),
        data.get("data"),
        data.get("items"),
        data.get("players"),
        data.get("table"),
        data.get("rows"),
        data.get("rankings"),
    ]

    for item in posibles:
        if isinstance(item, list):
            return item

        if isinstance(item, dict):
            lista = extraer_lista_fotmob_api(item)
            if lista:
                return lista

    for value in data.values():
        if isinstance(value, list) and value:
            # Evita listas de strings simples.
            if isinstance(value[0], dict):
                return value

        if isinstance(value, dict):
            lista = extraer_lista_fotmob_api(value)
            if lista:
                return lista

    return []


def obtener_nombre_fotmob_item(item):
    if not isinstance(item, dict):
        return ""

    player = (
        item.get("player")
        or item.get("participant")
        or item.get("person")
        or item.get("athlete")
        or {}
    )

    if isinstance(player, dict):
        nombre = (
            player.get("name")
            or player.get("displayName")
            or player.get("fullName")
            or player.get("localizedName")
            or player.get("shortName")
            or ""
        )

        if nombre:
            return nombre

    return (
        item.get("name")
        or item.get("playerName")
        or item.get("displayName")
        or item.get("fullName")
        or item.get("localizedName")
        or ""
    )


def obtener_valor_fotmob_item(item, stat):
    if not isinstance(item, dict):
        return 0

    posibles_keys = [
        stat,
        "value",
        "statValue",
        "stat",
        "total",
        "count",
        "goals",
        "goal_assist",
        "yellow_card",
        "red_card",
    ]

    for key in posibles_keys:
        if key in item and item.get(key) not in [None, ""]:
            return normalizar_numero(item.get(key))

    # Algunas respuestas traen nested stats.
    nested_stats = item.get("stats") or item.get("stat") or {}

    if isinstance(nested_stats, dict):
        for key in posibles_keys:
            if key in nested_stats and nested_stats.get(key) not in [None, ""]:
                return normalizar_numero(nested_stats.get(key))

    # Fallback: buscar primer número útil, pero evitar IDs.
    for key, value in item.items():
        key_slug = slug(key)

        if key_slug in ["id", "playerid", "teamid", "participantid"]:
            continue

        if isinstance(value, (int, float)):
            return normalizar_numero(value)

        if isinstance(value, str):
            try:
                return normalizar_numero(value)
            except Exception:
                pass

    return 0


def cargar_ranking_fotmob_api(equipo, competicion, stat):
    fotmob_id = equipo.get("fotmob_id")
    fotmob_slug = equipo.get("fotmob_slug") or equipo.get("id")

    league_id = competicion.get("fotmob_league_id") or FOTMOB_LEAGUE_ID
    season_id = competicion.get("fotmob_season_id") or FOTMOB_SEASON_ID

    if not fotmob_id or not league_id or not season_id:
        return []

    url = (
        "https://www.fotmob.com/api/data/leagueseasondeepstats"
        f"?lng=es"
        f"&id={league_id}"
        f"&season={season_id}"
        f"&type=players"
        f"&stat={stat}"
        f"&teamId={fotmob_id}"
        f"&slug={fotmob_slug}-players"
    )

    try:
        r = requests.get(
            url,
            timeout=30,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
                "Referer": f"https://www.fotmob.com/teams/{fotmob_id}/stats/{fotmob_slug}/players",
            },
        )

        print(f"📊 FotMob API {r.status_code} stat={stat} {url}")

        if not r.ok:
            return []

        data = r.json()
        items = extraer_lista_fotmob_api(data)

        resultados = []
        vistos = set()

        for item in items:
            nombre = obtener_nombre_fotmob_item(item)
            total = obtener_valor_fotmob_item(item, stat)

            if not nombre:
                continue

            if total in ["", None]:
                continue

            key = slug(nombre)

            if key in vistos:
                continue

            vistos.add(key)

            resultados.append(
                {
                    "jugador": nombre,
                    "total": total,
                }
            )

        return resultados[:10]

    except Exception as e:
        print(f"⚠️ Error leyendo FotMob API stat={stat} para {equipo.get('nombre')}: {e}")
        return []


def cargar_estadisticas_fotmob(equipo, competicion):
    # Confirmado:
    # goals       -> goles
    # goal_assist -> asistencias
    # yellow_card -> amarillas
    # red_card    -> rojas
    goles = cargar_ranking_fotmob_api(equipo, competicion, "goals")
    asistencias = cargar_ranking_fotmob_api(equipo, competicion, "goal_assist")
    amarillas = cargar_ranking_fotmob_api(equipo, competicion, "yellow_card")
    rojas = cargar_ranking_fotmob_api(equipo, competicion, "red_card")

    estadisticas = {
        "goles": goles,
        "asistencias": asistencias,
        "amarillas": amarillas,
        "rojas": rojas,
    }

    print(f"✅ Estadísticas FotMob API {equipo.get('nombre')}:", estadisticas)

    return estadisticas


# =========================
# ESPN - TABLA / GENERALES
# =========================

def extraer_team_id_desde_entry(entry):
    team = entry.get("team") or {}

    if isinstance(team, dict):
        if team.get("id"):
            return str(team.get("id"))

        ref = team.get("$ref") or team.get("href") or ""

        if "/teams/" in ref:
            return ref.split("/teams/")[1].split("?")[0].split("/")[0]

    return ""


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


def mapear_stats_generales(entry):
    stats = entry.get("stats") or []
    salida = estadisticas_generales_vacias()

    if entry.get("rank"):
        salida["posicion"] = str(entry.get("rank"))

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


def cargar_estadisticas_generales(equipo):
    espn_id = str(equipo.get("espn_id") or "")

    if not espn_id:
        return estadisticas_generales_vacias()

    urls = [
        f"https://site.api.espn.com/apis/v2/sports/soccer/{LEAGUE_SLUG}/standings",
        f"https://site.web.api.espn.com/apis/v2/sports/soccer/{LEAGUE_SLUG}/standings",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{LEAGUE_SLUG}/standings",
    ]

    for url in urls:
        data = get_json(url)

        if not data:
            continue

        entries = extraer_entries_standings(data)

        for entry in entries:
            if not isinstance(entry, dict):
                continue

            team_id = extraer_team_id_desde_entry(entry)

            if team_id == espn_id:
                print(f"📈 Estadísticas generales encontradas para {equipo.get('nombre')}")
                return mapear_stats_generales(entry)

    return estadisticas_generales_vacias()


def cargar_datos_por_competicion(base, equipo, competicion):
    global LEAGUE_SLUG, SEASON

    league_original = LEAGUE_SLUG
    season_original = SEASON

    LEAGUE_SLUG = competicion["league_slug"]
    SEASON = competicion["season"]

    nombre_competicion = competicion["nombre"]

    print(f"🏆 Cargando competición: {nombre_competicion} para {base['nombre']}")

    proximos, resultados = cargar_partidos_equipo(base)

    proximos = filtrar_partidos_por_fecha(proximos, competicion)
    resultados = filtrar_partidos_por_fecha(resultados, competicion)

    if competicion.get("league_slug") == "arg.1":
        if resultados or proximos:
            estadisticas = cargar_estadisticas_fotmob(base, competicion)
        else:
            estadisticas = estadisticas_vacias()
    else:
        estadisticas = estadisticas_vacias()

    estadisticas = filtrar_estadisticas_por_plantel(
        estadisticas,
        equipo["plantel"]
    )

    if resultados or proximos:
        generales = cargar_estadisticas_generales(base)
    else:
        generales = estadisticas_generales_vacias()

    LEAGUE_SLUG = league_original
    SEASON = season_original

    return {
        "nombre": nombre_competicion,
        "league_slug": competicion["league_slug"],
        "season": competicion["season"],
        "fase": competicion.get("fase", ""),
        "fecha_desde": competicion.get("fecha_desde", ""),
        "fecha_hasta": competicion.get("fecha_hasta", ""),
        "proximosPartidos": proximos[:10],
        "resultados": resultados[:10],
        "estadisticas": estadisticas,
        "generales": generales,
    }


def completar_equipo(base):
    print(f"🏟️ Actualizando equipo: {base['nombre']}")

    base = cargar_datos_club(base)
    equipo = equipo_vacio(base)

    equipo["plantel"] = cargar_plantel(base)

    estadisticas_por_competicion = {}

    for competicion in COMPETICIONES:
        datos_competicion = cargar_datos_por_competicion(
            base,
            equipo,
            competicion
        )

        estadisticas_por_competicion[competicion["nombre"]] = datos_competicion

    equipo["estadisticasPorCompeticion"] = estadisticas_por_competicion

    principal = estadisticas_por_competicion.get(COMPETICION_PRINCIPAL)

    if principal:
        equipo["liga"] = principal["nombre"]
        equipo["proximosPartidos"] = principal["proximosPartidos"]
        equipo["resultados"] = principal["resultados"]
        equipo["estadisticas"] = principal["estadisticas"]
        equipo["estadisticasGenerales"] = principal["generales"]

    return equipo


def main():
    os.makedirs("data", exist_ok=True)

    equipos = []

    for base in EQUIPOS_BASE:
        equipos.append(completar_equipo(base))

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(equipos, f, ensure_ascii=False, indent=2)

    print(f"✅ Generado {OUTPUT_FILE} con {len(equipos)} equipos")


if __name__ == "__main__":
    main()
