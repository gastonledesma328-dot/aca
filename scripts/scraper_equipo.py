import json
import os
import unicodedata
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
        "ciudad": "Buenos Aires"
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
        "ciudad": "Buenos Aires"
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
        "ciudad": "Avellaneda"
    }
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
                "Referer": "https://www.espn.com.ar/"
            }
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
            "delanteros": []
        },
        "estadisticas": {
            "goles": [],
            "asistencias": [],
            "amarillas": []
        }
    }


def formatear_fecha(fecha):
    if not fecha:
        return "Sin fecha"

    return str(fecha).split("T")[0]

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
        score = comp.get("score")

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
        "url": (evento.get("links") or [{}])[0].get("href", "")
    }


def cargar_partidos_equipo(equipo):
    espn_id = equipo.get("espn_id")

    if not espn_id:
        return [], []

    # Schedule del equipo en ESPN
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
            resultados.append({
                "dia": partido["fecha"],
                "local": partido["local"],
                "visitante": partido["visitante"],
                "url": partido["url"],
                "resultado": f'{partido["marcador_local"]} - {partido["marcador_visitante"]}' if tiene_marcador else "-"
            })
        else:
            proximos.append({
                "dia": partido["fecha"],
                "local": partido["local"],
                "visitante": partido["visitante"],
                "url": partido["url"],
                "hora": "Ver horario"
            })

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

    if not espn_id:
        return {
            "arqueros": [],
            "defensores": [],
            "mediocampistas": [],
            "delanteros": []
        }

    # Roster desde ESPN site api
    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{LEAGUE_SLUG}/teams/{espn_id}/roster"
    data = get_json(url)

    plantel = {
        "arqueros": [],
        "defensores": [],
        "mediocampistas": [],
        "delanteros": []
    }

    if not data:
        return plantel

    athletes = data.get("athletes") or []

    # Algunas respuestas vienen agrupadas por position.
    for group in athletes:
        if isinstance(group, dict) and "items" in group:
            posicion_nombre = group.get("position") or group.get("name") or ""
            categoria = normalizar_posicion(posicion_nombre)

            for item in group.get("items") or []:
                athlete = item.get("athlete") or item
                nombre = athlete.get("displayName") or athlete.get("fullName") or athlete.get("name")

                if not nombre:
                    continue

                plantel[categoria].append({
                    "nombre": nombre,
                    "edad": athlete.get("age") or "-",
                    "altura": athlete.get("displayHeight") or athlete.get("height") or "-"
                })

        elif isinstance(group, dict):
            nombre = group.get("displayName") or group.get("fullName") or group.get("name")

            if not nombre:
                continue

            position = group.get("position") or {}
            categoria = normalizar_posicion(position.get("displayName") or position.get("name") or "")

            plantel[categoria].append({
                "nombre": nombre,
                "edad": group.get("age") or "-",
                "altura": group.get("displayHeight") or group.get("height") or "-"
            })

    return plantel


def extraer_stat_valor(stat):
    for key in ["value", "displayValue", "total"]:
        if stat.get(key) is not None:
            return stat.get(key)

    return 0


def cargar_estadisticas_jugadores(equipo):
    espn_id = equipo.get("espn_id")

    if not espn_id:
        return {
            "goles": [],
            "asistencias": [],
            "amarillas": []
        }

    estadisticas = {
        "goles": [],
        "asistencias": [],
        "amarillas": []
    }

    # Endpoint de estadísticas del equipo. Puede variar según liga/temporada.
    urls = [
        f"https://site.api.espn.com/apis/site/v2/sports/soccer/{LEAGUE_SLUG}/teams/{espn_id}/statistics",
        f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{LEAGUE_SLUG}/seasons/2026/types/1/teams/{espn_id}/statistics?lang=es&region=ar"
    ]

    for url in urls:
        data = get_json(url)

        if not data:
            continue

        # Como ESPN no siempre entrega el mismo formato, guardamos si encontramos rankings/listas.
        # Si no encuentra formato compatible, deja arrays vacíos.
        leaders = data.get("leaders") or data.get("categories") or []

        for group in leaders:
            group_name = slug(group.get("name") or group.get("displayName") or "")

            items = group.get("leaders") or group.get("items") or group.get("statistics") or []

            for item in items:
                athlete = item.get("athlete") or item.get("player") or {}
                nombre = (
                    athlete.get("displayName")
                    or athlete.get("fullName")
                    or item.get("displayName")
                    or item.get("name")
                )

                if not nombre:
                    continue

                total = item.get("value") or item.get("displayValue") or item.get("total") or 0

                if "goal" in group_name or "gol" in group_name:
                    estadisticas["goles"].append({
                        "jugador": nombre,
                        "total": total
                    })

                if "assist" in group_name or "asistencia" in group_name:
                    estadisticas["asistencias"].append({
                        "jugador": nombre,
                        "total": total
                    })

                if "yellow" in group_name or "amarilla" in group_name:
                    estadisticas["amarillas"].append({
                        "jugador": nombre,
                        "total": total
                    })

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
    equipo["estadisticas"] = cargar_estadisticas_jugadores(base)

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
