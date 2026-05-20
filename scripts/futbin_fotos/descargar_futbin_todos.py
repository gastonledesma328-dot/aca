import argparse
import json
import os
import re
import time
from pathlib import Path
from urllib.parse import quote

import requests
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

PLAYER_IMG_RE = re.compile(r"https://cdn\d+\.futbin\.com/content/fifa26/img/players/\d+\.png\?[^\"'\s<>]+")
PLAYER_LINK_RE = re.compile(r'https?://www\.futbin\.com/26/player/\d+/[^"\'\s<>]+|/26/player/\d+/[^"\'\s<>]+')

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
    "Referer": "https://www.futbin.com/",
}

IMG_HEADERS = {
    "User-Agent": HEADERS["User-Agent"],
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": HEADERS["Accept-Language"],
    "Referer": "https://www.futbin.com/",
}


def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    tmp = str(path) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def slug(text):
    text = str(text or "").lower().strip()
    repl = {
        "á":"a","é":"e","í":"i","ó":"o","ú":"u","à":"a","è":"e","ì":"i","ò":"o","ù":"u",
        "ä":"a","ë":"e","ï":"i","ö":"o","ü":"u","ã":"a","õ":"o","â":"a","ê":"e","î":"i","ô":"o","û":"u",
        "ñ":"n","ç":"c","ø":"o","š":"s","ć":"c","č":"c","ž":"z","ğ":"g","ı":"i","ł":"l","đ":"d","ș":"s","ț":"t",
    }
    for a, b in repl.items():
        text = text.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def clean_url(url):
    return str(url or "").replace("\\u0026", "&").replace("&amp;", "&").strip()


def clean_filename(text):
    text = str(text or "jugador").strip()
    for c in ['\\', '/', ':', '*', '?', '"', '<', '>', '|']:
        text = text.replace(c, "")
    return text.replace(" ", "_") or "jugador"


def extract_players(base):
    seen = set()
    players = []
    for league in base.get("ligas", []):
        league_name = league.get("liga", "")
        for team in league.get("equipos", []):
            team_name = team.get("equipo", "")
            for group in ["titulares", "suplentes"]:
                for player in team.get(group, []):
                    name = player.get("nombre", "").strip()
                    if not name:
                        continue
                    key = slug(name)
                    if key in seen:
                        continue
                    seen.add(key)
                    players.append({
                        "nombre": name,
                        "altura": player.get("altura"),
                        "posicion": player.get("posicion"),
                        "liga": league_name,
                        "equipo": team_name,
                        "rol": "titular" if group == "titulares" else "suplente",
                    })
    return players


def search_variants(player, aliases):
    name = player.get("nombre", "")
    alias = player.get("alias_futbin") or aliases.get(name) or name
    variants = []
    for item in [alias, name, name.replace(".", "").replace(" Jr", " Junior")]:
        if item and item not in variants:
            variants.append(item)
    parts = [p for p in slug(name).split("-") if len(p) >= 3]
    if len(parts) >= 2 and parts[-1] not in variants:
        variants.append(parts[-1])
    return variants


def request_html(url, timeout):
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        print(f"pagina {r.status_code} {url}")
        if r.status_code == 200:
            return r.text
    except Exception as e:
        print(f"requests pagina error: {e}")
    return ""


def image_from_html(html):
    matches = [clean_url(m.group(0)) for m in PLAYER_IMG_RE.finditer(html or "")]
    unique = []
    for url in matches:
        if url not in unique:
            unique.append(url)
    preferred = [u for u in unique if "w=162" in u and "s=" in u]
    if preferred:
        return preferred[0]
    signed = [u for u in unique if "s=" in u]
    if signed:
        return signed[0]
    return unique[0] if unique else ""


def links_from_html(html):
    links = []
    for m in PLAYER_LINK_RE.finditer(html or ""):
        href = clean_url(m.group(0))
        if href.startswith("/"):
            href = "https://www.futbin.com" + href
        href = href.split("?")[0]
        if href not in links:
            links.append(href)
    return links


