"""
reordenar_fechas_primera_nacional.py

Reordena las fechas del fixture de Primera Nacional según el orden oficial
de Promiedos (api.promiedos.com.ar), que refleja el calendario real del torneo.

Por qué esto es necesario:
  ESPN numera las fechas en el orden en que las carga, que no siempre coincide
  con el orden cronológico oficial. Promiedos usa el orden oficial de AFA.
  Este script usa la API de Promiedos para saber qué partido pertenece a qué
  jornada, y reasigna los números de fecha en consecuencia.

Robusto para temporadas futuras (2027, 2028...):
  - Lee el league_id desde primera_nacional_fechas.json (campo "promiedos_league_id")
    o usa el default "ebj" (Primera Nacional).
  - Mapea equipos ESPN → Promiedos con un diccionario ampliable.
  - Si un partido no se encuentra en Promiedos, conserva su fecha original.
  - Funciona aunque Promiedos no tenga todas las fechas aún (temporada en curso).
"""

import json
import time
import requests
from pathlib import Path

# ─── Configuración ────────────────────────────────────────────────────────────

PATHS = [
    Path("data/primera_nacional_fechas.json"),
    Path("public/data/primera_nacional_fechas.json"),
]

# ID de la liga en Promiedos. Cambiar si en 2027 Promiedos usa otro slug.
# También puede venir del JSON con el campo "promiedos_league_id".
PROMIEDOS_LEAGUE_ID_DEFAULT = "ebj"

# Mapa de nombres ESPN → nombres Promiedos
# Agregar entradas si en el futuro hay equipos nuevos con nombres distintos.
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


# ─── Helpers ──────────────────────────────────────────────────────────────────

def fetch_promiedos_fixture(league_id: str) -> dict:
    """
    Descarga el fixture completo desde la API de Promiedos.
    Devuelve un dict: { "home|away": fecha_num, ... }
    donde home y away son los nombres en formato Promiedos.
    """
    url = f"https://api.promiedos.com.ar/league/tables_and_fixtures/{league_id}"
    headers = {
        "Referer": "https://www.promiedos.com.ar/",
        "User-Agent": "Mozilla/5.0",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"  ⚠ No se pudo obtener fixture de Promiedos: {e}")
        return {}

    # La API devuelve estructura con itemevent / fixture
    # Intentamos extraer las fechas del fixture
    lookup = {}

    # Estructura observada: data puede contener "itemevent" con lista de fechas
    fixtures = data.get("itemevent") or data.get("fixture") or []
    if isinstance(fixtures, dict):
        fixtures = list(fixtures.values())

    for fecha_item in fixtures:
        if not isinstance(fecha_item, dict):
            continue
        # Número de fecha
        fecha_num = fecha_item.get("number") or fecha_item.get("num") or fecha_item.get("numero")
        if fecha_num is None:
            continue
        fecha_num = int(fecha_num)

        # Lista de partidos dentro de la fecha
        partidos = fecha_item.get("events") or fecha_item.get("partidos") or fecha_item.get("games") or []
        if isinstance(partidos, dict):
            partidos = list(partidos.values())

        for partido in partidos:
            if not isinstance(partido, dict):
                continue
            home = partido.get("home_name") or partido.get("home") or partido.get("local") or ""
            away = partido.get("away_name") or partido.get("away") or partido.get("visitante") or ""
            home = str(home).strip()
            away = str(away).strip()
            if home and away:
                lookup[f"{home}|{away}"] = fecha_num

    if lookup:
        print(f"  ✓ Promiedos API: {len(lookup)} partidos en {len(set(lookup.values()))} fechas")
    else:
        print(f"  ⚠ Promiedos API devolvió estructura vacía o desconocida. Usando scraping HTML como fallback.")

    return lookup


def fetch_promiedos_fixture_html(league_id: str) -> dict:
    """
    Fallback: scrapea la página HTML de Promiedos para obtener el fixture.
    Itera por cada fecha usando el endpoint de navegación.
    """
    lookup = {}
    base_url = f"https://www.promiedos.com.ar/league/{league_id.replace('_','-').replace(' ','-')}/ebj"

    # Intentamos con la API pública que usa el frontend JS
    # El frontend llama a: GET /league/tables_and_fixtures/ebj con cookies de sesión
    # Sin cookies esto devuelve {}. En su lugar, usamos requests con sesión.
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.promiedos.com.ar/",
        "Accept": "application/json",
        "Accept-Language": "es-AR,es;q=0.9",
    })

    # Primero visitamos la página para obtener cookies
    try:
        session.get(f"https://www.promiedos.com.ar/league/primera-nacional/{league_id}", timeout=10)
        time.sleep(1)
        resp = session.get(
            f"https://api.promiedos.com.ar/league/tables_and_fixtures/{league_id}",
            timeout=15
        )
        resp.raise_for_status()
        data = resp.json()
        if data:
            # Intentar parsear estructura alternativa
            for key, val in data.items():
                if isinstance(val, list):
                    for item in val:
                        if isinstance(item, dict) and ("home" in item or "local" in item):
                            fn = item.get("fecha") or item.get("jornada") or item.get("round")
                            h = item.get("home") or item.get("local", "")
                            a = item.get("away") or item.get("visitante", "")
                            if fn and h and a:
                                lookup[f"{h}|{a}"] = int(fn)
    except Exception as e:
        print(f"  ⚠ Fallback HTML también falló: {e}")

    return lookup


