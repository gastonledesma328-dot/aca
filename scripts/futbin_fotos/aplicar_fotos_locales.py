import json
import os
import re
from pathlib import Path

BASE_FILE = "data/adivina-jugador/base_jugadores_con_fotos.json"
CACHE_FILE = "data/adivina-jugador/futbin_cache.json"
OUT_FILE = "data/adivina-jugador/base_jugadores_con_fotos.json"
PUBLIC_PREFIX = "data/adivina-jugador/imagenes_jugadores"


def slug(text):
    text = str(text or "").lower().strip()
    repl = {
        "á":"a","é":"e","í":"i","ó":"o","ú":"u","à":"a","è":"e","ì":"i","ò":"o","ù":"u",
        "ä":"a","ë":"e","ï":"i","ö":"o","ü":"u","ã":"a","õ":"o","â":"a","ê":"e","î":"i","ô":"o","û":"u",
        "ñ":"n","ç":"c","ø":"o","š":"s","ć":"c","č":"c","ž":"z","ğ":"g","ı":"i","ł":"l","đ":"d","ș":"s","ț":"t",
    }
    for a, b in repl.items():
        text = text.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    base = load_json(BASE_FILE, {})
    cache = load_json(CACHE_FILE, {})

    if not base:
        raise SystemExit(f"No existe {BASE_FILE}")

    for liga in base.get("ligas", []):
        for equipo in liga.get("equipos", []):
            for grupo in ["titulares", "suplentes"]:
                for jugador in equipo.get(grupo, []):
                    item = cache.get(slug(jugador.get("nombre", "")), {})
                    archivo = item.get("archivo")

                    if archivo:
                        jugador["foto_local"] = f"{PUBLIC_PREFIX}/{archivo}"

                    if item.get("imagen_url"):
                        jugador["foto_futbin"] = item["imagen_url"]
                        jugador["foto"] = jugador.get("foto_local") or item["imagen_url"]

                    if item.get("futbin_page_url"):
                        jugador["futbin_page_url"] = item["futbin_page_url"]

                    if item.get("alias_futbin"):
                        jugador["alias_futbin"] = item["alias_futbin"]

    save_json(OUT_FILE, base)
    print(f"OK: actualizado {OUT_FILE} con foto_local")


if __name__ == "__main__":
    main()
