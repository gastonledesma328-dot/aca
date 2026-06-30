"""europa/ — Ligas europeas. Temporada: julio año anterior – junio actual."""

from ..base_scraper import BaseCompetitionScraper
from .._date_ranges import rango_temporada_europea


class PremierLeagueScraper(BaseCompetitionScraper):
    slug = "premier-league"; league_code = "eng.1"; name = "Premier League"
    def _date_ranges(self): return rango_temporada_europea()

class LaLigaScraper(BaseCompetitionScraper):
    slug = "laliga"; league_code = "esp.1"; name = "LaLiga"
    def _date_ranges(self): return rango_temporada_europea()

class SerieAScraper(BaseCompetitionScraper):
    slug = "serie-a"; league_code = "ita.1"; name = "Serie A"
    def _date_ranges(self): return rango_temporada_europea()

class BundesligaScraper(BaseCompetitionScraper):
    slug = "bundesliga"; league_code = "ger.1"; name = "Bundesliga"
    def _date_ranges(self): return rango_temporada_europea()

class Ligue1Scraper(BaseCompetitionScraper):
    slug = "ligue-1"; league_code = "fra.1"; name = "Ligue 1"
    def _date_ranges(self): return rango_temporada_europea()

class PrimeiraLigaScraper(BaseCompetitionScraper):
    slug = "primeira-liga"; league_code = "por.1"; name = "Primeira Liga"
    def _date_ranges(self): return rango_temporada_europea()
