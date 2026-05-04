import json
import os
import re
import unicodedata
from datetime import datetime, timezone
from html import unescape

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
        "scores365_id": "868",
        "scores365_slug": "river-plate",
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
        "scores365_id": "866",
        "scores365_slug": "boca-juniors",
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
        "scores365_id": "876",
        "scores365_slug": "racing-club",
        "nombre": "Racing Club",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/15.png",
        "apodo": "La Academia",
        "fundacion": "1903",
        "estadio": "Presidente Perón",
        "ciudad": "Avellaneda",
    },
]


PREVIOUS_DATA = []


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


def normalizar_texto(texto):
    texto = str(texto or "")
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = texto.lower()
    texto = re.sub(r"\s+", " ", texto)
    return texto.strip()


def slug_jugador(nombre):
    value = slug(nombre)

    correcciones = {
        "lautaruo-rivero": "lautaro-rivero",
        "joaquin-freitas": "joaquin-freitas",
        "adrian-martinez": "adrian-martinez",
        "tomas-conechny": "tomas-conechny",
        "duvan-vergara": "duvan-vergara",
        "matias-zaracho": "matias-zaracho",
    }

    return correcciones.get(value, value)


def nombre_visible(nombre):
    correcciones = {
        "Lautaruo Rivero": "Lautaro Rivero",
        "Joaquin Freitas": "Joaquín Freitas",
        "Aníbal Moreno": "Aníbal Moreno",
        "Adrián Martínez": "Adrián Martínez",
        "Duván Vergara": "Duván Vergara",
        "Matías Zaracho": "Matías Zaracho",
    }

    return correcciones.get(nombre, nombre)


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


def stats_vacias(stats):
    if not isinstance(stats, dict):
        return True

    return (
        not stats.get("goles")
        and not stats.get("asistencias")
        and not stats.get("amarillas")
        and not stats.get("rojas")
    )


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
        "scores365_id": equipo.get("scores365_id", ""),
        "scores365_slug": equipo.get("scores365_slug", ""),
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


def lista_jugadores_plantel(plantel):
    jugadores = []

    for grupo in plantel.values():
        if not isinstance(grupo, list):
            continue

        for jugador in grupo:
            if not isinstance(jugador, dict):
                continue

            nombre = jugador.get("nombre")

            if nombre:
                jugadores.append(nombre)

    return jugadores


def nombres_validos_plantel(plantel):
    return {slug_jugador(nombre) for nombre in lista_jugadores_plantel(plantel)}


def filtrar_estadisticas_por_plantel(estadisticas, plantel):
    validos = nombres_validos_plantel(plantel)

    if not validos:
        return estadisticas

    limpias = estadisticas_vacias()

    for categoria in ["goles", "asistencias", "amarillas", "rojas"]:
        for item in estadisticas.get(categoria, []):
            jugador = item.get("jugador", "")

            if slug_jugador(jugador) in validos:
                limpias[categoria].append(item)

    return limpias


# =========================
# 365SCORES - ESTADÍSTICAS PERSONALES
# =========================

TITULOS_365 = [
    "Goles",
    "Goles esperados",
    "Asistencias",
    "Asistencias esperadas",
    "Goles y Asistencias",
    "Goles esperados y asistencias",
    "Rating 365",
    "Penaltis convertidos",
    "Barridas ganadas por partido",
    "Intercepciones por partido",
    "Tarjetas Rojas",
    "Tarjetas Amarillas",
    "Porterías a cero",
    "Goles recibidos",
    "Atajadas por partido",
    "Penaltis parados",
    "Faltas",
    "Faltas cometidas",
    "Duelos ganados",
]


def limpiar_html_365(html):
    html = re.sub(r"<script[\s\S]*?</script>", "\n", html, flags=re.I)
    html = re.sub(r"<style[\s\S]*?</style>", "\n", html, flags=re.I)
    html = re.sub(r"<noscript[\s\S]*?</noscript>", "\n", html, flags=re.I)

    html = re.sub(r"<h[1-6][^>]*>", "\n### ", html, flags=re.I)
    html = re.sub(r"</h[1-6]>", "\n", html, flags=re.I)
    html = re.sub(r"<a[^>]*>", "\n", html, flags=re.I)
    html = re.sub(r"</a>", "\n", html, flags=re.I)
    html = re.sub(r"<[^>]+>", "\n", html)

    texto = unescape(html)
    texto = re.sub(r"\s+", " ", texto)

    return texto.strip()


def obtener_bloque_texto_365(texto, titulo):
    if not texto:
        return ""

    patron_inicio = re.compile(rf"(?:###\s*)?{re.escape(titulo)}\b", re.I)
    match = patron_inicio.search(texto)

    if not match:
        return ""

    inicio = match.end()
    fin = len(texto)

    for otro in TITULOS_365:
        if slug(otro) == slug(titulo):
            continue

        patron_fin = re.compile(rf"(?:###\s*)?{re.escape(otro)}\b", re.I)
        m = patron_fin.search(texto, inicio)

        if m and m.start() < fin:
            fin = m.start()

    return texto[inicio:fin].strip()


def parse_numero_365(valor):
    valor = str(valor or "").replace(",", ".").strip()

    if "/" in valor:
        valor = valor.split("/")[0]

    try:
        numero = float(valor)

        if numero.is_integer():
            return int(numero)

        return numero

    except Exception:
        return 0


