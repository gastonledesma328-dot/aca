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
    "fanatiz",
    "fubotv",
    "fubo tv",
    "fubo",
    "betmgm",
}

# Páginas específicas de canales argentinos en Live Soccer TV.
# Algunas URLs pueden no devolver datos si Live Soccer TV cambia el slug,
# pero el script no se rompe: solo las omite.
CHANNELS_ARG = {
    "ESPN": [
        "https://www.livesoccertv.com/channels/espn-sur/",
        "https://www.livesoccertv.com/channels/espn-argentina/",
    ],
    "ESPN 2": [
        "https://www.livesoccertv.com/channels/espn2-sur/",
        "https://www.livesoccertv.com/channels/espn-2-sur/",
        "https://www.livesoccertv.com/channels/espn2-argentina/",
    ],
    "ESPN 3": [
        "https://www.livesoccertv.com/channels/espn3-sur/",
        "https://www.livesoccertv.com/channels/espn-3-sur/",
        "https://www.livesoccertv.com/channels/espn3-argentina/",
    ],
    "ESPN 4": [
        "https://www.livesoccertv.com/channels/espn4-sur/",
        "https://www.livesoccertv.com/channels/espn-4-sur/",
        "https://www.livesoccertv.com/channels/espn4-argentina/",
    ],
    "ESPN Premium": [
        "https://www.livesoccertv.com/channels/fox-sports-premium-argentina/",
        "https://www.livesoccertv.com/channels/espn-premium-argentina/",
    ],
    "DGO": [
        "https://www.livesoccertv.com/channels/directv-sports-app/",
        "https://www.livesoccertv.com/channels/dgo/",
    ],
    "DIRECTV Sports": [
        "https://www.livesoccertv.com/channels/directv-argentina/",
        "https://www.livesoccertv.com/channels/directv-sports-argentina/",
    ],
    "Disney+ Premium": [
        "https://www.livesoccertv.com/channels/starplus-sur/",
        "https://www.livesoccertv.com/channels/disney-plus-premium-argentina/",
        "https://www.livesoccertv.com/channels/disney-premium-argentina/",
    ],
    "TNT Sports": [
        "https://www.livesoccertv.com/channels/tnt-sports-argentina/",
    ],
    "TyC Sports": [
        "https://www.livesoccertv.com/channels/tyc-sports-argentina/",
    ],
    "TyC Sports Internacional": [
        "https://www.livesoccertv.com/channels/tyc-sports-internacional/",
    ],
    "TV Pública": [
        "https://www.livesoccertv.com/channels/tv-publica-argentina/",
    ],
}

# Canales argentinos que queremos priorizar especialmente
CANALES_PRIORIDAD_ARGENTINA = [
    "ESPN Argentina",
    "ESPN2 Argentina",
    "ESPN3 Argentina",
    "ESPN4 Argentina",
    "DGO",
    "DIRECTV Sports Argentina",
    "DIRECTV Sports Argentina HD",
    "DIRECTV Sports App",
    "DIRECTV Sports App Argentina",
    "Disney+ Premium Argentina",
    "TNT Sports Argentina",
    "TNT Sports Go Argentina",
    "TyC Sports Argentina",
    "TyC Sports Internacional",
    "ESPN Premium Argentina",
    "Fox Sports Argentina",
    "Televisión Pública",
    "Television Publica",
]

# Nombres limpios para mostrar en tu app
ALIAS_CANAL = {
    "ESPN Argentina": "ESPN",
    "ESPN2 Argentina": "ESPN 2",
    "ESPN3 Argentina": "ESPN 3",
    "ESPN4 Argentina": "ESPN 4",

    "ESPN 2 Argentina": "ESPN 2",
    "ESPN 3 Argentina": "ESPN 3",
    "ESPN 4 Argentina": "ESPN 4",

    "ESPN Premium Argentina": "ESPN Premium",

    "DGO": "DGO",
    "DIRECTV Sports Argentina": "DIRECTV Sports",
    "DIRECTV Sports Argentina HD": "DIRECTV Sports",
    "DIRECTV Sports App": "DGO",
    "DIRECTV Sports App Argentina": "DGO",
    "DirecTV Sports Argentina": "DIRECTV Sports",

    "Disney+ Premium Argentina": "Disney+ Premium",

    "TNT Sports Argentina": "TNT Sports",
    "TNT Sports Go Argentina": "TNT Sports Go",
    "TNT SPORTS Premium": "TNT Sports Premium",
    "TNT SPORTS Premium HD": "TNT Sports Premium",

    "TyC Sports Argentina": "TyC Sports",
    "TyC Sports Internacional": "TyC Sports Internacional",

    "Fox Sports Argentina": "Fox Sports",
    "Televisión Pública": "TV Pública",
    "Television Publica": "TV Pública",

    "MLS Season Pass": "MLS Season Pass",
}

