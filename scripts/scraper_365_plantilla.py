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

OUTPUT_IMAGES_DIR = DATA_DIR / "imagenes_jugadores_365"
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

        equipos_limpios.append({
            **equipo,
            "equipo": nombre,
            "url": url
        })

    return equipos_limpios


def asegurar_carpetas():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    GAME_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
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


def descargar_imagen(url, nombre_archivo):
    if not es_url_imagen_valida_365(url):
        return ""

    ext = extension_desde_url(url)

    data_path = OUTPUT_IMAGES_DIR / f"{nombre_archivo}{ext}"
    game_path = GAME_IMAGES_DIR / f"{nombre_archivo}{ext}"

    rel_game_path = f"imagenes_jugadores_365/{nombre_archivo}{ext}"

    if game_path.exists() and game_path.stat().st_size > 0:
        return rel_game_path

    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        print(f"🖼️ {r.status_code} imagen {url}")

        if not r.ok:
            return ""

        content_type = r.headers.get("content-type", "").lower()

        if "image" not in content_type:
            return ""

        data_path.write_bytes(r.content)
        game_path.write_bytes(r.content)

        return rel_game_path

    except Exception as e:
        print(f"❌ Error descargando imagen {url}: {e}")
        return ""


def limpiar_jugador_para_juego(j):
    return {
        "id": j.get("id", ""),
        "nombre": j.get("nombre", ""),
        "club": j.get("club", ""),
        "club_id": j.get("club_id", ""),
        "pais": j.get("pais", ""),
        "posicion": j.get("posicion", ""),
        "numero": j.get("numero", ""),
        "edad": j.get("edad", ""),
        "imagen": j.get("imagen", ""),
        "imagen_url": j.get("imagen_url", ""),
        "url_365scores": j.get("url_365scores", ""),
        "fuente": FUENTE,
    }


def es_staff_o_no_jugador(nombre, texto):
    """
    Filtro de staff conservador.
    Antes se descartaba por palabras como "asistente" dentro del texto cercano,
    y eso podía eliminar jugadores reales como Marcelo Weigandt.
    Ahora solo descartamos nombres claramente conocidos como staff.
    """
    n = normalizar(nombre)

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
        "aleksandar kolarov"
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


async def extraer_jugadores_del_plantel(page, equipo_nombre, equipo_url):
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
            "imagen_url": j.get("imagen_url") or "",
            "imagen": "",
            "url_365scores": j.get("url_365scores") or "",
            "fuente": FUENTE,
        })

    return salida


async def extraer_detalle_jugador(context, jugador):
    """
    Perfil individual: lo usamos principalmente para completar imagen si en el plantel no salió.
    No adivinamos país/posición desde todo el body porque eso generaba muchos errores.
    """
    if not jugador.get("url_365scores"):
        return jugador

    if jugador.get("imagen_url") and es_url_imagen_valida_365(jugador["imagen_url"]):
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

                const imgs = Array.from(document.querySelectorAll("img"))
                    .map(img => ({
                        src: getBestSrc(img),
                        alt: clean(img.alt || ""),
                        width: img.naturalWidth || img.width || 0,
                        height: img.naturalHeight || img.height || 0
                    }))
                    .filter(x => x.src);

                return { nombre, imgs };
            }
            """
        )

        nombre_real = limpiar_texto(data.get("nombre"))

        if nombre_real and 2 <= len(nombre_real) <= 70:
            jugador["nombre"] = nombre_real

        imgs = data.get("imgs") or []
        imagen_url = ""

        for img in imgs:
            src = img.get("src") or ""
            if es_url_imagen_valida_365(src):
                imagen_url = src
                break

        if imagen_url:
            jugador["imagen_url"] = imagen_url

        return jugador

    except Exception as e:
        print(f"⚠️ No se pudo completar detalle de {jugador.get('nombre')}: {e}")
        return jugador

    finally:
        await page.close()


async def procesar_equipo(context, equipo):
    equipo_nombre = obtener_nombre_equipo(equipo)
    equipo_url = obtener_url_equipo(equipo)

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

        jugadores = await extraer_jugadores_del_plantel(page, equipo_nombre, equipo_url)
        print(f"📦 Jugadores encontrados en {equipo_nombre}: {len(jugadores)}")

    except Exception as e:
        print(f"❌ Error abriendo {equipo_nombre}: {e}")
        jugadores = []

    finally:
        await page.close()

    resultados = []

    for i, jugador in enumerate(jugadores, start=1):
        print(f"[{i}/{len(jugadores)}] ⚽ {jugador['nombre']} - {equipo_nombre}")

        jugador = await extraer_detalle_jugador(context, jugador)

        nombre_archivo = f"{slugify(jugador['club'])}-{slugify(jugador['nombre'])}-{jugador['id']}"

        if jugador.get("imagen_url"):
            jugador["imagen"] = descargar_imagen(jugador["imagen_url"], nombre_archivo)
        else:
            jugador["imagen"] = ""

        resultados.append(limpiar_jugador_para_juego(jugador))

        await asyncio.sleep(0.25)

    return resultados


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
    print(f"📋 Equipos cargados: {len(equipos)}")

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
            jugadores_equipo = await procesar_equipo(context, equipo)
            todos_los_jugadores.extend(jugadores_equipo)

        await browser.close()

    todos_los_jugadores = deduplicar_jugadores(todos_los_jugadores)

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
    print(f"🖼️ Imágenes data: {OUTPUT_IMAGES_DIR}")
    print(f"🖼️ Imágenes juego: {GAME_IMAGES_DIR}")
    print(f"👥 Total jugadores: {len(simple)}")
    print(f"✅ Con imagen: {con_imagen}")
    print(f"⚠️ Sin imagen: {sin_imagen}")


if __name__ == "__main__":
    asyncio.run(main())
