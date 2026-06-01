"""
generar_fixture_map_promiedos.py

Script de ejecución UNICA al inicio de cada temporada.
Consulta Promiedos para obtener el orden oficial de las fechas
y guarda el mapa "local_espn|visitante_espn" -> numero_fecha en:
  data/promiedos_fixture_map.json
  public/data/promiedos_fixture_map.json

Este mapa luego es consumido por generar_fechas_primera_nacional.py
en cada ejecución del workflow, SIN volver a consultar Promiedos.

Cuándo ejecutar:
  - Al inicio de cada temporada nueva (2027, 2028...)
  - Si AFA modifica el fixture oficial a mitad de torneo
  - Manualmente: python scripts/generar_fixture_map_promiedos.py
  - O disparar el workflow "Generar Fixture Map Promiedos" desde GitHub Actions

Configuración para nueva temporada:
  1. Cambiar PROMIEDOS_LEAGUE_ID si Promiedos usa otro slug
  2. Agregar entradas a ESPN_TO_PROMIEDOS_map si hay equipos nuevos
  3. Ejecutar el script
"""

import json
import time
import requests
from pathlib import Path

# ─── Configuración ────────────────────────────────────────────────────────────

PROMIDDOS_LEAGUE_ID = "ebj"          # Primera Nacional 2026. Cambiar si cambia en 2027+.
PROMIDEOS_URL = "https://www.promiedos.com.ar/league/primera-nacional"
PROMIEDOS_API = f"https://api.promiedos.com.ar/league/tables_and_fixtures/{PROMIEDOS_LEAGUE}ID}"

OUTPUT_PATHS = [
    Path("data/promiedos_fixture_map.json"),
    Path("public/data/promiedos_fixture_map.json"),
]

# Mapa de nombres ESPN → nombres Promiedos.
# Agregar entradas cuando cambien equipos entre temporadas.
ESPN_TO_PROMIEDOS = {
    "Acassuso": "Acassuso",
    "Agropecuario": "Agropecuario",
    "All Boys": "All Boys",
    "Almagro": "Almagro",
    "Almirante Brown": "Alte. Brown",
    "Atlanta": "Atlanta",
    "Atletico Rafaela": "Atlético Rafaela",
    "Central Norte": "Central Norte",
    "Chacarita Juniors": "Chacarita",
    "Chaco For Ever": "Chaco For Ever",
    "Ciudad de Bolívar": "Bolivar",
    "Colegiales": "Colegiales",
    "Colón (Santa Fe)": "Colón",
    "Defensores de Belgrano": "Defensores",
    "Deportivo Madryn": "Dep. Madryn",
    "Deportivo Maipú": "Maipú",
    "Deportivo Morón": "Morón",
    "Estudiantes (Buenos Aires)": "Estudiantes",
    "Ferro Carril Oeste": "Ferro",
    "Gimnasia y Esgrima (Jujuy)": "Gimnasia (J)",
    "Gimnasia y Tiro (Salta)": "Gimnasia y Tiro",
    "Godoy Cruz Antonio Tomba": "Godoy Cruz",
    "Güemes": "Güemes",
    "Los Andes": "Los Andes",
    "Midland": "Midland",
    "Mitre (Santiago del Estero)": "CA Mitre",
    "Nueva Chicago": "Chicago",
    "Patronato": "Patronato",
    "Quilmes": "Quilmes",
    "Racing (Córdoba)": "Racing (Cba)",
    "San Martín (San Juan)": "San Martín",
    "San Martín (Tucumán)": "San Martín (T)",
    "San Miguel": "San Miguel",
    "San Telmo": "San Telmo",
    "Temperley": "Temperley",
    "Tristán Suárez": "Tristan Suárez",
}

# Mapa inverso: Promiedos → ESPN (se genera automáticamente)
PROMIEDOS_TO_ESPN = {v: k for k, v in ESPN_TO_PROMIEDOS.items()}


# ─── Scraping Promiedos ────────────────────────────────────────────────────────────

