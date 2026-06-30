#!/usr/bin/env python3
"""
run_scrapers.py — Entry point principal del sistema de scraping.

Uso:
    # Grupo completo
    python run_scrapers.py --group argentina

    # Competición específica
    python run_scrapers.py --slug liga-profesional

    # Todo
    python run_scrapers.py --all

    # Actualizar competiciones.json legacy (compatibilidad)
    python run_scrapers.py --all --update-legacy

    # Cache vacío (forzar requests frescos)
    python run_scrapers.py --group conmebol --force-refresh
"""

import argparse
import json
import logging
import sys
from pathlib import Path

# Agregar la raíz del proyecto al path para que los imports relativos funcionen
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.core import setup_logging, write_json, now_iso, COMPETITIONS
from scripts.competitions import SCRAPERS, GROUPS
from scripts.core.http_client import HttpClient

logger = logging.getLogger(__name__)

OUTPUT_DIR = Path("public/data/competitions")
LEGACY_PATH = Path("public/data/competiciones.json")


def run_scraper(slug: str, http: HttpClient, force_refresh: bool = False) -> bool:
    scraper_class = SCRAPERS.get(slug)
    if not scraper_class:
        logger.error("No existe scraper para: %s", slug)
        return False

    scraper = scraper_class(http=http, output_dir=OUTPUT_DIR)
    results = scraper.run()
    return all(v for v in results.values() if v is not False)


def _int(value):
    try:
        return int(value) if value is not None else 0
    except (TypeError, ValueError):
        return 0


def _normalize_tabla(standings: dict) -> list:
    if not standings:
        return []
    tabla = []
    for group in standings.get("groups", []):
        group_name = group.get("name", "General")
        grupo_label = group_name if group_name != "General" else ""

        # Ordenar equipos del grupo por puntos desc, luego diferencia de goles desc
        teams_sorted = sorted(
            group.get("teams", []),
            key=lambda e: (
                -_int(e.get("points")),
                -(_int(e.get("goalsFor")) - _int(e.get("goalsAgainst"))),
                -_int(e.get("goalsFor")),
            ),
        )

        for i, entry in enumerate(teams_sorted):
            team = entry.get("team", {})
            gf = _int(entry.get("goalsFor"))
            gc = _int(entry.get("goalsAgainst"))
            tabla.append({
                "equipo": {
                    "nombre": team.get("name", ""),
                    "nombre_corto": team.get("short_name", team.get("abbreviation", "")),
                    "logo": team.get("logo", ""),
                    "id": team.get("id", ""),
                },
                "stats": {
                    "posicion": i + 1,  # posición real dentro del grupo
                    "pj": _int(entry.get("gamesPlayed")),
                    "g":  _int(entry.get("wins")),
                    "e":  _int(entry.get("ties")),
                    "p":  _int(entry.get("losses")),
                    "gf": gf,
                    "gc": gc,
                    "dg": gf - gc,
                    "pts": _int(entry.get("points")),
                },
                "grupo": grupo_label,
            })
    return tabla


def _normalize_match(fix: dict) -> dict:
    home = fix.get("home", {})
    away = fix.get("away", {})
    state = fix.get("state", "")
    estado_map = {"pre": "Programado", "in": "En curso", "post": "Finalizado"}

    def team_entry(side):
        t = side.get("team", {})
        score = side.get("score")
        return {
            "equipo": {
                "nombre": t.get("name", ""),
                "nombre_corto": t.get("short_name", t.get("abbreviation", "")),
                "logo": t.get("logo", ""),
                "id": t.get("id", ""),
            },
            "marcador": str(score) if score is not None and state == "post" else "",
            "ganador": side.get("winner", False),
        }

    return {
        "local":     team_entry(home),
        "visitante": team_entry(away),
        "fecha":     fix.get("date", ""),
        "estado":    estado_map.get(state, fix.get("status", "Programado")),
        "jornada":   fix.get("round"),
        "estadio":   fix.get("venue", ""),
    }


def _normalize_partidos(fixtures: dict) -> dict:
    if not fixtures:
        return {"proximos": [], "ultimos": [], "todos": []}
    proximos, ultimos, todos = [], [], []
    for fix in fixtures.get("fixtures", []):
        match = _normalize_match(fix)
        todos.append(match)
        if fix.get("state") == "post":
            ultimos.append(match)
        else:
            proximos.append(match)
    proximos.sort(key=lambda x: x.get("fecha") or "")
    ultimos.sort(key=lambda x: x.get("fecha") or "", reverse=True)
    todos.sort(key=lambda x: x.get("fecha") or "")
    return {
        "proximos": proximos[:10],
        "ultimos":  ultimos[:10],
        "todos":    todos,          # todos los partidos — usado por competicion-fechas-fases.js
    }


def _normalize_equipos(teams: dict) -> list:
    if not teams:
        return []
    result = []
    for t in teams.get("teams", []):
        result.append({
            "nombre": t.get("name", ""),
            "nombre_corto": t.get("short_name", t.get("abbreviation", "")),
            "logo": t.get("logo", ""),
            "id": t.get("id", ""),
            "color": t.get("color", ""),
        })
    return sorted(result, key=lambda t: t.get("nombre", ""))


