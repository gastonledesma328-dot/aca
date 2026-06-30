"""
argentina/ — Scrapers de competiciones argentinas.
"""

from ..base_scraper import BaseCompetitionScraper
from ..bracket_mixin import BracketMixin


class LigaProfesionalScraper(BaseCompetitionScraper):
    """Temporada: febrero–diciembre. Apertura + Clausura."""
    slug = "liga-profesional"
    league_code = "arg.1"
    name = "Liga Profesional Argentina"

    def _date_ranges(self):
        from datetime import datetime
        y = datetime.now().year
        return [(f"{y}0201", f"{y}1231")]


class PrimeraNacionalScraper(BaseCompetitionScraper):
    """36 equipos, 18 partidos por fecha. Temporada: febrero–diciembre."""
    slug = "primera-nacional"
    league_code = "arg.2"
    name = "Primera Nacional"
    PARTIDOS_POR_FECHA = 18  # usado por el JS para agrupar jornadas

    def _date_ranges(self):
        from datetime import datetime
        y = datetime.now().year
        return [(f"{y}0201", f"{y}1231")]


class CopaArgentinaScraper(BracketMixin, BaseCompetitionScraper):
    """Copa Argentina — knockout, sin standings."""
    slug = "copa-argentina"
    league_code = "arg.copa_argentina"
    name = "Copa Argentina"

    def _date_ranges(self):
        from datetime import datetime
        y = datetime.now().year
        return [(f"{y}0101", f"{y}1231")]

    def fetch_standings(self):
        return None

    def fetch_fixtures(self):
        raw = self.espn.get_scoreboard(self.league_code, limit=200)
        if not raw:
            return None
        fixtures = self._normalize_fixtures(raw)
        order = {"in": 0, "pre": 1, "post": 2}
        return sorted(fixtures, key=lambda f: order.get(f.get("state", ""), 9))
