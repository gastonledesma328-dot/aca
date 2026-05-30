import json
from pathlib import Path
from datetime import datetime, timezone

PATHS = [
    Path("data/primera_nacional_fixture_oficial.json"),
    Path("public/data/primera_nacional_fixture_oficial.json"),
]

# El fixture base quedó con este problema:
# - Las fechas 1, 2 y 3 están bien.
# - El bloque que figura como Fecha 4 en el JSON corresponde a la Fecha 18.
# - Los primeros partidos del bloque siguiente, jugados el 14/06, también pertenecen a Fecha 18.
# - El resto del bloque 5 pasa a ser Fecha 4.
# - Desde ahí, los bloques 6..18 bajan una posición: 6=>5, 7=>6 ... 18=>17.
# - Desde 19 en adelante quedan igual.

FECHA_18_EXTRA_DIAS = {"2026-06-13", "2026-06-14"}

# Pares manuales de seguridad. Sirve aunque ESPN cambie el día/hora y el partido no caiga en los días de arriba.
FECHA_18_PARES = {
    frozenset(["Deportivo Maipú", "Tristán Suárez"]),
    frozenset(["Quilmes", "Gimnasia y Tiro (Salta)"]),
}


def pareja(partido):
    return frozenset([partido.get("local", ""), partido.get("visitante", "")])


def es_extra_fecha_18(partido):
    dia = partido.get("fecha_original") or partido.get("dia") or ""
    if dia in FECHA_18_EXTRA_DIAS:
        return True
    if pareja(partido) in FECHA_18_PARES:
        return True
    return False


def normalizar_partido(partido, numero):
    partido["numero_fecha"] = numero
    partido["fecha_torneo"] = numero
    partido["fixture_corregido"] = True
    partido["actualizado_fixture"] = datetime.now(timezone.utc).isoformat()
    return partido


def ordenar_partidos(partidos):
    return sorted(partidos, key=lambda p: (p.get("fecha_original") or p.get("dia") or "", p.get("hora_original") or p.get("hora") or "", p.get("local") or ""))


def corregir(data):
    fechas_originales = data.get("fechas") or []
    por_numero = {}
    for fecha in fechas_originales:
        try:
            por_numero[int(fecha.get("numero"))] = fecha
        except Exception:
            continue

    old_4 = list((por_numero.get(4) or {}).get("partidos", []))
    old_5 = list((por_numero.get(5) or {}).get("partidos", []))

    extras_fecha_18 = [p for p in old_5 if es_extra_fecha_18(p)]
    old_5_limpia = [p for p in old_5 if not es_extra_fecha_18(p)]

    nuevas = []

    def agregar(numero_nuevo, partidos, origen=None):
        partidos = ordenar_partidos([normalizar_partido(dict(p), numero_nuevo) for p in partidos])
        nuevas.append({
            "numero": numero_nuevo,
            "nombre": f"Fecha {numero_nuevo}",
            "numero_origen_antes_correccion": origen,
            "partidos": partidos,
            "fecha_desde": next((p.get("fecha_original") or p.get("dia") for p in partidos if p.get("fecha_original") or p.get("dia")), ""),
            "fecha_hasta": next((p.get("fecha_original") or p.get("dia") for p in reversed(partidos) if p.get("fecha_original") or p.get("dia")), ""),
            "metodo_agrupacion": "fixture-oficial-corregido-manual",
        })

    # 1, 2 y 3 quedan igual.
    for numero in [1, 2, 3]:
        fecha = por_numero.get(numero)
        if fecha:
            agregar(numero, fecha.get("partidos", []), origen=numero)

    # Fecha 4: lo que estaba en la 5, sacando los partidos que pertenecen a la 18.
    agregar(4, old_5_limpia, origen=5)

    # Fechas 5 a 17: viejas 6 a 18.
    for nuevo in range(5, 18):
        viejo = nuevo + 1
        fecha = por_numero.get(viejo)
        if fecha:
            agregar(nuevo, fecha.get("partidos", []), origen=viejo)

    # Fecha 18: viejo bloque 4 + partidos descolgados desde el inicio del bloque 5.
    agregar(18, old_4 + extras_fecha_18, origen="4+extras_de_5")

    # Desde 19 en adelante quedan igual.
    for numero in range(19, 37):
        fecha = por_numero.get(numero)
        if fecha:
            agregar(numero, fecha.get("partidos", []), origen=numero)

    data["fechas"] = sorted(nuevas, key=lambda f: int(f.get("numero", 999)))
    data["partidos"] = [p for f in data["fechas"] for p in f.get("partidos", [])]
    data["total_fechas"] = len(data["fechas"])
    data["total_partidos"] = len(data["partidos"])
    data["metodo_agrupacion"] = "fixture-oficial-corregido-manual"
    data["correccion_fecha_18"] = {
        "activa": True,
        "descripcion": "Vieja fecha 4 pasa a fecha 18. Partidos del 14/06 que quedaron al inicio de vieja fecha 5 también pasan a fecha 18. Vieja fecha 5 sin esos partidos pasa a fecha 4. Viejas 6-18 pasan a 5-17.",
        "pares_extra_fecha_18": [list(x) for x in FECHA_18_PARES],
        "dias_extra_fecha_18": sorted(FECHA_18_EXTRA_DIAS),
    }
    data["actualizado_fixture_corregido"] = datetime.now(timezone.utc).isoformat()
    return data


def main():
    for path in PATHS:
        if not path.exists():
            print(f"⚠️ No existe {path}, se omite")
            continue
        raw = path.read_text(encoding="utf-8").strip()
        if not raw:
            raise SystemExit(f"{path} está vacío")
        data = json.loads(raw)
        data = corregir(data)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"✅ Fixture corregido en {path}: {data['total_fechas']} fechas, {data['total_partidos']} partidos")


if __name__ == "__main__":
    main()
