from playwright.sync_api import sync_playwright
import json
import re
import time
from pathlib import Path

# ==========================
# CONFIG
# ==========================

MAPPING_FILE = Path(
    r"C:\Users\Gasti\Documents\partidos hoy\aca\scripts\data\mapping_365_ids.json"
)

OUTPUT_FILE = Path(r"C:\Users\Gasti\Documents\partidos hoy\aca\public\data\jugadores_america.json")


# ==========================
# EXTRAER JUGADORES
# ==========================

def extraer_jugadores_con_playwright(url, headless=True):

    jugadores = []

    with sync_playwright() as p:

        browser = p.chromium.launch(
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox"
            ]
        )

        page = browser.new_page(
            viewport={
                "width": 1600,
                "height": 900
            }
        )

        page.set_default_timeout(60000)

        try:

            print(f"  Cargando: {url}")

            page.goto(
                url,
                wait_until="domcontentloaded",
                timeout=60000
            )

            page.wait_for_timeout(5000)

            # Intentar aceptar cookies
            try:

                botones = [
                    "button:has-text('Aceptar')",
                    "button:has-text('Accept')",
                    "[id*=accept]",
                    "[class*=accept]"
                ]

                for boton in botones:

                    if page.locator(boton).count() > 0:

                        page.locator(
                            boton
                        ).first.click(
                            timeout=1000
                        )

                        break

            except:
                pass

            # Esperar links de jugadores
            try:

                page.wait_for_selector(
                    'a[href*="/player/"]',
                    timeout=15000
                )

            except:

                print("  ⚠️ No aparecieron jugadores")

            # El innerText del <a> viene como:
            # "Nombre\nPais(Posicion)" o "Nombre\nPais(Posicion)  99"
            # Extraemos nombre (primera línea) y posición (entre paréntesis al final)
            enlaces = page.evaluate("""
                () => {
                    const links = document.querySelectorAll('a[href*="/player/"]');
                    return Array.from(links).map(a => {
                        const texto = a.innerText || '';
                        const posMatch = texto.match(/\\(([^)]+)\\)\\s*\\d*\\s*$/);
                        const posRaw = posMatch ? posMatch[1].trim() : '';
                        const nombre = texto.split('\\n')[0].trim();
                        return {
                            text: nombre,
                            href: a.href,
                            posicion_raw: posRaw
                        };
                    });
                }
            """)

            vistos = set()

            for item in enlaces:

                try:

                    texto = item["text"] or ""
                    href = item["href"] or ""
                    posicion_raw = item["posicion_raw"] or ""

                    NO_JUGADORES = {
                        "entrenador",
                        "ayudante de campo",
                        "utilero",
                        "preparador físico",
                        "preparador fisico",
                        "médico",
                        "medico",
                        "kinesiólogo",
                        "kinesiologo",
                    }

                    if posicion_raw.lower() in NO_JUGADORES:
                        continue

                    if not texto:
                        continue

                    match = re.search(
                        r'/player/(\d+)',
                        href
                    )

                    jugador_id = (
                        match.group(1)
                        if match
                        else ""
                    )

                    nombre = texto.strip()

                    if not nombre:
                        continue

                    clave = f"{jugador_id}_{nombre}"

                    if clave in vistos:
                        continue

                    vistos.add(clave)

                    # Número de camiseta (si viene en el texto original)
                    numero = ""

                    num = re.search(
                        r'(\d+)$',
                        texto
                    )

                    if num:
                        numero = num.group(1)

                    jugadores.append({

                        "id": jugador_id,

                        "nombre": nombre,

                        "slug": re.sub(
                            r'[^a-z0-9]+',
                            '-',
                            nombre.lower()
                        ).strip("-"),

                        "posicion_raw": posicion_raw,

                        "numero": numero,

                        "url_jugador": href

                    })

                except Exception as e:

                    print(
                        f"    Error jugador: {e}"
                    )

        except Exception as e:

            print(f"  Error: {e}")

        finally:

            browser.close()

    return jugadores


