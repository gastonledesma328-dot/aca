import json
import os
import re
import time
import unicodedata
from datetime import datetime, timezone
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.promiedos.com.ar"
SEED_URL = f"{BASE_URL}/league/liga-profesional/hc"
OUTPUT_FILE = "public/data/competiciones.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-AR,es;q=0.9,en;q=0.7",
    "Referer": BASE_URL,
}

# Orden parecido al menú de Promiedos.
MENU_GRUPOS = [
    {
        "grupo": "Destacado",
        "items": [
            "Liga Profesional",
            "Primera Nacional",
            "Libertadores",
            "Sudamericana",
            "Copa Argentina",
            "Champions",
            "Eliminatorias Conmebol",
            "Mundial",
        ],
    },
    {
        "grupo": "Argentina",
        "items": [
            "Liga Profesional",
            "Primera Nacional",
            "Copa Argentina",
            "Copa de la Liga",
            "Primera B Metro",
            "Federal A",
            "Primera C",
            "Promocional Amateur",
            "Liga Profesional - Reserva",
            "Liga Femenina",
            "Copa de la Liga - Reserva",
            "Tabla Historica",
        ],
    },
    {
        "grupo": "Internacional",
        "items": [
            "Copa Libertadores",
            "Copa Sudamericana",
            "Champions League",
            "Copa Intercontinental",
            "Europa League",
            "Conference League",
            "Mundial de Clubes",
            "Concacaf Champions",
        ],
    },
    {"grupo": "Inglaterra", "items": ["Premier League", "Carabao Cup", "FA Cup"]},
    {"grupo": "España", "items": ["La Liga", "Copa del Rey", "Supercopa"]},
    {"grupo": "Italia", "items": ["Serie A", "Coppa Italia", "Supercopa"]},
    {"grupo": "Alemania", "items": ["Bundesliga", "DFB Pokal"]},
    {"grupo": "Portugal", "items": ["Primeira Liga"]},
    {"grupo": "Francia", "items": ["Ligue 1", "Copa Francia"]},
    {"grupo": "Brasil", "items": ["Brasileirao", "Copa do Brasil"]},
    {"grupo": "Uruguay", "items": ["Primera división"]},
    {"grupo": "Paraguay", "items": ["Copa de primera"]},
    {"grupo": "Colombia", "items": ["Liga BetPlay"]},
    {"grupo": "Chile", "items": ["Primera división"]},
    {"grupo": "Mexico", "items": ["Liga MX"]},
    {"grupo": "EEUU", "items": ["MLS"]},
    {
        "grupo": "Selecciones",
        "items": [
            "Mundial Sub-20",
            "Copa America",
            "Eliminatorias Sudamericanas",
            "Eliminatorias UEFA",
            "Eurocopa",
            "UEFA Nations League",
            "Eliminatorias Eurocopa",
            "Mundial",
            "Sudamericano Sub20",
            "Eliminatorias Concacaf",
            "Repechaje Mundialista",
        ],
    },
]

ALIASES = {
    "libertadores": "Copa Libertadores",
    "sudamericana": "Copa Sudamericana",
    "champions": "Champions League",
    "eliminatorias conmebol": "Eliminatorias Sudamericanas",
    "primera division": "Primera división",
    "brasileirão": "Brasileirao",
    "méxico": "Mexico",
    "tabla histórica": "Tabla Historica",
}


def normalizar(texto):
    texto = str(texto or "").strip().lower()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = re.sub(r"[^a-z0-9\s.-]", " ", texto)
    texto = re.sub(r"\s+", " ", texto).strip()
    return ALIASES.get(texto, texto)


def limpiar_lineas(texto):
    lineas = []
    for linea in str(texto or "").splitlines():
        linea = re.sub(r"\s+", " ", linea).strip()
        if not linea:
            continue
        if linea.lower() in {"legal", "privacidad", "loading...", "logo"}:
            continue
        lineas.append(linea)
    return lineas


def get_html(url):
    response = requests.get(url, headers=HEADERS, timeout=35)
    response.raise_for_status()
    return response.text


def descubrir_links():
    html = get_html(SEED_URL)
    soup = BeautifulSoup(html, "html.parser")
    links = {}

    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if "/league/" not in href:
            continue

        label = re.sub(r"\s+", " ", a.get_text(" ", strip=True)).strip()
        if not label:
            continue

        url = urljoin(BASE_URL, href)
        links.setdefault(normalizar(label), {"label": label, "url": url})

    return links


