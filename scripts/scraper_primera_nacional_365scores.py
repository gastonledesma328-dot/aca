import json
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

LEAGUE_ID = 419
SEASON = "2026"
START_DATE = datetime(2026, 1, 1)
END_DATE = datetime(2026, 12, 31)
MIN_FECHAS_VALIDAS = 30
MAX_FECHAS_VALIDAS = 45
MIN_PARTIDOS_VALIDOS = 500
PARTIDOS_REFERENCIA_POR_FECHA = 18
SEED_GAME_IDS = [4644182]
OUTPUTS = [
    Path("data/primera_nacional_fechas.json"),
    Path("public/data/primera_nacional_fechas.json"),
]

BASE_URLS = [
    "https://webws.365scores.com/web/games/allscores/",
    "https://webws.365scores.com/web/games/current/",
]
PAGED_URL = "https://webws.365scores.com/web/games/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.365scores.com",
    "Referer": "https://www.365scores.com/es/football/league/primera-nacional-419/matches",
}

session = requests.Session()
session.headers.update(HEADERS)


def parse_int(value, default=None):
    try:
        if value is None or value == "":
            return default
        return int(float(str(value).strip()))
    except Exception:
        return default


def clean_text(value):
    return re.sub(r"\s+", " ", str(value or "").strip())


def extract_games_payload(data):
    if not isinstance(data, dict):
        return []
    candidates = [
        data.get("games"),
        data.get("Games"),
        data.get("gamesByDate"),
        data.get("GamesByDate"),
    ]
    for value in candidates:
        if isinstance(value, list):
            games = []
            for item in value:
                if isinstance(item, dict) and isinstance(item.get("games"), list):
                    games.extend(item.get("games") or [])
                elif isinstance(item, dict) and isinstance(item.get("Games"), list):
                    games.extend(item.get("Games") or [])
                elif isinstance(item, dict) and (item.get("homeCompetitor") or item.get("homeTeam") or item.get("home")):
                    games.append(item)
            if games:
                return games
        elif isinstance(value, dict):
            nested = value.get("games") or value.get("Games")
            if isinstance(nested, list):
                return nested
    return []


def normalize_status(game):
    status_text = clean_text(
        game.get("statusText")
        or game.get("shortStatusText")
        or game.get("gameStatusText")
        or game.get("statusName")
        or ""
    )
    status_group = parse_int(game.get("statusGroup"), None)
    status_id = parse_int(game.get("status"), None)

    lower = status_text.lower()
    completed = False
    estado_tipo = "pre"

    if status_group in {3, 4} or status_id in {3, 4} or any(x in lower for x in ["fin", "final", "termin", "ft"]):
        completed = True
        estado_tipo = "post"
    elif status_group == 2 or any(x in lower for x in ["vivo", "live", "descanso", "1t", "2t"]):
        estado_tipo = "in"
    else:
        estado_tipo = "pre"

    if not status_text:
        status_text = "Final" if completed else "Programado"

    return status_text, estado_tipo, completed


def logo_url(competitor):
    competitor_id = competitor.get("id") or competitor.get("competitorId")
    image_version = competitor.get("imageVersion")
    if not competitor_id:
        return ""
    if image_version:
        return f"https://imagecache.365scores.com/image/upload/f_png,w_96,h_96,c_limit,q_auto:eco,dpr_2,d_Competitors:default1.png/v{image_version}/Competitors/{competitor_id}.png"
    return f"https://imagecache.365scores.com/image/upload/f_png,w_96,h_96,c_limit,q_auto:eco,dpr_2,d_Competitors:default1.png/Competitors/{competitor_id}.png"


def competitor_name(competitor):
    return clean_text(
        competitor.get("name")
        or competitor.get("shortName")
        or competitor.get("displayName")
        or competitor.get("symbolicName")
        or "Equipo"
    )


def score_value(game, side):
    keys = [
        f"{side}CompetitorScore",
        f"{side}Score",
        f"{side}_score",
        f"{side}TeamScore",
    ]
    for key in keys:
        if game.get(key) is not None:
            return str(game.get(key))
    scores = game.get("scores") or {}
    if isinstance(scores, dict) and scores.get(side) is not None:
        return str(scores.get(side))
    return None