# ==========================
# MAPEAR POSICION
# ==========================

def mapear_posicion(pos_raw):

    pos = (
        pos_raw.lower()
        if pos_raw
        else ""
    )

    mapa = {

        # GK
        "arquero": "GK",
        "portero": "GK",
        "goalkeeper": "GK",
        "gk": "GK",

        # DEF
        "defensa central": "CB",
        "central": "CB",
        "cb": "CB",
        "defensa lateral izquierdo": "LB",
        "lateral izquierdo": "LB",
        "left back": "LB",
        "lb": "LB",
        "defensa lateral derecho": "RB",
        "lateral derecho": "RB",
        "right back": "RB",
        "rb": "RB",

        # MID
        "mediocampista central": "CM",
        "mediocampista": "CM",
        "centrocampista": "CM",
        "volante": "CM",
        "cm": "CM",
        "centrocampista defensivo": "CDM",
        "volante defensivo": "CDM",
        "mediocampista defensivo": "CDM",
        "cdm": "CDM",
        "enganche": "CAM",
        "mediocampista ofensivo": "CAM",
        "cam": "CAM",
        "mediocampista derecho": "RM",
        "rm": "RM",
        "mediocampista izquierdo": "LM",
        "lm": "LM",

        # ATK
        "extremo izquierdo": "LW",
        "delantero izquierdo": "LW",
        "lw": "LW",
        "extremo derecho": "RW",
        "delantero derecho": "RW",
        "rw": "RW",
        "segundo delantero": "SS",
        "ss": "SS",
        "delantero": "ST",
        "centro delantero": "ST",
        "striker": "ST",
        "st": "ST",

    }

    return mapa.get(pos, "")


# ==========================
# MAIN
# ==========================

def main():

    with open(
        MAPPING_FILE,
        "r",
        encoding="utf-8"
    ) as f:

        mapping = json.load(f)

    total = []

    procesados = 0

    print(
        f"📋 Total equipos en mapping: {len(mapping)}"
    )

    print(
        "🚀 Iniciando scraping...\n"
    )

    for clave, datos in mapping.items():

        try:

            nombre = clave.split("::")[0]
            pais = clave.split("::")[1]

            id365 = datos["id365"]
            slug365 = datos["slug365"]

            url = (
                f"https://www.365scores.com/es/football/team/"
                f"{slug365}-{id365}/squad"
            )

            print(
                f"\n[{procesados+1}/{len(mapping)}] "
                f"{nombre} ({pais})"
            )

            jugadores = extraer_jugadores_con_playwright(
                url,
                headless=True
            )

            for j in jugadores:

                j["club"] = nombre
                j["pais"] = pais
                j["club_id"] = str(id365)
                j["club_slug"] = slug365

                j["posicion"] = mapear_posicion(
                    j["posicion_raw"]
                )

            total.extend(jugadores)

            procesados += 1

            print(
                f"  ✅ {len(jugadores)} jugadores"
            )

            if procesados % 10 == 0:

                with open(
                    OUTPUT_FILE,
                    "w",
                    encoding="utf-8"
                ) as f:

                    json.dump(
                        {
                            "total": len(total),
                            "equipos_procesados": procesados,
                            "fecha": time.strftime(
                                "%Y-%m-%d %H:%M:%S"
                            ),
                            "jugadores": total
                        },
                        f,
                        indent=2,
                        ensure_ascii=False
                    )

                print(
                    "  💾 Guardado parcial"
                )

            time.sleep(1)

        except Exception as e:

            print(
                f"Error equipo: {e}"
            )

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            {
                "total": len(total),
                "equipos_procesados": procesados,
                "fecha_generacion": time.strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
                "jugadores": total
            },
            f,
            indent=2,
            ensure_ascii=False
        )

    print("\n===================")
    print("✅ COMPLETADO")
    print(f"📊 Jugadores: {len(total)}")
    print(f"📁 {OUTPUT_FILE}")
    print("===================")


if __name__ == "__main__":
    main()
