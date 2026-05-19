import json
import os
import re
import time
import unicodedata
from datetime import datetime, timezone

import requests

BASE_FILE = "adivinajugador/jugadores_base.json"
OUTPUT_FILE = "adivinajugador/jugadores.json"
OVERRIDES_FILE = "adivinajugador/jugadores_overrides.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.espn.com/",
}

TEAM_MAP = {
    "Premier League|Arsenal": ("eng.1", "359"),
    "Premier League|Manchester City": ("eng.1", "382"),
    "Premier League|Liverpool": ("eng.1", "364"),

    "LaLiga|Real Madrid": ("esp.1", "86"),
    "LaLiga|Barcelona": ("esp.1", "83"),
    "LaLiga|Atlético de Madrid": ("esp.1", "1068"),
    "LaLiga|Atlético Madrid": ("esp.1", "1068"),

    "Serie A|Inter Milan": ("ita.1", "110"),
    "Serie A|Internazionale": ("ita.1", "110"),
    "Serie A|Juventus": ("ita.1", "111"),
    "Serie A|AC Milan": ("ita.1", "103"),

    "Bundesliga|Bayern München": ("ger.1", "132"),
    "Bundesliga|Bayern Munich": ("ger.1", "132"),
    "Bundesliga|Borussia Dortmund": ("ger.1", "124"),
    "Bundesliga|Bayer Leverkusen": ("ger.1", "131"),

    "Ligue 1|Paris Saint-Germain": ("fra.1", "160"),
    "Ligue 1|PSG": ("fra.1", "160"),
    "Ligue 1|Olympique de Marseille": ("fra.1", "176"),
    "Ligue 1|Marseille": ("fra.1", "176"),
    "Ligue 1|AS Monaco": ("fra.1", "174"),
    "Ligue 1|Monaco": ("fra.1", "174"),

    "Brasileirão|Flamengo": ("bra.1", "819"),
    "Brasileirão|Palmeiras": ("bra.1", "2029"),
    "Brasileirão|Santos": ("bra.1", "2674"),

    "Liga Profesional Argentina|River Plate": ("arg.1", "16"),
    "Liga Profesional Argentina|Boca Juniors": ("arg.1", "5"),
    "Liga Profesional Argentina|Racing Club": ("arg.1", "15"),

    "Eredivisie|Ajax Amsterdam": ("ned.1", "139"),
    "Eredivisie|Ajax": ("ned.1", "139"),
    "Eredivisie|PSV Eindhoven": ("ned.1", "148"),
    "Eredivisie|Feyenoord": ("ned.1", "142"),

    "Liga BetPlay|Atlético Nacional": ("col.1", "776"),
    "Liga BetPlay|Millonarios": ("col.1", "2828"),
    "Liga BetPlay|Junior FC": ("col.1", "4818"),
    "Liga BetPlay|Junior": ("col.1", "4818"),

    "MLS|Inter Miami CF": ("usa.1", "20232"),
    "MLS|Inter Miami": ("usa.1", "20232"),
    "MLS|LAFC": ("usa.1", "18966"),
    "MLS|Seattle Sounders": ("usa.1", "9726"),

    "Saudi Pro League|Al Nassr": ("ksa.1", "817"),
    "Saudi Pro League|Al Hilal": ("ksa.1", "605"),
    "Saudi Pro League|Al Ahli": ("ksa.1", "837"),

    "Liga Portugal|Benfica": ("por.1", "1929"),
    "Liga Portugal|FC Porto": ("por.1", "437"),
    "Liga Portugal|Sporting CP": ("por.1", "2250"),

    "Süper Lig|Galatasaray": ("tur.1", "432"),
    "Süper Lig|Fenerbahçe": ("tur.1", "436"),
    "Süper Lig|Fenerbahce": ("tur.1", "436"),
    "Süper Lig|Beşiktaş": ("tur.1", "549"),
    "Süper Lig|Besiktas": ("tur.1", "549"),

    "Liga MX|Club América": ("mex.1", "227"),
    "Liga MX|América": ("mex.1", "227"),
    "Liga MX|Cruz Azul": ("mex.1", "218"),
    "Liga MX|Tigres UANL": ("mex.1", "232"),
}