PALABRAS_CANAL_ARGENTINA = [
    "espn argentina",
    "espn2 argentina",
    "espn 2 argentina",
    "espn3 argentina",
    "espn 3 argentina",
    "espn4 argentina",
    "espn 4 argentina",
    "espn premium argentina",
    "dgo",
    "directv sports argentina",
    "directv sports app",
    "directv sports",
    "dsports",
    "disney+ premium argentina",
    "tnt sports argentina",
    "tnt sports go argentina",
    "tyc sports argentina",
    "tyc sports internacional",
    "fox sports argentina",
    "television publica",
    "televisión pública",
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


def hora_normalizada(hora):
    hora = limpiar_linea(hora)

    m = re.fullmatch(r"(\d{1,2}):(\d{2})", hora)
    if not m:
        return ""

    return f"{int(m.group(1)):02d}:{m.group(2)}"


def es_fecha_header(linea):
    n = normalizar(linea)

    meses = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
        "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep",
        "oct", "nov", "dec",
    ]

    return any(m in n for m in meses) and re.search(r"\d{1,2}", n)


def parsear_fecha_header(linea, anio_default=None):
    """
    Intenta leer fechas tipo:
    - Miércoles, 13 de mayo
    - 13 mayo
    - May 13
    - 2026-05-13
    """
    texto = normalizar(linea)
    anio_default = anio_default or ahora_argentina().year

    m_iso = re.search(r"\b(20\d{2})-(\d{1,2})-(\d{1,2})\b", texto)
    if m_iso:
        return f"{int(m_iso.group(1)):04d}-{int(m_iso.group(2)):02d}-{int(m_iso.group(3)):02d}"

    meses = {
        "enero": 1,
        "febrero": 2,
        "marzo": 3,
        "abril": 4,
        "mayo": 5,
        "junio": 6,
        "julio": 7,
        "agosto": 8,
        "septiembre": 9,
        "setiembre": 9,
        "octubre": 10,
        "noviembre": 11,
        "diciembre": 12,
        "jan": 1,
        "january": 1,
        "feb": 2,
        "february": 2,
        "mar": 3,
        "march": 3,
        "apr": 4,
        "april": 4,
        "may": 5,
        "jun": 6,
        "june": 6,
        "jul": 7,
        "july": 7,
        "aug": 8,
        "august": 8,
        "sep": 9,
        "sept": 9,
        "september": 9,
        "oct": 10,
        "october": 10,
        "nov": 11,
        "november": 11,
        "dec": 12,
        "december": 12,
    }

    anio_match = re.search(r"\b(20\d{2})\b", texto)
    anio = int(anio_match.group(1)) if anio_match else anio_default

    # 13 de mayo / 13 mayo
    m = re.search(r"\b(\d{1,2})\b(?:\s+de)?\s+([a-záéíóúñ]+)", texto)
    if m:
        dia = int(m.group(1))
        mes_txt = m.group(2)

        if mes_txt in meses:
            return f"{anio:04d}-{meses[mes_txt]:02d}-{dia:02d}"

    # may 13 / mayo 13
    m = re.search(r"\b([a-záéíóúñ]+)\s+(\d{1,2})\b", texto)
    if m:
        mes_txt = m.group(1)
        dia = int(m.group(2))

        if mes_txt in meses:
            return f"{anio:04d}-{meses[mes_txt]:02d}-{dia:02d}"

    return ""


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

    reemplazos_previos = {
        "ESPN 2 Argentina": "ESPN2 Argentina",
        "ESPN 3 Argentina": "ESPN3 Argentina",
        "ESPN 4 Argentina": "ESPN4 Argentina",
        "DirecTV Sports Argentina": "DIRECTV Sports Argentina",
        "DIRECTV Sports App Argentina": "DIRECTV Sports App",
        "TyC Sports": "TyC Sports Argentina",
    }

    canal = reemplazos_previos.get(canal, canal)
    canal = ALIAS_CANAL.get(canal, canal)

    # Normaliza variantes que puedan venir pegadas
    canal = canal.replace("ESPN2", "ESPN 2")
    canal = canal.replace("ESPN3", "ESPN 3")
    canal = canal.replace("ESPN4", "ESPN 4")

    return canal.strip()


