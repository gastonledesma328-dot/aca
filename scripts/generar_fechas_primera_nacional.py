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
        print(f"🌐 {r.status_code} {url}")
        if not r.ok:
            return None
        return r.json()
    except Exception as e:
        print(f"⚠️ Error leyendo JSON: {e} | {url}")
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
    # Consultas por mes. ESPN suele responder mejor por rangos medianos que por toda la temporada completa.
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


def crear_fechas(partidos):
    fechas = []
    for i in range(0, len(partidos), PARTIDOS_POR_FECHA):
        bloque = partidos[i:i + PARTIDOS_POR_FECHA]
        if not bloque:
            continue
        numero = len(fechas) + 1
        fechas.append({
            "numero": numero,
            "nombre": f"Fecha {numero}",
            "partidos": bloque,
            "fecha_desde": bloque[0].get("dia", ""),
            "fecha_hasta": bloque[-1].get("dia", ""),
        })
    return fechas


def guardar(data):
    for path in [OUTPUT_FILE, PUBLIC_OUTPUT_FILE]:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✅ Generado {path}")


def main():
    partidos = cargar_partidos_liga()
    fechas = crear_fechas(partidos)
    data = {
        "competicion": "Primera Nacional",
        "league_slug": LEAGUE_SLUG,
        "season": SEASON,
        "formato": "Fase de grupos",
        "partidos_por_fecha": PARTIDOS_POR_FECHA,
        "total_partidos": len(partidos),
        "total_fechas": len(fechas),
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "fechas": fechas,
        "partidos": partidos,
    }

    if len(fechas) < 30:
        print(f"⚠️ ESPN devolvió solo {len(fechas)} fechas desde scoreboard. Se guarda igual, pero no parece calendario completo.")
    else:
        print(f"✅ Calendario completo estimado: {len(fechas)} fechas, {len(partidos)} partidos")

    guardar(data)


if __name__ == "__main__":
    main()
