import os
import re
import json
import unicodedata
import requests
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup

TIMEZONE = "America/Argentina/Buenos_Aires"
FUENTE_URL = "https://www.futbolenvivoargentina.com/"
OUTPUT_FILE = "data/tv_partidos.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
    "Referer": "https://www.futbolenvivoargentina.com/",
}

CANALES_IGNORAR = {
    "",
    ",",
    "|",
    "-",
    "–",
}

# Orden de prioridad visual en la app
ORDEN_CANALES = [
    "ESPN",
    "ESPN 2",
    "ESPN 3",
    "ESPN 4",
    "ESPN Premium",
    "Disney+ Premium",
    "DGO",
    "DSports",
    "DSports 1611",
    "DSPORTS+ Plus",
    "DIRECTV Sports",
    "TNT Sports",
    "TNT Sports Premium",
    "TNT Sports en HBO MAX",
    "TyC Sports",
    "TyC Sports Play",
    "TV Pública",
    "DeporTV",
    "Fox Sports",
    "Fox Sports 2",
    "Fox Sports 3",
    "RCN Nuestra Tele",
    "Apple TV",
    "OneFootball",
    "OneFootball PPV",
    "LPF Play",
]

ALIAS_CANAL = {
    "ESPN Premium": "ESPN Premium",
    "ESPN": "ESPN",
    "ESPN 2": "ESPN 2",
    "ESPN 3": "ESPN 3",
    "ESPN 4": "ESPN 4",

    "Disney+ Premium": "Disney+ Premium",
    "Disney Plus Premium": "Disney+ Premium",

    "DGO": "DGO",

    "DSports (610/1610)": "DSports",
    "DSports 1611 (611/1611)": "DSports 1611",
    "DSports 1611": "DSports 1611",
    "DSports": "DSports",

    "DSPORTS+ Plus (613/1613)": "DSPORTS+ Plus",
    "DSPORTS+ Plus": "DSPORTS+ Plus",
    "DSports+ Plus": "DSPORTS+ Plus",

    "DIRECTV Sports": "DIRECTV Sports",

    "TNT Sports Premium": "TNT Sports Premium",
    "TNT Sports": "TNT Sports",
    "TNT Sports en HBO MAX (Suscripción Pack fútbol)": "TNT Sports en HBO MAX",
    "TNT Sports en HBO MAX": "TNT Sports en HBO MAX",

    "TyC Sports": "TyC Sports",
    "TyC Sports Play": "TyC Sports Play",

    "Televisión Pública": "TV Pública",
    "Television Publica": "TV Pública",
    "TV Pública": "TV Pública",

    "Fox Sports": "Fox Sports",
    "Fox Sports 2": "Fox Sports 2",
    "Fox Sports 3": "Fox Sports 3",

    "Apple TV": "Apple TV",
    "OneFootball": "OneFootball",
    "OneFootball PPV": "OneFootball PPV",
    "LPF Play": "LPF Play",
}

PALABRAS_CANAL = [
    "espn",
    "disney",
    "dgo",
    "dsports",
    "directv",
    "tnt",
    "tyc",
    "tv pública",
    "tv publica",
    "deportv",
    "fox sports",
    "rcn nuestra tele",
    "apple tv",
    "onefootball",
    "lpf play",
    "youtube",
    "fifa+",
    "fifa plus",
    "fanatiz",
    "vix",
    "dazn",
    "bein",
    "liga futve",
    "j.league",
    "amazon prime video",
    "paramount",
    "win play",
    "tigo sports",
    "tcs go",
]

PALABRAS_NO_PARTIDO = {
    "ordenar:",
    "hora",
    "competición",
    "competicion",
    "resultados",
    "ver todo",
    "partidos de fútbol en vivo hoy",
    "partidos de futbol en vivo hoy",
}

PALABRAS_FIN = [
    "datos estadísticos",
    "datos estadisticos",
    "partidos televisados",
    "fútbol en vivo en argentina",
    "futbol en vivo en argentina",
    "la mayor información",
    "la mayor informacion",
]


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


def fecha_hoy_argentina():
    return ahora_argentina().date().strftime("%Y-%m-%d")


