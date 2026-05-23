import asyncio
import json
import os
import re
import unicodedata
from pathlib import Path

import requests
from playwright.async_api import async_playwright


EQUIPOS_FILE = "equipos.json"

DATA_DIR = Path("data/adivina-jugador")
GAME_DIR = Path("juegos/adivinajugador")

OUTPUT_JSON = DATA_DIR / "plantilla_365_jugadores.json"
OUTPUT_SIMPLE_JSON = DATA_DIR / "plantilla_365_jugadores_simple.json"

# Las imágenes se guardan solo en la carpeta del juego para no duplicar miles de archivos.
GAME_IMAGES_DIR = GAME_DIR / "imagenes_jugadores_365"

GAME_JSON = GAME_DIR / "jugadores.json"

FUENTE = "365Scores"

# Mapeo para cuando equipos.json viene desde tu JSON viejo de equipos
# y no trae url de 365Scores.
EQUIPOS_365_FALLBACK = {
    "boca-juniors": {
        "equipo": "Boca Juniors",
        "url": "https://www.365scores.com/es/football/team/boca-juniors-866/squad"
    },
    "river-plate": {
        "equipo": "River Plate",
        "url": "https://www.365scores.com/es/football/team/river-plate-868/squad"
    },
    "racing-club": {
        "equipo": "Racing Club",
        "url": "https://www.365scores.com/es/football/team/racing-club-876/squad"
    },
    "independiente": {
        "equipo": "Independiente",
        "url": "https://www.365scores.com/es/football/team/independiente-870/squad"
    },
    "san-lorenzo": {
        "equipo": "San Lorenzo",
        "url": "https://www.365scores.com/es/football/team/san-lorenzo-873/squad"
    },
    "arsenal": {
        "equipo": "Arsenal",
        "url": "https://www.365scores.com/es/football/team/arsenal-104/squad"
    },
    "manchester-city": {
        "equipo": "Manchester City",
        "url": "https://www.365scores.com/es/football/team/manchester-city-110/squad"
    },
    "liverpool": {
        "equipo": "Liverpool",
        "url": "https://www.365scores.com/es/football/team/liverpool-108/squad"
    },
    "real-madrid": {
        "equipo": "Real Madrid",
        "url": "https://www.365scores.com/es/football/team/real-madrid-131/squad"
    },
    "barcelona": {
        "equipo": "Barcelona",
        "url": "https://www.365scores.com/es/football/team/fc-barcelona-132/squad"
    },
    "atletico-madrid": {
        "equipo": "Atlético de Madrid",
        "url": "https://www.365scores.com/es/football/team/atletico-madrid-134/squad"
    },
    "inter-miami": {
        "equipo": "Inter Miami CF",
        "url": "https://www.365scores.com/es/football/team/inter-miami-54729/squad"
    },
}

LIGAS_POR_EQUIPO_365 = {
    "arsenal": "Premier League",
    "manchester city": "Premier League",
    "liverpool": "Premier League",
    "chelsea": "Premier League",
    "manchester united": "Premier League",
    "tottenham hotspur": "Premier League",

    "real madrid": "LaLiga",
    "barcelona": "LaLiga",
    "fc barcelona": "LaLiga",
    "atlético de madrid": "LaLiga",
    "atletico de madrid": "LaLiga",
    "sevilla": "LaLiga",
    "real sociedad": "LaLiga",
    "villarreal": "LaLiga",

    "inter milan": "Serie A",
    "juventus": "Serie A",
    "ac milan": "Serie A",
    "napoli": "Serie A",
    "roma": "Serie A",
    "lazio": "Serie A",

    "bayern münchen": "Bundesliga",
    "bayern munchen": "Bundesliga",
    "bayern munich": "Bundesliga",
    "borussia dortmund": "Bundesliga",
    "bayer leverkusen": "Bundesliga",
    "rb leipzig": "Bundesliga",

    "paris saint-germain": "Ligue 1",
    "psg": "Ligue 1",
    "olympique de marseille": "Ligue 1",
    "as monaco": "Ligue 1",
    "monaco": "Ligue 1",
    "olympique lyonnais": "Ligue 1",
    "lyon": "Ligue 1",

    "benfica": "Primeira Liga",
    "fc porto": "Primeira Liga",
    "sporting cp": "Primeira Liga",

    "ajax amsterdam": "Eredivisie",
    "ajax": "Eredivisie",
    "psv eindhoven": "Eredivisie",
    "feyenoord": "Eredivisie",

    "boca juniors": "Liga Profesional Argentina",
    "river plate": "Liga Profesional Argentina",
    "racing club": "Liga Profesional Argentina",
    "independiente": "Liga Profesional Argentina",
    "san lorenzo": "Liga Profesional Argentina",

    "flamengo": "Brasileirão",
    "palmeiras": "Brasileirão",
    "santos": "Brasileirão",
    "corinthians": "Brasileirão",
    "são paulo": "Brasileirão",
    "sao paulo": "Brasileirão",

    "atlético nacional": "Categoría Primera A",
    "atletico nacional": "Categoría Primera A",
    "millonarios": "Categoría Primera A",
    "junior fc": "Categoría Primera A",

    "inter miami cf": "MLS",
    "inter miami": "MLS",
    "lafc": "MLS",
    "seattle sounders": "MLS",

    "al nassr": "Saudi Pro League",
    "al hilal": "Saudi Pro League",
    "al ahli": "Saudi Pro League",

    "galatasaray": "Süper Lig",
    "fenerbahçe": "Süper Lig",
    "fenerbahce": "Süper Lig",
    "beşiktaş": "Süper Lig",
    "besiktas": "Süper Lig",

    "club américa": "Liga MX",
    "club america": "Liga MX",
    "cruz azul": "Liga MX",
    "tigres uanl": "Liga MX",
}


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Referer": "https://www.365scores.com/",
}


