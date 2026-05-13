import os
import re
import json
import unicodedata
import requests
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup

TIMEZONE = "America/Argentina/Buenos_Aires"
BASE_URL = "https://www.livesoccertv.com"
OUTPUT_FILE = "data/tv_partidos.json"

# Cuántos días scrapea desde hoy.
# 1 = solo hoy
# 2 = hoy y mañana
LOOKAHEAD_DAYS = int(os.environ.get("LOOKAHEAD_DAYS", "2"))

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
    "Referer": "https://www.livesoccertv.com/es/",
}

CANALES_IGNORAR = {
    "bet365",
    "bet365.com",
}

PAISES_REGIONALES_A_LIMPIAR = [
    " argentina",
    " brazil",
    " brasil",
    " chile",
    " colombia",
    " uruguay",
    " peru",
    " perú",
    " ecuador",
    " paraguay",
    " bolivia",
    " mexico",
    " méxico",
    " usa",
    " canada",
    " canadá",
    " sur",
    " latin america",
    " internacional",
]

ALIAS_CANAL = {
    "ESPN Premium Argentina": "ESPN Premium",
    "TNT Sports Argentina": "TNT Sports",
    "Disney+ Premium Argentina": "Disney+",
    "DIRECTV Sports Argentina": "DSports",
    "DIRECTV Sports App": "DSports App",
    "DIRECTV Sports Argentina HD": "DSports",
    "ESPN Argentina": "ESPN",
    "ESPN2 Argentina": "ESPN 2",
    "ESPN3 Argentina": "ESPN 3",
    "ESPN4 Argentina": "ESPN 4",
    "Fox Sports Argentina": "Fox Sports",
    "TyC Sports Internacional": "TyC Sports Internacional",
    "Televisión Pública": "TV Pública",
    "Television Publica": "TV Pública",
    "TNT Sports Go Chile": "TNT Sports Go",
    "TNT SPORTS Premium": "TNT Sports Premium",
    "TNT SPORTS Premium HD": "TNT Sports Premium",
    "MLS Season Pass": "MLS Season Pass",
}

PALABRAS_CANAL_ARGENTINA = [
    "argentina",
    "espn premium",
    "tnt sports argentina",
    "directv sports argentina",
    "disney+ premium argentina",
    "televisión pública",
    "television publica",
    "tyc sports",
]

STATUS_LINES = {
    "en vivo",
    "fp",
    "posp.",
    "posp",
    "apl.",
    "apl",
    "cancelado",
    "suspendido",
    "final",
}


def ahora_argentina():
    return datetime.now(ZoneInfo(TIMEZONE))


def normalizar(texto):
    texto = str(texto or "").strip().lower()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = re.sub(r"\s+", " ", texto)
    return texto.strip()


def slug(texto):
    texto = normalizar(texto)
    texto = re.sub(r"[^a-z0-9]+", "-", texto)
    return texto.strip("-")


def limpiar_linea(linea):
    linea = str(linea or "")
    linea = linea.replace("\xa0", " ")
    linea = re.sub(r"\s+", " ", linea)
    return linea.strip()


def es_hora(linea):
    return bool(re.fullmatch(r"\d{1,2}:\d{2}", limpiar_linea(linea)))


def es_fecha_header(linea):
    n = normalizar(linea)
    meses = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
        "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep",
        "oct", "nov", "dec",
    ]
    return any(m in n for m in meses) and re.search(r"\d{1,2}", n)


def es_linea_competicion(linea):
    linea = limpiar_linea(linea)
    n = normalizar(linea)

    if not linea:
        return False

    if " vs " in n:
        return False

    if es_hora(linea):
        return False

    if "," in linea:
        return False

    if n in STATUS_LINES:
        return False

    if es_fecha_header(linea):
        return False

    # Ejemplo: Argentina - Liga Profesional
    return " - " in linea and len(linea) <= 80


def separar_pais_liga(linea):
    partes = limpiar_linea(linea).split(" - ", 1)

    if len(partes) == 2:
        return partes[0].strip(), partes[1].strip()

    return "", limpiar_linea(linea)


def extraer_equipos(partido):
    partido = limpiar_linea(partido)

    if " vs " in partido:
        local, visitante = partido.split(" vs ", 1)
        return limpiar_linea(local), limpiar_linea(visitante)

    if " v " in partido:
        local, visitante = partido.split(" v ", 1)
        return limpiar_linea(local), limpiar_linea(visitante)

    return "", ""


def limpiar_nombre_canal(canal):
    canal = limpiar_linea(canal)
    canal = canal.strip(" ,.-")

    if not canal:
        return ""

    canal = ALIAS_CANAL.get(canal, canal)

    # Normaliza algunas variantes comunes
    canal = canal.replace("ESPN2", "ESPN 2")
    canal = canal.replace("ESPN3", "ESPN 3")
    canal = canal.replace("ESPN4", "ESPN 4")

    return canal.strip()


def canal_es_argentino_o_util(canal):
    n = normalizar(canal)
    return any(p in n for p in PALABRAS_CANAL_ARGENTINA)