def _assemble_one(slug: str) -> dict:
    import json as _json
    base = OUTPUT_DIR / slug

    def rj(path):
        if not path.exists():
            return None
        try:
            return _json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return None

    meta      = rj(base / "meta.json") or {}
    standings = rj(base / "standings.json")
    fixtures  = rj(base / "fixtures.json")
    teams     = rj(base / "teams.json")

    tabla    = _normalize_tabla(standings)
    partidos = _normalize_partidos(fixtures)
    equipos  = _normalize_equipos(teams)

    return {
        "id":           slug,
        "slug":         slug,
        "nombre":       meta.get("name", slug),
        "nombre_largo": meta.get("name", slug),
        "nombre_corto": meta.get("name", slug),
        "pais":         meta.get("country", meta.get("confederation", "")),
        "grupo":        meta.get("group", ""),
        "season":       meta.get("season", "actual"),
        "fuente":       "ESPN API",
        "logo":         meta.get("logo", ""),
        "type":         meta.get("type", "league"),
        "league_code":  meta.get("league_code", ""),
        "actualizado":  meta.get("updated_at", now_iso()),
        "updated_at":   meta.get("updated_at", now_iso()),
        "tabla":        tabla,
        "partidos":     partidos,
        "equipos":      equipos,
        # Cuántos partidos hay por jornada — usado por el JS para agrupar correctamente
        # LPF = 15, Primera Nacional = 18, resto = None (auto-detecta por jornada)
        "partidos_por_fecha": meta.get("partidos_por_fecha", None),
        "resumen": {
            "equipos":    len(equipos),
            "posiciones": len(tabla),
            "proximos":   len(partidos["proximos"]),
            "ultimos":    len(partidos["ultimos"]),
            "todos":      len(partidos["todos"]),
        },
    }


def update_legacy(http: HttpClient) -> None:
    """
    Ensambla competiciones.json en el formato exacto que consume el frontend (competicion.js).
    Lee fixtures.json + standings.json + teams.json de cada competición y los convierte
    a la estructura que espera: tabla[], partidos.proximos[], partidos.ultimos[], equipos[].
    """
    slugs = sorted([d.name for d in OUTPUT_DIR.iterdir() if d.is_dir()]) if OUTPUT_DIR.exists() else []

    competiciones = []
    for slug in slugs:
        try:
            comp = _assemble_one(slug)
            competiciones.append(comp)
            logger.info(
                "  ✓ %-30s tabla=%d  próximos=%d  últimos=%d  equipos=%d",
                slug,
                len(comp["tabla"]),
                len(comp["partidos"]["proximos"]),
                len(comp["partidos"]["ultimos"]),
                len(comp["equipos"]),
            )
        except Exception as e:
            logger.warning("  ✗ %s: %s", slug, e)

    write_json(
        LEGACY_PATH,
        {"updated_at": now_iso(), "count": len(competiciones), "competiciones": competiciones},
    )
    logger.info("✓ Actualizado %s con %d competiciones", LEGACY_PATH, len(competiciones))


def main() -> None:
    parser = argparse.ArgumentParser(description="ESPN Football Scraper")
    parser.add_argument("--group", help="Grupo a scrapear: argentina, conmebol, uefa, fifa, europa, america")
    parser.add_argument("--slug", help="Competición específica por slug")
    parser.add_argument("--all", action="store_true", help="Scrapear todas las competiciones")
    parser.add_argument("--update-legacy", action="store_true", help="Actualizar competiciones.json al finalizar")
    parser.add_argument("--force-refresh", action="store_true", help="Ignorar cache y forzar requests frescos")
    parser.add_argument("--log-level", default="INFO", help="Nivel de logging")
    parser.add_argument("--log-file", default=None, help="Archivo de log opcional")
    args = parser.parse_args()

    setup_logging(level=args.log_level, log_file=args.log_file)

    http = HttpClient(
        cache_ttl=0 if args.force_refresh else 3600,
        cache_dir=".cache/espn",
    )

    slugs_to_run: list[str] = []

    if args.all:
        slugs_to_run = list(SCRAPERS.keys())
    elif args.group:
        slugs_to_run = GROUPS.get(args.group, [])
        if not slugs_to_run:
            logger.error("Grupo desconocido: %s. Disponibles: %s", args.group, list(GROUPS.keys()))
            sys.exit(1)
    elif args.slug:
        slugs_to_run = [args.slug]
    else:
        parser.print_help()
        sys.exit(0)

    logger.info("Procesando %d competiciones: %s", len(slugs_to_run), slugs_to_run)

    successes = 0
    failures = []

    for slug in slugs_to_run:
        ok = run_scraper(slug, http, force_refresh=args.force_refresh)
        if ok:
            successes += 1
        else:
            failures.append(slug)

    if args.update_legacy or args.all:
        update_legacy(http)

    http.close()

    logger.info(
        "Resumen: %d/%d exitosos. Fallos: %s",
        successes,
        len(slugs_to_run),
        failures or "ninguno",
    )

    # Exit code 1 si hay fallos (permite que GitHub Actions lo detecte)
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
