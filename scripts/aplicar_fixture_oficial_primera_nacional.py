import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

FIXTURE_PATH = Path("data/primera_nacional_fixture_oficial.json")
DATA_PATHS = [
    Path("data/primera_nacional_fechas.json"),
    Path("public/data/primera_nacional_fechas.json"),
]


def cargar_json_seguro(path, default):
    if not path.exists():
        return default
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        print(f"⚠️ {path} está vacío. Se reconstruye desde fixture oficial.")
        return default
    try:
        return json.loads(raw)
    except Exception as e:
        print(f"⚠️ {path} tiene JSON inválido: {e}. Se reconstruye desde fixture oficial.")
        return default


def normalizar(texto):
    texto = str(texto or "").lower().strip()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = re.sub(r"\([^)]*\)", " ", texto)
    texto = re.sub(r"\bclub\b|\batletico\b|\bca\b|\by esgrima\b", " ", texto)
    texto = re.sub(r"[^a-z0-9]+", " ", texto)
    texto = re.sub(r"\s+", " ", texto).strip()
    alias = {
        "godoy cruz antonio tomba": "godoy cruz",
        "estudiantes buenos aires": "estudiantes ba",
        "estudiantes de buenos aires": "estudiantes ba",
        "racing cordoba": "racing de cordoba",
        "mitre santiago del estero": "mitre sde",
        "guemes santiago del estero": "guemes sde",
        "gimnasia jujuy": "gimnasia de jujuy",
        "atletico rafaela": "rafaela",
        "deportivo madryn": "madryn",
        "deportivo maipu": "maipu",
        "deportivo moron": "moron",
    }
    return alias.get(texto, texto)


def similitud(a, b):
    a = normalizar(a)
    b = normalizar(b)
    if not a or not b:
        return 0
    if a == b:
        return 100
    if a in b or b in a:
        return 85
    sa = set(a.split())
    sb = set(b.split())
    if not sa or not sb:
        return 0
    return int(100 * len(sa & sb) / max(len(sa), len(sb)))


def buscar_partido(fijo, candidatos, usados):
    mejor = None
    mejor_score = 0
    for idx, partido in enumerate(candidatos):
        if idx in usados:
            continue
        directo = similitud(fijo.get("local"), partido.get("local")) + similitud(fijo.get("visitante"), partido.get("visitante"))
        inverso = similitud(fijo.get("local"), partido.get("visitante")) + similitud(fijo.get("visitante"), partido.get("local"))
        score = max(directo, inverso)
        if score > mejor_score:
            mejor = idx
            mejor_score = score
    if mejor is not None and mejor_score >= 130:
        usados.add(mejor)
        return dict(candidatos[mejor])
    return None


def placeholder(fijo):
    return {
        "id": "",
        "dia": fijo.get("fecha_original", ""),
        "fecha_iso": "",
        "hora": fijo.get("hora_original", "Ver horario"),
        "local": fijo.get("local", "Local"),
        "visitante": fijo.get("visitante", "Visitante"),
        "local_id": "",
        "visitante_id": "",
        "local_logo": "",
        "visitante_logo": "",
        "marcador_local": None,
        "marcador_visitante": None,
        "estado": "A confirmar",
        "estado_tipo": "pre",
        "completado": False,
        "url": "",
    }


def aplicar_fixture(data, fixture):
    candidatos = data.get("partidos") or [p for f in data.get("fechas", []) for p in f.get("partidos", [])]
    usados = set()
    fechas = []

    for fecha_fija in fixture.get("fechas", []):
        numero = int(fecha_fija.get("numero"))
        partidos = []
        for fijo in fecha_fija.get("partidos", []):
            partido = buscar_partido(fijo, candidatos, usados) or placeholder(fijo)
            partido["numero_fecha"] = numero
            partido["fecha_torneo"] = numero
            partido["fecha_original"] = fijo.get("fecha_original", "")
            partido["hora_original"] = fijo.get("hora_original", "")
            partido["local_fixture"] = fijo.get("local", "")
            partido["visitante_fixture"] = fijo.get("visitante", "")
            partido["fuente_fecha"] = "fixture_oficial_fijo"
            partidos.append(partido)

        fechas.append({
            "numero": numero,
            "nombre": f"Fecha {numero}",
            "partidos": partidos,
            "fecha_desde": next((p.get("dia") for p in partidos if p.get("dia")), ""),
            "fecha_hasta": next((p.get("dia") for p in reversed(partidos) if p.get("dia")), ""),
            "metodo_agrupacion": "fixture-oficial-fijo-datos-espn",
        })

    partidos_usados = [p for f in fechas for p in f.get("partidos", [])]
    ids_usados = {p.get("id") for p in partidos_usados if p.get("id")}
    partidos_extra = [p for p in candidatos if p.get("id") and p.get("id") not in ids_usados]

    data["competicion"] = "Primera Nacional"
    data["season"] = data.get("season", fixture.get("season", "2026"))
    data["formato"] = "Fase de grupos"
    data["fechas"] = fechas
    data["partidos"] = partidos_usados
    data["partidos_extra"] = partidos_extra
    data["total_fechas"] = len(fechas)
    data["total_partidos"] = len(partidos_usados)
    data["total_partidos_extra"] = len(partidos_extra)
    data["metodo_agrupacion"] = "fixture-oficial-fijo-datos-espn"
    data["descripcion"] = "La fecha oficial sale de primera_nacional_fixture_oficial.json. ESPN solo actualiza dia, hora, marcador, estado, logos y link."
    data["actualizado_fixture_oficial"] = datetime.now(timezone.utc).isoformat()
    return data


def main():
    if not FIXTURE_PATH.exists():
        raise SystemExit("No existe data/primera_nacional_fixture_oficial.json")

    fixture = cargar_json_seguro(FIXTURE_PATH, {"fechas": []})
    if not fixture.get("fechas"):
        raise SystemExit("El fixture oficial fijo no tiene fechas")

    for path in DATA_PATHS:
        data = cargar_json_seguro(path, {})
        data = aplicar_fixture(data, fixture)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"✅ Fixture oficial aplicado en {path}: {data['total_fechas']} fechas, {data['total_partidos']} partidos")


if __name__ == "__main__":
    main()