def fetch_fixture_con_sesion() -> list:
    """
    Obtiene el fixture de Promiedos usando una sesión con cookies.
    Devuelve lista de dicts: [{home_prom, away_prom, fecha_num, date}, ...]
    """
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "es-AR,es;q=0.9",
        "Referer": "https://www.promiedos.com.ar/",
    })

    # Paso 1: visitar la página para obtener cookies de sesión
    print("  Obteniendo cookies de sesión de Promiedos...")
    try:
        session.get(f"{PROMIEDOS_URL}/{PROMIDEOS_LEAGUE_ID}", timeout=15)
        time.sleep(1.5)
    except Exception as e:
        print(f"  ⚠ No se pudo cargar la página: {e}")

    # Paso 2: consultar la API con las cookies
    print(f"  Consultando API: {PROMIEDOS_API}")
    try:
        resp = session.get(PROMIEDOS_API, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"  ✕ Error en API: {e}")
        return []

    if not data:
        print("  ✕ API devolvió respuesta vacía")
        return []

    # Parsear estructura: buscar lista de fechas con partidos
    partidos = []
    fixtures = (
        data.get("itemevent") or
        data.get("fixture") or
        data.get("fechas") or
        []
    )
    if isinstance(fixtures, dict):
        fixtures = list(fixtures.values())

    for fecha_item in fixtures:
        if not isinstance(fecha_item, dict):
            continue
        fecha_num = (
            fecha_item.get("number") or
            fecha_item.get("num") or
            fecha_item.get("numero")
        )
        if fecha_num is None:
            continue
        fecha_num = int(fecha_num)

        events = (
            fecha_item.get("events") or
            fecha_item.get("partidos") or
            fecha_item.get("games") or
            []
        )
        if isinstance(events, dict):
            events = list(events.values())

        for ev in events:
            if not isinstance(ev, dict):
                continue
            home = str(ev.get("home_name") or ev.get("home") or ev.get("local") or "").strip()
            away = str(ev.get("away_name") or ev.get("away") or ev.get("visitante") or "").strip()
            date_str = str(ev.get("date") or ev.get("dia") or ev.get("fecha") or "").strip()
            if home and away:
                partidos.append({"home_prom": home, "away_prom": away, "fecha_num": fecha_num, "date": date_str})

    print(f"  ✓ {len(partidos)} partidos en {len(set(p['fecha_num'] for p in partidos))} fechas")
    return partidos


def build_map(partidos_prom: list) -> dict:
    """
    Construye el mapa ESPN_key -> fecha_num.
    ESPN_key = "local_espn|visitante_espn"
    """
    fixture_map = {}
    sin_mapear = []

    for p in partidos_prom:
        home_prom = p["home_prom"]
        away_prom = p["away_prom"]
        fecha_num = p["fecha_num"]

        # Traducir de Promiedos a ESPN
        home_espn = PROMIEDOS_TO_ESPH.get(home_prom)
        away_espn = PROMIDEOS_TO_ESPN.get(away_prom)

        if home_espn and away_espn:
            espn_key = f"{home_espn}|{away_espn}"
            fixture_map[espn_key] = fecha_num
        else:
            sin_mapear.append(f"{home_prom} vs {away_prom} (F{fecha_num})")

    if sin_mapear:
        print(f"  ⚠ {len(sin_mapear)} partidos sin mapear ESPN&nbsp;↔Promiedos:")
        for item in sin_mapear[:10]:
            print(f"    - {item}")
        print("    → Agregar entradas en ESPN_TO_PROMIEDOS_map y regenerar.")

    return fixture_map


def main():
    print(f"Generando fixture map desde Promiedos (league_id={PROMIEDOS_LEAGUE}ID})...")
    print("Este script solo se ejecuta UNA VEZ por temporada.\n")

    # Obtener datos de Promiedos
    partidos = fetch_fixture_con_sesion()
    if not partidos:
        print("✕ No se pudo obtener el fixture de Promiedos. Abortando.")
        return

    # Construir mapa ESPN_key → numero_fecha
    fixture_map = build_map(partidos)
    print(f"\n  ↓ {len(fixture_map)} pares local|visitante mapeados")

    # Estructura del archivo de salida
    output = {
        "descripcion": "Mapa de fixture oficial de Promiedos. Generado UNA VEZ por temporada.",
        "promiedos_league_id": PROMIEDOS_LEAGUE__ID,
        "total_partidos": len(fixture_map),
        "espn_to_promiedos": ESPN_TO_PROMIEDOS,
        "fixture_map": fixture_map,
    }

    # Guardar
    for path in OUTPUT_PATHS:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(f"  Guardado: {path}")

    print("\n✓ Fixture map generado. El workflow ahora usará este archivo")
    print("  para asignar fechas sin volver a consultar Promiedos.")


if __name__ == "__main__":
    main()
