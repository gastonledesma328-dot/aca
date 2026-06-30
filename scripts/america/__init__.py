"""america/ — Ligas de América."""

from typing import Optional
from ..base_scraper import BaseCompetitionScraper
from .._date_ranges import rango_anio_completo, rango_temporada_europea
from ...core.utils import safe_get, normalize_team


class BrasileiraoScraper(BaseCompetitionScraper):
    slug = "brasileirao"; league_code = "bra.1"; name = "Brasileirão Série A"
    def _date_ranges(self): return rango_anio_completo()

class LigaUruguayScraper(BaseCompetitionScraper):
    slug = "liga-uruguay"; league_code = "uru.1"; name = "Primera División Uruguay"
    def _date_ranges(self): return rango_anio_completo()

class LigaParaguayScraper(BaseCompetitionScraper):
    slug = "liga-paraguay"; league_code = "par.1"; name = "División Profesional Paraguay"
    def _date_ranges(self): return rango_anio_completo()

class LigaColombiaScraper(BaseCompetitionScraper):
    slug = "liga-colombia"; league_code = "col.1"; name = "Liga BetPlay Colombia"
    def _date_ranges(self): return rango_anio_completo()

class LigaChileScraper(BaseCompetitionScraper):
    slug = "liga-chile"; league_code = "chi.1"; name = "Primera División Chile"
    def _date_ranges(self): return rango_anio_completo()

class LigaMXScraper(BaseCompetitionScraper):
    slug = "liga-mx"; league_code = "mex.1"; name = "Liga MX"
    def _date_ranges(self): return rango_anio_completo()

class MLSScraper(BaseCompetitionScraper):
    slug = "mls"; league_code = "usa.1"; name = "Major League Soccer"
    def _date_ranges(self): return rango_anio_completo()

    def fetch_standings(self) -> Optional[dict]:
        raw = self.espn.get_standings(self.league_code, season=self.season)
        if not raw:
            return None
        children = safe_get(raw, "children", default=[])
        if not children:
            return self._normalize_standings(raw)
        groups = []
        for child in children:
            entries = safe_get(child, "standings", "entries", default=[])
            teams = []
            for entry in entries:
                stats_raw = safe_get(entry, "stats", default=[])
                stats = {s["name"]: s.get("value") for s in stats_raw if "name" in s}
                gf = int(stats.get("pointsFor") or 0)
                gc = int(stats.get("pointsAgainst") or 0)
                teams.append({
                    "team": normalize_team(safe_get(entry, "team", default={})),
                    "rank": safe_get(entry, "note", "rank", default=None),
                    "gamesPlayed": int(stats.get("gamesPlayed") or 0),
                    "wins": int(stats.get("wins") or 0), "ties": int(stats.get("ties") or 0),
                    "losses": int(stats.get("losses") or 0), "points": int(stats.get("points") or 0),
                    "goalsFor": gf, "goalsAgainst": gc, "pointDifferential": gf - gc,
                })
            groups.append({"name": safe_get(child, "name", default="Conferencia"), "teams": teams})
        return {"groups": groups}
