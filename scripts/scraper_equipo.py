import json
import os
import unicodedata
from datetime import datetime, timezone

import requests


OUTPUT_FILE = "data/equipos.json"
AGENDA_URL = "https://partidos-hoy-worker.gastonledesma328.workers.dev"

EQUIPOS_BASE = [
    {
        "id": "river-plate",
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
        "nombre": "Boca Juniors",
        "liga": "Liga Profesional de Futbol",
        "logo": "https://a.espncdn.com/i/teamlogos/soccer/500/5.png",
        "apodo": "Xeneizes",
        "fundacion": "1905",
        "estadio": "Alberto J. Armando",
        "ciudad": "Buenos Aires"
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


def equipo_vacio(equipo):
    return {
        "id": equipo.get("id", ""),
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


def cargar_agenda():
    try:
        print("📡 Leyendo agenda desde Worker...")
        r = requests.get(
            AGENDA_URL,
            timeout=25,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json"
            }
        )
        r.raise_for_status()
        data = r.json()
        partidos = data.get("partidos", [])

        if not isinstance(partidos, list):
            return []

        print(f"✅ Partidos recibidos: {len(partidos)}")
        return partidos

    except Exception as e:
        print(f"⚠️ No se pudo leer la agenda: {e}")
        return []


def resultado_partido(partido):
    marcador_local = partido.get("marcador_local")
    marcador_visitante = partido.get("marcador_visitante")

    if marcador_local is not None and marcador_visitante is not None:
        return f"{marcador_local} - {marcador_visitante}"

    if partido.get("resultado"):
        return str(partido.get("resultado"))

    return "-"


def tiene_marcador(partido):
    return (
        partido.get("marcador_local") is not None
        and partido.get("marcador_visitante") is not None
    )


def completar_partidos(equipo, partidos):
    equipo_id = equipo["id"]

    print(f"🔎 Buscando partidos para: {equipo['nombre']} ({equipo_id})")
    print(f"📋 Total partidos disponibles: {len(partidos)}")

    partidos_equipo = []

    for partido in partidos:
        local = partido.get("local") or ""
        visitante = partido.get("visitante") or ""

        local_id = slug(local)
        visitante_id = slug(visitante)

        if local_id == equipo_id or visitante_id == equipo_id:
            partidos_equipo.append(partido)

        print(f"🎯 Partidos encontrados para {equipo['nombre']}: {len(partidos_equipo)}")

    proximos = []
    resultados = []

    for partido in partidos_equipo:
        item_base = {
            "dia": partido.get("fecha") or "Sin fecha",
            "local": partido.get("local") or "Local",
            "visitante": partido.get("visitante") or "Visitante",
            "url": partido.get("url_espn") or ""
        }

        completado = partido.get("completado") is True

        if completado or tiene_marcador(partido):
            resultados.append({
                **item_base,
                "resultado": resultado_partido(partido)
            })
        else:
            proximos.append({
                **item_base,
                "hora": partido.get("hora_inicio") or partido.get("hora") or "-"
            })

    equipo["proximosPartidos"] = proximos[:10]
    equipo["resultados"] = resultados[:10]

    return equipo


def main():
    os.makedirs("data", exist_ok=True)

    partidos = cargar_agenda()

    equipos = []

    for base in EQUIPOS_BASE:
        equipo = equipo_vacio(base)
        equipo = completar_partidos(equipo, partidos)
        equipos.append(equipo)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(equipos, f, ensure_ascii=False, indent=2)

    print(f"✅ Generado {OUTPUT_FILE} con {len(equipos)} equipos")


if __name__ == "__main__":
    main()
