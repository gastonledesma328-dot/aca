import json
import os
from datetime import datetime, timezone
from urllib.parse import quote

import requests


OUTPUT_FILE = "data/equipos.json"

# Por ahora arrancamos con equipos principales.
# Después podemos agrandar esta lista automáticamente desde tu agenda.
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


def main():
    os.makedirs("data", exist_ok=True)

    equipos = [equipo_vacio(equipo) for equipo in EQUIPOS_BASE]

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(equipos, f, ensure_ascii=False, indent=2)

    print(f"✅ Generado {OUTPUT_FILE} con {len(equipos)} equipos")


if __name__ == "__main__":
    main()