def canal_es_argentino_o_util(canal):
    n = normalizar(canal)
    n_sin_espacios = n.replace(" ", "")

    patrones = [
        "espn argentina",
        "espn2 argentina",
        "espn 2 argentina",
        "espn3 argentina",
        "espn 3 argentina",
        "espn4 argentina",
        "espn 4 argentina",
        "espn premium argentina",
        "dgo",
        "directv sports argentina",
        "directv sports app",
        "disney+ premium argentina",
        "tnt sports argentina",
        "tnt sports go argentina",
        "tyc sports argentina",
        "tyc sports internacional",
        "fox sports argentina",
        "television publica",
        "televisión pública",
    ]

    if any(p in n for p in patrones):
        return True

    if "espn2argentina" in n_sin_espacios:
        return True

    if "espn3argentina" in n_sin_espacios:
        return True

    if "espn4argentina" in n_sin_espacios:
        return True

    return False


def prioridad_canal(canal):
    canal_limpio = limpiar_nombre_canal(canal)

    orden = [
        "ESPN",
        "ESPN 2",
        "ESPN 3",
        "ESPN 4",
        "ESPN Premium",
        "DGO",
        "DIRECTV Sports",
        "Disney+ Premium",
        "TNT Sports",
        "TNT Sports Premium",
        "TNT Sports Go",
        "TyC Sports",
        "TyC Sports Internacional",
        "Fox Sports",
        "TV Pública",
    ]

    if canal_limpio in orden:
        return orden.index(canal_limpio)

    return 999


def limpiar_canales(canales_raw):
    if not canales_raw:
        return ["A confirmar"]

    candidatos = []

    for bloque in canales_raw:
        partes = re.split(r",|\|", str(bloque or ""))

        for parte in partes:
            canal_original = limpiar_linea(parte)

            if not canal_original:
                continue

            if canal_original in [",", "|", "-", "–"]:
                continue

            n_original = normalizar(canal_original)

            if n_original in CANALES_IGNORAR:
                continue

            canal = limpiar_nombre_canal(canal_original)

            if not canal:
                continue

            n = normalizar(canal)

            if n in CANALES_IGNORAR:
                continue

            if canal not in candidatos:
                candidatos.append(canal)

    if not candidatos:
        return ["A confirmar"]

    # Solo guardamos canales útiles para Argentina.
    argentinos = []

    for canal in candidatos:
        if canal_es_argentino_o_util(canal):
            limpio = limpiar_nombre_canal(canal)

            if limpio and limpio not in argentinos:
                argentinos.append(limpio)

    if argentinos:
        argentinos.sort(key=prioridad_canal)
        return argentinos

    # Si Live Soccer TV solo trae canales de otros países,
    # no los guardamos como canales principales para no ensuciar la grilla.
    return ["A confirmar"]


def agregar_canal(canales, canal):
    canal = limpiar_nombre_canal(canal)

    if not canal:
        return canales or ["A confirmar"]

    actuales = []

    for c in canales or []:
        c = limpiar_nombre_canal(c)

        if c and c != "A confirmar" and c not in actuales:
            actuales.append(c)

    if canal not in actuales:
        actuales.append(canal)

    actuales.sort(key=prioridad_canal)

    return actuales or ["A confirmar"]


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

    if es_fecha_header(linea):
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


