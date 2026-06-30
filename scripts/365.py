from playwright.sync_api import sync_playwright
import json
import re
import time
from pathlib import Path

MAPPING_FILE = Path(r"C:\Users\Gasti\Documents\partidos hoy\aca\scripts\data\mapping_365_ids.json")
OUTPUT_FILE = Path(r"C:\Users\Gasti\Documents\partidos hoy\aca\public\data\jugadores_america.json")

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
        page = browser.new_page(viewport={"width": 1600, "height": 900})
        page.set_default_timeout(60000)
        
        try:
            print(f"  Cargando: {url}")
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(5000)
            
            # Aceptar cookies
            try:
                for boton in ["button:has-text('Aceptar')", "button:has-text('Accept')", "[id*=accept]", "[class*=accept]"]:
                    if page.locator(boton).count() > 0:
                        page.locator(boton).first.click(timeout=1000)
                        break
            except:
                pass
            
            # Esperar que aparezcan los jugadores
            page.wait_for_selector('a[href*="/player/"]', timeout=15000)
            
            # ============================================================
            # EXTRACCIÓN: Solo procesar links que tengan posición entre paréntesis
            # ============================================================
            enlaces = page.evaluate("""
                () => {
                    const links = document.querySelectorAll('a[href*="/player/"]');
                    return Array.from(links).map(a => {
                        const fullText = a.innerText || '';
                        const lines = fullText.split('\\n').map(l => l.trim()).filter(l => l);
                        const nombre = lines[0] || '';
                        
                        // Buscar posición entre paréntesis en CUALQUIER línea del texto
                        let posicionRaw = '';
                        let pais = '';
                        
                        for (let line of lines) {
                            const match = line.match(/\\(([^)]+)\\)/);
                            if (match) {
                                posicionRaw = match[1].trim();
                                pais = line.replace(match[0], '').trim();
                                break;
                            }
                        }
                        
                        // Buscar número de camiseta
                        let numero = '';
                        for (let line of lines) {
                            const numMatch = line.match(/^\\s*(\\d{1,2})\\s*$/);
                            if (numMatch) {
                                numero = numMatch[1];
                                break;
                            }
                        }
                        if (!numero) {
                            const endNum = fullText.match(/(\\d{1,2})\\s*$/);
                            if (endNum) numero = endNum[1];
                        }
                        
                        return {
                            nombre: nombre,
                            href: a.href,
                            posicion_raw: posicionRaw,
                            pais_jugador: pais,
                            numero: numero,
                            debug: fullText.substring(0, 100)
                        };
                    });
                }
            """)
            
            vistos = set()
            
            for item in enlaces:
                try:
                    nombre = item.get("nombre", "").strip()
                    href = item.get("href", "")
                    posicion_raw = item.get("posicion_raw", "").strip()
                    
                    # ============================================================
                    # FILTRO CLAVE: Ignorar jugadores sin posición (son los "destacados" duplicados)
                    # ============================================================
                    if not posicion_raw:
                        # Solo mostrar debug para los primeros 5 sin posición para no saturar
                        if len([j for j in jugadores if j["nombre"] == nombre]) == 0:
                            print(f"    ⏭️  {nombre} → ignorado (sin posición, probablemente destacado)")
                        continue
                    
                    print(f"    ✅ {nombre} → {posicion_raw}")
                    
                    # Filtrar no-jugadores
                    NO_JUGADORES = {
                        "entrenador", "ayudante de campo", "utilero",
                        "preparador físico", "preparador fisico",
                        "médico", "medico", "kinesiólogo", "kinesiologo"
                    }
                    
                    if posicion_raw.lower() in NO_JUGADORES:
                        continue
                    
                    if not nombre:
                        continue
                    
                    match = re.search(r'/player/(\d+)', href)
                    jugador_id = match.group(1) if match else ""
                    
                    clave = f"{jugador_id}_{nombre}"
                    if clave in vistos:
                        continue
                    vistos.add(clave)
                    
                    jugadores.append({
                        "id": jugador_id,
                        "nombre": nombre,
                        "slug": re.sub(r'[^a-z0-9]+', '-', nombre.lower()).strip("-"),
                        "posicion_raw": posicion_raw,
                        "posicion": mapear_posicion(posicion_raw),
                        "numero": item.get("numero", ""),
                        "url_jugador": href
                    })
                    
                except Exception as e:
                    print(f"    Error jugador: {e}")
                    
        except Exception as e:
            print(f"  Error: {e}")
        finally:
            browser.close()
    
    return jugadores


