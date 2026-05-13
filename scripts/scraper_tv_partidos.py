import os
import json
import requests
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

API_KEY = os.environ.get("API_FOOTBALL_KEY", "")
API_HOST = "v3.football.api-sports.io"
API_URL = "https://v3.football.api-sports.io/fixtures"

TIMEZONE = "America/Argentina/Buenos_Aires"

OUTPUT_FILE = "data/tv_partidos.json"
RULES_FILE = "data/tv_rules.json"


def ahora_argentina():
    return datetime.now(ZoneInfo(TIMEZONE))


def normalizar(texto):
    texto = str(texto or "").lower().strip()
    reemplazos = {
        "á": "a",
        "é": "e",
        "í": "i",
        "ó": "o",
        "ú": "u",
        "ñ": "n"
    }

    for original, nuevo in reemplazos.items():
        texto = texto.replace(original, nuevo)

    return " ".join(texto.split())


def cargar_rules():
    if not os.path.exists(RULES_FILE):
        return {"default": ["A confirmar"]}

    with open(RULES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def es_liga_juvenil_o_reserva(liga):
    liga_norm = normalizar(liga)

    palabras = [
        "u17",
        "u18",
        "u19",
        "u20",
        "u21",
        "u23",
        "sub 17",
        "sub 18",
        "sub 19",
        "sub 20",
        "sub 21",
        "sub 23",
        "reserve",
        "reserva",
        "res.",
        "reserves",
        "youth",
        "academy",
        "development",
        "junior",
        "juniors",
        "juvenil"
    ]

    return any(palabra in liga_norm for palabra in palabras)


def limpiar_canales(canales):
    if not isinstance(canales, list):
        return ["A confirmar"]

    limpios = []

    for canal in canales:
        canal = str(canal or "").strip()

        if not canal:
            continue

        if canal not in limpios:
            limpios.append(canal)

    canales_reales = [
        canal for canal in limpios
        if normalizar(canal) != "a confirmar"
    ]

    if canales_reales:
        return canales_reales

    return ["A confirmar"]


def buscar_en_rules(rules, pais, liga):
    pais = str(pais or "").strip()
    liga = str(liga or "").strip()

    pais_norm = normalizar(pais)
    liga_norm = normalizar(liga)

    # Coincidencia exacta por país
    if pais in rules and isinstance(rules[pais], dict):
        ligas_pais = rules[pais]

        if liga in ligas_pais:
            return ligas_pais[liga], "regla_exacta", "alta"

        for nombre_liga, canales in ligas_pais.items():
            nombre_liga_norm = normalizar(nombre_liga)

            if nombre_liga_norm == liga_norm:
                return canales, "regla_exacta_normalizada", "alta"

            if nombre_liga_norm in liga_norm or liga_norm in nombre_liga_norm:
                return canales, "regla_flexible", "media"

    # Coincidencia por país normalizado
    for pais_rule, ligas_pais in rules.items():
        if pais_rule == "default":
            continue

        if not isinstance(ligas_pais, dict):
            continue

        if normalizar(pais_rule) != pais_norm:
            continue

        for nombre_liga, canales in ligas_pais.items():
            nombre_liga_norm = normalizar(nombre_liga)

            if nombre_liga_norm == liga_norm:
                return canales, "regla_pais_normalizado", "alta"

            if nombre_liga_norm in liga_norm or liga_norm in nombre_liga_norm:
                return canales, "regla_pais_flexible", "media"

    return None, None, None


def buscar_canales(rules, pais, liga):
    pais = str(pais or "").strip()
    liga = str(liga or "").strip()

    pais_norm = normalizar(pais)
    liga_norm = normalizar(liga)

    # Evita falsos positivos:
    # U18 Premier League no debe heredar ESPN/Disney+ de Premier League.
    if es_liga_juvenil_o_reserva(liga):
        return rules.get("default", ["A confirmar"]), "liga_juvenil_reserva", "baja"

    # =========================
    # REGLAS FUERTES ARGENTINA
    # =========================

    if pais_norm == "argentina":
        if "copa argentina" in liga_norm or liga_norm == "copa" or "argentina cup" in liga_norm:
            return ["TyC Sports"], "regla_fuerte_copa_argentina", "alta"

        if "primera nacional" in liga_norm:
            return ["TyC Sports", "TyC Sports Play"], "regla_fuerte_primera_nacional", "alta"

        if (
            "liga profesional" in liga_norm
            or "primera division" in liga_norm
            or "torneo betano" in liga_norm
        ):
            return ["ESPN Premium", "TNT Sports"], "regla_fuerte_liga_argentina", "alta"

        if "reserve" in liga_norm or "reserva" in liga_norm:
            return ["A confirmar"], "reserva_argentina", "baja"

    # =========================
    # REGLAS FUERTES CONMEBOL
    # =========================

    if "libertadores" in liga_norm:
        canales = (
            rules.get("CONMEBOL", {}).get("CONMEBOL Libertadores")
            or rules.get("CONMEBOL", {}).get("Copa Libertadores")
            or ["ESPN", "Disney+"]
        )
        return canales, "regla_conmebol", "media"

    if "sudamericana" in liga_norm:
        canales = (
            rules.get("CONMEBOL", {}).get("CONMEBOL Sudamericana")
            or rules.get("CONMEBOL", {}).get("Copa Sudamericana")
            or ["ESPN", "Disney+"]
        )
        return canales, "regla_conmebol", "media"

    # =========================
    # REGLAS FUERTES POR PAÍS
    # =========================

    if pais_norm == "colombia":
        if "primera a" in liga_norm or "copa colombia" in liga_norm:
            return ["Win Sports"], "regla_fuerte_colombia", "alta"

    if pais_norm == "bolivia":
        if "primera division" in liga_norm or "division profesional" in liga_norm:
            return ["Tigo Sports"], "regla_fuerte_bolivia", "alta"

    if pais_norm == "brazil":
        if "copa do brasil" in liga_norm:
            return ["SporTV", "Premiere"], "regla_fuerte_brasil", "alta"

        if liga_norm == "serie a" or "brasileirao" in liga_norm:
            return ["SporTV", "Premiere"], "regla_fuerte_brasil", "media"

    if pais_norm == "spain":
        if "la liga" in liga_norm or "laliga" in liga_norm:
            return ["ESPN", "Disney+"], "regla_fuerte_espana", "alta"

    if pais_norm == "italy":
        if liga_norm == "serie a":
            return ["ESPN", "Disney+"], "regla_fuerte_italia", "alta"

        if liga_norm == "serie b":
            return ["A confirmar"], "serie_b_italia_sin_regla", "baja"

    if pais_norm == "england":
        if liga_norm == "premier league":
            return ["ESPN", "Disney+"], "regla_fuerte_inglaterra", "alta"

        if "championship" in liga_norm:
            return ["ESPN", "Disney+"], "regla_fuerte_championship", "media"

    if pais_norm == "france":
        if "ligue 1" in liga_norm:
            return ["ESPN", "Disney+"], "regla_fuerte_francia", "alta"

    if pais_norm == "germany":
        if "bundesliga" in liga_norm:
            return ["ESPN", "Disney+"], "regla_fuerte_alemania", "alta"

    if pais_norm == "usa":
        if "major league soccer" in liga_norm or liga_norm == "mls":
            return ["Apple TV"], "regla_fuerte_mls", "alta"

        if "nwsl" in liga_norm:
            return ["A confirmar"], "nwsl_sin_regla", "baja"

    # =========================
    # RULES JSON
    # =========================

    canales, fuente, confianza = buscar_en_rules(rules, pais, liga)

    if canales:
        return canales, fuente, confianza

    # =========================
    # EUROPA
    # =========================

    if "champions league" in liga_norm:
        return ["ESPN", "Disney+"], "regla_europa", "media"

    if "europa league" in liga_norm:
        return ["ESPN", "Disney+"], "regla_europa", "media"

    if "conference league" in liga_norm:
        return ["ESPN", "Disney+"], "regla_europa", "media"

    # Fallback
    return rules.get("default", ["A confirmar"]), "sin_regla", "baja"


def obtener_fixtures_del_dia(fecha):
    if not API_KEY:
        raise RuntimeError("Falta configurar API_FOOTBALL_KEY en GitHub Secrets.")

    headers = {
        "x-apisports-key": API_KEY,
        "x-rapidapi-host": API_HOST
    }

    params = {
        "date": fecha,
        "timezone": TIMEZONE
    }

    r = requests.get(API_URL, headers=headers, params=params, timeout=30)

    print("🌐 API-FOOTBALL status:", r.status_code)

    r.raise_for_status()

    data = r.json()

    if data.get("errors"):
        raise RuntimeError(f"API-FOOTBALL devolvió errores: {data.get('errors')}")

    return data.get("response", [])


def armar_json_tv(fixtures, rules, fecha):
    partidos = {}

    for item in fixtures:
        fixture = item.get("fixture") or {}
        league = item.get("league") or {}
        teams = item.get("teams") or {}
        status = fixture.get("status") or {}

        fixture_id = fixture.get("id")

        if not fixture_id:
            continue

        home = teams.get("home") or {}
        away = teams.get("away") or {}

        local = home.get("name") or "Local"
        visitante = away.get("name") or "Visitante"

        liga = league.get("name") or ""
        pais = league.get("country") or ""

        canales, fuente, confianza = buscar_canales(rules, pais, liga)
        canales = limpiar_canales(canales)

        partidos[str(fixture_id)] = {
            "fixture_id": fixture_id,
            "partido": f"{local} vs {visitante}",
            "local": local,
            "visitante": visitante,
            "local_id": home.get("id"),
            "visitante_id": away.get("id"),
            "liga": liga,
            "liga_id": league.get("id"),
            "pais": pais,
            "fecha": fixture.get("date", ""),
            "timestamp": fixture.get("timestamp"),
            "estado": {
                "long": status.get("long"),
                "short": status.get("short"),
                "elapsed": status.get("elapsed")
            },
            "canales": canales,
            "fuente": fuente,
            "confianza": confianza
        }

    return {
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "timezone": TIMEZONE,
        "fecha": fecha,
        "total": len(partidos),
        "partidos": partidos
    }


def main():
    os.makedirs("data", exist_ok=True)

    fecha = ahora_argentina().strftime("%Y-%m-%d")

    print(f"📺 Generando TV de partidos para {fecha}")

    rules = cargar_rules()
    fixtures = obtener_fixtures_del_dia(fecha)

    print(f"⚽ Fixtures recibidos: {len(fixtures)}")

    salida = armar_json_tv(fixtures, rules, fecha)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=2)

    print(f"✅ Generado {OUTPUT_FILE}")
    print(f"📌 Partidos procesados: {salida['total']}")


if __name__ == "__main__":
    main()
