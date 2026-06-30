"""conmebol/ — Scrapers CONMEBOL."""

from typing import Optional
from ..base_scraper import BaseCompetitionScraper
from ..bracket_mixin import BracketMixin
from .._date_ranges import rango_copa_conmebol, rango_eliminatorias
from ...core.utils import safe_get, normalize_team


def _standings_con_grupos(self) -> Optional[dict]:
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
                "wins":   int(stats.get("wins") or 0),
                "ties":   int(stats.get("ties") or 0),
                "losses": int(stats.get("losses") or 0),
                "points": int(stats.get("points") or 0),
                "goalsFor": gf,
                "goalsAgainst": gc,
                "pointDifferential": gf - gc,
            })
        groups.append({"name": safe_get(child, "name", default=""), "teams": teams})
    return {"groups": groups}


class LibertadoresScraper(BracketMixin, BaseCompetitionScraper):
    slug = "libertadores"
    league_code = "conmebol.libertadores"
    name = "Copa Libertadores"
    def _date_ranges(self): return rango_copa_conmebol()
    fetch_standings = _standings_con_grupos


class SudamericanaScraper(BracketMixin, BaseCompetitionScraper):
    slug = "sudamericana"
    league_code = "conmebol.sudamericana"
    name = "Copa Sudamericana"
    def _date_ranges(self): return rango_copa_conmebol()
    fetch_standings = _standings_con_grupos


class EliminatoriasScraper(BaseCompetitionScraper):
    slug = "eliminatorias-conmebol"
    league_code = "fifa.worldq.conmebol"
    name = "Eliminatorias CONMEBOL"
    def _date_ranges(self): return rango_eliminatorias()