def secciones_detectadas(lineas):
    joined = "\n".join(lineas).lower()
    secciones = []

    if "fixture y tablas" in joined:
        secciones.append("fixture_y_tablas")
    if "equipos y estadisticas" in joined or "equipos y estadísticas" in joined:
        secciones.append("equipos_y_estadisticas")
    if "campeones" in joined:
        secciones.append("campeones")
    if "cuadro" in joined:
        secciones.append("cuadro")
    if "posiciones" in joined:
        secciones.append("posiciones")

    return secciones


def recortar_contenido_principal(lineas, titulo):
    inicio = 0
    titulo_norm = normalizar(titulo)

    for i, linea in enumerate(lineas):
        if normalizar(linea) == titulo_norm:
            inicio = i
            break

    bloque = lineas[inicio:]

    cortar_en = len(bloque)
    for i, linea in enumerate(bloque):
        low = linea.lower()
        if i > 10 and ("el juego compulsivo" in low or "familia +18" in low or "família +18" in low):
            cortar_en = i
            break

    return bloque[:cortar_en]


def extraer_bloque(lineas, encabezado, max_lineas=80):
    start = None
    encabezado_norm = normalizar(encabezado)
    stop_words = {"cuadro", "posiciones", "fixture", "partidos", "campeones", "goleadores", "proxima fecha", "próxima fecha"}

    for i, linea in enumerate(lineas):
        if normalizar(linea) == encabezado_norm:
            start = i
            break

    if start is None:
        return []

    salida = []
    for linea in lineas[start + 1 : start + 1 + max_lineas]:
        if salida and normalizar(linea) in stop_words:
            break
        salida.append(linea)

    return salida


def parsear_competicion(nombre_menu, grupo, url):
    html = get_html(url)
    soup = BeautifulSoup(html, "html.parser")

    h1 = soup.find("h1")
    titulo = h1.get_text(" ", strip=True) if h1 else nombre_menu
    titulo = re.sub(r"\s+", " ", titulo).strip()

    lineas = limpiar_lineas(soup.get_text("\n"))
    contenido = recortar_contenido_principal(lineas, titulo)

    return {
        "id": normalizar(nombre_menu).replace(" ", "-"),
        "nombre": nombre_menu,
        "titulo": titulo,
        "grupo": grupo,
        "url": url,
        "secciones": secciones_detectadas(contenido),
        "resumen": contenido[:140],
        "cuadro": extraer_bloque(contenido, "CUADRO", 120),
        "posiciones": extraer_bloque(contenido, "POSICIONES", 80),
        "campeones": extraer_bloque(contenido, "CAMPEONES", 80),
    }


def main():
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    links = descubrir_links()
    competiciones = []
    grupos_finales = []
    vistos = set()

    for grupo in MENU_GRUPOS:
        items_finales = []

        for nombre in grupo["items"]:
            key = normalizar(nombre)
            link = links.get(key)

            if not link:
                # Si Promiedos cambió un texto, dejamos el item igual para la UI,
                # pero sin romper el workflow.
                items_finales.append({"nombre": nombre, "url": "", "disponible": False})
                continue

            items_finales.append({"nombre": nombre, "url": link["url"], "disponible": True})

            unique_key = f"{normalizar(nombre)}|{link['url']}"
            if unique_key in vistos:
                continue

            vistos.add(unique_key)

            try:
                competiciones.append(parsear_competicion(nombre, grupo["grupo"], link["url"]))
                print(f"OK {nombre}: {link['url']}")
                time.sleep(0.35)
            except Exception as exc:
                print(f"ERROR {nombre}: {exc}")
                competiciones.append({
                    "id": normalizar(nombre).replace(" ", "-"),
                    "nombre": nombre,
                    "titulo": nombre,
                    "grupo": grupo["grupo"],
                    "url": link["url"],
                    "secciones": [],
                    "resumen": [],
                    "error": str(exc),
                })

        grupos_finales.append({"grupo": grupo["grupo"], "items": items_finales})

    payload = {
        "fuente": "Promiedos",
        "seed": SEED_URL,
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "total": len(competiciones),
        "grupos": grupos_finales,
        "competiciones": competiciones,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"Generado {OUTPUT_FILE} con {len(competiciones)} competiciones")


if __name__ == "__main__":
    main()
