"""copa_england/ — Carabao Cup y FA Cup."""

from ..base_scraper import BaseCompetitionScraper
from ..bracket_mixin import BracketMixin
from .._date_ranges import rango_copa_nacional


class CarabaoCupScraper(BracketMixin, BaseCompetitionScraper):
    slug = "carabao-cup"; league_code = "eng.league_cup"; name = "Carabao Cup"
    def _date_ranges(self): return rango_copa_nacional()
    def fetch_standings(self): return None

class FACupScraper(BracketMixin, BaseCompetitionScraper):
    slug = "fa-cup"; league_code = "eng.fa"; name = "FA Cup"
    def _date_ranges(self): return rango_copa_nacional()
    def fetch_standings(self): return None