def limpiar_canales(canales_raw):
    if not canales_raw:
        return ["A confirmar"]

    candidatos = []

    for bloque in canales_raw:
        partes = re.split(r",|\|", str(bloque or ""))

        for parte in partes:
            canal = limpiar_nombre_canal(parte)

            if not canal:
                continue

            n = normalizar(canal)

            if n in CANALES_IGNORAR:
                continue

            if canal not in candidatos:
                candidatos.append(canal)

    if not candidatos:
        return ["A confirmar"]

    # Si hay canales específicos de Argentina, nos quedamos con esos.
    argentinos = [c for c in candidatos if canal_es_argentino_o_util(c)]

    if argentinos:
        salida = []

        for canal in argentinos:
            canal = limpiar_nombre_canal(canal)

            # Aplica alias otra vez después de filtrar
            canal = ALIAS_CANAL.get(canal, canal)

            if canal not in salida:
                salida.append(canal)

        return salida or ["A confirmar"]

    # Si no hay Argentina, guardamos canales reales pero sacamos apuestas.
    salida = []

    for canal in candidatos:
        canal = limpiar_nombre_canal(canal)

        if not canal:
            continue

        if normalizar(canal) in CANALES_IGNORAR:
            continue

        if canal not in salida:
            salida.append(canal)

    return salida[:6] if salida else ["A confirmar"]


def obtener_html(url):
    print(f"🌐 Leyendo {url}")

    r = requests.get(url, headers=HEADERS, timeout=30)

    print(f"📡 Status {r.status_code}")

    r.raise_for_status()

    return r.text


def lineas_desde_html(html):
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    texto = soup.get_text("\n")
    lineas = []

    for linea in texto.splitlines():
        linea = limpiar_linea(linea)

        if not linea:
            continue

        if linea in ["+", "×", "?", "PUBLICIDAD"]:
            continue

        lineas.append(linea)

    return lineas


def es_linea_partido(linea):
    n = normalizar(linea)

    if " vs " not in n:
        return False

    if len(linea) > 120:
        return False

    # Evita textos de navegación o noticias
    prohibidas = [
        "próximos partidos",
        "proximos partidos",
        "más partidos",
        "mas partidos",
        "noticias",
    ]

    return not any(p in n for p in prohibidas)


def es_fin_canales(linea):
    if es_hora(linea):
        return True

    if es_linea_competicion(linea):
        return True

    if es_linea_partido(linea):
        return True

    n = normalizar(linea)

    cortes = [
        "noticias",
        "suscríbete",
        "suscribete",
        "próximos partidos relevantes",
        "proximos partidos relevantes",
        "más partidos",
        "mas partidos",
        "boletín",
        "boletin",
    ]

    return any(c in n for c in cortes)


def parsear_partidos_livesoccertv(html, fecha_iso, url):
    lineas = lineas_desde_html(html)

    partidos = {}
    liga_actual = ""
    pais_actual = ""
    hora_actual = ""
    estado_actual = "Programado"

    i = 0

    while i < len(lineas):
        linea = lineas[i]
        n = normalizar(linea)

        if es_linea_competicion(linea):
            pais_actual, liga_actual = separar_pais_liga(linea)
            i += 1
            continue

        if n in STATUS_LINES:
            estado_actual = linea
            i += 1
            continue

        if es_hora(linea):
            hora_actual = linea
            estado_actual = "Programado"
            i += 1
            continue

        if es_linea_partido(linea):
            partido_nombre = linea
            local, visitante = extraer_equipos(partido_nombre)

            if not local or not visitante:
                i += 1
                continue

            canales_raw = []
            j = i + 1

            while j < len(lineas):
                siguiente = lineas[j]

                if es_fin_canales(siguiente):
                    break

                # Evita basura del layout
                ns = normalizar(siguiente)
                basura = [
                    "mostrar marcadores",
                    "ordenar por",
                    "liga hora",
                    "language",
                    "elige un dia",
                    "elige un día",
                ]

                if not any(b in ns for b in basura):
                    canales_raw.append(siguiente)

                j += 1

            canales = limpiar_canales(canales_raw)

            partido_id = f"lstv-{fecha_iso}-{slug(local)}-{slug(visitante)}"

            partidos[partido_id] = {
                "id": partido_id,
                "fixture_id": partido_id,
                "partido": f"{local} vs {visitante}",
                "local": local,
                "visitante": visitante,
                "liga": liga_actual,
                "pais": pais_actual,
                "fecha": f"{fecha_iso}T{hora_actual or '00:00'}:00",
                "dia": fecha_iso,
                "hora": hora_actual,
                "estado": {
                    "long": estado_actual,
                    "short": estado_actual,
                    "elapsed": None,
                },
                "canales": canales,
                "fuente": "Live Soccer TV",
                "fuente_url": url,
                "confianza": "alta" if canales != ["A confirmar"] else "baja",
            }

            i = j
            continue

        i += 1

    return partidos


def url_para_fecha(fecha):
    hoy = ahora_argentina().date()

    if fecha == hoy:
        return f"{BASE_URL}/es/"

    return f"{BASE_URL}/es/schedules/{fecha.strftime('%Y-%m-%d')}/"


def main():
    os.makedirs("data", exist_ok=True)

    hoy = ahora_argentina().date()
    todos = {}
    fechas = []

    for offset in range(LOOKAHEAD_DAYS):
        fecha = hoy + timedelta(days=offset)
        fecha_iso = fecha.strftime("%Y-%m-%d")
        url = url_para_fecha(fecha)

        try:
            html = obtener_html(url)
            partidos = parsear_partidos_livesoccertv(html, fecha_iso, url)

            print(f"✅ {fecha_iso}: {len(partidos)} partidos con TV encontrados")

            todos.update(partidos)
            fechas.append(fecha_iso)

        except Exception as e:
            print(f"⚠️ Error scrapeando {fecha_iso}: {e}")

    salida = {
        "fuente": "Live Soccer TV",
        "metodo": "scraping HTML agenda diaria",
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "timezone": TIMEZONE,
        "fechas": fechas,
        "total": len(todos),
        "partidos": todos,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=2)

    print(f"📺 Generado {OUTPUT_FILE}")
    print(f"📌 Total partidos TV: {salida['total']}")


if __name__ == "__main__":
    main()