def limpiar_canales_raw(canales_raw):
    salida = []

    for item in canales_raw or []:
        item = limpiar_linea(item)

        if not item:
            continue

        if item in [",", "|", "-", "–"]:
            continue

        n = normalizar(item)

        if n in CANALES_IGNORAR:
            continue

        if item not in salida:
            salida.append(item)

    return salida


def key_match(dia, local, visitante):
    return f"{dia}|{slug(local)}|{slug(visitante)}"


def key_match_reverse(dia, local, visitante):
    return f"{dia}|{slug(visitante)}|{slug(local)}"


def hora_iso(dia, hora):
    h = hora_normalizada(hora)

    if not h:
        h = "00:00"

    return f"{dia}T{h}:00"


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
            hora_actual = hora_normalizada(linea)
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

            canales_raw_limpios = limpiar_canales_raw(canales_raw)
            canales = limpiar_canales(canales_raw_limpios)

            partido_id = f"lstv-{fecha_iso}-{slug(local)}-{slug(visitante)}"

            partidos[partido_id] = {
                "id": partido_id,
                "fixture_id": partido_id,
                "partido": f"{local} vs {visitante}",
                "local": local,
                "visitante": visitante,
                "liga": liga_actual,
                "pais": pais_actual,
                "fecha": hora_iso(fecha_iso, hora_actual),
                "dia": fecha_iso,
                "hora": hora_actual,
                "estado": {
                    "long": estado_actual,
                    "short": estado_actual,
                    "elapsed": None,
                },
                "canales": canales,
                "canales_raw": canales_raw_limpios,
                "fuente": "Live Soccer TV",
                "fuente_url": url,
                "confianza": "alta" if canales != ["A confirmar"] else "baja",
            }

            i = j
            continue

        i += 1

    return partidos


def parsear_partidos_de_canal(html, canal_nombre, url, fechas_validas):
    """
    Lee una página de canal de Live Soccer TV y devuelve partidos
    donde ese canal aparece confirmado.
    """
    lineas = lineas_desde_html(html)

    partidos = {}
    fecha_actual = ""
    liga_actual = ""
    pais_actual = ""
    hora_actual = ""
    estado_actual = "Programado"

    hoy = ahora_argentina().date()
    anio_default = hoy.year

    # Si la página del canal no muestra header de fecha claro,
    # usamos hoy como fecha inicial.
    fecha_actual = hoy.strftime("%Y-%m-%d")

    i = 0

    while i < len(lineas):
        linea = lineas[i]
        n = normalizar(linea)

        if es_fecha_header(linea):
            fecha_parseada = parsear_fecha_header(linea, anio_default=anio_default)

            if fecha_parseada:
                fecha_actual = fecha_parseada

            i += 1
            continue

        if fecha_actual not in fechas_validas:
            # Igual seguimos leyendo para detectar si cambia la fecha más adelante.
            if es_linea_competicion(linea):
                pais_actual, liga_actual = separar_pais_liga(linea)
            elif es_hora(linea):
                hora_actual = hora_normalizada(linea)
            i += 1
            continue

        if es_linea_competicion(linea):
            pais_actual, liga_actual = separar_pais_liga(linea)
            i += 1
            continue

        if n in STATUS_LINES:
            estado_actual = linea
            i += 1
            continue

        if es_hora(linea):
            hora_actual = hora_normalizada(linea)
            estado_actual = "Programado"
            i += 1
            continue

        if es_linea_partido(linea):
            local, visitante = extraer_equipos(linea)

            if not local or not visitante:
                i += 1
                continue

            partido_id = f"lstv-{fecha_actual}-{slug(local)}-{slug(visitante)}"

            partidos[partido_id] = {
                "id": partido_id,
                "fixture_id": partido_id,
                "partido": f"{local} vs {visitante}",
                "local": local,
                "visitante": visitante,
                "liga": liga_actual,
                "pais": pais_actual,
                "fecha": hora_iso(fecha_actual, hora_actual),
                "dia": fecha_actual,
                "hora": hora_actual,
                "estado": {
                    "long": estado_actual,
                    "short": estado_actual,
                    "elapsed": None,
                },
                "canales": [canal_nombre],
                "canales_raw": [canal_nombre],
                "fuente": "Live Soccer TV - canal",
                "fuente_url": url,
                "confianza": "alta",
            }

            i += 1
            continue

        i += 1

    return partidos


