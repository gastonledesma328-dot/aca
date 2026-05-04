import json
import os
import unicodedata
from collections import Counter
from datetime import datetime, timezone

import requests


OUTPUT_FILE = "data/equipos.json"

# Liga Profesional Argentina en ESPN
LEAGUE_SLUG = "arg.1"

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
        "estadisticas": {
            "goles": [],
            "asistencias": [],
            "amarillas": [],
        },
    }


def formatear_fecha(fecha):
    if not fecha:
        return "Sin fecha"

    return str(fecha).split("T")[0]


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

    return proximos[:10], resultados[:10]


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
                        "altura": athlete.get("displayHeight")
                        or athlete.get("height")
                        or "-",
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
        for jugador in grupo:
            nombre = jugador.get("nombre")
            if nombre:
                nombres.add(slug(nombre))

    return nombres


def filtrar_estadisticas_por_plantel(estadisticas, plantel):
    validos = nombres_validos_plantel(plantel)

    if not validos:
        return estadisticas

    limpias = {
        "goles": [],
        "asistencias": [],
        "amarillas": [],
    }

    for categoria in ["goles", "asistencias", "amarillas"]:
        for item in estadisticas.get(categoria, []):
            jugador = item.get("jugador", "")

            if slug(jugador) in validos:
                limpias[categoria].append(item)

    return limpias


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
            ):
                encontrados.append(obj)

            for value in obj.values():
                caminar(value)

        elif isinstance(obj, list):
            for item in obj:
                caminar(item)

    caminar(data)
    return encontrados


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

    if "goal" in texto or "gol" in texto:
        return "gol"

    if "assist" in texto or "asistencia" in texto:
        return "asistencia"

    if "yellow" in texto or "amarilla" in texto:
        return "amarilla"

    if "card" in texto and "yellow" in texto:
        return "amarilla"

    return ""


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


def cargar_estadisticas_desde_resumenes(equipo):
    goles = Counter()
    asistencias = Counter()
    amarillas = Counter()

    partidos = equipo.get("resultados", [])[:10]

    print(f"📊 Buscando estadísticas por resumen para {equipo.get('nombre')}")

    for partido in partidos:
        game_id = extraer_game_id(partido.get("url"))

        if not game_id:
            continue

        data = cargar_resumen_partido(game_id)

        if not data:
            continue

        print(f"📌 Summary {game_id} keys: {list(data.keys())}")

        eventos = []

        if isinstance(data.get("scoringPlays"), list):
            eventos.extend(data.get("scoringPlays") or [])

        if isinstance(data.get("plays"), list):
            eventos.extend(data.get("plays") or [])

        eventos.extend(extraer_eventos_recursivo(data))

        for evento in eventos:
            if not isinstance(evento, dict):
                continue

            tipo = detectar_tipo_evento(evento)
            jugadores = extraer_jugadores_de_evento(evento)

            if not tipo or not jugadores:
                continue

            jugador_principal = jugadores[0]

            if tipo == "gol":
                goles[jugador_principal] += 1

                if len(jugadores) > 1:
                    asistencias[jugadores[1]] += 1

            elif tipo == "asistencia":
                asistencias[jugador_principal] += 1

            elif tipo == "amarilla":
                amarillas[jugador_principal] += 1

    return {
        "goles": sumar_counter_a_lista(goles),
        "asistencias": sumar_counter_a_lista(asistencias),
        "amarillas": sumar_counter_a_lista(amarillas),
    }


def cargar_estadisticas_jugadores(equipo):
    espn_id = equipo.get("espn_id")

    estadisticas = {
        "goles": [],
        "asistencias": [],
        "amarillas": [],
    }

    if not espn_id:
        return estadisticas

    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{LEAGUE_SLUG}/teams/{espn_id}/statistics",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{LEAGUE_SLUG}/seasons/2026/types/1/teams/{espn_id}/statistics?lang=es&region=ar",
    ]

    for url in urls:
        data = get_json(url)

        if not data:
            continue

        print(f"📊 Estadísticas recibidas para {equipo.get('nombre')}")
        print("🔑 Keys principales:", list(data.keys()))

        leaders = data.get("leaders") or data.get("categories") or []

        for group in leaders:
            if not isinstance(group, dict):
                continue

            group_name = slug(group.get("name") or group.get("displayName") or "")
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

    estadisticas["goles"] = estadisticas["goles"][:10]
    estadisticas["asistencias"] = estadisticas["asistencias"][:10]
    estadisticas["amarillas"] = estadisticas["amarillas"][:10]

    return estadisticas


def completar_equipo(base):
    print(f"🏟️ Actualizando equipo: {base['nombre']}")

    equipo = equipo_vacio(base)

    proximos, resultados = cargar_partidos_equipo(base)
    equipo["proximosPartidos"] = proximos
    equipo["resultados"] = resultados

    equipo["plantel"] = cargar_plantel(base)

    estadisticas = cargar_estadisticas_jugadores(base)

    if (
        not estadisticas["goles"]
        and not estadisticas["asistencias"]
        and not estadisticas["amarillas"]
    ):
        estadisticas = cargar_estadisticas_desde_resumenes(equipo)

    estadisticas = filtrar_estadisticas_por_plantel(estadisticas, equipo["plantel"])

    equipo["estadisticas"] = estadisticas

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
