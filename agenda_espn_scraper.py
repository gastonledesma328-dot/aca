import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


OUTPUT_FILE = "agenda_espn.json"
ARG_TZ = timezone(timedelta(hours=-3))
FETCH_SCORERS = True
MAX_WORKERS_SCOREBOARD = 10
MAX_WORKERS_SUMMARY = 2

ESPN_SCOREBOARD_URLS = [
    "https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard",
    "https://site.web.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard",
]

ESPN_SUMMARY_URLS = [
    "https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/summary",
    "https://site.web.api.espn.com/apis/site/v2/sports/soccer/{league}/summary",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
    "Referer": "https://www.espn.com.ar/futbol/calendario",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}


# Menor numero = aparece mas arriba.
LEAGUES = {
    # Argentina masculino
    "arg.1": ("Liga Profesional de Futbol", 10),
    "arg.2": ("Primera Nacional", 11),
    "arg.3": ("Primera B Metropolitana", 12),
    "arg.4": ("Torneo Federal A", 13),
    "arg.5": ("Primera C", 14),
    "arg.copa": ("Copa Argentina", 15),
    "arg.supercopa": ("Supercopa Argentina", 16),

    # Europa masculino
    "eng.1": ("Premier League", 100),
    "esp.1": ("LaLiga", 101),
    "ita.1": ("Serie A", 102),
    "ger.1": ("Bundesliga", 103),
    "fra.1": ("Ligue 1", 104),
    "por.1": ("Primeira Liga", 105),
    "ned.1": ("Eredivisie", 106),
    "bel.1": ("Belgian Pro League", 107),
    "tur.1": ("Super Lig", 108),
    "sco.1": ("Scottish Premiership", 109),
    "uefa.champions": ("UEFA Champions League", 120),
    "uefa.europa": ("UEFA Europa League", 121),
    "uefa.europa.conf": ("UEFA Conference League", 122),

    # Brasil masculino
    "bra.1": ("Brasileirao", 200),
    "bra.2": ("Brasileirao Serie B", 201),
    "bra.3": ("Brasileirao Serie C", 202),
    "bra.4": ("Brasileirao Serie D", 203),
    "bra.copa_do_brazil": ("Copa do Brasil", 204),

    # Sudamerica masculino
    "conmebol.libertadores": ("Copa Libertadores", 250),
    "conmebol.sudamericana": ("Copa Sudamericana", 251),
    "conmebol.recopa": ("CONMEBOL Recopa", 252),
    "chi.1": ("Primera Division de Chile", 260),
    "col.1": ("Categoria Primera A", 261),
    "ecu.1": ("LigaPro Serie A", 262),
    "par.1": ("Primera Division de Paraguay", 263),
    "per.1": ("Liga 1 Peru", 264),
    "uru.1": ("Primera Division de Uruguay", 265),
    "ven.1": ("Liga FUTVE", 266),
    "bol.1": ("Division Profesional Bolivia", 267),

    # Otros utiles
    "mex.1": ("Liga MX", 400),
    "usa.1": ("MLS", 401),
    "fifa.world": ("Copa del Mundo", 1),
    "fifa.cwc": ("Mundial de Clubes FIFA", 2),

    # Femenino al final
    "arg.w.1": ("Campeonato Femenino de Primera Division", 900),
    "bra.w.1": ("Brasileirao Feminino Serie A1", 901),
    "col.w.1": ("Liga Femenina Colombia", 902),
    "chi.w.1": ("Primera Division Femenina Chile", 903),
    "esp.w.1": ("Liga F", 906),
    "eng.w.1": ("Womens Super League", 907),
    "fra.w.1": ("Premiere Ligue", 908),
    "ger.w.1": ("Frauen-Bundesliga", 909),
    "ita.w.1": ("Serie A Femminile", 910),
    "uefa.wchampions": ("UEFA Women's Champions League", 920),
    "fifa.wwc": ("Mundial Femenino FIFA", 921),
    "usa.nwsl": ("NWSL Estados Unidos", 930),
}

NOT_STARTED = {
    "STATUS_SCHEDULED",
    "STATUS_POSTPONED",
    "STATUS_CANCELED",
    "STATUS_SUSPENDED",
    "STATUS_DELAYED",
    "STATUS_ABANDONED",
    "STATUS_RAIN_DELAY",
}

ACTIVE_OR_DONE = {
    "STATUS_IN_PROGRESS",
    "STATUS_HALFTIME",
    "STATUS_END_PERIOD",
    "STATUS_FINAL",
    "STATUS_FULL_TIME",
}