def extraer_ranking_365_desde_texto(texto, titulo, plantel, max_items=10):
    bloque = obtener_bloque_texto_365(texto, titulo)

    if not bloque:
        print(f"⚠️ 365Scores: no encontré bloque {titulo}")
        return []

    jugadores = lista_jugadores_plantel(plantel)
    resultados = []

    jugadores_ordenados = sorted(
        jugadores,
        key=lambda n: len(str(n)),
        reverse=True
    )

    for nombre in jugadores_ordenados:
        candidatos = [nombre]

        if slug(nombre) == "lautaruo-rivero":
            candidatos.append("Lautaro Rivero")

        if slug(nombre) == "joaquin-freitas":
            candidatos.append("Joaquín Freitas")

        encontrado = None

        for candidato in candidatos:
            nombre_regex = re.escape(candidato)

            patron_pre = re.compile(
                rf"(?:^|\s)(?P<pre>\d+(?:[.,]\d+)?(?:/\d+)?)\s+"
                rf"{nombre_regex}"
                rf"(?=\s|$)",
                re.I,
            )

            m_pre = patron_pre.search(bloque)

            if m_pre:
                total = parse_numero_365(m_pre.group("pre"))

                if total > 0:
                    encontrado = {
                        "jugador": nombre_visible(nombre),
                        "total": total,
                    }
                    break

            patron_post = re.compile(
                rf"{nombre_regex}"
                rf"(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñüÜ().'\-]+){{0,12}}?"
                rf"\s+(?P<post>\d+(?:[.,]\d+)?(?:/\d+)?)"
                rf"(?=\s|$)",
                re.I,
            )

            m_post = patron_post.search(bloque)

            if m_post:
                total = parse_numero_365(m_post.group("post"))

                if total > 0:
                    encontrado = {
                        "jugador": nombre_visible(nombre),
                        "total": total,
                    }
                    break

        if encontrado:
            resultados.append(encontrado)

    resultados.sort(key=lambda x: x.get("total", 0), reverse=True)

    vistos = set()
    limpios = []

    for item in resultados:
        key = slug_jugador(item["jugador"])

        if key in vistos:
            continue

        vistos.add(key)
        limpios.append(item)

    return limpios[:max_items]


def cargar_estadisticas_365scores(equipo, plantel):
    scores365_id = equipo.get("scores365_id")
    scores365_slug = equipo.get("scores365_slug") or equipo.get("id")

    if not scores365_id:
        return estadisticas_vacias()

    url = f"https://www.365scores.com/es/football/team/{scores365_slug}-{scores365_id}/stats"

    try:
        r = requests.get(
            url,
            timeout=30,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
                "Referer": "https://www.365scores.com/es",
            },
        )

        print(f"📊 365Scores {r.status_code} {url}")

        if not r.ok:
            return estadisticas_vacias()

        texto = limpiar_html_365(r.text)

        print("🔎 365Scores texto length:", len(texto))
        print("🔎 Tiene Goles:", "Goles" in texto)
        print("🔎 Tiene Asistencias:", "Asistencias" in texto)
        print("🔎 Tiene Tarjetas Amarillas:", "Tarjetas Amarillas" in texto)
        print("🔎 Tiene Tarjetas Rojas:", "Tarjetas Rojas" in texto)

        goles = extraer_ranking_365_desde_texto(texto, "Goles", plantel)
        asistencias = extraer_ranking_365_desde_texto(texto, "Asistencias", plantel)
        amarillas = extraer_ranking_365_desde_texto(texto, "Tarjetas Amarillas", plantel)
        rojas = extraer_ranking_365_desde_texto(texto, "Tarjetas Rojas", plantel)

        estadisticas = {
            "goles": goles,
            "asistencias": asistencias,
            "amarillas": amarillas,
            "rojas": rojas,
        }

        print(f"✅ Estadísticas 365Scores {equipo.get('nombre')}:", estadisticas)

        return estadisticas

    except Exception as e:
        print(f"⚠️ Error leyendo 365Scores para {equipo.get('nombre')}: {e}")
        return estadisticas_vacias()


def obtener_estadisticas_previas(equipo_id, nombre_competicion):
    if not isinstance(PREVIOUS_DATA, list):
        return estadisticas_vacias()

    for equipo in PREVIOUS_DATA:
        if not isinstance(equipo, dict):
            continue

        if equipo.get("id") != equipo_id:
            continue

        comp = (equipo.get("estadisticasPorCompeticion") or {}).get(nombre_competicion)

        if isinstance(comp, dict):
            stats = comp.get("estadisticas") or {}

            if not stats_vacias(stats):
                return stats

        stats = equipo.get("estadisticas") or {}

        if not stats_vacias(stats):
            return stats

    return estadisticas_vacias()


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
            estadisticas = cargar_estadisticas_365scores(base, equipo["plantel"])

            if stats_vacias(estadisticas):
                previas = obtener_estadisticas_previas(base.get("id"), nombre_competicion)

                if not stats_vacias(previas):
                    print(f"♻️ Usando estadísticas previas para {base['nombre']}")
                    estadisticas = previas
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


def main():
    global PREVIOUS_DATA

    os.makedirs("data", exist_ok=True)

    PREVIOUS_DATA = cargar_json_previo()

    equipos = []

    for base in EQUIPOS_BASE:
        equipos.append(completar_equipo(base))

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(equipos, f, ensure_ascii=False, indent=2)

    print(f"✅ Generado {OUTPUT_FILE} con {len(equipos)} equipos")


if __name__ == "__main__":
    main()
