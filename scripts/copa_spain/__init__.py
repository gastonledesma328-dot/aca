"""copa_spain/ — Copa del Rey y Supercopa."""

from ..base_scraper import BaseCompetitionScraper
from ..bracket_mixin import BracketMixin
from .._date_ranges import rango_copa_nacional


class CopaDelReyScraper(BracketMixin, BaseCompetitionScraper):
    slug = "copa-del-rey"; league_code = "esp.copa_del_rey"; name = "Copa del Rey"
    def _date_ranges(self): return rango_copa_nacional()
    def fetch_standings(self): return None

class SupercopaEspanaScraper(BracketMixin, BaseCompetitionScraper):
    slug = "supercopa-espana"; league_code = "esp.super_cup"; name = "Supercopa de España"
    def _date_ranges(self): return rango_copa_nacional()
    def fetch_standings(self): return None
