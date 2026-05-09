import json
import os
from collections import Counter, defaultdict

INPUT_FILE = "data/jugadores_america.json"
OUTPUT_FILE = "data/reporte_jugadores_america.txt"


def cargar_json():
    if not os.path.exists(INPUT_FILE):
        raise FileNotFoundError(f"No existe {INPUT_FILE}")

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def obtener_jugadores(data):
    if isinstance(data, list):
        return data

    return data.get("jugadores") or []


def valor(player, key):
    value = player.get(key)

    if value is None or value == "":
        return "Sin datos"

    return str(value)


def main():
    data = cargar_json()
    jugadores = obtener_jugadores(data)

    total = len(jugadores)

    por_pais = Counter()
    por_liga = Counter()
    por_club = Counter()
    por_categoria = Counter()
    por_posicion = Counter()
    sin_altura = 0
    sin_edad = 0
    sin_club = 0
    sin_posicion = 0

    clubes_detalle = defaultdict(lambda: {
        "total": 0,
        "arqueros": 0,
        "defensores": 0,
        "mediocampistas": 0,
        "delanteros": 0,
        "posiciones": Counter(),
    })

    sospechosos = []

    for player in jugadores:
        pais = valor(player, "pais_club")
        liga = valor(player, "liga")
        club = valor(player, "club")
        categoria = valor(player, "categoria")
        posicion = valor(player, "posicion")

        por_pais[pais] += 1
        por_liga[liga] += 1
        por_club[club] += 1
        por_categoria[categoria] += 1
        por_posicion[posicion] += 1

        if not player.get("altura"):
            sin_altura += 1

        if not player.get("edad"):
            sin_edad += 1

        if not player.get("club"):
            sin_club += 1

        if not player.get("posicion"):
            sin_posicion += 1

        clubes_detalle[club]["total"] += 1

        if categoria in clubes_detalle[club]:
            clubes_detalle[club][categoria] += 1

        clubes_detalle[club]["posiciones"][posicion] += 1

    for club, info in clubes_detalle.items():
        if info["total"] < 8:
            sospechosos.append(
                f"{club}: solo {info['total']} jugadores cargados"
            )

        if info["arqueros"] == 0:
            sospechosos.append(
                f"{club}: no tiene arqueros detectados"
            )

        if info["defensores"] < 3:
            sospechosos.append(
                f"{club}: pocos defensores detectados ({info['defensores']})"
            )

        if info["mediocampistas"] < 3:
            sospechosos.append(
                f"{club}: pocos mediocampistas detectados ({info['mediocampistas']})"
            )

        if info["delanteros"] < 2:
            sospechosos.append(
                f"{club}: pocos delanteros detectados ({info['delanteros']})"
            )

    lines = []

    lines.append("REPORTE JUGADORES AMÉRICA")
    lines.append("=" * 40)
    lines.append("")
    lines.append(f"Total jugadores: {total}")
    lines.append(f"Actualizado: {data.get('actualizado', '-') if isinstance(data, dict) else '-'}")
    lines.append("")

    lines.append("POR PAÍS")
    lines.append("-" * 40)
    for name, count in por_pais.most_common():
        lines.append(f"{name}: {count}")
    lines.append("")

    lines.append("POR LIGA")
    lines.append("-" * 40)
    for name, count in por_liga.most_common():
        lines.append(f"{name}: {count}")
    lines.append("")

    lines.append("POR CATEGORÍA")
    lines.append("-" * 40)
    for name, count in por_categoria.most_common():
        lines.append(f"{name}: {count}")
    lines.append("")

    lines.append("POR POSICIÓN")
    lines.append("-" * 40)
    for name, count in por_posicion.most_common():
        lines.append(f"{name}: {count}")
    lines.append("")

    lines.append("DATOS FALTANTES")
    lines.append("-" * 40)
    lines.append(f"Sin edad: {sin_edad}")
    lines.append(f"Sin altura: {sin_altura}")
    lines.append(f"Sin club: {sin_club}")
    lines.append(f"Sin posición: {sin_posicion}")
    lines.append("")

    lines.append("TOP 30 CLUBES CON MÁS JUGADORES")
    lines.append("-" * 40)
    for name, count in por_club.most_common(30):
        lines.append(f"{name}: {count}")
    lines.append("")

    lines.append("CLUBES SOSPECHOSOS")
    lines.append("-" * 40)

    if sospechosos:
        for item in sospechosos[:300]:
            lines.append(item)
    else:
        lines.append("No se detectaron problemas grandes por club.")

    lines.append("")

    os.makedirs("data", exist_ok=True)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print("\n".join(lines[:80]))
    print("")
    print(f"✅ Reporte generado en {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