def round_from_text(value):
    text = clean_text(value)
    if not text:
        return None
    match = re.search(r"(?:fecha|jornada|round|week|matchday)\s*(\d{1,2})", text, re.I)
    if match:
        n = parse_int(match.group(1))
        if n and 1 <= n <= 60:
            return n
    return None


def recursive_find_round(obj, depth=0):
    if depth > 5:
        return None

    if isinstance(obj, dict):
        strong_number_keys = {
            "roundnum",
            "roundnumber",
            "round",
            "week",
            "weeknumber",
            "matchday",
            "matchdaynumber",
            "fixture",
            "fixturenumber",
        }
        text_keys = {
            "roundname",
            "weekname",
            "matchdayname",
            "fixturetitle",
            "stagetext",
            "grouptitle",
            "name",
            "title",
        }

        for key, value in obj.items():
            low = str(key).lower()
            if low in strong_number_keys:
                n = parse_int(value)
                if n and 1 <= n <= 60:
                    return n
            if low in text_keys:
                n = round_from_text(value)
                if n:
                    return n

        for value in obj.values():
            n = recursive_find_round(value, depth + 1)
            if n:
                return n

    elif isinstance(obj, list):
        for item in obj:
            n = recursive_find_round(item, depth + 1)
            if n:
                return n

    return None


def extract_round(game):
    top_level_candidates = [
        game.get("roundNum"),
        game.get("roundNumber"),
        game.get("round"),
        game.get("week"),
        game.get("weekNumber"),
        game.get("matchday"),
        game.get("fixture"),
    ]

    for value in top_level_candidates:
        n = parse_int(value)
        if n and 1 <= n <= 60:
            return n

    text_candidates = [
        game.get("roundName"),
        game.get("weekName"),
        game.get("matchdayName"),
        game.get("groupName"),
        game.get("competitionDisplayName"),
        game.get("seasonName"),
    ]
    for text in text_candidates:
        n = round_from_text(text)
        if n:
            return n

    return recursive_find_round(game)


def parse_game(game):
    home = game.get("homeCompetitor") or game.get("homeTeam") or game.get("home") or {}
    away = game.get("awayCompetitor") or game.get("awayTeam") or game.get("away") or {}

    start_time = clean_text(game.get("startTime") or game.get("date") or game.get("gameTime") or "")
    dia = start_time[:10] if len(start_time) >= 10 else clean_text(game.get("dateForURL") or game.get("gameDate") or "")[:10]
    hora = "Ver horario"
    if "T" in start_time and len(start_time.split("T")[-1]) >= 5:
        hora = start_time.split("T")[-1][:5]

    estado, estado_tipo, completado = normalize_status(game)
    marcador_local = score_value(game, "home") if completado or estado_tipo == "in" else None
    marcador_visitante = score_value(game, "away") if completado or estado_tipo == "in" else None

    round_num = extract_round(game)

    return {
        "id": str(game.get("id") or game.get("gameId") or ""),
        "fuente": "365Scores",
        "numero_fecha": round_num,
        "fecha_torneo": round_num,
        "dia": dia,
        "fecha_iso": start_time,
        "hora": hora,
        "local": competitor_name(home),
        "visitante": competitor_name(away),
        "local_id": str(home.get("id") or home.get("competitorId") or ""),
        "visitante_id": str(away.get("id") or away.get("competitorId") or ""),
        "local_logo": logo_url(home),
        "visitante_logo": logo_url(away),
        "marcador_local": marcador_local,
        "marcador_visitante": marcador_visitante,
        "estado": estado,
        "estado_tipo": estado_tipo,
        "completado": completado,
        "round_name": clean_text(game.get("roundName") or game.get("stageName") or ""),
        "url": f"https://www.365scores.com/es/football/match/-#id={game.get('id') or game.get('gameId') or ''}",
    }


