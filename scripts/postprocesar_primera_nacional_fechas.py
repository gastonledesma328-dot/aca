"""
postprocesar_primera_nacional_fechas.py

Aplica correcciones automáticas sobre primera_nacional_fechas.json
DESPUÉS de que corran los scrapers, para que no se pierdan con cada actualización:

1. Convierte horas UTC de madrugada (00:xx, 01:xx, 02:xx, 03:xx) a hora Argentina real
   (UTC-3), ajustando el día si corresponde.
2. Ordena los partidos de cada fecha cronológicamente (por día y hora).
3. Elimina duplicados exactos (mismo local + visitante + mismo día dentro de la misma fecha).

Estos son problemas estructurales del scraper que este script compensa sin tocar
la lógica de scraping.
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUTPUTS = [
    Path("data/primera_nacional_fechas.json"),
    Path("public/data/primera_nacional_fechas.json"),
]


def utc_hora_a_arg(hora_utc: str, dia_utc: str):
    """
    Convierte una hora UTC de madrugada a hora Argentina (UTC-3).
    Si la hora UTC es 00:xx–03:xx, el partido se jugó la noche anterior en ARG.
    Devuelve (nueva_hora_str, nuevo_dia_str).
    """
    try:
        h, m = map(int, hora_utc.split(":"))
    except Exception:
        return hora_utc, dia_utc

    h_arg = h - 3
    nuevo_dia = dia_utc

    if h_arg < 0:
        h_arg += 24
        dia_dt = datetime.strptime(dia_utc, "%Y-%m-%d")
        nuevo_dia = (dia_dt - timedelta(days=1)).strftime("%Y-%m-%d")

    return f"{h_arg:02d}:{m:02d}", nuevo_dia


def es_hora_madrugada_utc(hora: str) -> bool:
    if not hora:
        return False
    try:
        h = int(hora.split(":")[0])
        return 0 <= h <= 3
    except Exception:
        return False


def postprocesar(data: dict) -> dict:
    stats = {"horas_corregidas": 0, "duplicados_eliminados": 0, "fechas_reordenadas": 0}

    for fecha in data.get("fechas", []):
        partidos = fecha.get("partidos", [])

        # 1. Corregir horas UTC de madrugada → hora ARG real
        for p in partidos:
            hora = p.get("hora", "")
            dia = p.get("dia", "")
            if hora and dia and es_hora_madrugada_utc(hora):
                nueva_hora, nuevo_dia = utc_hora_a_arg(hora, dia)
                if nueva_hora != hora or nuevo_dia != dia:
                    p["hora"] = nueva_hora
                    p["dia"] = nuevo_dia
                    stats["horas_corregidas"] += 1

        # 2. Eliminar duplicados: mismo (local, visitante, dia) dentro de la misma fecha
        vistos = {}
        sin_dupes = []
        for p in partidos:
            clave = (p.get("local", ""), p.get("visitante", ""), p.get("dia", ""))
            if clave in vistos:
                # Conservar el que tiene resultado (completado), sino el más nuevo (id mayor)
                existente = vistos[clave]
                if p.get("completado") and not existente.get("completado"):
                    # El nuevo tiene resultado, reemplazar
                    sin_dupes[sin_dupes.index(existente)] = p
                    vistos[clave] = p
                elif not p.get("completado") and existente.get("completado"):
                    pass  # Conservar el existente que ya tiene resultado
                else:
                    # Ambos igual de completos: conservar el ID más alto (más reciente ESPN)
                    try:
                        if int(p.get("id", "0")) > int(existente.get("id", "0")):
                            sin_dupes[sin_dupes.index(existente)] = p
                            vistos[clave] = p
                    except Exception:
                        pass
                stats["duplicados_eliminados"] += 1
            else:
                vistos[clave] = p
                sin_dupes.append(p)
        fecha["partidos"] = sin_dupes

        # 3. Ordenar cronológicamente por (dia, hora)
        partidos_antes = [p.get("dia", "") for p in fecha["partidos"][:3]]
        fecha["partidos"].sort(
            key=lambda p: (p.get("dia") or "9999-99-99", p.get("hora") or "99:99")
        )
        partidos_despues = [p.get("dia", "") for p in fecha["partidos"][:3]]
        if partidos_antes != partidos_despues:
            stats["fechas_reordenadas"] += 1

    data["postprocesado"] = datetime.now(timezone.utc).isoformat()
    return data, stats


def main():
    for path in OUTPUTS:
        if not path.exists():
            print(f"⚠️  No existe: {path}")
            continue

        with open(path, encoding="utf-8") as f:
            data = json.load(f)

        data, stats = postprocesar(data)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(
            f"✅ {path.name}: "
            f"{stats['horas_corregidas']} horas corregidas, "
            f"{stats['duplicados_eliminados']} duplicados eliminados, "
            f"{stats['fechas_reordenadas']} fechas reordenadas"
        )


if __name__ == "__main__":
    main()