def make_session():
    retry = Retry(
        total=3,
        connect=3,
        read=3,
        backoff_factor=0.4,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=50, pool_maxsize=50)
    session = requests.Session()
    session.headers.update(HEADERS)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


SESSION = make_session()


def now_argentina():
    return datetime.now(ARG_TZ)


def api_date(date=None):
    # ESPN espera YYYYMMDD. Usar Argentina para que la agenda sea la del usuario.
    return (date or now_argentina()).strftime("%Y%m%d")


def utc_to_argentina(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(ARG_TZ)
    except ValueError:
        return None


def normalize_score(value):
    if value is None:
        return None
    if isinstance(value, dict):
        value = value.get("value") or value.get("displayValue") or value.get("score")
    if value is None:
        return None
    try:
        return str(int(float(value)))
    except (TypeError, ValueError):
        return str(value)


def score_int(value):
    try:
        return int(normalize_score(value) or 0)
    except (TypeError, ValueError):
        return 0


def fetch_json(url, params, timeout=18):
    response = SESSION.get(url, params=params, timeout=timeout)
    response.raise_for_status()
    return response.json()


def fetch_scoreboard(league_slug, league_name, priority, date=None):
    params = {
        "region": "ar",
        "lang": "es",
        "contentorigin": "espn",
        "dates": api_date(date),
        "limit": 300,
        "_": int(time.time()),
    }

    last_error = None
    for base_url in ESPN_SCOREBOARD_URLS:
        try:
            data = fetch_json(base_url.format(league=league_slug), params)
            return {
                "ok": True,
                "league_slug": league_slug,
                "league_name": league_name,
                "priority": priority,
                "events": data.get("events") or [],
                "error": None,
            }
        except Exception as exc:
            last_error = str(exc)

    return {
        "ok": False,
        "league_slug": league_slug,
        "league_name": league_name,
        "priority": priority,
        "events": [],
        "error": last_error,
    }


def fetch_summary_url(base_url, league_slug, event_id):
    params = {
        "region": "ar",
        "lang": "es",
        "contentorigin": "espn",
        "event": event_id,
        "_": int(time.time()),
    }
    try:
        return fetch_json(base_url.format(league=league_slug), params, timeout=15)
    except Exception:
        return None


def get_competition_from_event(event):
    comps = event.get("competitions") or []
    return comps[0] if comps else {}


def get_competition_from_summary(summary):
    header = summary.get("header") or {}
    comps = header.get("competitions") or []
    return comps[0] if comps else {}


def competition_score(comp):
    if not comp:
        return -1

    status = comp.get("status") or {}
    status_type = status.get("type") or {}
    status_name = status_type.get("name")
    completed = bool(status_type.get("completed"))
    clock = status.get("displayClock")
    short = status_type.get("shortDetail") or ""
    competitors = comp.get("competitors") or []
    goals = sum(score_int(item.get("score")) for item in competitors)

    points = 0
    if completed:
        points += 1000
    if status_name in ACTIVE_OR_DONE:
        points += 800
    if clock:
        points += 500
    if "'" in str(short) or "+" in str(short):
        points += 300
    points += goals * 50
    return points


def fetch_summary(league_slug, event_id):
    if not event_id:
        return {}

    results = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS_SUMMARY) as executor:
        futures = [
            executor.submit(fetch_summary_url, base_url, league_slug, event_id)
            for base_url in ESPN_SUMMARY_URLS
        ]
        for future in as_completed(futures):
            data = future.result()
            if data:
                results.append(data)

    if not results:
        return {}

    return max(results, key=lambda item: competition_score(get_competition_from_summary(item)))


def choose_competition(event, summary):
    from_event = get_competition_from_event(event)
    from_summary = get_competition_from_summary(summary)

    if not from_summary:
        return from_event or {}
    if not from_event:
        return from_summary

    status_name = ((from_summary.get("status") or {}).get("type") or {}).get("name")
    if status_name in ACTIVE_OR_DONE:
        return from_summary

    return max([from_event, from_summary], key=competition_score)


def get_logo(team):
    logos = team.get("logos") or []
    for logo in logos:
        href = logo.get("href")
        if href and ".png" in href.lower():
            return href
    for logo in logos:
        href = logo.get("href")
        if href:
            return href

    if team.get("logo"):
        return team["logo"]

    team_id = team.get("id")
    if team_id:
        return f"https://a.espncdn.com/i/teamlogos/soccer/500/{team_id}.png"

    return None


