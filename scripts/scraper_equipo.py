import json
import os
import unicodedata
from collections import Counter
from datetime import datetime, timezone

import requests


OUTPUT_FILE = "data/equipos.json"

LEAGUE_SLUG = "arg.1"
SEASON = "2026"

COMPETICION_PRINCIPAL = "Liga Profesional de Futbol - Torneo Apertura 2026"

COMPETICIONES = [
    {
        "nombre": "Liga Profesional de Futbol - Torneo Apertura 2026",
        "league_slug": "arg.1",
        "season": "2026",
        "fase": "apertura",
        "fecha_desde": "2026-01-01",
        "fecha_hasta": "2026-06-30",
    },
    {
        "nombre": "Liga Profesional de Futbol - Torneo Clausura 2026",
        "league_slug": "arg.1",
        "season": "2026",
        "fase": "clausura",
        "fecha_desde": "2026-07-01",
        "fecha_hasta": "2026-12-31",
    },
    {
        "nombre": "Copa Libertadores 2026",
        "league_slug": "conmebol.libertadores",
        "season": "2026",
        "fase": "",
        "fecha_desde": "",
        "fecha_hasta": "",
    },
    {
        "nombre": "Copa Sudamericana 2026",
        "league_slug": "conmebol.sudamericana",
        "season": "2026",
        "fase": "",
        "fecha_desde": "",
        "fecha_hasta": "",
    },
]


