import json
import os
import re
import unicodedata
from datetime import datetime, timezone
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup

WIKI_API_URL = "https://es.wikipedia.org/w/api.php"
WIKI_PAGE = "Primera_División_de_Argentina"
DATA_PATHS = ["data/competiciones.json", "public/data/competiciones.json"]
DEBUG_PATHS = ["data/titulos-liga-profesional.json", "public/data/titulos-liga-profesional.json"]

HEADERS = {
    "User-Agent": "PartidosHoy/1.0 (titulos Liga Profesional Argentina)",
    "Accept": "application/json,text/plain,*/*",
}

EXTRA_ALIASES = {
    "racing-club": ["racing", "racing club"],
    "river-plate": ["river plate"],
    "boca-juniors": ["boca juniors"],
    "independiente": ["independiente"],
    "san-lorenzo": ["san lorenzo", "san lorenzo de almagro"],
    "velez-sarsfield": ["velez", "velez sarsfield"],
    "estudiantes-de-la-plata": ["estudiantes", "estudiantes de la plata"],
    "newells-old-boys": ["newells", "newells old boys", "newell s old boys"],
    "newell-s-old-boys": ["newells", "newells old boys", "newell s old boys"],
    "rosario-central": ["rosario central"],
    "huracan": ["huracan"],
    "argentinos-juniors": ["argentinos juniors"],
    "lanus": ["lanus"],
    "banfield": ["banfield"],
    "belgrano": ["belgrano"],
    "belgrano-cordoba": ["belgrano"],
    "gimnasia-la-plata": ["gimnasia la plata", "gimnasia y esgrima la plata"],
    "platense": ["platense"],
    "tigre": ["tigre"],
    "union": ["union", "union santa fe"],
    "union-santa-fe": ["union", "union santa fe"],
    "talleres": ["talleres", "talleres cordoba"],
    "talleres-cordoba": ["talleres", "talleres cordoba"],
    "talleres-de-cordoba": ["talleres", "talleres cordoba"],
    "sarmiento": ["sarmiento", "sarmiento junin"],
    "sarmiento-junin": ["sarmiento", "sarmiento junin"],
    "aldosivi": ["aldosivi"],
    "barracas-central": ["barracas central"],
    "central-cordoba": ["central cordoba", "central cordoba santiago del estero"],
    "central-cordoba-santiago": ["central cordoba", "central cordoba santiago del estero"],
    "central-cordoba-santiago-del-estero": ["central cordoba", "central cordoba santiago del estero"],
    "defensa-y-justicia": ["defensa y justicia"],
    "deportivo-riestra": ["deportivo riestra", "riestra"],
    "independiente-rivadavia": ["independiente rivadavia"],
    "instituto": ["instituto", "instituto cordoba"],
    "instituto-cordoba": ["instituto", "instituto cordoba"],
    "atletico-tucuman": ["atletico tucuman"],
    "estudiantes-de-rio-cuarto": ["estudiantes de rio cuarto"],
    "gimnasia-mendoza": ["gimnasia mendoza", "gimnasia y esgrima mendoza"],
}


def ahora_iso():
    return datetime.now(timezone.utc).isoformat()


def normalizar(texto):
    texto = str(texto or "").lower().strip()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = texto.replace("'", "")
    texto = texto.replace("’", "")
    texto = re.sub(r"[^a-z0-9]+", " ", texto)
    return re.sub(r"\s+", " ", texto).strip()


def slug(texto):
    return normalizar(texto).replace(" ", "-")


def nombre_para_match(nombre):
    n = normalizar(nombre)
    reemplazos = {
        "club atletico river plate": "river plate",
        "club atletico boca juniors": "boca juniors",
        "club atletico independiente": "independiente",
        "club atletico san lorenzo de almagro": "san lorenzo",
        "club atletico velez sarsfield": "velez sarsfield",
        "club estudiantes de la plata": "estudiantes de la plata",
        "club atletico rosario central": "rosario central",
        "club atletico newells old boys": "newells old boys",
        "club atletico huracan": "huracan",
        "club atletico lanus": "lanus",
        "club atletico banfield": "banfield",
        "club atletico belgrano": "belgrano",
        "club atletico platense": "platense",
        "club atletico tigre": "tigre",
        "club atletico union": "union",
        "club atletico talleres": "talleres",
        "club atletico sarmiento": "sarmiento",
        "club atletico aldosivi": "aldosivi",
        "club atletico barracas central": "barracas central",
        "club atletico central cordoba": "central cordoba",
        "club deportivo riestra": "deportivo riestra",
        "club sportivo independiente rivadavia": "independiente rivadavia",
        "instituto atletico central cordoba": "instituto",
        "club de gimnasia y esgrima la plata": "gimnasia la plata",
        "gimnasia y esgrima la plata": "gimnasia la plata",
        "club atletico gimnasia y esgrima mendoza": "gimnasia mendoza",
        "gimnasia y esgrima mendoza": "gimnasia mendoza",
        "asociacion atletica argentinos juniors": "argentinos juniors",
        "club social y deportivo defensa y justicia": "defensa y justicia",
    }
    if n in reemplazos:
        n = reemplazos[n]
    for prefijo in ["club atletico ", "club social y deportivo ", "asociacion atletica ", "club "]:
        if n.startswith(prefijo):
            n = n[len(prefijo):].strip()
    for extra in [" cordoba", " santa fe", " junin", " santiago del estero"]:
        n = n.replace(extra, "").strip()
    return re.sub(r"\s+", " ", n).strip()