def build_promiedos_lookup(league_id: str) -> dict:
    """
    Intenta obtener el mapa home|away -> fecha_num de Promiedos.
    Devuelve dict vacío si no es posible (el script continúa sin reordenar).
    """
    lookup = fetch_promiedos_fixture(league_id)
    if not lookup:
        lookup = fetch_promiedos_fixture_html(league_id)
    return lookup


def reordenar_con_promiedos(data: dict, prom_lookup: dict) -> dict:
    """
    Reasigna el número de fecha de cada partido según Promiedos.
    Agrupa los partidos en nuevas fechas con el número correcto.
    Conserva todos los campos originales del partido y del JSON.
    """
    if not prom_lookup:
        print("  ⚠ Sin datos de Promiedos, el orden no se modifica.")
        return data

    # Inicializar 36 buckets (máximo esperado)
    max_fecha = max(prom_lookup.values()) if prom_lookup else 36
    max_fecha = max(max_fecha, 36)
    new_fechas_map = {}
    for i in range(1, max_fecha + 1):
        new_fechas_map[i] = {"numero": i, "nombre": f"Fecha {i}", "partidos": []}

    mapped = 0
    not_found = 0
    not_found_list = []

    for fecha in data.get("fechas", []):
        for partido in fecha.get("partidos", []):
            p = dict(partido)
            local_espn = p.get("local", "")
            visit_espn = p.get("visitante", "")

            # Traducir nombres ESPN → Promiedos
            local_prom = ESPN_TO_PROMIEDOS.get(local_espn, local_espn)
            visit_prom = ESPN_TO_PROMIEDOS.get(visit_espn, visit_espn)

            prom_key = f"{local_prom}|{visit_prom}"
            prom_num = prom_lookup.get(prom_key)

            if prom_num is not None:
                p["numero_fecha"] = prom_num
                p["fecha_torneo"] = prom_num
                new_fechas_map[prom_num]["partidos"].append(p)
                mapped += 1
            else:
                # No encontrado en Promiedos: conservar en fecha original
                orig_num = fecha.get("numero", 99)
                if orig_num not in new_fechas_map:
                    new_fechas_map[orig_num] = {"numero": orig_num, "nombre": f"Fecha {orig_num}", "partidos": []}
                new_fechas_map[orig_num]["partidos"].append(p)
                not_found += 1
                not_found_list.append(f"F{orig_num}: {local_espn} vs {visit_espn}")

    # Construir lista final ordenada, solo fechas con partidos
    new_fechas = [f for f in sorted(new_fechas_map.values(), key=lambda x: x["numero"]) if f["partidos"]]

    print(f"  ✓ Reordenados: {mapped} partidos OK, {not_found} sin encontrar en Promiedos")
    if not_found_list:
        for item in not_found_list[:10]:
            print(f"    - {item}")
        if len(not_found_list) > 10:
            print(f"    ... y {len(not_found_list) - 10} más")

    result = dict(data)
    result["fechas"] = new_fechas
    result["metodo_agrupacion"] = "promiedos_api"
    return result


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    # Leer JSON principal
    main_path = PATHS[0]
    if not main_path.exists():
        print(f"No existe {main_path}, saltando.")
        return

    with open(main_path, encoding="utf-8") as f:
        data = json.load(f)

    # Obtener league_id: del JSON o default
    league_id = data.get("promiedos_league_id") or PROMIEDOS_LEAGUE_ID_DEFAULT
    print(f"Reordenando Primera Nacional con Promiedos (league_id={league_id})...")

    # Obtener lookup de Promiedos
    prom_lookup = build_promiedos_lookup(league_id)

    # Aplicar reordenamiento
    data_reordenada = reordenar_con_promiedos(data, prom_lookup)

    # Guardar en todos los paths
    for path in PATHS:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data_reordenada, f, ensure_ascii=False, indent=2)
        print(f"  Guardado: {path}")

    print("✓ Reordenamiento completado.")


if __name__ == "__main__":
    main()
