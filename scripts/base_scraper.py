"""
base_scraper.py — Clase base para todos los scrapers de competiciones.

Principio de diseño: cada competición hereda de BaseCompetitionScraper y
solo sobreescribe la lógica que realmente es diferente. Si no hay nada especial,
los métodos por defecto manejan el caso estándar.

Esto elimina duplicación de código y garantiza que todos los scrapers
produzcan el mismo schema de salida.
"""

import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Optional

from ..core import (
    ESPNClient,
    HttpClient,
    write_json,
    safe_get,
    normalize_team,
    now_iso,
)

logger = logging.getLogger(__name__)

# Output root — configurable via env o argumento
DEFAULT_OUTPUT = Path("public/data/competitions")


class BaseCompetitionScraper(ABC):
    """
    Clase base para scrapers de competiciones.

    Atributos obligatorios en subclases:
        slug        — identificador URL-safe único (ej: "liga-profesional")
        league_code — código ESPN (ej: "ARG.1")
        name        — nombre legible (ej: "Liga Profesional Argentina")

    Atributos opcionales con defaults:
        season      — temporada a scrapear (None = actual)
        output_dir  — Path base donde guardar JSONs
    """

    slug: str
    league_code: str
    name: str
    season: Optional[int] = None

    def __init__(
        self,
        http: Optional[HttpClient] = None,
        output_dir: Path = DEFAULT_OUTPUT,
    ):
        if not hasattr(self, "slug") or not self.slug:
            raise NotImplementedError("Subclase debe definir `slug`")
        if not hasattr(self, "league_code") or not self.league_code:
            raise NotImplementedError("Subclase debe definir `league_code`")

        self.http = http or HttpClient()
        self.espn = ESPNClient(self.http)
        self.output_dir = output_dir / self.slug
        self._log = logging.getLogger(f"scraper.{self.slug}")

    # ── API pública ───────────────────────────────────────────────────────

    def run(self, force_refresh: bool = False) -> dict[str, bool]:
        """
        Ejecuta el scraping completo. Devuelve dict con resultado por archivo.
        Nunca lanza excepciones: errores se loguean y se continúa.
        """
        self._log.info("▶ Iniciando scraping: %s", self.name)
        results: dict[str, bool] = {}

        steps = [
            ("meta", self._run_meta),
            ("fixtures", self._run_fixtures),
            ("standings", self._run_standings),
            ("teams", self._run_teams),
            ("bracket", self._run_bracket),
        ]

        for name, fn in steps:
            try:
                ok = fn()
                results[name] = ok
                icon = "✓" if ok else "⚠"
                self._log.info("  %s %s", icon, name)
            except Exception as e:  # noqa: BLE001
                self._log.error("  ✗ %s: %s", name, e)
                results[name] = False

        self._log.info("◀ Finalizado: %s — %s", self.name, results)
        return results

    # ── Rangos de fecha por tipo de competición ───────────────────────────
    #
    # ESPN acepta ?dates=YYYYMMDD-YYYYMMDD en el scoreboard.
    # Cada competición define su rango natural de temporada.
    # Si no se define, se usa el año calendario actual.
    #
    # Formato: lista de tuplas (inicio, fin) en YYYYMMDD
    # Múltiples rangos = temporada que cruza años (ej: ago-jun)

    def _date_ranges(self) -> list[tuple[str, str]]:
        """
        Devuelve los rangos de fecha a consultar para esta competición.
        Sobreescribir en subclases para temporadas que cruzan años.
        Por defecto: año calendario actual completo.
        """
        from datetime import datetime
        year = datetime.now().year
        return [(f"{year}0101", f"{year}1231")]

    # ── Métodos abstractos (opcional sobreescribir la lógica interna) ─────

    def fetch_fixtures(self) -> Optional[list[dict]]:
        """
        Obtiene TODOS los fixtures del rango de temporada definido en _date_ranges().
        Hace múltiples requests si el rango cubre varios períodos.
        Deduplica por event_id antes de devolver.
        """
        ranges = self._date_ranges()
        all_fixtures: list[dict] = []
        seen_ids: set[str] = set()

        for date_from, date_to in ranges:
            dates_param = f"{date_from}-{date_to}"
            raw = self.espn.get_scoreboard(
                self.league_code,
                dates=dates_param,
                limit=500,
            )
            if not raw:
                self._log.debug("Sin datos para rango %s", dates_param)
                continue

            fixtures = self._normalize_fixtures(raw)
            for fix in fixtures:
                fid = fix.get("id", "")
                if fid and fid in seen_ids:
                    continue
                if fid:
                    seen_ids.add(fid)
                all_fixtures.append(fix)

        if not all_fixtures:
            return None

        # Ordenar cronológicamente
        all_fixtures.sort(key=lambda f: f.get("date", "") or "")
        return all_fixtures

    def fetch_standings(self) -> Optional[dict]:
        """Obtiene standings normalizados. Sobreescribir para grupos/zonas."""
        raw = self.espn.get_standings(self.league_code, season=self.season)
        if not raw:
            return None
        return self._normalize_standings(raw)

    def fetch_teams(self) -> Optional[list[dict]]:
        """Obtiene equipos normalizados."""
        raw = self.espn.get_teams(self.league_code)
        if not raw:
            return None
        return self._normalize_teams(raw)

    def fetch_bracket(self) -> Optional[dict]:
        """
        Por defecto no hay bracket. Las subclases de competiciones knockout
        sobreescriben este método para reconstruir las llaves.
        """
        return None

    # ── Normalización estándar ────────────────────────────────────────────

    def _normalize_fixtures(self, raw: dict) -> list[dict]:
        events = safe_get(raw, "events", default=[])
        fixtures = []
        for event in events:
            comp = safe_get(event, "competitions", 0, default={})
            competitors = safe_get(comp, "competitors", default=[])
            home = next((c for c in competitors if c.get("homeAway") == "home"), {})
            away = next((c for c in competitors if c.get("homeAway") == "away"), {})

            status = safe_get(comp, "status", "type", "name", default="")
            state  = safe_get(comp, "status", "type", "state", default="")

            fixtures.append({
                "id": str(safe_get(event, "id", default="")),
                "date": safe_get(event, "date", default=""),
                "name": safe_get(event, "name", default=""),
                "short_name": safe_get(event, "shortName", default=""),
                "status": status,
                "state": state,  # pre / in / post
                "venue": safe_get(comp, "venue", "fullName", default=""),
                "round": safe_get(event, "week", "number", default=None),
                "home": {
                    "team": normalize_team(safe_get(home, "team", default={})),
                    "score": safe_get(home, "score", default=None),
                    "winner": safe_get(home, "winner", default=False),
                },
                "away": {
                    "team": normalize_team(safe_get(away, "team", default={})),
                    "score": safe_get(away, "score", default=None),
                    "winner": safe_get(away, "winner", default=False),
                },
            })
        return fixtures

    def _normalize_standings(self, raw: dict) -> dict:
        """
        ESPN puede devolver standings de múltiples formas:
        - tabla única (standings > entries)
        - grupos (standings[].name + entries)
        - conferencias (tipo MLS)

        Normalizamos siempre a: { groups: [ { name, teams: [] } ] }
        """
        standings_raw = safe_get(raw, "standings", default=[])
        if not standings_raw:
            standings_raw = safe_get(raw, "children", default=[])

        groups = []
        for group in standings_raw:
            group_name = safe_get(group, "name", default="")
            entries = safe_get(group, "standings", "entries", default=[])
            # Fallback para tabla plana
            if not entries:
                entries = safe_get(group, "entries", default=[])

            teams = []
            for entry in entries:
                team_raw = safe_get(entry, "team", default={})
                stats_raw = safe_get(entry, "stats", default=[])
                stats = {s["name"]: s.get("value") for s in stats_raw if "name" in s}
                teams.append({
                    "team": normalize_team(team_raw),
                    "rank": safe_get(entry, "note", "rank", default=None),
                    "gamesPlayed": stats.get("gamesPlayed"),
                    "wins": stats.get("wins"),
                    "ties": stats.get("ties"),
                    "losses": stats.get("losses"),
                    "points": stats.get("points"),
                    "pointDifferential": stats.get("pointDifferential"),
                    "goalsFor": stats.get("pointsFor"),
                    "goalsAgainst": stats.get("pointsAgainst"),
                })
            groups.append({"name": group_name or "General", "teams": teams})

        # Si ESPN devolvió tabla plana (sin grupos), lo envolvemos igual
        if not groups:
            entries = safe_get(raw, "standings", "entries", default=[])
            teams = []
            for entry in entries:
                team_raw = safe_get(entry, "team", default={})
                stats_raw = safe_get(entry, "stats", default=[])
                stats = {s["name"]: s.get("value") for s in stats_raw if "name" in s}
                teams.append({
                    "team": normalize_team(team_raw),
                    "rank": safe_get(entry, "note", "rank", default=None),
                    "gamesPlayed": stats.get("gamesPlayed"),
                    "wins": stats.get("wins"),
                    "ties": stats.get("ties"),
                    "losses": stats.get("losses"),
                    "points": stats.get("points"),
                    "pointDifferential": stats.get("pointDifferential"),
                    "goalsFor": stats.get("pointsFor"),
                    "goalsAgainst": stats.get("pointsAgainst"),
                })
            groups = [{"name": "General", "teams": teams}]

        return {"groups": groups}

    def _normalize_teams(self, raw: dict) -> list[dict]:
        sports = safe_get(raw, "sports", default=[])
        leagues = safe_get(sports, 0, "leagues", default=[])
        teams_raw = safe_get(leagues, 0, "teams", default=[])
        result = []
        for entry in teams_raw:
            team = safe_get(entry, "team", default=entry)
            result.append(normalize_team(team))
        return result

    # ── Runners internos ──────────────────────────────────────────────────

    def _run_meta(self) -> bool:
        from ..core.espn_client import COMPETITIONS
        meta = COMPETITIONS.get(self.slug, {}).copy()
        meta["updated_at"] = now_iso()
        meta["season"] = self.season
        # Exportar constantes específicas del scraper al meta
        if hasattr(self, "PARTIDOS_POR_FECHA"):
            meta["partidos_por_fecha"] = self.PARTIDOS_POR_FECHA
        write_json(self.output_dir / "meta.json", meta)
        return True

    def _run_fixtures(self) -> bool:
        data = self.fetch_fixtures()
        if data is None:
            self._log.warning("fetch_fixtures devolvió None para %s", self.slug)
            return False
        write_json(
            self.output_dir / "fixtures.json",
            {"updated_at": now_iso(), "count": len(data), "fixtures": data},
        )
        return True

    def _run_standings(self) -> bool:
        data = self.fetch_standings()
        if data is None:
            self._log.warning("fetch_standings devolvió None para %s", self.slug)
            return False
        data["updated_at"] = now_iso()
        write_json(self.output_dir / "standings.json", data)
        return True

    def _run_teams(self) -> bool:
        data = self.fetch_teams()
        if data is None:
            self._log.warning("fetch_teams devolvió None para %s", self.slug)
            return False
        write_json(
            self.output_dir / "teams.json",
            {"updated_at": now_iso(), "count": len(data), "teams": data},
        )
        return True

    def _run_bracket(self) -> bool:
        data = self.fetch_bracket()
        if data is None:
            return True  # No es error — competición sin bracket
        data["updated_at"] = now_iso()
        write_json(self.output_dir / "bracket.json", data)
        return True

    # ── Compatibilidad con competiciones.json legacy ──────────────────────

    def to_legacy_entry(self) -> dict:
        """
        Devuelve un entry compatible con el formato de competiciones.json.
        Permite mantener el archivo monolítico durante la migración.
        """
        from ..core.espn_client import COMPETITIONS
        return COMPETITIONS.get(self.slug, {"slug": self.slug, "name": self.name})