def request_games_for_date(date_str):
    params_list = [
        {
            "appTypeId": 5,
            "langId": 29,
            "timezoneName": "America/Argentina/Buenos_Aires",
            "userCountryId": 382,
            "competitions": LEAGUE_ID,
            "gamesDate": date_str,
            "showOdds": "false",
            "onlyMajorGames": "false",
        },
        {
            "appTypeId": 5,
            "langId": 29,
            "timezoneName": "America/Argentina/Buenos_Aires",
            "userCountryId": 382,
            "competitions": LEAGUE_ID,
            "date": date_str,
            "showOdds": "false",
            "onlyMajorGames": "false",
        },
    ]

    for base in BASE_URLS:
        for params in params_list:
            try:
                r = session.get(base, params=params, timeout=25)
                print(f"🌐 {r.status_code} {base} {date_str}")
                if not r.ok:
                    continue
                data = r.json()
                games = extract_games_payload(data)
                if games:
                    return games
            except Exception as exc:
                print(f"⚠️ Error 365Scores {date_str}: {exc}")
    return []


def request_games_aftergame(aftergame, direction):
    params = {
        "langId": 14,
        "timezoneId": 64,
        "userCountryId": 401,
        "competitions": LEAGUE_ID,
        "games": 1,
        "aftergame": aftergame,
        "direction": direction,
    }
    try:
        r = session.get(PAGED_URL, params=params, timeout=25)
        print(f"🌐 {r.status_code} {PAGED_URL} aftergame={aftergame} direction={direction}")
        if not r.ok:
            return []
        data = r.json()
        return extract_games_payload(data)
    except Exception as exc:
        print(f"⚠️ Error 365Scores paginado aftergame={aftergame} direction={direction}: {exc}")
        return []


def collect_games_by_aftergame():
    games = []
    seen_game_ids = set()

    def add_raw_games(raw_games):
        added = 0
        for raw in raw_games:
            game = parse_game(raw)
            key = game.get("id") or f"{game.get('dia')}-{game.get('local')}-{game.get('visitante')}"
            if not key or key in seen_game_ids:
                continue
            seen_game_ids.add(key)
            games.append(game)
            added += 1
        return added

    for seed in SEED_GAME_IDS:
        for direction in [1, -1]:
            aftergame = seed
            seen_aftergames = set()
            for _ in range(120):
                if aftergame in seen_aftergames:
                    break
                seen_aftergames.add(aftergame)
                raw_games = request_games_aftergame(aftergame, direction)
                if not raw_games:
                    break
                add_raw_games(raw_games)
                next_id = None
                for raw in reversed(raw_games):
                    next_id = raw.get("id") or raw.get("gameId")
                    if next_id:
                        break
                if not next_id or str(next_id) == str(aftergame):
                    break
                aftergame = next_id
                time.sleep(0.12)

    games.sort(key=lambda g: (g.get("fecha_iso") or g.get("dia") or "", g.get("hora") or ""))
    print(f"ℹ️ 365Scores paginado: {len(games)} partidos únicos")
    return games


def collect_games_by_date():
    current = START_DATE
    seen = set()
    games = []

    while current <= END_DATE:
        date_str = current.strftime("%Y-%m-%d")
        raw_games = request_games_for_date(date_str)
        for raw in raw_games:
            game = parse_game(raw)
            key = game.get("id") or f"{game.get('dia')}-{game.get('local')}-{game.get('visitante')}"
            if key in seen:
                continue
            seen.add(key)
            games.append(game)
        current += timedelta(days=1)
        time.sleep(0.08)

    games.sort(key=lambda g: (g.get("fecha_iso") or g.get("dia") or "", g.get("hora") or ""))
    print(f"ℹ️ 365Scores por fecha: {len(games)} partidos únicos")
    return games


def collect_games():
    paged = collect_games_by_aftergame()
    if len(paged) >= MIN_PARTIDOS_VALIDOS:
        return paged

    dated = collect_games_by_date()
    merged = []
    seen = set()
    for game in paged + dated:
        key = game.get("id") or f"{game.get('dia')}-{game.get('local')}-{game.get('visitante')}"
        if key in seen:
            continue
        seen.add(key)
        merged.append(game)
    merged.sort(key=lambda g: (g.get("fecha_iso") or g.get("dia") or "", g.get("hora") or ""))
    print(f"ℹ️ 365Scores combinado: {len(merged)} partidos únicos")
    return merged