def url_para_fecha(fecha):
    hoy = ahora_argentina().date()

    if fecha == hoy:
        return f"{BASE_URL}/es/"

    return f"{BASE_URL}/es/schedules/{fecha.strftime('%Y-%m-%d')}/"


def indexar_partidos(partidos):
    indice = {}

    for partido_id, partido in partidos.items():
        dia = partido.get("dia") or ""
        local = partido.get("local") or ""
        visitante = partido.get("visitante") or ""

        if not dia or not local or not visitante:
            continue

        indice[key_match(dia, local, visitante)] = partido_id
        indice[key_match_reverse(dia, local, visitante)] = partido_id

    return indice


def combinar_partido(destino, nuevo):
    canales_actuales = destino.get("canales") or []
    canales_nuevos = nuevo.get("canales") or []

    for canal in canales_nuevos:
        canales_actuales = agregar_canal(canales_actuales, canal)

    raw_actual = destino.get("canales_raw") or []
    raw_nuevo = nuevo.get("canales_raw") or []

    for item in raw_nuevo:
        item = limpiar_linea(item)

        if item and item not in raw_actual:
            raw_actual.append(item)

    destino["canales"] = canales_actuales
    destino["canales_raw"] = limpiar_canales_raw(raw_actual)
    destino["confianza"] = "alta" if canales_actuales != ["A confirmar"] else "baja"

    fuentes = destino.get("fuentes_tv") or []

    for fuente in [
        {
            "fuente": nuevo.get("fuente", "Live Soccer TV"),
            "url": nuevo.get("fuente_url", ""),
            "canales": canales_nuevos,
        }
    ]:
        if fuente not in fuentes:
            fuentes.append(fuente)

    destino["fuentes_tv"] = fuentes

    return destino


def sumar_partidos_de_canales(todos, fechas_validas):
    indice = indexar_partidos(todos)

    for canal_nombre, urls in CHANNELS_ARG.items():
        for url in urls:
            try:
                html = obtener_html(url)
                partidos_canal = parsear_partidos_de_canal(
                    html,
                    canal_nombre,
                    url,
                    fechas_validas,
                )

                print(f"📺 Canal {canal_nombre}: {len(partidos_canal)} partidos encontrados en {url}")

                for partido_id, partido_canal in partidos_canal.items():
                    k1 = key_match(
                        partido_canal.get("dia"),
                        partido_canal.get("local"),
                        partido_canal.get("visitante"),
                    )

                    k2 = key_match_reverse(
                        partido_canal.get("dia"),
                        partido_canal.get("local"),
                        partido_canal.get("visitante"),
                    )

                    existente_id = indice.get(k1) or indice.get(k2)

                    if existente_id and existente_id in todos:
                        todos[existente_id] = combinar_partido(todos[existente_id], partido_canal)
                    else:
                        todos[partido_id] = partido_canal
                        indice[k1] = partido_id
                        indice[k2] = partido_id

            except Exception as e:
                print(f"⚠️ Error leyendo canal {canal_nombre} en {url}: {e}")

    return todos


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

            print(f"✅ Agenda {fecha_iso}: {len(partidos)} partidos encontrados")

            todos.update(partidos)
            fechas.append(fecha_iso)

        except Exception as e:
            print(f"⚠️ Error scrapeando agenda {fecha_iso}: {e}")

    fechas_validas = set(fechas)

    # Segundo paso: revisar páginas específicas de canales argentinos.
    # Esto mejora muchísimo la detección de ESPN, DGO, DIRECTV, TNT, TyC, Disney+.
    todos = sumar_partidos_de_canales(todos, fechas_validas)

    salida = {
        "fuente": "Live Soccer TV",
        "metodo": "scraping HTML agenda diaria + páginas de canales argentinos",
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "timezone": TIMEZONE,
        "fechas": fechas,
        "total": len(todos),
        "canales_priorizados": list(CHANNELS_ARG.keys()),
        "partidos": todos,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=2)

    print(f"📺 Generado {OUTPUT_FILE}")
    print(f"📌 Total partidos TV: {salida['total']}")


if __name__ == "__main__":
    main()