def score_link(href, player, query):
    href_s = slug(href)
    name_s = slug(player.get("nombre", ""))
    query_s = slug(query)
    score = 0
    if query_s and query_s in href_s:
        score += 120
    if name_s and name_s in href_s:
        score += 100
    for part in [p for p in query_s.split("-") if len(p) >= 3]:
        if part in href_s:
            score += 25
    for part in [p for p in name_s.split("-") if len(p) >= 3]:
        if part in href_s:
            score += 15
    return score


def best_link(links, player, query):
    if not links:
        return ""
    ranked = sorted([(score_link(x, player, query), x) for x in links], reverse=True)
    return ranked[0][1]


def open_page(page, context, url, timeout_ms):
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
    except PlaywrightTimeoutError:
        print(f"timeout: {url}")
        return page, False
    except Exception as e:
        print(f"playwright pagina error: {e}")
        try:
            page.close()
        except Exception:
            pass
        return context.new_page(), False
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        pass
    return page, True


def links_from_page(page):
    try:
        links = page.eval_on_selector_all("a[href*='/26/player/']", "links => links.map(a => a.href || '').filter(Boolean)")
    except Exception:
        return []
    out = []
    for href in links:
        href = clean_url(href).split("?")[0]
        if href not in out:
            out.append(href)
    return out


def image_from_page(page):
    try:
        img = image_from_html(page.content())
        if img:
            return img
    except Exception:
        pass
    try:
        imgs = page.eval_on_selector_all("img", "imgs => imgs.map(img => img.currentSrc || img.src || '').filter(Boolean)")
    except Exception:
        imgs = []
    imgs = [clean_url(x) for x in imgs if "/content/fifa26/img/players/" in x and ".png" in x]
    preferred = [x for x in imgs if "w=162" in x and "s=" in x]
    return preferred[0] if preferred else (imgs[0] if imgs else "")


def find_page(page, context, player, aliases, req_timeout, page_timeout_ms):
    for query in search_variants(player, aliases):
        print(f"buscando como: {query}")
        url = f"https://www.futbin.com/players?search={quote(query)}"
        html = request_html(url, req_timeout)
        links = links_from_html(html)
        if links:
            return page, best_link(links, player, query), query
        page, ok = open_page(page, context, url, page_timeout_ms)
        if not ok:
            continue
        links = links_from_page(page)
        if links:
            return page, best_link(links, player, query), query
    return page, "", ""


def find_image(page, context, player, aliases, req_timeout, page_timeout_ms):
    direct = player.get("imagen_url") or player.get("foto") or player.get("image")
    if direct and "/img/players/" in direct:
        return page, clean_url(direct), player.get("futbin_page_url", ""), "directa"
    page_url = player.get("futbin_page_url") or ""
    used = player.get("alias_futbin") or aliases.get(player.get("nombre", ""), player.get("nombre", ""))
    if not page_url:
        page, page_url, used = find_page(page, context, player, aliases, req_timeout, page_timeout_ms)
    if not page_url:
        return page, "", "", used
    html = request_html(page_url, req_timeout)
    img = image_from_html(html)
    if img:
        return page, img, page_url, used
    page, ok = open_page(page, context, page_url, page_timeout_ms)
    if not ok:
        return page, "", page_url, used
    img = image_from_page(page)
    return page, img, page_url, used


def download_image(url, dest, referer, timeout):
    headers = dict(IMG_HEADERS)
    headers["Referer"] = referer or "https://www.futbin.com/"
    try:
        r = requests.get(url, headers=headers, timeout=timeout)
        print(f"imagen {r.status_code} {url}")
        if r.status_code != 200 or "image" not in r.headers.get("Content-Type", ""):
            return False
        Path(dest).parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as f:
            f.write(r.content)
        return os.path.getsize(dest) > 1000
    except Exception as e:
        print(f"download error: {e}")
        return False