def extract_teams(comp):
    out = {
        "local": None,
        "visitante": None,
        "local_id": None,
        "visitante_id": None,
        "local_logo": None,
        "visitante_logo": None,
        "marcador_local": None,
        "marcador_visitante": None,
    }

    for item in comp.get("competitors") or []:
        team = item.get("team") or {}
        name = team.get("displayName") or team.get("shortDisplayName") or team.get("name")
        team_id = team.get("id")
        logo = get_logo(team)
        score = normalize_score(item.get("score"))

        if item.get("homeAway") == "home":
            out.update({
                "local": name,
                "local_id": team_id,
                "local_logo": logo,
                "marcador_local": score,
            })
        elif item.get("homeAway") == "away":
            out.update({
                "visitante": name,
                "visitante_id": team_id,
                "visitante_logo": logo,
                "marcador_visitante": score,
            })

    return out


def extract_status(comp):
    status = comp.get("status") or {}
    status_type = status.get("type") or {}
    status_name = status_type.get("name")
    completed = bool(status_type.get("completed")) or status_name in {"STATUS_FINAL", "STATUS_FULL_TIME"}
    clock = status.get("displayClock")
    period = status.get("period")
    description = status_type.get("description")
    short = status_type.get("shortDetail")

    if completed:
        display_time = "Fin"
    elif clock:
        display_time = clock
    else:
        display_time = short or description

    return {
        "estado": description,
        "estado_corto": short,
        "estado_nombre": status_name,
        "completado": completed,
        "minuto": clock,
        "periodo": period,
        "mostrar_tiempo": display_time,
    }


def match_started_or_finished(status_data, home_score=None, away_score=None):
    status_name = status_data.get("estado_nombre")
    if status_name in NOT_STARTED:
        return False
    if status_data.get("completado"):
        return True
    if status_name in ACTIVE_OR_DONE:
        return True
    if status_data.get("minuto"):
        return True

    for value in (
        status_data.get("estado_corto"),
        status_data.get("estado"),
        status_data.get("mostrar_tiempo"),
    ):
        text = str(value or "").lower()
        if "'" in text or "+" in text:
            return True
        if text in {"fin", "final", "descanso", "entretiempo", "medio tiempo"}:
            return True
        if "half" in text or "final" in text:
            return True

    return score_int(home_score) > 0 or score_int(away_score) > 0


def display_time(status_data, start_time):
    if status_data.get("completado"):
        return "Fin"
    if status_data.get("minuto"):
        return status_data["minuto"]
    if status_data.get("estado_nombre") == "STATUS_HALFTIME":
        return "Descanso"

    shown = status_data.get("mostrar_tiempo")
    if shown in {"Descanso", "Entretiempo", "Fin", "Suplementario"}:
        return shown

    return start_time


def result_text(home_score, away_score, show_score):
    if not show_score:
        return None
    if home_score is None or away_score is None:
        return None
    return f"{home_score}-{away_score}"


def extract_scorers(summary):
    scorers = []
    for play in summary.get("scoringPlays") or []:
        athlete = play.get("athlete") or {}
        team = play.get("team") or {}
        clock = play.get("clock")
        play_type = play.get("type") or {}

        player = (
            athlete.get("displayName")
            or athlete.get("fullName")
            or athlete.get("shortName")
            or athlete.get("name")
        )
        team_name = (
            team.get("displayName")
            or team.get("shortDisplayName")
            or team.get("name")
            or team.get("abbreviation")
        )

        if isinstance(clock, dict):
            minute = clock.get("displayValue")
        else:
            minute = clock

        description = (
            play.get("text")
            or play.get("displayValue")
            or play_type.get("text")
            or play_type.get("description")
        )

        if not player and not description:
            continue

        scorers.append({
            "jugador": player,
            "equipo": team_name,
            "minuto": minute,
            "descripcion": description,
            "score": play.get("score") or {},
        })

    return scorers