def extraer_fecha_desde_titulo(lineas):
    """
    Busca una línea tipo:
    Partidos de hoy miércoles, 13/5/2026
    """
    for linea in lineas:
        n = normalizar(linea)

        if "partidos de hoy" not in n:
            continue

        m = re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b", linea)

        if m:
            dia = int(m.group(1))
            mes = int(m.group(2))
            anio = int(m.group(3))
            return f"{anio:04d}-{mes:02d}-{dia:02d}"

    return fecha_hoy_argentina()


def limpiar_nombre_canal(canal):
    canal = limpiar_linea(canal)
    canal = canal.strip(" ,.-")

    if not canal:
        return ""

    # Limpieza de textos promocionales o variantes
    canal = canal.replace("Ver gratis", "").strip()
    canal = canal.replace("(Ver gratis)", "").strip()
    canal = re.sub(r"\s+", " ", canal)

    canal = ALIAS_CANAL.get(canal, canal)

    return canal.strip()


def prioridad_canal(canal):
    canal = limpiar_nombre_canal(canal)

    if canal in ORDEN_CANALES:
        return ORDEN_CANALES.index(canal)

    return 999


def es_canal_probable(linea):
    linea = limpiar_linea(linea)

    if not linea:
        return False

    n = normalizar(linea)

    if n in CANALES_IGNORAR:
        return False

    if n in PALABRAS_NO_PARTIDO:
        return False

    return any(p in n for p in PALABRAS_CANAL)


def limpiar_canales(canales):
    salida = []

    for canal in canales or []:
        canal = limpiar_nombre_canal(canal)

        if not canal:
            continue

        n = normalizar(canal)

        if n in CANALES_IGNORAR:
            continue

        if canal not in salida:
            salida.append(canal)

    salida.sort(key=prioridad_canal)

    return salida or ["A confirmar"]


def es_fase_o_ruido(linea):
    linea = limpiar_linea(linea)
    n = normalizar(linea)

    if not linea:
        return True

    if n in PALABRAS_NO_PARTIDO:
        return True

    if linea in ["*", "×"]:
        return True

    fases = [
        "final",
        "semifinal",
        "1/4 de final",
        "cuartos de final",
        "octavos de final",
        "playoff",
        "playoffs",
        "fase",
        "grupo",
        "jornada",
        "fecha",
        "partido único",
        "partido unico",
    ]

    return any(fase in n for fase in fases)


def es_fin_seccion(linea):
    n = normalizar(linea)
    return any(p in n for p in PALABRAS_FIN)


def obtener_html():
    print(f"🌐 Leyendo {FUENTE_URL}")

    r = requests.get(FUENTE_URL, headers=HEADERS, timeout=30)

    print(f"📡 Status {r.status_code}")

    r.raise_for_status()

    return r.text


def lineas_desde_html(html):
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()

    # Sacamos imágenes para que no dupliquen nombres con alt/title
    for img in soup.find_all("img"):
        img.decompose()

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


def buscar_inicio_agenda(lineas):
    for i, linea in enumerate(lineas):
        n = normalizar(linea)

        if n.startswith("partidos de hoy"):
            return i

    # Fallback por si cambia el título
    for i, linea in enumerate(lineas):
        n = normalizar(linea)

        if "partidos de futbol en vivo hoy" in n or "partidos de fútbol en vivo hoy" in n:
            return i

    return 0


def siguiente_linea_util(lineas, idx):
    j = idx + 1

    while j < len(lineas):
        linea = limpiar_linea(lineas[j])

        if linea:
            return linea

        j += 1

    return ""


def es_cabecera_competicion(lineas, idx):
    linea = limpiar_linea(lineas[idx])
    n = normalizar(linea)

    if not linea:
        return False

    if es_hora(linea):
        return False

    if es_canal_probable(linea):
        return False

    if es_fase_o_ruido(linea):
        return False

    if n.startswith("partidos de hoy"):
        return False

    if n in PALABRAS_NO_PARTIDO:
        return False

    siguiente = siguiente_linea_util(lineas, idx)

    return es_hora(siguiente)


def parece_nombre_equipo(linea):
    linea = limpiar_linea(linea)
    n = normalizar(linea)

    if not linea:
        return False

    if es_hora(linea):
        return False

    if es_canal_probable(linea):
        return False

    if es_fase_o_ruido(linea):
        return False

    if n.startswith("partidos de hoy"):
        return False

    if n in PALABRAS_NO_PARTIDO:
        return False

    if es_fin_seccion(linea):
        return False

    return True