def fallback_rounds_by_order(games):
    fechas = []
    current = []
    current_round = 1

    for game in games:
        if not current:
            current = [game]
            continue

        last_day = current[-1].get("dia")
        this_day = game.get("dia")
        if len(current) >= PARTIDOS_REFERENCIA_POR_FECHA and this_day != last_day:
            for p in current:
                p["numero_fecha"] = current_round
                p["fecha_torneo"] = current_round
            fechas.append(current)
            current_round += 1
            current = [game]
        else:
            current.append(game)

    if current:
        for p in current:
            p["numero_fecha"] = current_round
            p["fecha_torneo"] = current_round
        fechas.append(current)

    return fechas


def grupos_round_confiables(groups, total_games):
    if not groups:
        return False, "sin grupos"
    total_grouped = sum(len(v) for v in groups.values())
    group_count = len(groups)
    max_group = max(len(v) for v in groups.values())

    if total_grouped < max(1, int(total_games * 0.6)):
        return False, f"pocos partidos con round: {total_grouped}/{total_games}"
    if group_count < MIN_FECHAS_VALIDAS:
        return False, f"pocas fechas detectadas por round: {group_count}"
    if group_count > MAX_FECHAS_VALIDAS:
        return False, f"demasiadas fechas detectadas por round: {group_count}"
    if max_group > 35:
        return False, f"grupo demasiado grande: {max_group} partidos"

    return True, f"{group_count} fechas / máximo {max_group} partidos"


def build_fechas(games):
    groups = {}
    for game in games:
        n = parse_int(game.get("numero_fecha"))
        if n:
            groups.setdefault(n, []).append(game)

    confiable, motivo = grupos_round_confiables(groups, len(games))

    if confiable:
        ordered_groups = [groups[n] for n in sorted(groups)]
        method = "365scores-round-confiable"
        print(f"✅ 365Scores round confiable: {motivo}")
    else:
        ordered_groups = fallback_rounds_by_order(games)
        method = "365scores-fallback-sin-cortar-mismo-dia"
        print(f"⚠️ 365Scores round no confiable ({motivo}). Uso fallback sin cortar mismo día.")

    fechas = []
    for idx, partidos in enumerate(ordered_groups, start=1):
        partidos = sorted(partidos, key=lambda g: (g.get("fecha_iso") or g.get("dia") or "", g.get("hora") or ""))
        for p in partidos:
            p["numero_fecha"] = idx
            p["fecha_torneo"] = idx
        fechas.append({
            "numero": idx,
            "nombre": f"Fecha {idx}",
            "partidos": partidos,
            "fecha_desde": next((p.get("dia") for p in partidos if p.get("dia")), ""),
            "fecha_hasta": next((p.get("dia") for p in reversed(partidos) if p.get("dia")), ""),
            "metodo_agrupacion": method,
        })

    return fechas, method


def calendario_valido(fechas, total_partidos):
    if len(fechas) < MIN_FECHAS_VALIDAS:
        return False, f"pocas fechas: {len(fechas)}"
    if total_partidos < MIN_PARTIDOS_VALIDOS:
        return False, f"pocos partidos: {total_partidos}"
    return True, "ok"


def save_json(data):
    for path in OUTPUTS:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"✅ Generado {path}")


def main():
    games = collect_games()
    if not games:
        raise SystemExit("365Scores no devolvió partidos para Primera Nacional 419")

    fechas, method = build_fechas(games)
    all_games = [p for f in fechas for p in f.get("partidos", [])]
    valido, motivo = calendario_valido(fechas, len(all_games))
    if not valido:
        raise SystemExit(f"365Scores no generó calendario válido: {motivo}. No se sobrescribe el JSON bueno.")

    data = {
        "competicion": "Primera Nacional",
        "league_id_365scores": LEAGUE_ID,
        "season": SEASON,
        "formato": "Fase de grupos",
        "fuente": "365Scores",
        "metodo_agrupacion": method,
        "descripcion": "Fechas generadas desde 365Scores. Primero intenta paginar por aftergame; si no alcanza, combina con búsqueda por día. Si la Fecha/Jornada no es confiable, agrupa por orden cronológico sin cortar partidos del mismo día.",
        "total_fechas": len(fechas),
        "total_partidos": len(all_games),
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "fechas": fechas,
        "partidos": all_games,
    }

    print(f"✅ 365Scores: {data['total_fechas']} fechas, {data['total_partidos']} partidos, método {method}")
    save_json(data)


if __name__ == "__main__":
    main()