VALID_POSITIONS = {"G", "D", "M", "F", "GK", "CB", "LB", "RB", "CM", "CDM", "CAM", "LW", "RW", "ST"}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def slug(value):
    value = str(value or "").strip().lower()
    value = unicodedata.normalize("NFD", value)
    value = "".join(c for c in value if unicodedata.category(c) != "Mn")
    value = value.replace("ß", "ss").replace("ı", "i")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def name_key(value):
    s = slug(value)
    aliases = {
        "vinicius jr": "vinicius junior",
        "vinicius júnior": "vinicius junior",
        "khephren thuram": "khephren thuram",
        "dušan vlahović": "dusan vlahovic",
        "dusan vlahović": "dusan vlahovic",
        "joško gvardiol": "josko gvardiol",
        "josko gvardiol": "josko gvardiol",
        "coman": "kingsley coman",
    }
    return aliases.get(s, s)


def similar_name(a, b):
    a = name_key(a)
    b = name_key(b)
    if not a or not b:
        return False
    if a == b:
        return True
    wa, wb = set(a.split()), set(b.split())
    return len(wa) >= 2 and len(wb) >= 2 and (wa.issubset(wb) or wb.issubset(wa))


def load_json(path, fallback):
    if not os.path.exists(path):
        return fallback
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_json(url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=25)
        print(f"🌐 {r.status_code} {url}")
        if not r.ok:
            return None
        return r.json()
    except Exception as e:
        print(f"⚠️ Error leyendo {url}: {e}")
        return None


def flatten_base(data):
    if isinstance(data, dict) and isinstance(data.get("ligas"), list):
        leagues = data["ligas"]
    elif isinstance(data, list) and all(isinstance(x, dict) and "equipos" in x for x in data):
        leagues = data
    elif isinstance(data, list):
        return [
            {
                "nombre": p.get("nombre", ""),
                "altura": int(p.get("altura") or 0),
                "posicion": p.get("posicion", ""),
                "club_base": p.get("club_base") or p.get("club") or "",
                "liga_base": p.get("liga_base") or p.get("liga") or p.get("competicion") or "",
                "rol_base": p.get("rol_base") or "",
            }
            for p in data if isinstance(p, dict) and p.get("nombre")
        ]
    else:
        raise ValueError("jugadores_base.json debe ser lista plana o estructura por ligas/equipos.")

    out = []
    for liga_obj in leagues:
        liga = liga_obj.get("liga", "")
        for equipo_obj in liga_obj.get("equipos", []) or []:
            equipo = equipo_obj.get("equipo", "")
            for rol in ("titulares", "suplentes"):
                for p in equipo_obj.get(rol, []) or []:
                    if isinstance(p, dict) and p.get("nombre"):
                        out.append({
                            "nombre": p.get("nombre", ""),
                            "altura": int(p.get("altura") or 0),
                            "posicion": p.get("posicion", ""),
                            "club_base": equipo,
                            "liga_base": liga,
                            "rol_base": rol,
                        })
    return out


def load_overrides():
    data = load_json(OVERRIDES_FILE, {})
    if not isinstance(data, dict):
        data = {}
    excluir = {name_key(x) for x in data.get("excluir", []) if x}
    forzar = {}
    for name, value in (data.get("forzar") or {}).items():
        if isinstance(value, dict):
            forzar[name_key(name)] = value
    return excluir, forzar


def find_team_map_key(liga, equipo):
    exact = f"{liga}|{equipo}"
    if exact in TEAM_MAP:
        return exact
    sl, se = slug(liga), slug(equipo)
    for key in TEAM_MAP:
        kl, ke = key.split("|", 1)
        if slug(kl) == sl and slug(ke) == se:
            return key
    return ""


def get_team_display_name(data, fallback):
    team = data.get("team") if isinstance(data, dict) else {}
    if not isinstance(team, dict):
        return fallback
    return team.get("displayName") or team.get("shortDisplayName") or team.get("name") or fallback


def extract_country(athlete):
    for key in ("citizenship", "nationality"):
        value = athlete.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    for key in ("country", "birthCountry"):
        value = athlete.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            country = value.get("displayName") or value.get("name") or value.get("abbreviation")
            if country:
                return str(country).strip()
    return ""


def extract_image(athlete, espn_id):
    headshot = athlete.get("headshot")
    if isinstance(headshot, dict):
        href = headshot.get("href") or headshot.get("url")
        if href:
            return href
    if isinstance(headshot, str) and headshot:
        return headshot
    if espn_id:
        return f"https://a.espncdn.com/i/headshots/soccer/players/full/{espn_id}.png"
    return ""


