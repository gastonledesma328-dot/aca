import json
from pathlib import Path

PATHS = [
    Path("data/primera_nacional_fechas.json"),
    Path("public/data/primera_nacional_fechas.json"),
]

for path in PATHS:
    if not path.exists():
        raise SystemExit(f"No existe {path}")
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        raise SystemExit(f"{path} está vacío")
    data = json.loads(raw)
    fechas = data.get("fechas") or []
    total_partidos = sum(len(f.get("partidos", [])) for f in fechas)
    if len(fechas) < 30:
        raise SystemExit(f"{path} tiene pocas fechas: {len(fechas)}")
    if total_partidos < 500:
        raise SystemExit(f"{path} tiene pocos partidos: {total_partidos}")
    print(f"✅ {path}: {len(fechas)} fechas, {total_partidos} partidos")
