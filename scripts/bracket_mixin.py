"""
bracket_mixin.py — Reconstrucción de brackets a partir de eventos ESPN.

ESPN no expone un endpoint directo de bracket para la mayoría de competiciones.
Este mixin reconstruye las llaves usando:
  - rounds del scoreboard
  - next_match_id de cada partido
  - winners para conectar ramas del bracket

Se mezcla (mixin) en los scrapers que lo necesiten.
"""

import logging
from typing import Any, Optional

from ..core.utils import safe_get, normalize_team

logger = logging.getLogger(__name__)

# Mapeo de nombres de ronda conocidos para normalización
_ROUND_NAME_MAP = {
    "1": "Primera ronda",
    "2": "Segunda ronda",
    "3": "Tercera ronda",
    "4": "Cuartos de final",
    "5": "Semifinales",
    "6": "Final",
    "32": "Treintaidosavos",
    "16": "Dieciseisavos",
    "8": "Octavos de final",
    "Quarter-Finals": "Cuartos de final",
    "Semi-Finals": "Semifinales",
    "Final": "Final",
    "Round of 16": "Octavos de final",
    "Round of 32": "Dieciseisavos",
    "Round of 64": "Treintaidosavos",
}


class BracketMixin:
    """
    Mixin para reconstruir brackets desde el scoreboard de ESPN.
    Úsalo en scrapers de competiciones knockout o mixtas.

    La clase que lo mezcle debe tener:
        self.espn     — instancia de ESPNClient
        self.league_code — código ESPN
        self._log     — logger
    """

    def fetch_bracket(self) -> Optional[dict]:
        """
        Reconstruye el bracket completo a partir del scoreboard por rondas.
        """
        try:
            return self._build_bracket()
        except Exception as e:
            self._log.error("Error reconstruyendo bracket: %s", e)
            return None

    def _build_bracket(self) -> Optional[dict]:
        # 1. Intentar endpoint de rounds primero
        rounds_raw = self.espn.get_rounds(self.league_code)

        if rounds_raw and "rounds" in rounds_raw:
            return self._parse_rounds_endpoint(rounds_raw)

        # 2. Fallback: obtener todos los eventos del scoreboard y agrupar por semana/ronda
        scoreboard = self.espn.get_scoreboard(self.league_code, limit=500)
        if not scoreboard:
            return None

        return self._reconstruct_from_scoreboard(scoreboard)

    def _parse_rounds_endpoint(self, rounds_raw: dict) -> dict:
        """Parsea cuando ESPN sí tiene endpoint /rounds."""
        rounds_out = []
        for round_data in safe_get(rounds_raw, "rounds", default=[]):
            round_name = safe_get(round_data, "displayName", default="")
            round_name = _ROUND_NAME_MAP.get(round_name, round_name)

            matches = []
            for event in safe_get(round_data, "events", default=[]):
                matches.append(self._event_to_match(event))

            rounds_out.append({"name": round_name, "matches": matches})

        return {"rounds": rounds_out}

    def _reconstruct_from_scoreboard(self, scoreboard: dict) -> dict:
        """
        Agrupa eventos por su campo week/round y reconstruye el bracket.
        Conecta next_match_id para construir el árbol de eliminación.
        """
        events = safe_get(scoreboard, "events", default=[])

        # Agrupar por número de ronda
        rounds_map: dict[int, list] = {}
        for event in events:
            round_num = safe_get(event, "week", "number", default=0)
            if round_num not in rounds_map:
                rounds_map[round_num] = []
            rounds_map[round_num].append(event)

        # Construir índice de event_id -> next_match_id
        # ESPN a veces incluye next_match_id en competitions
        next_match_index: dict[str, str] = {}
        for event in events:
            comp = safe_get(event, "competitions", 0, default={})
            next_id = safe_get(comp, "nextMatchId", default=None)
            if next_id:
                next_match_index[str(safe_get(event, "id", default=""))] = str(next_id)

        rounds_out = []
        for round_num in sorted(rounds_map.keys()):
            round_events = rounds_map[round_num]
            round_name = self._infer_round_name(round_num, len(round_events))

            matches = []
            for event in round_events:
                match = self._event_to_match(event)
                event_id = str(safe_get(event, "id", default=""))
                match["next_match_id"] = next_match_index.get(event_id)
                matches.append(match)

            rounds_out.append({"name": round_name, "matches": matches})

        return {"rounds": rounds_out}

    def _event_to_match(self, event: dict) -> dict:
        comp = safe_get(event, "competitions", 0, default={})
        competitors = safe_get(comp, "competitors", default=[])
        home = next((c for c in competitors if c.get("homeAway") == "home"), {})
        away = next((c for c in competitors if c.get("homeAway") == "away"), {})

        # Determinar ganador
        winner_id = None
        if safe_get(home, "winner"):
            winner_id = str(safe_get(home, "team", "id", default=""))
        elif safe_get(away, "winner"):
            winner_id = str(safe_get(away, "team", "id", default=""))

        return {
            "match_id": str(safe_get(event, "id", default="")),
            "date": safe_get(event, "date", default=""),
            "status": safe_get(comp, "status", "type", "name", default=""),
            "state": safe_get(comp, "status", "type", "state", default=""),
            "home": {
                "team": normalize_team(safe_get(home, "team", default={})),
                "score": safe_get(home, "score", default=None),
                "aggregate_score": safe_get(home, "aggregateScore", default=None),
            },
            "away": {
                "team": normalize_team(safe_get(away, "team", default={})),
                "score": safe_get(away, "score", default=None),
                "aggregate_score": safe_get(away, "aggregateScore", default=None),
            },
            "winner": winner_id,
            "next_match_id": None,  # se rellena en _reconstruct_from_scoreboard
        }

    @staticmethod
    def _infer_round_name(round_num: int, match_count: int) -> str:
        """Infiere nombre de ronda por cantidad de partidos o número."""
        if match_count == 1:
            return "Final"
        if match_count == 2:
            return "Semifinales"
        if match_count == 4:
            return "Cuartos de final"
        if match_count == 8:
            return "Octavos de final"
        if match_count == 16:
            return "Dieciseisavos"
        if match_count == 32:
            return "Treintaidosavos"
        return f"Ronda {round_num}"
