#!/usr/bin/env node
/*
  scraper_comparador_selecciones.js
  Genera data/comparador-selecciones.json y public/data/comparador-selecciones.json

  Que hace:
    - Consulta ESPN API por cada seleccion del Mundial 2026 (48 equipos + extras libres).
    - Trae roster completo: nombre, numero, edad, posicion, club, foto.
    - Trae logo oficial del equipo.
    - Guarda un JSON listo para que el juego lo consuma sin llamadas en tiempo real.
    - Si ESPN no responde para una seleccion, conserva los datos del JSON anterior.

  Uso:
    node scripts/scraper_comparador_selecciones.js

  GitHub Actions: .github/workflows/update-comparador-selecciones.yml
*/

const fs   = require("fs");
const path = require("path");

const ROOT       = path.resolve(__dirname, "..");
const OUT_DATA   = path.join(ROOT, "data",        "comparador-selecciones.json");
const OUT_PUBLIC = path.join(ROOT, "public/data", "comparador-selecciones.json");

const DELAY_MS        = 150;   // pausa entre requests para no saturar ESPN
const MIN_PLAYERS     = 8;     // minimo para considerar roster valido
const REQUEST_TIMEOUT = 10000; // 10s por request

// ---------------------------------------------------------------------------
// Todas las selecciones del juego:
// campo `league` = league slug de ESPN para el endpoint de teams/{id}/roster
// ---------------------------------------------------------------------------
const SELECCIONES = [
  // GRUPO A
  { name: "México",          flag: "🇲🇽", espnId: 20,  league: "fifa.worldq.concacaf", grupo: "A", flagCode: "mx" },
  { name: "Sudáfrica",       flag: "🇿🇦", espnId: 85,  league: "fifa.worldq.caf",      grupo: "A", flagCode: "za" },
  { name: "Corea del Sur",   flag: "🇰🇷", espnId: 181, league: "fifa.worldq.afc",      grupo: "A", flagCode: "kr" },
  { name: "República Checa", flag: "🇨🇿", espnId: 450, league: "uefa.nations",         grupo: "A", flagCode: "cz" },
  // GRUPO B
  { name: "Canadá",          flag: "🇨🇦", espnId: 571, league: "fifa.worldq.concacaf", grupo: "B", flagCode: "ca" },
  { name: "Bosnia y Herz.",  flag: "🇧🇦", espnId: 452, league: "uefa.nations",         grupo: "B", flagCode: "ba" },
  { name: "Qatar",           flag: "🇶🇦", espnId: 196, league: "fifa.worldq.afc",      grupo: "B", flagCode: "qa" },
  { name: "Suiza",           flag: "🇨🇭", espnId: 379, league: "uefa.nations",         grupo: "B", flagCode: "ch" },
  // GRUPO C
  { name: "Brasil",          flag: "🇧🇷", espnId: 6,   league: "fifa.worldq.conmebol", grupo: "C", flagCode: "br" },
  { name: "Marruecos",       flag: "🇲🇦", espnId: 51,  league: "fifa.worldq.caf",      grupo: "C", flagCode: "ma" },
  { name: "Haití",           flag: "🇭🇹", espnId: 531, league: "fifa.worldq.concacaf", grupo: "C", flagCode: "ht" },
  { name: "Escocia",         flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", espnId: 269, league: "uefa.nations",         grupo: "C", flagCode: "gb-sct" },
  // GRUPO D
  { name: "Estados Unidos",  flag: "🇺🇸", espnId: 18,  league: "fifa.worldq.concacaf", grupo: "D", flagCode: "us" },
  { name: "Paraguay",        flag: "🇵🇾", espnId: 30,  league: "fifa.worldq.conmebol", grupo: "D", flagCode: "py" },
  { name: "Australia",       flag: "🇦🇺", espnId: 201, league: "fifa.worldq.afc",      grupo: "D", flagCode: "au" },
  { name: "Turquía",         flag: "🇹🇷", espnId: 465, league: "uefa.nations",         grupo: "D", flagCode: "tr" },
  // GRUPO E
  { name: "Alemania",        flag: "🇩🇪", espnId: 3,   league: "uefa.nations",         grupo: "E", flagCode: "de" },
  { name: "Curazao",         flag: "🇨🇼", espnId: 557, league: "fifa.worldq.concacaf", grupo: "E", flagCode: "cw" },
  { name: "Ecuador",         flag: "🇪🇨", espnId: 13,  league: "fifa.worldq.conmebol", grupo: "E", flagCode: "ec" },
  { name: "Costa de Marfil", flag: "🇨🇮", espnId: 54,  league: "fifa.worldq.caf",      grupo: "E", flagCode: "ci" },
  // GRUPO F
  { name: "Países Bajos",    flag: "🇳🇱", espnId: 167, league: "uefa.nations",         grupo: "F", flagCode: "nl" },
  { name: "Japón",           flag: "🇯🇵", espnId: 175, league: "fifa.worldq.afc",      grupo: "F", flagCode: "jp" },
  { name: "Suecia",          flag: "🇸🇪", espnId: 466, league: "uefa.nations",         grupo: "F", flagCode: "se" },
  { name: "Túnez",           flag: "🇹🇳", espnId: 87,  league: "fifa.worldq.caf",      grupo: "F", flagCode: "tn" },
  // GRUPO G
  { name: "Bélgica",         flag: "🇧🇪", espnId: 1,   league: "uefa.nations",         grupo: "G", flagCode: "be" },
  { name: "Egipto",          flag: "🇪🇬", espnId: 48,  league: "fifa.worldq.caf",      grupo: "G", flagCode: "eg" },
  { name: "Irán",            flag: "🇮🇷", espnId: 170, league: "fifa.worldq.afc",      grupo: "G", flagCode: "ir" },
  { name: "Nueva Zelanda",   flag: "🇳🇿", espnId: 202, league: "fifa.worldq.afc",      grupo: "G", flagCode: "nz" },
  // GRUPO H
  { name: "España",          flag: "🇪🇸", espnId: 164, league: "uefa.nations",         grupo: "H", flagCode: "es" },
  { name: "Cabo Verde",      flag: "🇨🇻", espnId: 96,  league: "fifa.worldq.caf",      grupo: "H", flagCode: "cv" },
  { name: "Arabia Saudita",  flag: "🇸🇦", espnId: 175, league: "fifa.worldq.afc",      grupo: "H", flagCode: "sa" },
  { name: "Uruguay",         flag: "🇺🇾", espnId: 47,  league: "fifa.worldq.conmebol", grupo: "H", flagCode: "uy" },
  // GRUPO I
  { name: "Francia",         flag: "🇫🇷", espnId: 2,   league: "uefa.nations",         grupo: "I", flagCode: "fr" },
  { name: "Zambia",          flag: "🇿🇲", espnId: 91,  league: "fifa.worldq.caf",      grupo: "I", flagCode: "zm" },
  { name: "Irak",            flag: "🇮🇶", espnId: 171, league: "fifa.worldq.afc",      grupo: "I", flagCode: "iq" },
  { name: "Panamá",          flag: "🇵🇦", espnId: 516, league: "fifa.worldq.concacaf", grupo: "I", flagCode: "pa" },
  // GRUPO J
  { name: "Argentina",       flag: "🇦🇷", espnId: 9,   league: "fifa.worldq.conmebol", grupo: "J", flagCode: "ar" },
  { name: "Argelia",         flag: "🇩🇿", espnId: 46,  league: "fifa.worldq.caf",      grupo: "J", flagCode: "dz" },
  { name: "Austria",         flag: "🇦🇹", espnId: 371, league: "uefa.nations",         grupo: "J", flagCode: "at" },
  { name: "Jordania",        flag: "🇯🇴", espnId: 172, league: "fifa.worldq.afc",      grupo: "J", flagCode: "jo" },
  // GRUPO K
  { name: "Portugal",        flag: "🇵🇹", espnId: 165, league: "uefa.nations",         grupo: "K", flagCode: "pt" },
  { name: "Congo",           flag: "🇨🇩", espnId: 49,  league: "fifa.worldq.caf",      grupo: "K", flagCode: "cd" },
  { name: "Uzbekistán",      flag: "🇺🇿", espnId: 192, league: "fifa.worldq.afc",      grupo: "K", flagCode: "uz" },
  { name: "Venezuela",       flag: "🇻🇪", espnId: 44,  league: "fifa.worldq.conmebol", grupo: "K", flagCode: "ve" },
  // GRUPO L
  { name: "Inglaterra",      flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", espnId: 10,  league: "uefa.nations",         grupo: "L", flagCode: "gb-eng" },
  { name: "Venezuela",       flag: "🇻🇪", espnId: 44,  league: "fifa.worldq.conmebol", grupo: "L", flagCode: "ve" },
  { name: "Senegal",         flag: "🇸🇳", espnId: 83,  league: "fifa.worldq.caf",      grupo: "L", flagCode: "sn" },
  { name: "Japón",           flag: "🇯🇵", espnId: 175, league: "fifa.worldq.afc",      grupo: "L", flagCode: "jp" },
  // Extra: selecciones populares sin grupo confirmado para modo Libre
  { name: "Croacia",         flag: "🇭🇷", espnId: 44,  league: "uefa.nations",         grupo: null, flagCode: "hr" },
  { name: "Colombia",        flag: "🇨🇴", espnId: 11,  league: "fifa.worldq.conmebol", grupo: null, flagCode: "co" },
];

// Fixture predefinido del Mundial 2026 (fase de grupos)
const FIXTURE = [
  { grupo: "A", local: "México",          visita: "Sudáfrica",       fecha: "11 Jun" },
  { grupo: "A", local: "Corea del Sur",   visita: "República Checa", fecha: "11 Jun" },
  { grupo: "B", local: "Canadá",          visita: "Bosnia y Herz.",  fecha: "12 Jun" },
  { grupo: "D", local: "Estados Unidos",  visita: "Paraguay",        fecha: "12 Jun" },
  { grupo: "B", local: "Qatar",           visita: "Suiza",           fecha: "13 Jun" },
  { grupo: "C", local: "Brasil",          visita: "Marruecos",       fecha: "13 Jun" },
  { grupo: "D", local: "Australia",       visita: "Turquía",         fecha: "13 Jun" },
  { grupo: "E", local: "Alemania",        visita: "Curazao",         fecha: "14 Jun" },
  { grupo: "F", local: "Países Bajos",    visita: "Japón",           fecha: "14 Jun" },
  { grupo: "E", local: "Ecuador",         visita: "Costa de Marfil", fecha: "14 Jun" },
  { grupo: "F", local: "Suecia",          visita: "Túnez",           fecha: "14 Jun" },
  { grupo: "H", local: "España",          visita: "Cabo Verde",      fecha: "15 Jun" },
  { grupo: "G", local: "Bélgica",         visita: "Egipto",          fecha: "15 Jun" },
  { grupo: "H", local: "Arabia Saudita",  visita: "Uruguay",         fecha: "15 Jun" },
  { grupo: "G", local: "Irán",            visita: "Nueva Zelanda",   fecha: "15 Jun" },
  { grupo: "I", local: "Panamá",          visita: "Irak",            fecha: "16 Jun" },
  { grupo: "J", local: "Argentina",       visita: "Argelia",         fecha: "16 Jun" },
  { grupo: "K", local: "Portugal",        visita: "Congo",           fecha: "17 Jun" },
  { grupo: "A", local: "Sudáfrica",       visita: "Corea del Sur",   fecha: "17 Jun" },
  { grupo: "B", local: "Bosnia y Herz.",  visita: "Qatar",           fecha: "17 Jun" },
  { grupo: "L", local: "Inglaterra",      visita: "Senegal",         fecha: "18 Jun" },
  { grupo: "D", local: "Paraguay",        visita: "Australia",       fecha: "18 Jun" },
  { grupo: "E", local: "Costa de Marfil", visita: "Alemania",        fecha: "18 Jun" },
  { grupo: "F", local: "Túnez",           visita: "Países Bajos",    fecha: "18 Jun" },
  { grupo: "I", local: "Francia",         visita: "Zambia",          fecha: "19 Jun" },
  { grupo: "G", local: "Nueva Zelanda",   visita: "Bélgica",         fecha: "19 Jun" },
  { grupo: "J", local: "Austria",         visita: "Jordania",        fecha: "19 Jun" },
  { grupo: "K", local: "Venezuela",       visita: "Uzbekistán",      fecha: "19 Jun" },
  { grupo: "H", local: "Cabo Verde",      visita: "Uruguay",         fecha: "20 Jun" },
  { grupo: "C", local: "Haití",           visita: "Escocia",         fecha: "20 Jun" },
  { grupo: "D", local: "Turquía",         visita: "Estados Unidos",  fecha: "20 Jun" },
  { grupo: "B", local: "Suiza",           visita: "Canadá",          fecha: "20 Jun" },
  { grupo: "A", local: "México",          visita: "Corea del Sur",   fecha: "21 Jun" },
  { grupo: "E", local: "Curazao",         visita: "Ecuador",         fecha: "21 Jun" },
  { grupo: "F", local: "Japón",           visita: "Suecia",          fecha: "21 Jun" },
  { grupo: "I", local: "Irak",            visita: "Francia",         fecha: "22 Jun" },
  { grupo: "J", local: "Argentina",       visita: "Austria",         fecha: "22 Jun" },
  { grupo: "K", local: "Portugal",        visita: "Venezuela",       fecha: "22 Jun" },
  { grupo: "L", local: "Senegal",         visita: "Inglaterra",      fecha: "23 Jun" },
  { grupo: "G", local: "Egipto",          visita: "Irán",            fecha: "23 Jun" },
  { grupo: "H", local: "España",          visita: "Arabia Saudita",  fecha: "23 Jun" },
  { grupo: "C", local: "Brasil",          visita: "Haití",           fecha: "24 Jun" },
  { grupo: "C", local: "Escocia",         visita: "Marruecos",       fecha: "24 Jun" },
  { grupo: "A", local: "Sudáfrica",       visita: "República Checa", fecha: "25 Jun" },
  { grupo: "B", local: "Bosnia y Herz.",  visita: "Suiza",           fecha: "25 Jun" },
  { grupo: "D", local: "Australia",       visita: "Estados Unidos",  fecha: "25 Jun" },
  { grupo: "E", local: "Alemania",        visita: "Ecuador",         fecha: "25 Jun" },
  { grupo: "G", local: "Nueva Zelanda",   visita: "Irán",            fecha: "26 Jun" },
  { grupo: "F", local: "Japón",           visita: "Túnez",           fecha: "26 Jun" },
  { grupo: "H", local: "Uruguay",         visita: "España",          fecha: "26 Jun" },
  { grupo: "I", local: "Panamá",          visita: "Francia",         fecha: "26 Jun" },
  { grupo: "J", local: "Argelia",         visita: "Austria",         fecha: "27 Jun" },
  { grupo: "J", local: "Jordania",        visita: "Argentina",       fecha: "27 Jun" },
  { grupo: "K", local: "Uzbekistán",      visita: "Congo",           fecha: "27 Jun" },
  { grupo: "L", local: "Inglaterra",      visita: "Zambia",          fecha: "28 Jun" },
];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "PartidosHoy-ComparadorSelecciones/1.0",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try {
      return await fetchJson(url);
    } catch (err) {
      if (i === retries) throw err;
      await sleep(400 * i);
    }
  }
}

