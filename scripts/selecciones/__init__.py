"""selecciones/ — Competiciones de selecciones nacionales."""

from ..base_scraper import BaseCompetitionScraper
from ..bracket_mixin import BracketMixin
from .._date_ranges import rango_mundial, rango_eliminatorias, rango_nations_league


class CopaAmericaScraper(BracketMixin, BaseCompetitionScraper):
    slug = "copa-america"; league_code = "conmebol.america"; name = "Copa América"
    def _date_ranges(self): return rango_mundial()

class EurocopaScraper(BracketMixin, BaseCompetitionScraper):
    slug = "eurocopa"; league_code = "uefa.euro"; name = "Eurocopa"
    def _date_ranges(self): return rango_mundial()

class UEFANationsLeagueScraper(BaseCompetitionScraper):
    slug = "uefa-nations-league"; league_code = "uefa.nations"; name = "UEFA Nations League"
    def _date_ranges(self): return rango_nations_league()

class EliminatoriasConcacafScraper(BaseCompetitionScraper):
    slug = "eliminatorias-concacaf"; league_code = "fifa.worldq.concacaf"; name = "Eliminatorias CONCACAF"
    def _date_ranges(self): return rango_eliminatorias()