def athlete_to_player(athlete, liga, club):
    espn_id = str(athlete.get("id") or athlete.get("uid") or "").split(":")[-1]
    nombre = athlete.get("displayName") or athlete.get("fullName") or athlete.get("name") or ""
    try:
        edad = int(athlete.get("age") or 0)
    except Exception:
        edad = 0
    return {
        "nombre": nombre,
        "club": club,
        "liga": liga,
        "competicion": liga,
        "edad": edad,
        "pais": extract_country(athlete) or "Sin datos",
        "imagen": extract_image(athlete, espn_id),
        "espn_id": espn_id,
    }


def collect_athletes(data, liga, club):
    raw = data.get("athletes") if isinstance(data, dict) else []
    if not isinstance(raw, list):
        return []
    players = []
    for group in raw:
        if not isinstance(group, dict):
            continue
        items = group.get("items") if isinstance(group.get("items"), list) else [group]
        for item in items:
            athlete = item.get("athlete") if isinstance(item, dict) else None
            if not isinstance(athlete, dict):
                athlete = item if isinstance(item, dict) else {}
            if athlete.get("displayName") or athlete.get("fullName") or athlete.get("name"):
                players.append(athlete_to_player(athlete, liga, club))
    return players


def fetch_roster(liga, equipo):
    key = find_team_map_key(liga, equipo)
    if not key:
        return [], {"liga": liga, "equipo": equipo, "motivo": "sin_team_map"}
    league_slug, team_id = TEAM_MAP[key]
    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league_slug}/teams/{team_id}/roster"
    data = get_json(url)
    if not data:
        return [], {"liga": liga, "equipo": equipo, "motivo": "sin_roster_espn"}
    club_actual = get_team_display_name(data, equipo)
    return collect_athletes(data, liga, club_actual), None


def build_roster_index(base_players):
    teams = []
    seen = set()
    for p in base_players:
        key = f"{p.get('liga_base')}|{p.get('club_base')}"
        if key not in seen:
            seen.add(key)
            teams.append((p.get("liga_base", ""), p.get("club_base", "")))

    index = {}
    equipos_no_encontrados = []
    for liga, equipo in teams:
        roster, err = fetch_roster(liga, equipo)
        if err:
            equipos_no_encontrados.append(err)
            continue
        for player in roster:
            nk = name_key(player.get("nombre"))
            if nk:
                index.setdefault(nk, []).append(player)
        time.sleep(0.04)
    return index, equipos_no_encontrados


def merge_player(base, espn, estado, confianza):
    return {
        "nombre": espn.get("nombre") or base.get("nombre"),
        "nombre_base": base.get("nombre"),
        "altura": int(base.get("altura") or 0),
        "posicion": base.get("posicion") or "",
        "club": espn.get("club") or "",
        "liga": espn.get("liga") or "",
        "competicion": espn.get("competicion") or espn.get("liga") or "",
        "edad": int(espn.get("edad") or 0),
        "pais": espn.get("pais") or "Sin datos",
        "imagen": espn.get("imagen") or "",
        "estado": estado,
        "confianza": confianza,
        "espn_id": str(espn.get("espn_id") or ""),
        "epoca": "actual",
    }


def is_valid_for_game(player):
    return (
        bool(player.get("nombre"))
        and bool(player.get("club"))
        and bool(player.get("competicion"))
        and int(player.get("altura") or 0) >= 140
        and player.get("posicion") in VALID_POSITIONS
        and int(player.get("edad") or 0) > 0
        and player.get("pais") not in ("", "Sin datos", None)
        and bool(player.get("imagen"))
    )


