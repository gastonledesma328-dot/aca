import json
from pathlib import Path
from datetime import datetime, timezone

BASE_PATH = Path("data/primera_nacional_fechas.json")
FIXTURE_PATHS = [
    Path("data/primera_nacional_fixture_oficial.json"),
    Path("public/data/primera_nacional_fixture_oficial.json"),
]

ORDEN_OFICIAL = [1, 2, 3, 18] + list(range(4, 18)) + list(range(19, 37))


def limpiar_partido(partido, numero_fecha, numero_original):
    return {
        "numero_fecha": numero_fecha,
        "numero_fecha_origen": numero_original,
        "local": partido.get("local", ""),
        "visitante": partido.get("visitante", ""),
        "fecha_original": partido.get("dia", ""),
        "hora_original": partido.get("hora", ""),
    }


def crear_fixture(data):
    fechas_base = data.get("fechas") or []
    por_numero = {}
    for fecha in fechas_base:
        try:
            por_numero[int(fecha.get("numero"))] = fecha
        except Exception:
            continue

    fechas = []
    for nuevo_numero, numero_original in enumerate(ORDEN_OFICIAL, start=1):
        fecha_origen = por_numero.get(numero_original)
        if not fecha_origen:
            continue

        partidos = [
            limpiar_partido(partido, nuevo_numero, numero_original)
            for partido in fecha_origen.get("partidos", [])
        ]

        fechas.append({
            "numero": nuevo_numero,
            "nombre": f"Fecha {nuevo_numero}",
            "numero_origen_espn": numero_original,
            "partidos": partidos,
        })

    return {
        "competicion": "Primera Nacional",
        "season": data.get("season", "2026"),
        "tipo": "fixture_oficial_fijo",
        "descripcion": "Define a qué fecha oficial pertenece cada partido. ESPN solo actualiza horario, marcador, estado y logos.",
        "orden_oficial_usado_para_bootstrap": ORDEN_OFICIAL,
        "creado": datetime.now(timezone.utc).isoformat(),
        "fechas": fechas,
    }


def main():
    existing = [p for p in FIXTURE_PATHS if p.exists()]
    if existing:
        print("✅ Fixture oficial ya existe. No se sobrescribe.")
        for p in existing:
            print(f"   - {p}")
        return

    if not BASE_PATH.exists():
        raise SystemExit(f"No existe {BASE_PATH}. Primero generá primera_nacional_fechas.json")

    data = json.loads(BASE_PATH.read_text(encoding="utf-8"))
    fixture = crear_fixture(data)

    for path in FIXTURE_PATHS:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(fixture, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"✅ Fixture oficial creado en {path}")


if __name__ == "__main__":
    main()