def apply_cache_to_base(base, cache):
    for league in base.get("ligas", []):
        for team in league.get("equipos", []):
            for group in ["titulares", "suplentes"]:
                for player in team.get(group, []):
                    item = cache.get(slug(player.get("nombre", "")), {})
                    if item.get("imagen_url"):
                        player["foto"] = item["imagen_url"]
                    if item.get("futbin_page_url"):
                        player["futbin_page_url"] = item["futbin_page_url"]
                    if item.get("alias_futbin"):
                        player["alias_futbin"] = item["alias_futbin"]
    return base


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="data/adivina-jugador/base_jugadores_original.json")
    parser.add_argument("--output", default="data/adivina-jugador/base_jugadores_con_fotos.json")
    parser.add_argument("--players-output", default="data/adivina-jugador/jugadores_futbin_con_fotos.json")
    parser.add_argument("--images-dir", default="data/adivina-jugador/imagenes_jugadores")
    parser.add_argument("--cache", default="data/adivina-jugador/futbin_cache.json")
    parser.add_argument("--failed", default="data/adivina-jugador/futbin_fallidos.json")
    parser.add_argument("--aliases", default="scripts/futbin_fotos/aliases_futbin.json")
    parser.add_argument("--ignore", default="scripts/futbin_fotos/ignorar_futbin.json")
    parser.add_argument("--max", type=int, default=int(os.environ.get("MAX_PLAYERS", "0") or "0"))
    parser.add_argument("--start-from", type=int, default=int(os.environ.get("START_FROM", "1") or "1"))
    parser.add_argument("--delay", type=float, default=float(os.environ.get("DELAY_SECONDS", "1.0") or "1.0"))
    parser.add_argument("--page-timeout-ms", type=int, default=int(os.environ.get("PAGE_TIMEOUT_MS", "25000") or "25000"))
    parser.add_argument("--request-timeout", type=int, default=int(os.environ.get("REQUEST_TIMEOUT", "25") or "25"))
    parser.add_argument("--headless", action="store_true")
    args = parser.parse_args()

    base = load_json(args.input, {})
    if not base:
        raise SystemExit(f"No existe o está vacío el archivo de entrada: {args.input}")

    aliases = load_json(args.aliases, {})
    ignore = {slug(x) for x in load_json(args.ignore, [])}
    cache = load_json(args.cache, {})
    failed = load_json(args.failed, [])

    players = extract_players(base)
    if args.start_from > 1:
        players = players[args.start_from - 1:]
    if args.max > 0:
        players = players[:args.max]

    print(f"Jugadores a procesar: {len(players)}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=args.headless, args=["--disable-blink-features=AutomationControlled"])
        context = browser.new_context(locale="es-AR", user_agent=HEADERS["User-Agent"])
        page = context.new_page()

        for idx, player in enumerate(players, start=1):
            name = player.get("nombre", "")
            key = slug(name)
            print(f"\n[{idx}/{len(players)}] {name}")
            if key in ignore:
                print("ignorado")
                continue
            if cache.get(key, {}).get("imagen_url"):
                print("cache")
                continue
            try:
                page, img, page_url, used = find_image(page, context, player, aliases, args.request_timeout, args.page_timeout_ms)
            except Exception as e:
                print(f"fallo inesperado: {e}")
                failed.append({"nombre": name, "motivo": str(e)[:200]})
                save_json(args.failed, failed)
                continue
            if not img:
                failed.append({"nombre": name, "alias_usado": used, "equipo": player.get("equipo", ""), "liga": player.get("liga", ""), "motivo": "No encontrado o timeout"})
                save_json(args.failed, failed)
                continue
            filename = clean_filename(name) + ".png"
            dest = os.path.join(args.images_dir, filename)
            ok = download_image(img, dest, page_url, args.request_timeout)
            cache[key] = {**player, "alias_futbin": used if used != name else player.get("alias_futbin", ""), "imagen_url": img, "foto": img, "futbin_page_url": page_url, "archivo": filename, "descargada": ok}
            save_json(args.cache, cache)
            time.sleep(args.delay)
        browser.close()

    updated = apply_cache_to_base(base, cache)
    save_json(args.output, updated)
    save_json(args.players_output, list(cache.values()))
    print("Listo")


if __name__ == "__main__":
    main()