def wiki_get(params):
    try:
        response = requests.get(WIKI_API_URL, params=params, headers=HEADERS, timeout=35)
        print(f"🌐 Wikipedia {response.status_code} {params.get('page', '')}")
        if response.ok:
            return response.json()
    except Exception as error:
        print(f"⚠️ Error Wikipedia: {error}")
    return None


def limpiar_celda(celda):
    texto = celda.get_text(" ", strip=True)
    texto = re.sub(r"\[[^\]]+\]", "", texto)
    texto = re.sub(r"\s+", " ", texto)
    return texto.strip()


def parse_numero(valor):
    nums = re.findall(r"\d+", str(valor or ""))
    return int(nums[0]) if nums else None


def detectar_indice_columna(headers, posibles):
    headers_norm = [normalizar(h) for h in headers]
    for posible in posibles:
        p = normalizar(posible)
        for i, h in enumerate(headers_norm):
            if p == h or p in h:
                return i
    return None


def extraer_titulos_de_tabla(tabla):
    filas = tabla.find_all("tr")
    headers = []
    header_row = None
    for tr in filas[:6]:
        celdas = tr.find_all(["th", "td"])
        textos = [limpiar_celda(c) for c in celdas]
        norm = [normalizar(t) for t in textos]
        if any("equipo" in t or "club" in t for t in norm) and any("campeon" in t or "titulos" in t or "primera" in t for t in norm):
            headers = textos
            header_row = tr
            break
    if not headers:
        for tr in filas[:6]:
            ths = tr.find_all("th")
            if len(ths) >= 2:
                headers = [limpiar_celda(c) for c in ths]
                header_row = tr
                break
    if not headers:
        return {}
    idx_equipo = detectar_indice_columna(headers, ["Equipo", "Club"])
    idx_campeon = detectar_indice_columna(headers, ["Campeón", "Campeon", "Títulos", "Titulos", "Primera División"])
    if idx_equipo is None or idx_campeon is None:
        return {}
    salida = {}
    usar = False if header_row is not None else True
    for tr in filas:
        if tr == header_row:
            usar = True
            continue
        if not usar:
            continue
        celdas = tr.find_all(["th", "td"])
        if len(celdas) <= max(idx_equipo, idx_campeon):
            continue
        equipo_txt = limpiar_celda(celdas[idx_equipo])
        titulos = parse_numero(limpiar_celda(celdas[idx_campeon]))
        if not equipo_txt or titulos is None:
            continue
        nombre = nombre_para_match(equipo_txt)
        if not nombre or nombre in ["total", "totales", "otros", "equipo"]:
            continue
        key = slug(nombre)
        previo = salida.get(key)
        if previo is None or titulos > previo["titulos"]:
            salida[key] = {
                "slug": key,
                "pagina": WIKI_PAGE,
                "nombre_detectado": equipo_txt,
                "nombre_match": nombre,
                "titulos": int(titulos),
                "fuente": "wikipedia",
                "url": f"https://es.wikipedia.org/wiki/{quote(WIKI_PAGE)}",
                "criterio": "Palmarés global histórico completo de Primera División Argentina. Se usa la columna Campeón.",
                "actualizado": ahora_iso(),
            }
    return salida


