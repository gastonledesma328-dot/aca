import json
from pathlib import Path
from datetime import datetime, timezone

PATHS = [
    Path("data/primera_nacional_fechas.json"),
    Path("public/data/primera_nacional_fechas.json"),
]

# Corrección indicada para Primera Nacional:
# Fechas 1, 2 y 3 quedan igual.
# La fecha que hoy está como 18 pasa a ser Fecha 4.
# La que hoy está como 4 pasa a ser Fecha 5, la 5 pasa a ser 6, y así hasta la 17.
# Desde la 19 en adelante queda igual.
ORDEN_OFICIAL = [1, 2, 3, 18] + list(range(4, 18)) + list(range(19, 37))


def reordenar(data):
    fechas = data.get("fechas") or []
    por_numero = {}

    for fecha in fechas:
        numero = fecha.get("numero")
        if numero is None:
            continue
        try:
            numero = int(numero)
        except Exception:
            continue
        por_numero[numero] = fecha

    nuevas = []

    for nuevo_numero, numero_original in enumerate(ORDEN_OFICIAL, start=1):
        fecha = por_numero.get(numero_original)
        if not fecha:
            continue

        fecha["numero_original_antes_reorden"] = numero_original
        fecha["numero"] = nuevo_numero
        fecha["nombre"] = f"Fecha {nuevo_numero}"
        fecha["metodo_agrupacion"] = "bloques-18-reordenados-manual"
        fecha["correccion_manual"] = True

        for partido in fecha.get("partidos", []):
            partido["numero_fecha_original_antes_reorden"] = numero_original
            partido["numero_fecha"] = nuevo_numero
            partido["fecha_torneo"] = nuevo_numero

        nuevas.append(fecha)

    data["fechas"] = nuevas
    data["partidos"] = [p for f in nuevas for p in f.get("partidos", [])]
    data["total_fechas"] = len(nuevas)
    data["total_partidos"] = len(data["partidos"])
    data["metodo_agrupacion"] = "bloques-18-reordenados-manual"
    data["orden_oficial_fechas"] = ORDEN_OFICIAL
    data["correccion_manual_fechas"] = {
        "activa": True,
        "descripcion": "1-3 igual, bloque 18 pasa a fecha 4, bloques 4-17 pasan a fechas 5-18, 19-36 igual.",
    }
    data["actualizado_reorden"] = datetime.now(timezone.utc).isoformat()
    return data


def main():
    for path in PATHS:
        if not path.exists():
            print(f"⚠️ No existe {path}, se omite")
            continue

        data = json.loads(path.read_text(encoding="utf-8"))
        data = reordenar(data)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"✅ Fechas reordenadas en {path}")


if __name__ == "__main__":
    main()