def main():
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    base_players = flatten_base(load_json(BASE_FILE, []))
    excluir, forzar = load_overrides()
    roster_index, equipos_no_encontrados = build_roster_index(base_players)

    jugadores = []
    actualizaciones = []
    descartados = []
    ambiguos = []
    seen_final = set()

    for base in base_players:
        base_name = base.get("nombre", "")
        nk = name_key(base_name)

        if nk in excluir:
            descartados.append({"nombre": base_name, "club_base": base.get("club_base"), "liga_base": base.get("liga_base"), "motivo": "excluido_override"})
            continue

        if nk in forzar:
            player = merge_player(base, forzar[nk], "forzado_override", "manual")
            if is_valid_for_game(player) and name_key(player["nombre"]) not in seen_final:
                seen_final.add(name_key(player["nombre"]))
                jugadores.append(player)
            else:
                descartados.append({**player, "motivo": "override_incompleto"})
            continue

        candidates = roster_index.get(nk, [])
        if not candidates:
            for cand_key, cand_list in roster_index.items():
                if similar_name(base_name, cand_list[0].get("nombre")):
                    candidates += cand_list

        same_team = [c for c in candidates if slug(c.get("club")) == slug(base.get("club_base")) and slug(c.get("liga")) == slug(base.get("liga_base"))]
        selected = None
        confianza = ""

        if len(same_team) == 1:
            selected = same_team[0]
            confianza = "mismo_club_confirmado"
        elif len(candidates) == 1:
            selected = candidates[0]
            confianza = "transferencia_confirmada_en_roster"
        elif len(same_team) > 1:
            selected = same_team[0]
            confianza = "mismo_club_multiples"
        elif len(candidates) > 1:
            ambiguos.append({
                "nombre": base_name,
                "club_base": base.get("club_base"),
                "liga_base": base.get("liga_base"),
                "motivo": "varios_candidatos_en_rosters",
                "candidatos": candidates[:8],
            })
            descartados.append({"nombre": base_name, "club_base": base.get("club_base"), "liga_base": base.get("liga_base"), "motivo": "ambiguo_no_confirmado"})
            continue

        if not selected:
            descartados.append({"nombre": base_name, "club_base": base.get("club_base"), "liga_base": base.get("liga_base"), "motivo": "no_confirmado_en_roster_actual"})
            continue

        player = merge_player(base, selected, "actualizado_espn", confianza)
        if not is_valid_for_game(player):
            descartados.append({**player, "motivo": "datos_incompletos_para_juego"})
            continue

        final_key = name_key(player["nombre"])
        if final_key in seen_final:
            continue
        seen_final.add(final_key)
        jugadores.append(player)

        if slug(player.get("club")) != slug(base.get("club_base")) or slug(player.get("liga")) != slug(base.get("liga_base")):
            actualizaciones.append({
                "nombre": base_name,
                "nombre_actual": player.get("nombre"),
                "club_base": base.get("club_base"),
                "liga_base": base.get("liga_base"),
                "club_actual": player.get("club"),
                "liga_actual": player.get("liga"),
                "edad": player.get("edad"),
                "pais": player.get("pais"),
                "espn_id": player.get("espn_id"),
                "confianza": confianza,
            })

    jugadores.sort(key=lambda p: (p.get("liga", ""), p.get("club", ""), p.get("nombre", "")))

    output = {
        "fuente": "jugadores_base.json curado + confirmación por rosters actuales ESPN",
        "modo": "solo_activos_confirmados_actualiza_todo_menos_altura_y_posicion",
        "actualizado": now_iso(),
        "total": len(jugadores),
        "base_detectados": len(base_players),
        "reglas": {
            "mantiene_manual": ["altura", "posicion"],
            "actualiza_espn": ["nombre", "club", "liga", "competicion", "edad", "pais", "imagen", "espn_id"],
            "no_confirmado_en_roster": "se excluye del jugadores.json para evitar clubes desactualizados",
            "overrides": OVERRIDES_FILE,
        },
        "con_pais": sum(1 for p in jugadores if p.get("pais") and p.get("pais") != "Sin datos"),
        "sin_pais": sum(1 for p in jugadores if not p.get("pais") or p.get("pais") == "Sin datos"),
        "con_imagen": sum(1 for p in jugadores if p.get("imagen")),
        "sin_imagen": sum(1 for p in jugadores if not p.get("imagen")),
        "actualizaciones": actualizaciones,
        "descartados_no_activos": descartados,
        "ambiguos_no_actualizados": ambiguos,
        "equipos_no_encontrados": equipos_no_encontrados,
        "jugadores": jugadores,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"✅ Generado {OUTPUT_FILE}")
    print(f"✅ Jugadores activos confirmados: {len(jugadores)}")
    print(f"⚠️ Descartados/no confirmados: {len(descartados)}")
    print(f"⚠️ Ambiguos: {len(ambiguos)}")


if __name__ == "__main__":
    main()
