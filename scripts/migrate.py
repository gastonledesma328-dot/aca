#!/usr/bin/env python3
"""
migrate.py — Script de migración del sistema legacy al nuevo.

Cómo funciona:
1. Lee el competiciones.json existente
2. Genera la estructura nueva (public/data/competitions/<slug>/)
3. NO modifica el competiciones.json original
4. Crea un reporte de qué se migró y qué faltó

Ejecutar UNA SOLA VEZ para arrancar la migración.
Después, el workflow de GitHub Actions se encarga de mantener ambos sistemas.

Uso:
    python scripts/migrate.py --dry-run   # Solo reportar, no escribir
    python scripts/migrate.py             # Migrar en serio
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.core import setup_logging, write_json, now_iso, COMPETITIONS
from scripts.competitions import SCRAPERS

LEGACY_PATH = Path("public/data/competiciones.json")
OUTPUT_DIR = Path("public/data/competitions")


def migrate(dry_run: bool = False) -> None:
    setup_logging()

    if not LEGACY_PATH.exists():
        print(f"❌ No se encontró {LEGACY_PATH}")
        print("   Asegúrate de ejecutar desde la raíz del proyecto.")
        sys.exit(1)

    try:
        legacy = json.loads(LEGACY_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"❌ Error parseando {LEGACY_PATH}: {e}")
        sys.exit(1)

    # competiciones.json puede ser lista o dict con key "competiciones"
    if isinstance(legacy, list):
        items = legacy
    elif isinstance(legacy, dict):
        items = legacy.get("competiciones", legacy.get("data", [legacy]))
    else:
        items = []

    print(f"\n📦 Migración de {LEGACY_PATH}")
    print(f"   {len(items)} items encontrados en legacy\n")

    migrated = []
    skipped = []

    for item in items:
        slug = item.get("slug") or item.get("id") or ""
        if not slug:
            print(f"  ⚠ Item sin slug: {item}")
            skipped.append(item)
            continue

        # Obtener metadata completa del registro (combinar legacy + registro)
        meta = COMPETITIONS.get(slug, {}).copy()
        meta.update({k: v for k, v in item.items() if v is not None})
        meta["slug"] = slug
        meta["updated_at"] = now_iso()
        meta["migrated_from_legacy"] = True

        out_dir = OUTPUT_DIR / slug

        if dry_run:
            print(f"  [DRY RUN] Crearía: {out_dir}/meta.json")
        else:
            out_dir.mkdir(parents=True, exist_ok=True)
            write_json(out_dir / "meta.json", meta)

            # Crear archivos vacíos para que el frontend no rompa con 404
            for fname in ["fixtures.json", "standings.json", "teams.json"]:
                fpath = out_dir / fname
                if not fpath.exists():
                    placeholder = {
                        "updated_at": now_iso(),
                        "migrated": True,
                        "note": "Este archivo será generado por el scraper automático.",
                    }
                    write_json(fpath, placeholder)

            print(f"  ✓ {slug} → {out_dir}/")

        migrated.append(slug)

    # Reporte
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Resumen de migración:")
    print(f"  ✓ Migrados: {len(migrated)}")
    print(f"  ⚠ Saltados: {len(skipped)}")

    # Competiciones en el registry que NO estaban en el legacy
    new_slugs = [s for s in SCRAPERS if s not in migrated]
    if new_slugs:
        print(f"\n  📋 Competiciones nuevas (no estaban en legacy): {len(new_slugs)}")
        for s in new_slugs:
            print(f"     - {s}")

    if not dry_run:
        print(f"\n  ✅ Migración completa. Estructura en: {OUTPUT_DIR}/")
        print(f"  📝 El archivo {LEGACY_PATH} NO fue modificado.")
        print(f"\n  Próximos pasos:")
        print(f"  1. Ejecutar el scraper: python scripts/run_scrapers.py --all")
        print(f"  2. Verificar que el frontend sigue funcionando")
        print(f"  3. Actualizar las referencias del frontend gradualmente")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrar del sistema legacy al nuevo")
    parser.add_argument("--dry-run", action="store_true", help="Solo reportar, no escribir archivos")
    args = parser.parse_args()
    migrate(dry_run=args.dry_run)