def limpiar_texto(txt):
    if not txt:
        return ""
    return re.sub(r"\s+", " ", str(txt)).strip()


def normalizar(txt):
    txt = str(txt or "").strip().lower()
    txt = unicodedata.normalize("NFD", txt)
    txt = "".join(c for c in txt if unicodedata.category(c) != "Mn")
    txt = re.sub(r"\s+", " ", txt)
    return txt.strip()


def limpiar_competicion(valor):
    comp = limpiar_texto(valor)

    if not comp:
        return ""

    n = normalizar(comp)

    invalidas = {
        "365scores",
        "365 scores",
        "fuente 365scores",
        "fuente",
        "-",
        "sin datos",
        "liga sin dato",
    }

    if n in invalidas:
        return ""

    return comp



def slugify(text):
    text = normalizar(text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    return text or "jugador"


def extension_desde_url(url):
    url_limpia = str(url or "").split("?")[0].lower()

    for ext in [".png", ".jpg", ".jpeg", ".webp", ".avif"]:
        if url_limpia.endswith(ext):
            return ext.replace(".jpeg", ".jpg")

    return ".png"



def extraer_athlete_id_desde_imagen(url):
    """
    Extrae el ID de atleta desde URLs tipo:
    .../v21/Athletes/66391
    .../Athletes/42367
    """
    if not url:
        return ""

    match = re.search(r"/Athletes/(\d+)", str(url), re.I)

    if match:
        return match.group(1)

    return ""


def extraer_athlete_version_desde_imagen(url):
    """
    Conserva la versión si viene en la URL, por ejemplo /v21/Athletes/66391.
    Si no existe versión, usa v1.
    """
    if not url:
        return "v1"

    match = re.search(r"/(v\d+)/Athletes/\d+", str(url), re.I)

    if match:
        return match.group(1)

    return "v1"


def imagen_365_alta_calidad(url):
    """
    Convierte cualquier imagen de 365Scores de baja calidad a una URL 400x400.
    Ejemplo:
    https://imagecache.365scores.com/image/upload/f_png,w_400,h_400,c_limit,q_auto:best,dpr_2,d_Athletes:default.png,r_max,c_thumb,g_face,z_0.65/v1/Athletes/42367
    """
    athlete_id = extraer_athlete_id_desde_imagen(url)

    if not athlete_id:
        return url or ""

    version = extraer_athlete_version_desde_imagen(url)

    return (
        "https://imagecache.365scores.com/image/upload/"
        "f_png,w_400,h_400,c_limit,q_auto:best,dpr_2,"
        "d_Athletes:default.png,r_max,c_thumb,g_face,z_0.65/"
        f"{version}/Athletes/{athlete_id}"
    )



def sacar_equipo_id_desde_url(url):
    match = re.search(r"team/[^/]+-(\d+)", url or "")
    return match.group(1) if match else ""


def obtener_nombre_equipo(equipo):
    return limpiar_texto(
        equipo.get("equipo")
        or equipo.get("nombre")
        or equipo.get("name")
        or equipo.get("club")
        or "Equipo"
    )


def obtener_url_equipo(equipo):
    """
    Acepta varios formatos para evitar que el workflow quede en 0 jugadores.
    Si tu equipos.json viene desde data/equipos.json y no trae URL,
    intenta armar la URL usando EQUIPOS_365_FALLBACK.
    """
    url = (
        equipo.get("url")
        or equipo.get("link")
        or equipo.get("squad")
        or equipo.get("squad_url")
        or equipo.get("plantel_url")
        or equipo.get("url_365scores")
        or equipo.get("href")
        or ""
    )

    url = limpiar_texto(url)

    if url:
        if "/squad" not in url:
            url = url.rstrip("/") + "/squad"
        return url

    # Fallback por id del equipo.
    equipo_id = normalizar(equipo.get("id", ""))
    equipo_nombre_slug = slugify(
        equipo.get("equipo")
        or equipo.get("nombre")
        or equipo.get("name")
        or equipo.get("club")
        or ""
    )

    for key in [equipo_id, equipo_nombre_slug]:
        if key in EQUIPOS_365_FALLBACK:
            return EQUIPOS_365_FALLBACK[key]["url"]

    return ""


def obtener_liga_equipo(equipo):
    """
    Devuelve la liga donde juega el equipo.
    1) Usa liga/competicion/league del equipos.json si existe y no es 365Scores.
    2) Si no existe, usa un mapeo interno por nombre del equipo.
    """
    liga = limpiar_competicion(
        equipo.get("liga")
        or equipo.get("competicion")
        or equipo.get("competition")
        or equipo.get("league")
        or equipo.get("torneo")
        or ""
    )

    if liga:
        return liga

    nombre = obtener_nombre_equipo(equipo)
    return LIGAS_POR_EQUIPO_365.get(normalizar(nombre), "")


def cargar_equipos():
    if not os.path.exists(EQUIPOS_FILE):
        ejemplo = [
            {
                "equipo": "Racing Club",
                "url": "https://www.365scores.com/es/football/team/racing-club-876/squad"
            }
        ]

        with open(EQUIPOS_FILE, "w", encoding="utf-8") as f:
            json.dump(ejemplo, f, ensure_ascii=False, indent=2)

        print(f"⚠️ No existía {EQUIPOS_FILE}. Se creó uno de ejemplo.")
        return ejemplo

    with open(EQUIPOS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("equipos.json debe ser una lista.")

    equipos_limpios = []

    for equipo in data:
        if not isinstance(equipo, dict):
            continue

        nombre = obtener_nombre_equipo(equipo)
        url = obtener_url_equipo(equipo)

        equipo_id = normalizar(equipo.get("id", ""))
        equipo_nombre_slug = slugify(nombre)

        fallback = EQUIPOS_365_FALLBACK.get(equipo_id) or EQUIPOS_365_FALLBACK.get(equipo_nombre_slug)

        if fallback:
            nombre = fallback.get("equipo") or nombre
            if not url:
                url = fallback.get("url", "")

        liga = obtener_liga_equipo({
            **equipo,
            "equipo": nombre,
            "url": url
        })

        equipos_limpios.append({
            **equipo,
            "equipo": nombre,
            "url": url,
            "liga": liga
        })

    return equipos_limpios


def asegurar_carpetas():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    GAME_DIR.mkdir(parents=True, exist_ok=True)
    GAME_IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def es_url_imagen_valida_365(url):
    if not url:
        return False

    low = url.lower()

    if "athletes/" not in low:
        return False

    basura = [
        "/website/",
        "appstore",
        "googleplay",
        "badge",
        "store",
        "favicon"
    ]

    if any(x in low for x in basura):
        return False

    return True



def buscar_imagen_existente(nombre_archivo):
    """
    Si la imagen ya está cargada en la carpeta del juego,
    no vuelve a descargarla. Devuelve la ruta relativa que usa el juego.
    """
    extensiones = [".png", ".jpg", ".jpeg", ".webp", ".avif"]

    for ext in extensiones:
        game_path = GAME_IMAGES_DIR / f"{nombre_archivo}{ext}"

        if game_path.exists() and game_path.stat().st_size > 0:
            return f"imagenes_jugadores_365/{nombre_archivo}{ext}"

    return ""


def descargar_imagen(url, nombre_archivo):
    existente = buscar_imagen_existente(nombre_archivo)

    if existente:
        print(f"♻️ Imagen ya cargada, omito descarga: {existente}")
        return existente

    url = imagen_365_alta_calidad(url)

    if not es_url_imagen_valida_365(url):
        return ""

    ext = extension_desde_url(url)

    game_path = GAME_IMAGES_DIR / f"{nombre_archivo}{ext}"
    rel_game_path = f"imagenes_jugadores_365/{nombre_archivo}{ext}"

    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        print(f"🖼️ {r.status_code} imagen alta calidad {url}")

        if not r.ok:
            return ""

        content_type = r.headers.get("content-type", "").lower()

        if "image" not in content_type:
            return ""

        game_path.write_bytes(r.content)

        return rel_game_path

    except Exception as e:
        print(f"❌ Error descargando imagen {url}: {e}")
        return ""


def limpiar_jugador_para_juego(j):
    competicion_limpia = limpiar_competicion(j.get("competicion", ""))

    return {
        "id": j.get("id", ""),
        "nombre": j.get("nombre", ""),
        "club": j.get("club", ""),
        "club_id": j.get("club_id", ""),
        "pais": j.get("pais", ""),
        "posicion": j.get("posicion", ""),
        "competicion": obtener_liga_por_club(j.get("club", "")) or limpiar_competicion(j.get("competicion", "")),
        "numero": j.get("numero", ""),
        "edad": j.get("edad", ""),
        "fecha_nacimiento": j.get("fecha_nacimiento", ""),
        "altura": j.get("altura", ""),
        "fin_contrato": j.get("fin_contrato", ""),
        "imagen": j.get("imagen", ""),
        "imagen_url": j.get("imagen_url", ""),
        "url_365scores": j.get("url_365scores", ""),
        "fuente": FUENTE,
    }


def es_staff_o_no_jugador(nombre, texto):
    """
    Filtro de staff/entrenadores.
    No descartamos por cualquier palabra suelta, pero sí por frases claras
    de biografía de entrenador y por nombres conocidos que 365Scores mete
    como si fueran jugadores dentro del plantel.
    """
    n = normalizar(nombre)
    t = normalizar(texto)

    frases_staff = [
        "entrenador de futbol",
        "entrenador de fútbol",
        "entrenador portugues",
        "entrenador portugués",
        "entrenador argentino",
        "entrenador espanol",
        "entrenador español",
        "football coach",
        "head coach",
        "manager",
        "director tecnico",
        "director técnico",
        "cuerpo tecnico",
        "cuerpo técnico",
    ]

    if any(frase in t for frase in frases_staff):
        return True

    nombres_staff_comunes = {
        "mikel arteta",
        "pep guardiola",
        "arne slot",
        "diego simeone",
        "hans-dieter flick",
        "hansi flick",
        "cristian chivu",
        "alvaro arbeloa",
        "gabriel heinze",
        "nelson vivas",
        "pepijn lijnders",
        "sipke hulshoff",
        "marcus sorg",
        "toni tapalovic",
        "aleksandar kolarov",
        "claudio ubeda",
        "eduardo coudet",
        "leonardo jardim",
    }

    return n in nombres_staff_comunes


def normalizar_posicion(pos):
    p = normalizar(pos)

    if not p:
        return ""

    if any(x in p for x in ["arquero", "portero", "goalkeeper"]):
        return "Portero"

    if any(x in p for x in ["defensa", "defensor", "defender", "centre back", "center back", "left back", "right back", "lateral"]):
        return "Defensa"

    if any(x in p for x in ["mediocampista", "medio", "volante", "midfielder"]):
        return "Mediocampista"

    if any(x in p for x in ["delantero", "forward", "striker", "extremo", "winger", "attacker"]):
        return "Delantero"

    return limpiar_texto(pos)



def altura_a_cm(valor):
    """
    Convierte altura tipo "1.89" o "1,89" a 189.
    Si ya viene como "189", devuelve 189.
    """
    raw = limpiar_texto(valor).replace(",", ".")

    if not raw:
        return ""

    try:
        n = float(raw)
    except Exception:
        return ""

    if 1.0 <= n <= 2.5:
        return int(round(n * 100))

    if 100 <= n <= 250:
        return int(round(n))

    return ""


def extraer_datos_desde_body_365(nombre, body_text):
    """
    Extrae datos visibles desde el perfil individual de 365Scores.
    Ejemplo:
    Franco Armani (Argentina, 39) es un jugador...
    39 años
    16/10/1986
    1.89
    Altura
    1
    Dorsal
    """
    body = limpiar_texto(body_text)
    datos = {
        "pais": "",
        "edad": "",
        "fecha_nacimiento": "",
        "altura": "",
        "numero": "",
        "competicion": "",
        "fin_contrato": "",
    }

    # País y edad desde la frase principal.
    # Franco Armani (Argentina, 39) ...
    patron = re.escape(nombre) + r"\s*\(([^,()]+),\s*(\d{1,2})\)"
    m = re.search(patron, body, re.I)

    if not m:
        m = re.search(r"\(([^,()]+),\s*(\d{1,2})\)\s+es un jugador", body, re.I)

    if m:
        datos["pais"] = limpiar_texto(m.group(1))
        datos["edad"] = limpiar_texto(m.group(2))

    # Fecha nacimiento.
    m = re.search(r"\b(\d{1,2}/\d{1,2}/\d{4})\b", body)
    if m:
        datos["fecha_nacimiento"] = m.group(1)

    # Edad desde bloque de detalles.
    if not datos["edad"]:
        m = re.search(r"\b(\d{1,2})\s+años\b", body, re.I)
        if m:
            datos["edad"] = m.group(1)

    # Altura: suele aparecer como "1.89 Altura".
    m = re.search(r"\b([12][,.]\d{2})\s+Altura\b", body, re.I)
    if m:
        datos["altura"] = altura_a_cm(m.group(1))

    # Dorsal: suele aparecer como "1 Dorsal".
    m = re.search(r"\b(\d{1,3})\s+Dorsal\b", body, re.I)
    if m:
        datos["numero"] = m.group(1)

    # Fin de contrato: "Fin del contrato 31/12/2026".
    m = re.search(r"Fin del contrato\s+(\d{1,2}/\d{1,2}/\d{4})", body, re.I)
    if m:
        datos["fin_contrato"] = m.group(1)

    # Competición principal: primera competición que aparece en estadísticas.
    # Evita usar "365Scores" como liga.
    posibles_ligas = [
        "Liga Profesional Argentina",
        "Premier League",
        "LaLiga",
        "Serie A",
        "Bundesliga",
        "Ligue 1",
        "Brasileirão",
        "MLS",
        "Liga MX",
        "Eredivisie",
        "Primeira Liga",
        "CONMEBOL Copa Libertadores",
        "CONMEBOL Copa Sudamericana",
        "UEFA Champions League",
        "UEFA Europa League",
        "Copa Argentina",
        "Copa del Rey",
        "Coppa Italia",
        "DFB-Pokal",
    ]

    for liga in posibles_ligas:
        if liga.lower() in body.lower():
            datos["competicion"] = liga
            break

    return datos


def tiene_datos_completos(player):
    """
    Sirve para ahorrar tiempo en siguientes corridas.
    Si ya existe el jugador con imagen y datos básicos, no entra al perfil otra vez.
    """
    return bool(
        player.get("imagen")
        and player.get("pais")
        and player.get("posicion")
        and player.get("edad")
        and player.get("altura")
    )


def cargar_jugadores_existentes():
    """
    Lee el JSON actual del juego para reutilizar datos ya cargados.
    """
    if not GAME_JSON.exists():
        return {}

    try:
        data = json.loads(GAME_JSON.read_text(encoding="utf-8"))
    except Exception:
        return {}

    existentes = {}

    if not isinstance(data, list):
        return existentes

    for j in data:
        if not isinstance(j, dict):
            continue

        key = f"{normalizar(j.get('club'))}|{normalizar(j.get('nombre'))}|{j.get('id', '')}"
        existentes[key] = j

        key_sin_id = f"{normalizar(j.get('club'))}|{normalizar(j.get('nombre'))}|"
        existentes[key_sin_id] = j

    return existentes


def buscar_jugador_existente(jugador, existentes):
    key = f"{normalizar(jugador.get('club'))}|{normalizar(jugador.get('nombre'))}|{jugador.get('id', '')}"
    key_sin_id = f"{normalizar(jugador.get('club'))}|{normalizar(jugador.get('nombre'))}|"

    return existentes.get(key) or existentes.get(key_sin_id) or None




async def cerrar_cookies_o_popups(page):
    textos = [
        "Aceptar",
        "Acepto",
        "Aceptar todo",
        "Accept",
        "Accept all",
        "OK",
        "Entendido"
    ]

    for texto in textos:
        try:
            btn = page.get_by_role("button", name=re.compile(texto, re.I))
            if await btn.count() > 0:
                await btn.first.click(timeout=1500)
                await page.wait_for_timeout(700)
                return
        except Exception:
            pass


async def hacer_scroll(page):
    for y in [0, 700, 1400, 2300, 3400, 4600, 6000, 7600, 9500, 12000]:
        try:
            await page.evaluate(f"window.scrollTo(0, {y})")
            await page.wait_for_timeout(550)
        except Exception:
            pass


async def extraer_jugadores_del_plantel(page, equipo_nombre, equipo_url, equipo_liga=''):
    equipo_id = sacar_equipo_id_desde_url(equipo_url)

    jugadores = await page.evaluate(
        """
        ({ equipoNombre, equipoId }) => {
            const BASE = location.origin;
            const anchors = Array.from(document.querySelectorAll('a[href*="/football/player/"]'));
            const map = new Map();

            function clean(s) {
                return String(s || "").replace(/\\s+/g, " ").trim();
            }

            function playerIdFromHref(href) {
                const m = href.match(/-(\\d+)(?:\\?|#|$)/);
                return m ? m[1] : href;
            }

            function getImgSrc(img) {
                if (!img) return "";
                if (img.currentSrc) return img.currentSrc;
                if (img.src) return img.src;
                if (img.getAttribute("data-src")) return img.getAttribute("data-src");

                const srcset = img.getAttribute("srcset");
                if (srcset) {
                    const parts = srcset
                        .split(",")
                        .map(x => x.trim().split(" ")[0])
                        .filter(Boolean);

                    if (parts.length) return parts[parts.length - 1];
                }

                return "";
            }

            function hasPlayerImage(src) {
                const low = String(src || "").toLowerCase();
                return low.includes("athletes/");
            }

            function getBestCard(a) {
                let card = a;

                for (let i = 0; i < 8; i++) {
                    if (!card.parentElement) break;

                    const next = card.parentElement;
                    const links = next.querySelectorAll('a[href*="/football/player/"]').length;
                    const txt = clean(next.innerText || next.textContent || "");

                    if (links === 1 && txt.length >= 2 && txt.length <= 260) {
                        card = next;
                    } else if (links > 1) {
                        break;
                    } else {
                        card = next;
                    }
                }

                return card;
            }

            function guessName(a, card) {
                const img = a.querySelector("img") || card.querySelector("img");

                if (img && clean(img.alt)) {
                    return clean(img.alt);
                }

                const aria = clean(a.getAttribute("aria-label"));
                if (aria) return aria;

                const text = clean(a.innerText || a.textContent || "");
                if (!text) return "";

                const parts = text
                    .split(/\\n|\\r|\\t|•|·/)
                    .map(clean)
                    .filter(Boolean);

                if (parts.length) return parts[0];

                return text;
            }

            function guessPosition(cardText, sectionText) {
                const source = `${sectionText} ${cardText}`.toLowerCase();

                const checks = [
                    ["Portero", ["portero", "arquero", "goalkeeper"]],
                    ["Defensa", ["defensa", "defensor", "defender", "centre back", "center back", "left back", "right back", "lateral"]],
                    ["Mediocampista", ["mediocampista", "medio", "volante", "midfielder"]],
                    ["Delantero", ["delantero", "forward", "striker", "extremo", "winger", "attacker"]]
                ];

                for (const [label, words] of checks) {
                    if (words.some(w => source.includes(w))) return label;
                }

                return "";
            }

            function findSectionText(card) {
                let node = card;

                for (let up = 0; up < 6; up++) {
                    if (!node || !node.parentElement) break;

                    const parent = node.parentElement;
                    const children = Array.from(parent.children);
                    const idx = children.indexOf(node);

                    for (let i = idx - 1; i >= Math.max(0, idx - 8); i--) {
                        const txt = clean(children[i].innerText || children[i].textContent || "");
                        const low = txt.toLowerCase();

                        if (
                            low.includes("portero") ||
                            low.includes("arquero") ||
                            low.includes("defensa") ||
                            low.includes("defensor") ||
                            low.includes("mediocampista") ||
                            low.includes("delantero") ||
                            low.includes("plantilla")
                        ) {
                            return txt;
                        }
                    }

                    node = parent;
                }

                return "";
            }

            function guessNumber(cardText) {
                const lines = String(cardText || "")
                    .split(/\\n|\\r|\\t/)
                    .map(clean)
                    .filter(Boolean);

                for (const line of lines) {
                    if (/^#?\\d{1,2}$/.test(line)) {
                        return line.replace("#", "");
                    }
                }

                return "";
            }

            for (const a of anchors) {
                const hrefRaw = a.getAttribute("href");
                if (!hrefRaw) continue;

                const href = new URL(hrefRaw, BASE).href;
                const id = playerIdFromHref(href);

                const card = getBestCard(a);
                const cardText = clean(card.innerText || card.textContent || "");

                const name = guessName(a, card);

                if (!name || name.length < 2 || name.length > 70) continue;

                const img = a.querySelector("img") || card.querySelector("img");
                const imgSrc = getImgSrc(img);

                const sectionText = findSectionText(card);
                const posicion = guessPosition(cardText, sectionText);
                const numero = guessNumber(cardText);

                if (!map.has(id)) {
                    map.set(id, {
                        id,
                        nombre: name,
                        club: equipoNombre,
                        club_id: equipoId,
                        numero,
                        posicion,
                        pais: "",
                        edad: "",
                        imagen_url_plantel: imgSrc,
                        imagen_url: hasPlayerImage(imgSrc) ? imgSrc : "",
                        imagen: "",
                        url_365scores: href,
                        texto_detectado: cardText,
                        seccion_detectada: sectionText
                    });
                }
            }

            return Array.from(map.values());
        }
        """,
        {
            "equipoNombre": equipo_nombre,
            "equipoId": equipo_id
        }
    )

    salida = []

    for j in jugadores:
        nombre = limpiar_texto(j.get("nombre"))
        texto = limpiar_texto(j.get("texto_detectado"))
        posicion = normalizar_posicion(j.get("posicion"))

        if not nombre:
            continue

        if es_staff_o_no_jugador(nombre, texto):
            print(f"🚫 Staff descartado: {nombre} ({equipo_nombre})")
            continue

        salida.append({
            "id": str(j.get("id") or ""),
            "nombre": nombre,
            "club": equipo_nombre,
            "club_id": str(j.get("club_id") or equipo_id),
            "numero": limpiar_texto(j.get("numero")),
            "posicion": posicion,
            "pais": "",
            "edad": "",
            "fecha_nacimiento": "",
            "altura": "",
            "fin_contrato": "",
            "competicion": equipo_liga,
            "imagen_url": imagen_365_alta_calidad(j.get("imagen_url") or ""),
            "imagen": "",
            "url_365scores": j.get("url_365scores") or "",
            "fuente": FUENTE,
        })

    return salida


async def extraer_detalle_jugador(context, jugador):
    """
    Entra al perfil individual de 365Scores para completar:
    país, edad, fecha de nacimiento, altura, dorsal, competición, contrato e imagen.
    """
    if not jugador.get("url_365scores"):
        return jugador

    page = await context.new_page()

    try:
        await page.goto(jugador["url_365scores"], wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(1700)
        await cerrar_cookies_o_popups(page)

        data = await page.evaluate(
            """
            () => {
                function clean(s) {
                    return String(s || "").replace(/\\s+/g, " ").trim();
                }

                function getBestSrc(img) {
                    if (!img) return "";
                    if (img.currentSrc) return img.currentSrc;
                    if (img.src) return img.src;
                    if (img.getAttribute("data-src")) return img.getAttribute("data-src");

                    const srcset = img.getAttribute("srcset");
                    if (srcset) {
                        const parts = srcset
                            .split(",")
                            .map(x => x.trim().split(" ")[0])
                            .filter(Boolean);

                        if (parts.length) return parts[parts.length - 1];
                    }

                    return "";
                }

                const nombre = clean(document.querySelector("h1")?.innerText || "");
                const bodyText = clean(document.body.innerText || "");

                let posicion = "";

                const h1 = document.querySelector("h1");
                if (h1) {
                    let node = h1;
                    for (let i = 0; i < 5; i++) {
                        if (!node.parentElement) break;
                        node = node.parentElement;
                        const txt = clean(node.innerText || node.textContent || "");
                        const low = txt.toLowerCase();

                        if (low.includes("portero")) posicion = "Portero";
                        else if (low.includes("defensa") || low.includes("defensor")) posicion = "Defensa";
                        else if (low.includes("mediocampista") || low.includes("medio")) posicion = "Mediocampista";
                        else if (low.includes("delantero") || low.includes("extremo")) posicion = "Delantero";

                        if (posicion) break;
                    }
                }

                const imgs = Array.from(document.querySelectorAll("img"))
                    .map(img => ({
                        src: getBestSrc(img),
                        alt: clean(img.alt || ""),
                        width: img.naturalWidth || img.width || 0,
                        height: img.naturalHeight || img.height || 0
                    }))
                    .filter(x => x.src);

                return { nombre, posicion, bodyText, imgs };
            }
            """
        )

        nombre_real = limpiar_texto(data.get("nombre"))

        if nombre_real and 2 <= len(nombre_real) <= 70:
            jugador["nombre"] = nombre_real

        posicion = normalizar_posicion(data.get("posicion"))
        if posicion:
            jugador["posicion"] = posicion

        detalles = extraer_datos_desde_body_365(jugador["nombre"], data.get("bodyText") or "")

        for campo in ["pais", "edad", "fecha_nacimiento", "altura", "numero", "fin_contrato"]:
            if detalles.get(campo):
                jugador[campo] = detalles[campo]

        detalle_competicion = limpiar_competicion(detalles.get("competicion", ""))
        if detalle_competicion and not jugador.get("competicion"):
            jugador["competicion"] = detalle_competicion

        imgs = data.get("imgs") or []

        if not jugador.get("imagen_url") or not es_url_imagen_valida_365(jugador["imagen_url"]):
            for img in imgs:
                src = img.get("src") or ""
                if es_url_imagen_valida_365(src):
                    jugador["imagen_url"] = src
                    break

        return jugador

    except Exception as e:
        print(f"⚠️ No se pudo completar detalle de {jugador.get('nombre')}: {e}")
        return jugador

    finally:
        await page.close()


async def procesar_equipo(context, equipo, existentes):
    equipo_nombre = obtener_nombre_equipo(equipo)
    equipo_url = obtener_url_equipo(equipo)
    equipo_liga = obtener_liga_equipo(equipo)

    if not equipo_url:
        print(f"⚠️ Equipo sin URL: {equipo_nombre}")
        print(f"   Objeto recibido: {json.dumps(equipo, ensure_ascii=False)}")
        return []

    page = await context.new_page()

    try:
        print(f"\n🌐 Abriendo plantilla: {equipo_nombre}")
        print(f"🔗 URL: {equipo_url}")

        await page.goto(equipo_url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(3500)
        await cerrar_cookies_o_popups(page)
        await hacer_scroll(page)

        jugadores = await extraer_jugadores_del_plantel(page, equipo_nombre, equipo_url, equipo_liga)
        print(f"📦 Jugadores encontrados en {equipo_nombre}: {len(jugadores)}")

    except Exception as e:
        print(f"❌ Error abriendo {equipo_nombre}: {e}")
        jugadores = []

    finally:
        await page.close()

    resultados = []

    for i, jugador in enumerate(jugadores, start=1):
        print(f"[{i}/{len(jugadores)}] ⚽ {jugador['nombre']} - {equipo_nombre}")

        nombre_archivo = f"{slugify(jugador['club'])}-{slugify(jugador['nombre'])}-{jugador['id']}"
        imagen_existente = buscar_imagen_existente(nombre_archivo)
        jugador_existente = buscar_jugador_existente(jugador, existentes)

        if jugador_existente and tiene_datos_completos(jugador_existente):
            liga_equipo_actual = equipo_liga or obtener_liga_por_club(jugador.get("club", ""))
            posicion_actual = jugador.get("posicion", "")

            jugador.update(jugador_existente)

            if liga_equipo_actual:
                jugador["competicion"] = liga_equipo_actual
            elif not limpiar_competicion(jugador.get("competicion", "")):
                jugador["competicion"] = ""

            if not jugador.get("posicion") and posicion_actual:
                jugador["posicion"] = posicion_actual

            print(f"♻️ Jugador ya cargado con datos e imagen, omito perfil/descarga: {jugador['nombre']}")
        else:
            liga_equipo_actual = equipo_liga or obtener_liga_por_club(jugador.get("club", ""))

            if liga_equipo_actual:
                jugador["competicion"] = liga_equipo_actual
            elif not limpiar_competicion(jugador.get("competicion", "")):
                jugador["competicion"] = ""

            if imagen_existente:
                jugador["imagen"] = imagen_existente

            jugador = await extraer_detalle_jugador(context, jugador)

            liga_equipo_actual = equipo_liga or obtener_liga_por_club(jugador.get("club", ""))

            if liga_equipo_actual:
                jugador["competicion"] = liga_equipo_actual
            elif not limpiar_competicion(jugador.get("competicion", "")):
                jugador["competicion"] = ""

            if imagen_existente:
                jugador["imagen"] = imagen_existente
                print(f"♻️ Imagen ya cargada, solo actualicé datos: {jugador['nombre']}")
            elif jugador.get("imagen_url"):
                jugador["imagen"] = descargar_imagen(jugador["imagen_url"], nombre_archivo)
            else:
                jugador["imagen"] = ""

            await asyncio.sleep(0.25)

        resultados.append(limpiar_jugador_para_juego(jugador))

    return resultados

def obtener_liga_por_club(club):
    """
    Liga final confiable según el club.
    Evita errores cacheados como Seattle Sounders -> LaLiga.
    """
    return LIGAS_POR_EQUIPO_365.get(normalizar(club), "")



def limpiar_dataset_final(jugadores):
    """
    Limpieza final antes de escribir JSON:
    - elimina entrenadores/staff colados
    - omite jugadores sin posición
    - fuerza la liga correcta según el club
    - elimina cualquier competicion inválida como 365Scores
    """
    salida = []

    for j in jugadores:
        nombre = j.get("nombre", "")
        club = j.get("club", "")
        posicion = normalizar_posicion(j.get("posicion", ""))

        if es_staff_o_no_jugador(nombre, f"{nombre} {posicion}"):
            print(f"🚫 Staff eliminado en limpieza final: {nombre} ({club})")
            continue

        if not posicion:
            print(f"⚠️ Jugador omitido sin posición: {nombre} ({club})")
            continue

        liga_por_club = obtener_liga_por_club(club)
        comp_actual = limpiar_competicion(j.get("competicion", ""))

        if liga_por_club:
            j["competicion"] = liga_por_club
        else:
            j["competicion"] = comp_actual

        j["posicion"] = posicion

        if str(j.get("edad", "")).strip() in ["0", "0.0"]:
            j["edad"] = ""

        if str(j.get("altura", "")).strip() in ["0", "0.0"]:
            j["altura"] = ""

        salida.append(j)

    return salida


def limpiar_imagenes_alta_calidad_dataset(jugadores):
    for j in jugadores:
        if j.get("imagen_url"):
            j["imagen_url"] = imagen_365_alta_calidad(j["imagen_url"])
    return jugadores



def deduplicar_jugadores(jugadores):
    vistos = set()
    salida = []

    for j in jugadores:
        key = f"{normalizar(j.get('club'))}|{normalizar(j.get('nombre'))}|{j.get('id')}"
        if key in vistos:
            continue
        vistos.add(key)
        salida.append(j)

    return salida


async def main():
    asegurar_carpetas()

    equipos = cargar_equipos()
    existentes = cargar_jugadores_existentes()
    print(f"📋 Equipos cargados: {len(equipos)}")
    print(f"♻️ Jugadores existentes en JSON del juego: {len(existentes)}")

    todos_los_jugadores = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ]
        )

        context = await browser.new_context(
            user_agent=HEADERS["User-Agent"],
            viewport={"width": 1366, "height": 900},
            locale="es-ES",
        )

        for equipo in equipos:
            jugadores_equipo = await procesar_equipo(context, equipo, existentes)
            todos_los_jugadores.extend(jugadores_equipo)

        await browser.close()

    todos_los_jugadores = limpiar_imagenes_alta_calidad_dataset(limpiar_dataset_final(deduplicar_jugadores(todos_los_jugadores)))

    OUTPUT_JSON.write_text(
        json.dumps(todos_los_jugadores, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    simple = [
        {
            "nombre": j.get("nombre", ""),
            "club": j.get("club", ""),
            "pais": j.get("pais", ""),
            "posicion": j.get("posicion", ""),
            "edad": j.get("edad", ""),
            "fecha_nacimiento": j.get("fecha_nacimiento", ""),
            "altura": j.get("altura", ""),
            "numero": j.get("numero", ""),
            "competicion": obtener_liga_por_club(j.get("club", "")) or limpiar_competicion(j.get("competicion", "")),
            "fin_contrato": j.get("fin_contrato", ""),
            "imagen": j.get("imagen", ""),
            "fuente": FUENTE
        }
        for j in todos_los_jugadores
    ]

    OUTPUT_SIMPLE_JSON.write_text(
        json.dumps(simple, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    GAME_JSON.write_text(
        json.dumps(simple, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    con_imagen = sum(1 for j in simple if j.get("imagen"))
    sin_imagen = len(simple) - con_imagen

    print("\n✅ Listo.")
    print(f"📄 JSON completo: {OUTPUT_JSON}")
    print(f"📄 JSON simple: {OUTPUT_SIMPLE_JSON}")
    print(f"🎮 JSON juego: {GAME_JSON}")
    print(f"🖼️ Imágenes juego: {GAME_IMAGES_DIR}")
    print(f"👥 Total jugadores: {len(simple)}")
    print(f"✅ Con imagen: {con_imagen}")
    print(f"⚠️ Sin imagen: {sin_imagen}")


if __name__ == "__main__":
    asyncio.run(main())