def clean_event(event, league_slug, league_name, priority):
    summary = fetch_summary(league_slug, event.get("id")) if FETCH_SCORERS and event.get("id") else {}
    comp = choose_competition(event, summary)
    teams = extract_teams(comp)
    status_data = extract_status(comp)

    start_utc = (get_competition_from_summary(summary) or {}).get("date") or comp.get("date") or event.get("date")
    start_arg = utc_to_argentina(start_utc)
    date_arg = start_arg.strftime("%Y-%m-%d") if start_arg else None
    start_time = start_arg.strftime("%H:%M") if start_arg else None

    show_score = match_started_or_finished(
        status_data,
        teams["marcador_local"],
        teams["marcador_visitante"],
    )

    shown_time = display_time(status_data, start_time)
    links = event.get("links") or []

    return {
        "id": event.get("id"),
        "partido": (
            f"{teams['local']} vs {teams['visitante']}"
            if teams["local"] and teams["visitante"]
            else event.get("name")
        ),
        "local": teams["local"],
        "visitante": teams["visitante"],
        "local_id": teams["local_id"],
        "visitante_id": teams["visitante_id"],
        "local_logo": teams["local_logo"],
        "visitante_logo": teams["visitante_logo"],
        "liga": league_name,
        "liga_corta": league_name,
        "liga_slug": league_slug,
        "prioridad_liga": priority,
        "competicion": {
            "nombre": league_name,
            "nombre_corto": league_name,
            "slug": league_slug,
            "prioridad": priority,
        },
        "fecha": date_arg,
        "hora_inicio": start_time,
        "hora": shown_time,
        "mostrar_tiempo": shown_time,
        "estado": status_data["estado"],
        "estado_corto": status_data["estado_corto"],
        "estado_nombre": status_data["estado_nombre"],
        "completado": status_data["completado"],
        "minuto": status_data["minuto"],
        "periodo": status_data["periodo"],
        "marcador_local": teams["marcador_local"] if show_score else None,
        "marcador_visitante": teams["marcador_visitante"] if show_score else None,
        "resultado": result_text(teams["marcador_local"], teams["marcador_visitante"], show_score),
        "mostrar_marcador": show_score,
        "goleadores": extract_scorers(summary) if summary and show_score else [],
        "fecha_espn": start_utc,
        "url_espn": links[0].get("href") if links else None,
    }


def scrape_matches(date=None):
    matches = []
    errors = []
    seen = set()

    print("Consultando competiciones de ESPN...")
    with ThreadPoolExecutor(max_workers=MAX_WORKERS_SCOREBOARD) as executor:
        futures = {
            executor.submit(fetch_scoreboard, slug, name, priority, date): (slug, name, priority)
            for slug, (name, priority) in LEAGUES.items()
        }

        for future in as_completed(futures):
            response = future.result()
            slug = response["league_slug"]
            name = response["league_name"]
            priority = response["priority"]

            if not response["ok"]:
                errors.append({"liga": name, "slug": slug, "error": response["error"]})
                continue

            for event in response["events"]:
                key = event.get("id") or f"{slug}-{event.get('name')}-{event.get('date')}"
                if key in seen:
                    continue

                item = clean_event(event, slug, name, priority)
                if item["local"] and item["visitante"]:
                    matches.append(item)
                    seen.add(key)

    matches.sort(key=lambda item: (
        item.get("prioridad_liga", 9999),
        item.get("fecha") or "",
        item.get("hora_inicio") or "",
        item.get("partido") or "",
    ))
    return matches, errors


def group_by_league(matches):
    groups = {}
    for match in matches:
        league = match.get("liga") or "Sin competicion"
        groups.setdefault(league, {
            "liga": league,
            "liga_slug": match.get("liga_slug"),
            "prioridad": match.get("prioridad_liga", 9999),
            "partidos": [],
        })
        groups[league]["partidos"].append(match)

    out = []
    for group in groups.values():
        group["partidos"].sort(key=lambda item: (
            item.get("fecha") or "",
            item.get("hora_inicio") or "",
            item.get("partido") or "",
        ))
        out.append({
            "liga": group["liga"],
            "liga_slug": group["liga_slug"],
            "prioridad": group["prioridad"],
            "total": len(group["partidos"]),
            "partidos": group["partidos"],
        })

    out.sort(key=lambda item: (item.get("prioridad", 9999), item.get("liga") or ""))
    return out


def save_json(matches, errors):
    payload = {
        "fuente": "ESPN Argentina",
        "metodo": "scoreboard + summary doble endpoint paralelo",
        "fecha_scrapeo": now_argentina().isoformat(),
        "total": len(matches),
        "total_ligas_consultadas": len(LEAGUES),
        "partidos": matches,
        "agrupado_por_liga": group_by_league(matches),
        "errores": errors,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)


def main():
    print("Obteniendo agenda desde ESPN por competicion...")
    matches, errors = scrape_matches()
    save_json(matches, errors)
    print(f"OK: {len(matches)} partidos guardados en {OUTPUT_FILE}")
    print(f"Ligas consultadas: {len(LEAGUES)}")
    print(f"Errores: {len(errors)}")


if __name__ == "__main__":
    main()