def cargar_titulos_wikipedia():
    data = wiki_get({"action": "parse", "page": WIKI_PAGE, "prop": "text", "format": "json", "utf8": "1"})
    html = ((data or {}).get("parse") or {}).get("text", {}).get("*") or ""
    soup = BeautifulSoup(html, "html.parser")
    tablas = soup.find_all("table")
    print(f"📚 Wikipedia: {len(tablas)} tablas detectadas")
    mejor = {}
    mejor_score = -1
    mejor_idx = -1
    for idx, tabla in enumerate(tablas):
        datos = extraer_titulos_de_tabla(tabla)
        if not datos:
            continue
        score = len(datos)
        for key, peso in {
            "river-plate": 10,
            "boca-juniors": 10,
            "racing": 8,
            "racing-club": 8,
            "independiente": 8,
            "san-lorenzo": 8,
            "rosario-central": 8,
            "estudiantes-de-la-plata": 5,
            "velez-sarsfield": 5,
        }.items():
            if key in datos:
                score += peso
        print(f"🔎 Tabla candidata #{idx}: {len(datos)} equipos, score {score}")
        if score > mejor_score:
            mejor = datos
            mejor_score = score
            mejor_idx = idx
    if "racing" in mejor and "racing-club" not in mejor:
        mejor["racing-club"] = dict(mejor["racing"], slug="racing-club", nombre_match="racing club")
    if "velez" in mejor and "velez-sarsfield" not in mejor:
        mejor["velez-sarsfield"] = dict(mejor["velez"], slug="velez-sarsfield", nombre_match="velez sarsfield")
    if "estudiantes" in mejor and "estudiantes-de-la-plata" not in mejor:
        mejor["estudiantes-de-la-plata"] = dict(mejor["estudiantes"], slug="estudiantes-de-la-plata", nombre_match="estudiantes de la plata")
    for key, esperado in {"river-plate": 38, "boca-juniors": 35, "rosario-central": 5, "racing-club": 18}.items():
        detectado = (mejor.get(key) or {}).get("titulos")
        if detectado == esperado:
            print(f"✅ Validación: {key.replace('-', ' ')} = {detectado}")
        else:
            print(f"⚠️ Validación: {key.replace('-', ' ')} esperado {esperado}, detectado {detectado}")
    print(f"✅ Wikipedia títulos detectados: {len(mejor)} equipos con dato")
    print(f"🏷️ Tabla usada: #{mejor_idx}")
    return mejor


def buscar_titulo_para_equipo(team, titulos):
    candidatos = []
    for key in [team.get("slug"), team.get("id"), team.get("nombre"), team.get("nombre_corto")]:
        if key:
            candidatos.append(slug(nombre_para_match(key)))
    slug_team = slug(team.get("slug") or team.get("nombre") or "")
    for alias in EXTRA_ALIASES.get(slug_team, []):
        candidatos.append(slug(nombre_para_match(alias)))
    nombre_norm = normalizar(team.get("nombre") or "")
    for variante in [nombre_norm, nombre_norm.replace("cordoba", "").strip(), nombre_norm.replace("santa fe", "").strip(), nombre_norm.replace("junin", "").strip(), nombre_norm.replace("santiago del estero", "").strip()]:
        if variante:
            candidatos.append(slug(nombre_para_match(variante)))
    vistos = set()
    for candidato in candidatos:
        if not candidato or candidato in vistos:
            continue
        vistos.add(candidato)
        if candidato in titulos:
            return titulos[candidato], candidato
    return None, ""


def aplicar_titulos_a_competiciones(titulos):
    for path in DATA_PATHS:
        if not os.path.exists(path):
            print(f"⚠️ No existe {path}")
            continue
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for comp in data.get("competiciones") or []:
            if comp.get("id") != "liga-profesional":
                continue
            for team in comp.get("equipos") or []:
                info, key_usada = buscar_titulo_para_equipo(team, titulos)
                total = int((info or {}).get("titulos") or 0)
                team["titulos"] = {
                    "total": total,
                    "liga": total,
                    "primera_division": total,
                    "fuente": (info or {}).get("fuente") or "sin-datos",
                    "url": (info or {}).get("url") or "",
                    "criterio": (info or {}).get("criterio") or "Campeonatos de Primera División Argentina.",
                    "nombre_detectado": (info or {}).get("nombre_detectado") or "",
                    "match_key": key_usada,
                }
                team["titulos_primera_division"] = total
            comp["equipos"].sort(key=lambda t: (-int(t.get("titulos_primera_division") or 0), normalizar(t.get("nombre") or "")))
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✅ Actualizado {path}")


def guardar_debug(titulos):
    payload = {
        "actualizado": ahora_iso(),
        "criterio_general": "Campeonatos de Primera División Argentina. Fuente: tabla global histórica de Wikipedia. Sin fallback manual.",
        "fuente": "Wikipedia - Primera División de Argentina",
        "clubes": titulos,
    }
    for path in DEBUG_PATHS:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"✅ Generado {path}")


def main():
    titulos = cargar_titulos_wikipedia()
    guardar_debug(titulos)
    aplicar_titulos_a_competiciones(titulos)


if __name__ == "__main__":
    main()