// Normaliza abreviatura ESPN -> GK/DEF/MID/FWD
function posGroup(abbr = "") {
  const a = abbr.toUpperCase().trim();
  if (["GK", "G", "POR"].includes(a))                         return "GK";
  if (["CB","RB","LB","LWB","RWB","SW","D","DEF"].includes(a)) return "DEF";
  if (["CM","CDM","CAM","LM","RM","AM","DM","M","MID"].includes(a)) return "MID";
  if (["ST","CF","LW","RW","SS","F","FWD","ATT","FW"].includes(a)) return "FWD";
  return "MID";
}

// Trae logo, nombre oficial y record del equipo
async function fetchTeamInfo(sel) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${sel.league}/teams/${sel.espnId}`;
  try {
    const d = await fetchWithRetry(url);
    const t = d?.team || {};
    return {
      logoUrl:    t.logos?.[0]?.href || null,
      nameEspn:   t.displayName || t.name || sel.name,
      record:     t.record?.items?.[0]?.summary || null,
    };
  } catch {
    return { logoUrl: null, nameEspn: sel.name, record: null };
  }
}

// Trae roster completo con foto
async function fetchRoster(sel) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${sel.league}/teams/${sel.espnId}/roster`;
  try {
    const d = await fetchWithRetry(url);
    const players = [];
    for (const group of (d.athletes || [])) {
      for (const p of (group.items || [group])) {
        if (!p?.fullName) continue;
        const posAbbr = (p.position?.abbreviation || p.position?.displayName || "MID").toUpperCase();
        players.push({
          id:       p.id   || null,
          name:     p.fullName,
          short:    p.shortName || p.displayName || p.fullName,
          number:   p.jersey || null,
          age:      p.age   || null,
          posAbbr:  posAbbr,
          posGroup: posGroup(posAbbr),
          club:     p.team?.displayName || p.team?.name || null,
          photo:    p.headshot?.href || null,
        });
      }
    }
    // Ordenar: GK → DEF → MID → FWD
    const ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
    return players.sort((a, b) => (ORDER[a.posGroup] ?? 4) - (ORDER[b.posGroup] ?? 4));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

// Deduplicar selecciones por espnId (el fixture puede tener repetidos)
function dedupSelecciones(list) {
  const seen = new Set();
  return list.filter(s => {
    const key = `${s.espnId}-${s.league}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  console.log("=== Scraper Comparador Selecciones – Mundial 2026 ===\n");

  // Cargar JSON anterior (fallback si ESPN no responde)
  let previous = {};
  if (fs.existsSync(OUT_DATA)) {
    try {
      previous = JSON.parse(fs.readFileSync(OUT_DATA, "utf8"));
      console.log(`Backup cargado: ${Object.keys(previous.teams || {}).length} selecciones previas.\n`);
    } catch {
      console.warn("No se pudo leer el JSON anterior. Se arranca desde cero.\n");
    }
  }

  const prevTeams = previous.teams || {};
  const unique    = dedupSelecciones(SELECCIONES);
  const result    = {};

  for (let i = 0; i < unique.length; i++) {
    const sel = unique[i];
    const key = String(sel.espnId);
    console.log(`[${i + 1}/${unique.length}] ${sel.name} (id=${sel.espnId}, ${sel.league})`);

    await sleep(DELAY_MS);

    // Info del equipo (logo, nombre oficial, record)
    const info = await fetchTeamInfo(sel);
    console.log(`  Logo: ${info.logoUrl ? "✓" : "✗"}  Nombre ESPN: ${info.nameEspn}`);

    await sleep(DELAY_MS);

    // Roster
    let players = await fetchRoster(sel);
    const fromEspn = players.length >= MIN_PLAYERS;

    if (!fromEspn && prevTeams[key]?.players?.length >= MIN_PLAYERS) {
      console.log(`  Roster ESPN insuficiente (${players.length}). Usando backup (${prevTeams[key].players.length} jugadores).`);
      players = prevTeams[key].players;
    } else if (!fromEspn) {
      console.warn(`  ⚠ Sin roster (${players.length} jugadores). Se guarda vacío.`);
    } else {
      console.log(`  Roster: ${players.length} jugadores ✓`);
    }

    result[key] = {
      espnId:   sel.espnId,
      name:     sel.name,
      nameEspn: info.nameEspn,
      flag:     sel.flag,
      flagCode: sel.flagCode,
      grupo:    sel.grupo,
      league:   sel.league,
      logoUrl:  info.logoUrl || prevTeams[key]?.logoUrl || null,
      record:   info.record  || null,
      players,
      fetchedAt: new Date().toISOString(),
    };
  }

  // Output final
  const output = {
    meta: {
      source:      "ESPN API publica – scraper_comparador_selecciones.js",
      updatedAt:   new Date().toISOString(),
      totalTeams:  Object.keys(result).length,
      fixture:     FIXTURE,
      note:        "Generado automaticamente. No editar a mano.",
    },
    teams: result,
  };

  const json = JSON.stringify(output, null, 2) + "\n";

  // Crear carpetas si no existen
  fs.mkdirSync(path.dirname(OUT_DATA),   { recursive: true });
  fs.mkdirSync(path.dirname(OUT_PUBLIC), { recursive: true });

  fs.writeFileSync(OUT_DATA,   json, "utf8");
  console.log(`\n✓ Guardado: data/comparador-selecciones.json`);

  fs.writeFileSync(OUT_PUBLIC, json, "utf8");
  console.log(`✓ Copiado:  public/data/comparador-selecciones.json`);

  // Resumen
  const withRoster = Object.values(result).filter(t => t.players.length >= MIN_PLAYERS).length;
  const withLogo   = Object.values(result).filter(t => t.logoUrl).length;
  console.log(`\n── Resumen ──`);
  console.log(`  Selecciones totales : ${Object.keys(result).length}`);
  console.log(`  Con roster valido   : ${withRoster}`);
  console.log(`  Con logo ESPN       : ${withLogo}`);
  console.log(`  Partidos en fixture : ${FIXTURE.length}`);
  console.log(`\nListo.`);
}

main().catch(err => {
  console.error("\n❌ Error fatal:", err.message);
  process.exit(1);
});