EQUIPOS_BASE = [
    {
        "id": "river-plate",
        "espn_id": "16",
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


def extraer_game_id(url):
    url = str(url or "")

    if "gameId/" not in url:
        return ""

    try:
        return url.split("gameId/")[1].split("/")[0].strip()
    except Exception:
        return ""


def cargar_resumen_partido(game_id):
    if not game_id:
        return None

    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{LEAGUE_SLUG}/summary?event={game_id}"
    return get_json(url)


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


def obtener_nombre_jugador(obj):
    if not isinstance(obj, dict):
        return ""

    athlete = obj.get("athlete") or obj.get("player") or {}

    if isinstance(athlete, dict):
        nombre = (
            athlete.get("displayName")
            or athlete.get("fullName")
            or athlete.get("name")
            or athlete.get("shortName")
        )

        if nombre:
            return nombre

    return (
        obj.get("displayName")
        or obj.get("fullName")
        or obj.get("name")
        or obj.get("athleteName")
        or obj.get("playerName")
        or ""
    )


def sumar_counter_a_lista(counter):
    return [
        {
            "jugador": jugador,
            "total": total,
        }
        for jugador, total in counter.most_common(10)
    ]


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


def texto_evento(obj):
    partes = []

    def caminar(valor):
        if isinstance(valor, dict):
            for k, v in valor.items():
                if k in [
                    "text",
                    "description",
                    "displayName",
                    "shortDisplayName",
                    "name",
                    "headline",
                    "caption",
                ]:
                    if isinstance(v, str):
                        partes.append(v)
                    elif isinstance(v, dict):
                        caminar(v)
                elif isinstance(v, (dict, list)):
                    caminar(v)

        elif isinstance(valor, list):
            for item in valor:
                caminar(item)

    caminar(obj)
    return " ".join(partes)


def mapa_jugadores_plantel(plantel):
    mapa = {}

    for grupo in (plantel or {}).values():
        if not isinstance(grupo, list):
            continue

        for jugador in grupo:
            if not isinstance(jugador, dict):
                continue

            nombre = jugador.get("nombre")

            if nombre:
                mapa[slug(nombre)] = nombre

    return mapa


def buscar_jugadores_plantel_en_texto(texto, plantel):
    texto_slug = slug(texto)
    mapa = mapa_jugadores_plantel(plantel)

    encontrados = []
    vistos = set()

    for jugador_slug, nombre_real in mapa.items():
        if not jugador_slug:
            continue

        partes = jugador_slug.split("-")
        apellido = partes[-1] if partes else ""

        coincide_nombre_completo = jugador_slug in texto_slug
        coincide_apellido = apellido and len(apellido) >= 4 and apellido in texto_slug

        if coincide_nombre_completo or coincide_apellido:
            key = slug(nombre_real)

            if key not in vistos:
                vistos.add(key)
                encontrados.append(nombre_real)

    return encontrados


def extraer_jugadores_de_evento(evento):
    jugadores = []

    posibles_listas = [
        evento.get("athletesInvolved"),
        evento.get("participants"),
        evento.get("players"),
        evento.get("competitors"),
    ]

    for lista in posibles_listas:
        if isinstance(lista, list):
            for item in lista:
                nombre = obtener_nombre_jugador(item)
                if nombre:
                    jugadores.append(nombre)

    nombre_directo = obtener_nombre_jugador(evento)
    if nombre_directo:
        jugadores.append(nombre_directo)

    vistos = set()
    limpios = []

    for jugador in jugadores:
        key = slug(jugador)
        if key and key not in vistos:
            vistos.add(key)
            limpios.append(jugador)

    return limpios


def extraer_jugadores_de_evento_con_plantel(evento, plantel):
    jugadores_directos = extraer_jugadores_de_evento(evento)
    validos = nombres_validos_plantel(plantel)

    jugadores_validos = []

    for jugador in jugadores_directos:
        if slug(jugador) in validos:
            jugadores_validos.append(jugador)

    if jugadores_validos:
        return jugadores_validos

    texto = texto_evento(evento)

    if not texto:
        return []

    return buscar_jugadores_plantel_en_texto(texto, plantel)


def detectar_tipo_evento(evento):
    textos = []

    for key in ["type", "text", "description", "displayName", "shortDisplayName", "name"]:
        value = evento.get(key)

        if isinstance(value, dict):
            textos.append(
                str(
                    value.get("text")
                    or value.get("description")
                    or value.get("name")
                    or ""
                )
            )
        elif value is not None:
            textos.append(str(value))

    texto = slug(" ".join(textos))

    if "red-card" in texto or "redcard" in texto:
        return "roja"

    if "tarjeta-roja" in texto or "roja" in texto or "red" in texto:
        return "roja"

    if "second-yellow" in texto or "segunda-amarilla" in texto:
        return "roja"

    if "yellow" in texto or "amarilla" in texto:
        return "amarilla"

    if "goal" in texto or "gol" in texto:
        return "gol"

    if "assist" in texto or "asistencia" in texto:
        return "asistencia"

    return ""


def extraer_eventos_recursivo(data):
    encontrados = []

    def caminar(obj):
        if isinstance(obj, dict):
            keys = set(obj.keys())

            if (
                "type" in keys
                or "text" in keys
                or "play" in keys
                or "athletesInvolved" in keys
                or "participants" in keys
                or "card" in keys
                or "commentary" in keys
                or "keyEvents" in keys
            ):
                encontrados.append(obj)

            for value in obj.values():
                caminar(value)

        elif isinstance(obj, list):
            for item in obj:
                caminar(item)

    caminar(data)
    return encontrados

def cargar_estadisticas_desde_resumenes(equipo):
    goles = Counter()
    asistencias = Counter()
    amarillas = Counter()
    rojas = Counter()

    partidos = equipo.get("resultados", [])[:20]
    plantel = equipo.get("plantel") or {}

    print(f"📊 Calculando estadísticas por partidos filtrados para {equipo.get('nombre')}")
    print(f"🎯 Partidos usados para estadísticas: {len(partidos)}")

    for partido in partidos:
        game_id = extraer_game_id(partido.get("url"))

        if not game_id:
            continue

        resumen = cargar_resumen_partido(game_id)

        if not isinstance(resumen, dict):
            continue

        print(f"📌 Partido {game_id} keys:", list(resumen.keys()))

        eventos = []

        # 1) Fuente principal si ESPN la trae
        if isinstance(resumen.get("scoringPlays"), list):
            eventos.extend(resumen.get("scoringPlays") or [])

        # 2) Jugadas generales si ESPN las trae
        if isinstance(resumen.get("plays"), list):
            eventos.extend(resumen.get("plays") or [])

        # 3) Fallback controlado: buscar eventos dentro del JSON completo
        eventos.extend(extraer_eventos_recursivo(resumen))

        vistos = set()

        for evento in eventos:
            if not isinstance(evento, dict):
                continue

            tipo = detectar_tipo_evento(evento)

            if tipo not in ["gol", "asistencia", "amarilla", "roja"]:
                continue

            jugadores = extraer_jugadores_de_evento_con_plantel(evento, plantel)

            if not jugadores:
                continue

            texto = texto_evento(evento)
            jugador = jugadores[0]

            # Evita contar repetido el mismo evento muchas veces
            key = f"{game_id}-{tipo}-{slug(jugador)}-{slug(texto)[:120]}"

            if key in vistos:
                continue

            vistos.add(key)

            if tipo == "gol":
                goles[jugador] += 1

                if len(jugadores) > 1:
                    asistencias[jugadores[1]] += 1

            elif tipo == "asistencia":
                asistencias[jugador] += 1

            elif tipo == "amarilla":
                amarillas[jugador] += 1

            elif tipo == "roja":
                rojas[jugador] += 1

    resultado = {
        "goles": sumar_counter_a_lista(goles),
        "asistencias": sumar_counter_a_lista(asistencias),
        "amarillas": sumar_counter_a_lista(amarillas),
        "rojas": sumar_counter_a_lista(rojas),
    }

    print(f"✅ Estadísticas calculadas para {equipo.get('nombre')}:", resultado)

    return resultado


def cargar_estadisticas_jugadores(equipo):
    espn_id = equipo.get("espn_id")

    estadisticas = estadisticas_vacias()

    if not espn_id:
        return estadisticas

    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{LEAGUE_SLUG}/teams/{espn_id}/statistics",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{LEAGUE_SLUG}/leaders?limit=100",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{LEAGUE_SLUG}/seasons/{SEASON}/leaders?limit=100",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{LEAGUE_SLUG}/seasons/{SEASON}/types/1/teams/{espn_id}/statistics?lang=es&region=ar",
    ]

    for url in urls:
        data = get_json(url)

        if not data:
            continue

        leaders = data.get("leaders") or data.get("categories") or data.get("items") or []

        for group in leaders:
            if not isinstance(group, dict):
                continue

            group_name = slug(
                group.get("name")
                or group.get("displayName")
                or group.get("shortDisplayName")
                or group.get("abbreviation")
                or ""
            )

            items = (
                group.get("leaders")
                or group.get("items")
                or group.get("statistics")
                or []
            )

            for item in items:
                if not isinstance(item, dict):
                    continue

                nombre = obtener_nombre_jugador(item)

                if not nombre:
                    continue

                total = (
                    item.get("value")
                    or item.get("displayValue")
                    or item.get("total")
                    or item.get("stat")
                    or 0
                )

                if "goal" in group_name or "gol" in group_name:
                    estadisticas["goles"].append(
                        {
                            "jugador": nombre,
                            "total": total,
                        }
                    )

                if "assist" in group_name or "asistencia" in group_name:
                    estadisticas["asistencias"].append(
                        {
                            "jugador": nombre,
                            "total": total,
                        }
                    )

                if "yellow" in group_name or "amarilla" in group_name:
                    estadisticas["amarillas"].append(
                        {
                            "jugador": nombre,
                            "total": total,
                        }
                    )

                if "red" in group_name or "roja" in group_name:
                    estadisticas["rojas"].append(
                        {
                            "jugador": nombre,
                            "total": total,
                        }
                    )

    estadisticas["goles"] = estadisticas["goles"][:10]
    estadisticas["asistencias"] = estadisticas["asistencias"][:10]
    estadisticas["amarillas"] = estadisticas["amarillas"][:10]
    estadisticas["rojas"] = estadisticas["rojas"][:10]

    return estadisticas


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

    equipo_temp = dict(equipo)
    equipo_temp["resultados"] = resultados
    equipo_temp["plantel"] = equipo["plantel"]

    if competicion.get("fecha_desde") or competicion.get("fecha_hasta"):
        estadisticas = cargar_estadisticas_desde_resumenes(equipo_temp)
    else:
        estadisticas = cargar_estadisticas_jugadores(base)

        if (
            not estadisticas["goles"]
            and not estadisticas["asistencias"]
            and not estadisticas["amarillas"]
            and not estadisticas["rojas"]
        ):
            estadisticas = cargar_estadisticas_desde_resumenes(equipo_temp)

    estadisticas = filtrar_estadisticas_por_plantel(
        estadisticas,
        equipo["plantel"]
    )

    # Temporal: ESPN suele mezclar tarjetas rojas con otros eventos.
    # Mejor dejar rojas vacías antes que mostrar datos falsos.
    estadisticas["rojas"] = []

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