def extraer_partido_desde_bloque(bloque):
    """
    Recibe líneas posteriores a una hora hasta antes de la próxima hora/competición.
    Intenta detectar:
    - fase opcional
    - local
    - visitante
    - canales
    """
    equipos = []
    canales = []
    fase = ""

    for linea in bloque:
        linea = limpiar_linea(linea)

        if not linea:
            continue

        if es_fase_o_ruido(linea):
            if not equipos and not fase and linea not in ["*", "×"]:
                fase = linea
            continue

        if len(equipos) < 2 and parece_nombre_equipo(linea):
            equipos.append(linea)
            continue

        if len(equipos) >= 2:
            if es_canal_probable(linea):
                canales.append(linea)
            else:
                # Algunos canales no tienen palabras muy obvias.
                # Si ya tenemos 2 equipos, todo lo siguiente hasta el próximo corte suele ser TV.
                if not es_fase_o_ruido(linea):
                    canales.append(linea)

    if len(equipos) < 2:
        return None

    local = equipos[0]
    visitante = equipos[1]

    canales = limpiar_canales(canales)

    return {
        "local": local,
        "visitante": visitante,
        "fase": fase,
        "canales": canales,
        "canales_raw": canales,
    }


def hora_iso(dia, hora):
    h = hora_normalizada(hora)

    if not h:
        h = "00:00"

    return f"{dia}T{h}:00"


def parsear_partidos_futbolenvivoargentina(html):
    lineas = lineas_desde_html(html)
    fecha_iso = extraer_fecha_desde_titulo(lineas)
    inicio = buscar_inicio_agenda(lineas)

    partidos = {}
    liga_actual = ""
    hora_actual = ""

    i = inicio

    while i < len(lineas):
        linea = limpiar_linea(lineas[i])
        n = normalizar(linea)

        if es_fin_seccion(linea):
            break

        if not linea:
            i += 1
            continue

        if es_cabecera_competicion(lineas, i):
            liga_actual = linea
            i += 1
            continue

        if es_hora(linea):
            hora_actual = hora_normalizada(linea)

            bloque = []
            j = i + 1

            while j < len(lineas):
                siguiente = limpiar_linea(lineas[j])

                if es_fin_seccion(siguiente):
                    break

                if es_hora(siguiente):
                    break

                if es_cabecera_competicion(lineas, j):
                    break

                bloque.append(siguiente)
                j += 1

            partido = extraer_partido_desde_bloque(bloque)

            if partido:
                local = partido["local"]
                visitante = partido["visitante"]

                partido_id = f"feva-{fecha_iso}-{slug(local)}-{slug(visitante)}"

                canales = partido["canales"]

                partidos[partido_id] = {
                    "id": partido_id,
                    "fixture_id": partido_id,
                    "partido": f"{local} vs {visitante}",
                    "local": local,
                    "visitante": visitante,
                    "liga": liga_actual,
                    "pais": "Argentina",
                    "fecha": hora_iso(fecha_iso, hora_actual),
                    "dia": fecha_iso,
                    "hora": hora_actual,
                    "fase": partido.get("fase", ""),
                    "estado": {
                        "long": "Programado",
                        "short": "Programado",
                        "elapsed": None,
                    },
                    "canales": canales,
                    "canales_raw": partido.get("canales_raw", canales),
                    "fuente": "Fútbol en Vivo Argentina",
                    "fuente_url": FUENTE_URL,
                    "confianza": "alta" if canales != ["A confirmar"] else "baja",
                }

            i = j
            continue

        i += 1

    return fecha_iso, partidos


def main():
    os.makedirs("data", exist_ok=True)

    html = obtener_html()
    fecha_iso, partidos = parsear_partidos_futbolenvivoargentina(html)

    salida = {
        "fuente": "Fútbol en Vivo Argentina",
        "metodo": "scraping HTML Partidos de hoy",
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "timezone": TIMEZONE,
        "fechas": [fecha_iso],
        "total": len(partidos),
        "partidos": partidos,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=2)

    print(f"📺 Generado {OUTPUT_FILE}")
    print(f"📌 Fecha: {fecha_iso}")
    print(f"📌 Total partidos TV: {salida['total']}")


if __name__ == "__main__":
    main()
