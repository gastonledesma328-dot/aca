import json
import re
import unicodedata
from pathlib import Path

DATA_PATHS = [
    Path("data/equipos_primera_nacional.json"),
    Path("public/data/equipos_primera_nacional.json"),
]

FASE = "Fase de grupos"
REGLAS = {
    "fase": FASE,
    "zonas": ["Zona A", "Zona B"],
    "final": {"desde": 1, "hasta": 1},
    "playoff": {"desde": 2, "hasta": 8},
    "descenso_ultimos_por_zona": 2,
}


def normalizar_texto(texto):
    texto = str(texto or "").lower().strip()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = re.sub(r"[^a-z0-9]+", " ", texto)
    return re.sub(r"\s+", " ", texto).strip()


def normalizar_zona(zona):
    n = normalizar_texto(zona)
    if not n or n == "-":
        return "-"
    if "zona a" in n or "group a" in n or "zone a" in n or n in ["a", "1"]:
        return "Zona A"
    if "zona b" in n or "group b" in n or "zone b" in n or n in ["b", "2"]:
        return "Zona B"
    if re.search(r"\ba\b", n):
        return "Zona A"
    if re.search(r"\bb\b", n):
        return "Zona B"
    return str(zona or "-").strip() or "-"


def int_o_none(valor):
    try:
        if valor is None or valor == "":
            return None
        return int(float(str(valor).strip()))
    except Exception:
        return None


def clasificacion_vacia():
    return {
        "codigo": "sin-datos",
        "nombre": "Sin datos",
        "descripcion": "No hay posición suficiente para calcular clasificación.",
    }


def clasificacion_por_posicion(posicion, total_zona):
    if posicion is None or total_zona <= 0:
        return clasificacion_vacia()

    descenso_cantidad = REGLAS["descenso_ultimos_por_zona"]
    primer_descenso = max(total_zona - descenso_cantidad + 1, 1)

    if posicion >= primer_descenso:
        return {
            "codigo": "descenso",
            "nombre": "Descenso",
            "descripcion": "Últimos 2 de la zona: descenso.",
        }

    if posicion == 1:
        return {
            "codigo": "final",
            "nombre": "Final",
            "descripcion": "1° de la zona: final por el ascenso.",
        }

    if 2 <= posicion <= 8:
        return {
            "codigo": "playoff",
            "nombre": "Playoff",
            "descripcion": "Del 2° al 8° de la zona: playoff / reducido.",
        }

    return {
        "codigo": "permanencia",
        "nombre": "Permanencia",
        "descripcion": "No clasifica a playoff ni queda en zona de descenso.",
    }


def zona_equipo(equipo):
    posibles = [
        equipo.get("zona"),
        (equipo.get("estadisticasGenerales") or {}).get("zona"),
    ]

    principal = (equipo.get("estadisticasPorCompeticion") or {}).get("Primera Nacional 2026") or {}
    generales_principal = principal.get("generales") or {}
    posibles.append(generales_principal.get("zona"))

    for valor in posibles:
        zona = normalizar_zona(valor)
        if zona != "-":
            return zona
    return "-"


def posicion_equipo(equipo):
    posibles = [
        equipo.get("posicionZona"),
        (equipo.get("estadisticasGenerales") or {}).get("posicionZona"),
        (equipo.get("estadisticasGenerales") or {}).get("posicion"),
    ]

    principal = (equipo.get("estadisticasPorCompeticion") or {}).get("Primera Nacional 2026") or {}
    generales_principal = principal.get("generales") or {}
    posibles.extend([
        generales_principal.get("posicionZona"),
        generales_principal.get("posicion"),
    ])

    for valor in posibles:
        posicion = int_o_none(valor)
        if posicion is not None:
            return posicion
    return None


def aplicar_reglas(equipos):
    zonas = {}

    for equipo in equipos:
        zona = zona_equipo(equipo)
        posicion = posicion_equipo(equipo)
        equipo["fase"] = FASE
        equipo["zona"] = zona
        equipo["posicionZona"] = posicion if posicion is not None else "-"
        zonas.setdefault(zona, []).append(equipo)

    for zona, equipos_zona in zonas.items():
        equipos_zona.sort(
            key=lambda e: (
                int_o_none(e.get("posicionZona")) or 999,
                str(e.get("nombre") or ""),
            )
        )

        total_zona = len(equipos_zona)

        for indice, equipo in enumerate(equipos_zona, start=1):
            posicion = int_o_none(equipo.get("posicionZona")) or indice
            clasificacion = clasificacion_por_posicion(posicion, total_zona)

            equipo["fase"] = FASE
            equipo["zona"] = zona
            equipo["posicionZona"] = posicion
            equipo["clasificacion"] = clasificacion
            equipo["reglasPrimeraNacional"] = REGLAS

            generales = equipo.setdefault("estadisticasGenerales", {})
            generales["fase"] = FASE
            generales["zona"] = zona
            generales["posicion"] = str(posicion)
            generales["posicionZona"] = posicion
            generales["clasificacion"] = clasificacion

            principal = (equipo.get("estadisticasPorCompeticion") or {}).get("Primera Nacional 2026")
            if isinstance(principal, dict):
                principal["fase"] = FASE
                principal["formato"] = "zona-a-zona-b"
                principal["reglas"] = REGLAS
                generales_principal = principal.setdefault("generales", {})
                generales_principal["fase"] = FASE
                generales_principal["zona"] = zona
                generales_principal["posicion"] = str(posicion)
                generales_principal["posicionZona"] = posicion
                generales_principal["clasificacion"] = clasificacion

    equipos.sort(
        key=lambda e: (
            str(e.get("zona") or "-"),
            int_o_none(e.get("posicionZona")) or 999,
            str(e.get("nombre") or ""),
        )
    )

    return equipos


def procesar_path(path):
    if not path.exists():
        print(f"⚠️ No existe {path}, se omite")
        return

    data = json.loads(path.read_text(encoding="utf-8"))

    if isinstance(data, list):
        data = aplicar_reglas(data)
    elif isinstance(data, dict) and isinstance(data.get("equipos"), list):
        data["fase"] = FASE
        data["formato"] = "zona-a-zona-b"
        data["reglas"] = REGLAS
        data["equipos"] = aplicar_reglas(data["equipos"])
    else:
        raise SystemExit(f"Formato no reconocido en {path}")

    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ Reglas aplicadas en {path}")


def main():
    for path in DATA_PATHS:
        procesar_path(path)


if __name__ == "__main__":
    main()
