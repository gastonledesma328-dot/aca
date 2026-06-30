"""copa_italy/ — Coppa Italia y Supercopa."""

from ..base_scraper import BaseCompetitionScraper
from ..bracket_mixin import BracketMixin
from .._date_ranges import rango_copa_nacional


class CoppaItaliaScraper(BracketMixin, BaseCompetitionScraper):
    slug = "coppa-italia"; league_code = "ita.coppa_italia"; name = "Coppa Italia"
    def _date_ranges(self): return rango_copa_nacional()
    def fetch_standings(self): return None

class SupercopaItaliaScraper(BracketMixin, BaseCompetitionScraper):
    slug = "supercopa-italia"; league_code = "ita.super_cup"; name = "Supercopa de Italia"
    def _date_ranges(self): return rango_copa_nacional()
    def fetch_standings(self): return None
