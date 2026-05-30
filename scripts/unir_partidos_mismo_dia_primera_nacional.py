import json
from pathlib import Path
from datetime import datetime, timezone

PATHS = [
    Path("data/primera_nacional_fixture_oficial.json"),
    Path("public/data/primera_nacional_fixture_oficial.json"),
    Path("data/primera_nacional_fechas.json"),
    Path("public/data/primera_nacional_fechas.json"),
]


def fecha_partido(partido):
    return (
        partido.get("fecha_original")
        or partido.get("dia")
        or partido.get("fecha")
        or partido.get("fecha_iso", "")[:10]
        or ""
    )


def hora_partido(partido):
    return partido.get("hora_original") or partido.get("hora") or ""


def ordenar_partidos(partidos):
    return sorted(
        partidos,
        key=lambda p: (
            fecha_partido(p),
            hora_partido(p),
            p.get("local", ""),
            p.get("visitante", ""),
        ),
    )


def normalizar_partido(partido, numero_fecha):
    partido["numero_fecha"] = numero_fecha
    partido["fecha_torneo"] = numero_fecha
    partido["unido_por_mismo_dia"] = True
    return partido


def recalcular_rango(fecha):
    partidos = ordenar_partidos(fecha.get("partidos", []))
    fecha["partidos"] = partidos
    fecha["fecha_desde"] = next((fecha_partido(p) for p in partidos if fecha_partido(p)), "")
    fecha["fecha_hasta"] = next((fecha_partido(p) for p in reversed(partidos) if fecha_partido(p)), "")
    return fecha


def unir_cortes_por_dia(data):
    fechas = data.get("fechas") or []
    if not fechas:
        return data

    fechas = sorted(fechas, key=lambda f: int(f.get("numero", 999)))
    cambios = []
    i = 0

    while i < len(fechas) - 1:
        actual = fechas[i]
        siguiente = fechas[i + 1]
        actual_partidos = ordenar_partidos(actual.get("partidos", []))
        siguiente_partidos = ordenar_partidos(siguiente.get("partidos", []))

        if not actual_partidos or not siguiente_partidos:
            i += 1
            continue

        ultimo_dia_actual = fecha_partido(actual_partidos[-1])
        primer_dia_siguiente = fecha_partido(siguiente_partidos[0])

        if ultimo_dia_actual and ultimo_dia_actual == primer_dia_siguiente:
            numero_actual = int(actual.get("numero"))
            movidos = []
            quedan = []

            for partido in siguiente_partidos:
                if fecha_partido(partido) == ultimo_dia_actual:
                    movidos.append(normalizar_partido(partido, numero_actual))
                else:
                    quedan.append(partido)

            if movidos:
                actual["partidos"] = ordenar_partidos(actual_partidos + movidos)
                siguiente["partidos"] = ordenar_partidos(quedan)
                cambios.append({
                    "dia": ultimo_dia_actual,
                    "desde_fecha": siguiente.get("numero"),
                    "hacia_fecha": actual.get("numero"),
                    "partidos_movidos": len(movidos),
                })
                recalcular_rango(actual)
                recalcular_rango(siguiente)
                # No avanzamos: puede haber otro corte consecutivo con el mismo día.
                continue

        i += 1

    nuevas = []
    for nueva_pos, fecha in enumerate(fechas, start=1):
        partidos = fecha.get("partidos", [])
        if not partidos:
            # Si una fecha quedó vacía por mover partidos del mismo día, se elimina
            # y se renumeran las siguientes para no mostrar cuadros vacíos.
            continue

        fecha["numero"] = nueva_pos
        fecha["nombre"] = f"Fecha {nueva_pos}"
        fecha["partidos"] = [normalizar_partido(p, nueva_pos) for p in ordenar_partidos(partidos)]
        fecha["metodo_corte_dia"] = "no-dividir-mismo-dia"
        recalcular_rango(fecha)
        nuevas.append(fecha)

    data["fechas"] = nuevas
    data["partidos"] = [p for f in nuevas for p in f.get("partidos", [])]
    data["total_fechas"] = len(nuevas)
    data["total_partidos"] = len(data["partidos"])
    data["no_dividir_mismo_dia"] = {
        "activo": True,
        "descripcion": "Si una fecha supera 18 partidos pero todavía hay partidos del mismo día, esos partidos quedan en la misma fecha y no pasan a la siguiente.",
        "cambios": cambios,
        "actualizado": datetime.now(timezone.utc).isoformat(),
    }
    return data


def main():
    for path in PATHS:
        if not path.exists():
            print(f"⚠️ No existe {path}, se omite")
            continue

        raw = path.read_text(encoding="utf-8").strip()
        if not raw:
            print(f"⚠️ {path} está vacío, se omite")
            continue

        data = json.loads(raw)
        data = unir_cortes_por_dia(data)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"✅ Unificados cortes por día en {path}: {data.get('total_fechas')} fechas, {data.get('total_partidos')} partidos")


if __name__ == "__main__":
    main()
