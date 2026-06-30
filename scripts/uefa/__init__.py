"""uefa/ — Scrapers UEFA."""

from typing import Optional
from ..base_scraper import BaseCompetitionScraper
from ..bracket_mixin import BracketMixin
from .._date_ranges import rango_temporada_larga, rango_eliminatorias, rango_nations_league
from ...core.utils import safe_get, normalize_team


def _ucl_standings(self) -> Optional[dict]:
    raw = self.espn.get_standings(self.league_code, season=self.season)
    if not raw:
        return None
    children = safe_get(raw, "children", default=[])
    if children:
        groups = []
        for child in children:
            entries = safe_get(child, "standings", "entries", default=[])
            teams = _entries_to_teams(entries)
            groups.append({"name": safe_get(child, "name", default=""), "teams": teams})
        return {"groups": groups, "format": "groups"}
    entries = safe_get(raw, "standings", "entries", default=[]) or safe_get(raw, "entries", default=[])
    return {"groups": [{"name": "Fase de Liga", "teams": _entries_to_teams(entries)}], "format": "league_phase"}


def _entries_to_teams(entries):
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
            "goalsFor": gf, "goalsAgainst": gc, "pointDifferential": gf - gc,
        })
    return teams


class ChampionsLeagueScraper(BracketMixin, BaseCompetitionScraper):
    slug = "champions-league"
    league_code = "uefa.champions"
    name = "Champions League"
    def _date_ranges(self): return rango_temporada_larga()
    fetch_standings = _ucl_standings


class EuropaLeagueScraper(BracketMixin, BaseCompetitionScraper):
    slug = "europa-league"
    league_code = "uefa.europa"
    name = "Europa League"
    def _date_ranges(self): return rango_temporada_larga()
    fetch_standings = _ucl_standings


class ConferenceLeagueScraper(BracketMixin, BaseCompetitionScraper):
    slug = "conference-league"
    league_code = "uefa.europa.conf"
    name = "Conference League"
    def _date_ranges(self): return rango_temporada_larga()
    fetch_standings = _ucl_standings


class EliminatoriaUEFAScraper(BaseCompetitionScraper):
    slug = "eliminatorias-uefa"
    league_code = "fifa.worldq.uefa"
    name = "Eliminatorias UEFA"
    def _date_ranges(self): return rango_eliminatorias()
