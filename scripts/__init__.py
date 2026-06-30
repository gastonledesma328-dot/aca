"""
Registry centralizado de todos los scrapers disponibles.
Mapea slug → clase scraper.

Agregar una nueva competición = agregar una línea aquí.
"""

from .argentina import LigaProfesionalScraper, PrimeraNacionalScraper, CopaArgentinaScraper
from .conmebol import LibertadoresScraper, SudamericanaScraper, EliminatoriasScraper
from .uefa import ChampionsLeagueScraper, EuropaLeagueScraper, ConferenceLeagueScraper, EliminatoriaUEFAScraper
from .fifa import MundialScraper, MundialClubesScraper, MundialSub20Scraper
from .selecciones import CopaAmericaScraper, EurocopaScraper, UEFANationsLeagueScraper, EliminatoriasConcacafScraper
from .europa import PremierLeagueScraper, LaLigaScraper, SerieAScraper, BundesligaScraper, Ligue1Scraper, PrimeiraLigaScraper
from .copa_england import CarabaoCupScraper, FACupScraper
from .copa_spain import CopaDelReyScraper, SupercopaEspanaScraper
from .copa_italy import CoppaItaliaScraper, SupercopaItaliaScraper
from .america import BrasileiraoScraper, LigaUruguayScraper, LigaParaguayScraper, LigaColombiaScraper, LigaChileScraper, LigaMXScraper, MLSScraper

SCRAPERS: dict[str, type] = {
    # Argentina
    "liga-profesional":      LigaProfesionalScraper,
    "primera-nacional":      PrimeraNacionalScraper,
    "copa-argentina":        CopaArgentinaScraper,
    # CONMEBOL
    "libertadores":          LibertadoresScraper,
    "sudamericana":          SudamericanaScraper,
    "eliminatorias-conmebol": EliminatoriasScraper,
    # UEFA
    "champions-league":      ChampionsLeagueScraper,
    "europa-league":         EuropaLeagueScraper,
    "conference-league":     ConferenceLeagueScraper,
    "eliminatorias-uefa":    EliminatoriaUEFAScraper,
    # FIFA
    "mundial":               MundialScraper,
    "mundial-clubes":        MundialClubesScraper,
    "mundial-sub20":         MundialSub20Scraper,
    # Selecciones
    "copa-america":          CopaAmericaScraper,
    "eurocopa":              EurocopaScraper,
    "uefa-nations-league":   UEFANationsLeagueScraper,
    "eliminatorias-concacaf": EliminatoriasConcacafScraper,
    # Europa — ligas
    "premier-league":        PremierLeagueScraper,
    "laliga":                LaLigaScraper,
    "serie-a":               SerieAScraper,
    "bundesliga":            BundesligaScraper,
    "ligue-1":               Ligue1Scraper,
    "primeira-liga":         PrimeiraLigaScraper,
    # Europa — copas
    "carabao-cup":           CarabaoCupScraper,
    "fa-cup":                FACupScraper,
    "copa-del-rey":          CopaDelReyScraper,
    "supercopa-espana":      SupercopaEspanaScraper,
    "coppa-italia":          CoppaItaliaScraper,
    "supercopa-italia":      SupercopaItaliaScraper,
    # América
    "brasileirao":           BrasileiraoScraper,
    "liga-uruguay":          LigaUruguayScraper,
    "liga-paraguay":         LigaParaguayScraper,
    "liga-colombia":         LigaColombiaScraper,
    "liga-chile":            LigaChileScraper,
    "liga-mx":               LigaMXScraper,
    "mls":                   MLSScraper,
}

GROUPS: dict[str, list[str]] = {
    "argentina":   ["liga-profesional", "primera-nacional", "copa-argentina"],
    "conmebol":    ["libertadores", "sudamericana", "eliminatorias-conmebol"],
    "uefa":        ["champions-league", "europa-league", "conference-league", "eliminatorias-uefa"],
    "fifa":        ["mundial", "mundial-clubes", "mundial-sub20"],
    "selecciones": ["copa-america", "eurocopa", "uefa-nations-league", "eliminatorias-concacaf"],
    "europa":      ["premier-league", "laliga", "serie-a", "bundesliga", "ligue-1", "primeira-liga"],
    "copas-europa":["carabao-cup", "fa-cup", "copa-del-rey", "supercopa-espana", "coppa-italia", "supercopa-italia"],
    "america":     ["brasileirao", "liga-uruguay", "liga-paraguay", "liga-colombia", "liga-chile", "liga-mx", "mls"],
}

__all__ = ["SCRAPERS", "GROUPS"]