def mapear_posicion(pos_raw):
    pos = pos_raw.lower() if pos_raw else ""
    
    mapa = {
        # GK
        "arquero": "GK", "portero": "GK", "goalkeeper": "GK", "gk": "GK",
        
        # DEF
        "defensa central": "CB", "central": "CB", "cb": "CB",
        "defensa lateral izquierdo": "LB", "lateral izquierdo": "LB", 
        "left back": "LB", "lb": "LB",
        "defensa lateral derecho": "RB", "lateral derecho": "RB",
        "right back": "RB", "rb": "RB",
        
        # MID
        "mediocampista central": "CM", "mediocampista": "CM",
        "centrocampista": "CM", "volante": "CM", "cm": "CM",
        "centrocampista defensivo": "CDM", "volante defensivo": "CDM",
        "mediocampista defensivo": "CDM", "cdm": "CDM",
        "enganche": "CAM", "mediocampista ofensivo": "CAM", "cam": "CAM",
        "mediocampista derecho": "RM", "rm": "RM",
        "mediocampista izquierdo": "LM", "lm": "LM",
        
        # ATK
        "extremo izquierdo": "LW", "delantero izquierdo": "LW", "lw": "LW",
        "extremo derecho": "RW", "delantero derecho": "RW", "rw": "RW",
        "segundo delantero": "SS", "ss": "SS",
        "delantero": "ST", "centro delantero": "ST", "striker": "ST", "st": "ST",
    }
    
    return mapa.get(pos, "")


def main():
    with open(MAPPING_FILE, "r", encoding="utf-8") as f:
        mapping = json.load(f)
    
    total = []
    procesados = 0
    
    print(f"📋 Total equipos en mapping: {len(mapping)}")
    print("🚀 Iniciando scraping...\\n")
    
    for clave, datos in mapping.items():
        try:
            nombre = clave.split("::")[0]
            pais = clave.split("::")[1]
            id365 = datos["id365"]
            slug365 = datos["slug365"]
            
            url = f"https://www.365scores.com/es/football/team/{slug365}-{id365}/squad"
            
            print(f"\\n[{procesados+1}/{len(mapping)}] {nombre} ({pais})")
            
            jugadores = extraer_jugadores_con_playwright(url, headless=True)
            
            for j in jugadores:
                j["club"] = nombre
                j["pais"] = pais
                j["club_id"] = str(id365)
                j["club_slug"] = slug365
            
            total.extend(jugadores)
            procesados += 1
            
            print(f"  ✅ {len(jugadores)} jugadores")
            
            if procesados % 10 == 0:
                with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                    json.dump({
                        "total": len(total),
                        "equipos_procesados": procesados,
                        "fecha": time.strftime("%Y-%m-%d %H:%M:%S"),
                        "jugadores": total
                    }, f, indent=2, ensure_ascii=False)
                print("  💾 Guardado parcial")
            
            time.sleep(1)
            
        except Exception as e:
            print(f"Error equipo: {e}")
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "total": len(total),
            "equipos_procesados": procesados,
            "fecha_generacion": time.strftime("%Y-%m-%d %H:%M:%S"),
            "jugadores": total
        }, f, indent=2, ensure_ascii=False)
    
    print("\\n===================")
    print("✅ COMPLETADO")
    print(f"📊 Jugadores: {len(total)}")
    print(f"📁 {OUTPUT_FILE}")
    print("===================")


if __name__ == "__main__":
    main()