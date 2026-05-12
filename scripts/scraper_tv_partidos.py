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


def buscar_canales(rules, pais, liga):
    pais = str(pais or "").strip()
    liga = str(liga or "").strip()

    pais_norm = normalizar(pais)
    liga_norm = normalizar(liga)

    # 1. Coincidencia exacta por país y liga
    if pais in rules:
        ligas_pais = rules[pais]

        if liga in ligas_pais:
            return ligas_pais[liga], "regla_exacta", "alta"

        for nombre_liga, canales in ligas_pais.items():
            nombre_liga_norm = normalizar(nombre_liga)

            if nombre_liga_norm == liga_norm:
                return canales, "regla_exacta_normalizada", "alta"

            if nombre_liga_norm in liga_norm or liga_norm in nombre_liga_norm:
                return canales, "regla_flexible", "media"

    # 2. Coincidencia por país normalizado
    for pais_rule, ligas_pais in rules.items():
        if pais_rule == "default":
            continue

        if normalizar(pais_rule) != pais_norm:
            continue

        if not isinstance(ligas_pais, dict):
            continue

        for nombre_liga, canales in ligas_pais.items():
            nombre_liga_norm = normalizar(nombre_liga)

            if nombre_liga_norm == liga_norm:
                return canales, "regla_pais_normalizado", "alta"

            if nombre_liga_norm in liga_norm or liga_norm in nombre_liga_norm:
                return canales, "regla_pais_flexible", "media"

    # 3. Reglas continentales por texto de liga
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

    if "champions league" in liga_norm:
        return ["ESPN", "Disney+"], "regla_europa", "media"

    if "europa league" in liga_norm:
        return ["ESPN", "Disney+"], "regla_europa", "media"

    if "conference league" in liga_norm:
        return ["ESPN", "Disney+"], "regla_europa", "media"

    # 4. Fallback
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
        status = (fixture.get("status") or {})

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
