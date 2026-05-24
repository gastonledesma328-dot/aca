#!/usr/bin/env node
/*
  Actualiza data/worldcup11-players.json usando endpoints publicos/no oficiales de ESPN.

  Uso:
    node scripts/update-worldcup11-espn.js

  Que hace:
    - Conserva tus formaciones actuales.
    - Busca selecciones reales de ESPN fifa.world.
    - Descarta placeholders de ESPN tipo Group A Winner, Quarterfinal Winner, Round of 16 Winner, etc.
    - El JSON final queda SOLO con paises/selecciones participantes encontrados en ESPN.
    - Intenta traer jugadores/roster por seleccion.
    - Si ESPN no trae suficientes jugadores de una seleccion participante, conserva los jugadores existentes de tu JSON.
    - Guarda en data/worldcup11-players.json.
    - Si existe public/data, tambien copia el mismo JSON a public/data/worldcup11-players.json.
*/

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const MAIN_JSON_PATH = path.join(ROOT_DIR, "data", "worldcup11-players.json");
const PUBLIC_JSON_PATH = path.join(ROOT_DIR, "public", "data", "worldcup11-players.json");

const ESPN_LEAGUE = "fifa.world";
const ESPN_SITE_BASE = `https://site.api.espn.com/apis/site/v2/sports/soccer/${ESPN_LEAGUE}`;
const ESPN_CORE_BASE = `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${ESPN_LEAGUE}`;
const ESPN_SPORTS_CORE_BASE = "https://sports.core.api.espn.com/v2/sports/soccer";

const MIN_PLAYERS_TO_REPLACE_COUNTRY = 8;
const REQUEST_DELAY_MS = 120;
const MAX_TEAMS = Number(process.env.MAX_TEAMS || 200);

const COUNTRY_NAME_FIXES = new Map([
  ["United States", "Estados Unidos"],
  ["USA", "Estados Unidos"],
  ["USMNT", "Estados Unidos"],
  ["Brazil", "Brasil"],
  ["Germany", "Alemania"],
  ["England", "Inglaterra"],
  ["Spain", "España"],
  ["France", "Francia"],
  ["Netherlands", "Países Bajos"],
  ["Holland", "Países Bajos"],
  ["Belgium", "Bélgica"],
  ["Mexico", "México"],
  ["Croatia", "Croacia"],
  ["Morocco", "Marruecos"],
  ["Czechia", "Chequia"],
  ["Czech Republic", "República Checa"],
  ["South Korea", "Corea del Sur"],
  ["Korea Republic", "Corea del Sur"],
  ["Ivory Coast", "Costa de Marfil"],
  ["Côte d'Ivoire", "Costa de Marfil"],
  ["Saudi Arabia", "Arabia Saudita"],
  ["Türkiye", "Turquía"],
  ["Turkey", "Turquía"],
  ["Switzerland", "Suiza"],
  ["Denmark", "Dinamarca"],
  ["Sweden", "Suecia"],
  ["Norway", "Noruega"],
  ["Poland", "Polonia"],
  ["Wales", "Gales"],
  ["Scotland", "Escocia"],
  ["Ukraine", "Ucrania"],
  ["Australia", "Australia"],
  ["Canada", "Canadá"],
  ["Argentina", "Argentina"],
  ["Portugal", "Portugal"],
  ["Uruguay", "Uruguay"],
  ["Colombia", "Colombia"],
  ["Paraguay", "Paraguay"],
  ["Ecuador", "Ecuador"],
  ["Peru", "Perú"],
  ["Venezuela", "Venezuela"],
  ["Chile", "Chile"],
  ["Italy", "Italia"],
  ["Austria", "Austria"],
  ["Serbia", "Serbia"],
  ["Senegal", "Senegal"],
  ["Ghana", "Ghana"],
  ["Nigeria", "Nigeria"],
  ["Cameroon", "Camerún"],
  ["Algeria", "Argelia"],
  ["Tunisia", "Túnez"],
  ["Japan", "Japón"],
  ["Iran", "Irán"],
  ["Qatar", "Qatar"],
  ["Cape Verde", "Cabo Verde"],
  ["Curacao", "Curazao"],
  ["Curaçao", "Curazao"],
  ["Congo DR", "RD Congo"],
  ["DR Congo", "RD Congo"],
  ["Democratic Republic of the Congo", "RD Congo"],
  ["Egypt", "Egipto"],
  ["Haiti", "Haití"],
  ["Iraq", "Irak"],
  ["Jordan", "Jordania"],
  ["New Zealand", "Nueva Zelanda"],
  ["Panama", "Panamá"],
  ["South Africa", "Sudáfrica"],
  ["Uzbekistan", "Uzbekistán"]
]);

const FIFA_FLAG_FIXES = {
  ARG: "ar",
  BRA: "br",
  FRA: "fr",
  ESP: "es",
  GER: "de",
  ENG: "gb-eng",
  ITA: "it",
  POR: "pt",
  NED: "nl",
  BEL: "be",
  MEX: "mx",
  USA: "us",
  URU: "uy",
  COL: "co",
  PAR: "py",
  ECU: "ec",
  PER: "pe",
  VEN: "ve",
  CHI: "cl",
  MAR: "ma",
  CRO: "hr",
  CZE: "cz",
  KOR: "kr",
  SRB: "rs",
  SUI: "ch",
  AUT: "at",
  DEN: "dk",
  SWE: "se",
  NOR: "no",
  POL: "pl",
  TUR: "tr",
  SEN: "sn",
  GHA: "gh",
  NGA: "ng",
  CIV: "ci",
  CMR: "cm",
  ALG: "dz",
  TUN: "tn",
  AUS: "au",
  CAN: "ca",
  WAL: "gb-wls",
  SCO: "gb-sct",
  UKR: "ua",
  JPN: "jp",
  IRN: "ir",
  KSA: "sa",
  QAT: "qa",
  CPV: "cv",
  CTA: "cw",
  CUW: "cw",
  COD: "cd",
  EGY: "eg",
  HAI: "ht",
  IRQ: "iq",
  JOR: "jo",
  NZL: "nz",
  PAN: "pa",
  RSA: "za",
  UZB: "uz"
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}) {
  const retries = options.retries ?? 3;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "PartidosHoy-WorldCup11-Scraper/1.0"
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return await res.json();
    } catch (error) {
      if (attempt === retries) {
        throw new Error(`${error.message} en ${url}`);
      }

      await sleep(350 * attempt);
    }
  }
}

function readExistingJson() {
  if (!fs.existsSync(MAIN_JSON_PATH)) {
    throw new Error(`No existe ${MAIN_JSON_PATH}`);
  }

  return JSON.parse(fs.readFileSync(MAIN_JSON_PATH, "utf8"));
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCountryName(name) {
  const raw = String(name || "").trim();
  if (!raw) return "";

  if (COUNTRY_NAME_FIXES.has(raw)) return COUNTRY_NAME_FIXES.get(raw);

  const normalizedRaw = normalizeText(raw);

  for (const [key, value] of COUNTRY_NAME_FIXES.entries()) {
    if (normalizeText(key) === normalizedRaw) return value;
  }

  return raw;
}

function makeCountryKey(name) {
  return normalizeText(normalizeCountryName(name));
}

function isPlaceholderTeam(team) {
  const nameParts = [
    team?.displayName,
    team?.name,
    team?.location,
    team?.shortDisplayName,
    team?.abbreviation,
    team?.slug
  ];

  const text = normalizeText(nameParts.filter(Boolean).join(" "));

  if (!text) return true;

  return /\bgroup\b/.test(text)
    || /\bwinner\b/.test(text)
    || /\bloser\b/.test(text)
    || /\b2nd place\b/.test(text)
    || /\bsecond place\b/.test(text)
    || /\bround of 16\b/.test(text)
    || /\bquarterfinal\b/.test(text)
    || /\bsemifinal\b/.test(text)
    || /\bthird place\b/.test(text)
    || /\btbd\b/.test(text)
    || /\bto be determined\b/.test(text);
}

function normalizePosition(position) {
  const raw = String(position || "").trim();
  const compact = normalizeText(raw).replace(/\s+/g, " ");

  if (!compact) return "CM";

  const direct = raw.toUpperCase().trim();
  const allowed = new Set(["GK", "RB", "CB", "LB", "LWB", "RWB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST"]);
  if (allowed.has(direct)) return direct;

  if (/goalkeeper|portero|arquero/.test(compact)) return "GK";
  if (/right back|right-back|lateral derecho|defender right/.test(compact)) return "RB";
  if (/left back|left-back|lateral izquierdo|defender left/.test(compact)) return "LB";
  if (/centre back|center back|central defender|defensa central|defender/.test(compact)) return "CB";
  if (/defensive midfielder|mediocentro defensivo|volante defensivo|holding midfielder/.test(compact)) return "CDM";
  if (/attacking midfielder|enganche|mediapunta|media punta/.test(compact)) return "CAM";
  if (/left wing|left winger|extremo izquierdo/.test(compact)) return "LW";
  if (/right wing|right winger|extremo derecho/.test(compact)) return "RW";
  if (/left midfield|volante izquierdo/.test(compact)) return "LM";
  if (/right midfield|volante derecho/.test(compact)) return "RM";
  if (/forward|striker|delantero|centre forward|center forward/.test(compact)) return "ST";
  if (/midfielder|mediocampista|volante/.test(compact)) return "CM";

  return "CM";
}

function getAthleteName(athlete) {
  return athlete?.displayName || athlete?.fullName || athlete?.name || athlete?.shortName || "";
}

function getAthletePosition(athlete) {
  return athlete?.position?.abbreviation || athlete?.position?.name || athlete?.position?.displayName || athlete?.position || "";
}

function getFlagCode(team) {
  const abbreviation = String(team?.abbreviation || team?.abbrev || "").toUpperCase();
  if (FIFA_FLAG_FIXES[abbreviation]) return FIFA_FLAG_FIXES[abbreviation];

  const slug = String(team?.slug || "").toLowerCase();
  const slugParts = slug.split("-");
  const last = slugParts[slugParts.length - 1];
  if (last && last.length === 2) return last;

  return "un";
}

function dedupePlayers(players) {
  const seen = new Set();
  const clean = [];

  for (const player of players || []) {
    const name = String(player.name || "").trim();
    if (!name) continue;

    const key = normalizeText(name);
    if (seen.has(key)) continue;
    seen.add(key);

    clean.push({
      name,
      position: normalizePosition(player.position),
      status: player.status || "Actual"
    });
  }

  return clean.sort((a, b) => {
    const order = ["GK", "RB", "CB", "LB", "LWB", "RWB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST"];
    return order.indexOf(a.position) - order.indexOf(b.position) || a.name.localeCompare(b.name, "es");
  });
}

async function resolveRef(ref) {
  if (!ref) return null;
  await sleep(REQUEST_DELAY_MS);
  return fetchJson(ref);
}

function extractTeamsFromSitePayload(payload) {
  const teams = [];
  const leagues = payload?.sports?.flatMap(sport => sport.leagues || []) || [];

  for (const league of leagues) {
    for (const item of league.teams || []) {
      const team = item.team || item;
      if (team?.id) teams.push(team);
    }
  }

  return teams;
}

async function getTeams() {
  const teamsById = new Map();

  try {
    const siteTeams = await fetchJson(`${ESPN_SITE_BASE}/teams?limit=${MAX_TEAMS}`);
    for (const team of extractTeamsFromSitePayload(siteTeams)) {
      if (!isPlaceholderTeam(team)) {
        teamsById.set(String(team.id), team);
      }
    }
  } catch (error) {
    console.warn(`Aviso: no se pudieron leer equipos desde site.api: ${error.message}`);
  }

  try {
    const coreTeams = await fetchJson(`${ESPN_CORE_BASE}/teams?limit=${MAX_TEAMS}`);
    const refs = coreTeams.items || [];

    for (const item of refs.slice(0, MAX_TEAMS)) {
      const ref = item.$ref || item.href || item.ref;
      if (!ref) continue;

      try {
        const coreTeam = await resolveRef(ref);
        const team = coreTeam.team || coreTeam;

        if (team?.id && !isPlaceholderTeam(team)) {
          teamsById.set(String(team.id), {
            ...teamsById.get(String(team.id)),
            ...team
          });
        }
      } catch (error) {
        console.warn(`Aviso: no se pudo resolver equipo ${ref}: ${error.message}`);
      }
    }
  } catch (error) {
    console.warn(`Aviso: no se pudieron leer equipos desde core.api: ${error.message}`);
  }

  return Array.from(teamsById.values())
    .filter(team => team?.id && !isPlaceholderTeam(team))
    .sort((a, b) => {
      const nameA = normalizeCountryName(a.displayName || a.name || a.location || a.shortDisplayName || "");
      const nameB = normalizeCountryName(b.displayName || b.name || b.location || b.shortDisplayName || "");
      return nameA.localeCompare(nameB, "es");
    });
}

async function getRosterFromSite(teamId) {
  const urls = [
    `${ESPN_SITE_BASE}/teams/${teamId}/roster`,
    `${ESPN_SITE_BASE}/teams/${teamId}?enable=roster`
  ];

  for (const url of urls) {
    try {
      const payload = await fetchJson(url);
      const athletes = [];

      if (Array.isArray(payload?.athletes)) athletes.push(...payload.athletes);
      if (Array.isArray(payload?.team?.athletes)) athletes.push(...payload.team.athletes);
      if (Array.isArray(payload?.roster?.athletes)) athletes.push(...payload.roster.athletes);

      if (Array.isArray(payload?.groups)) {
        for (const group of payload.groups) {
          if (Array.isArray(group.athletes)) athletes.push(...group.athletes);
          if (Array.isArray(group.items)) athletes.push(...group.items);
        }
      }

      const players = athletes.map(item => {
        const athlete = item.athlete || item;
        return {
          name: getAthleteName(athlete),
          position: getAthletePosition(athlete),
          status: item.starter ? "Titular" : "Actual"
        };
      });

      const clean = dedupePlayers(players);
      if (clean.length) return clean;
    } catch (_) {
      // Probamos el siguiente endpoint.
    }
  }

  return [];
}

async function getRosterFromCore(teamId) {
  const urls = [
    `${ESPN_CORE_BASE}/teams/${teamId}/athletes?limit=80`,
    `${ESPN_SPORTS_CORE_BASE}/teams/${teamId}/athletes?limit=80`,
    `${ESPN_CORE_BASE}/seasons/2026/teams/${teamId}/athletes?limit=80`
  ];

  for (const url of urls) {
    try {
      const payload = await fetchJson(url);
      const items = payload.items || payload.athletes || [];
      const players = [];

      for (const item of items) {
        let athlete = item.athlete || item;

        if (item.$ref || item.href || item.ref) {
          try {
            athlete = await resolveRef(item.$ref || item.href || item.ref);
          } catch (_) {
            continue;
          }
        }

        players.push({
          name: getAthleteName(athlete),
          position: getAthletePosition(athlete),
          status: "Actual"
        });
      }

      const clean = dedupePlayers(players);
      if (clean.length) return clean;
    } catch (_) {
      // Probamos el siguiente endpoint.
    }
  }

  return [];
}

async function getTeamRoster(teamId) {
  const siteRoster = await getRosterFromSite(teamId);
  if (siteRoster.length) return siteRoster;

  return getRosterFromCore(teamId);
}

function buildExistingCountryMap(existingCountries) {
  const map = new Map();

  for (const country of existingCountries || []) {
    map.set(makeCountryKey(country.country), country);
  }

  return map;
}

function buildFinalParticipantCountries(existingCountries, scrapedCountries) {
  const existingMap = buildExistingCountryMap(existingCountries);
  const finalCountries = [];
  const used = new Set();

  for (const scrapedCountry of scrapedCountries) {
    const key = makeCountryKey(scrapedCountry.country);
    if (!key || used.has(key)) continue;

    const existingCountry = existingMap.get(key);
    const scrapedHasGoodRoster = scrapedCountry.players.length >= MIN_PLAYERS_TO_REPLACE_COUNTRY;

    if (scrapedHasGoodRoster) {
      finalCountries.push({
        country: existingCountry?.country || scrapedCountry.country,
        flagCode: existingCountry?.flagCode || scrapedCountry.flagCode || "un",
        dt: existingCountry?.dt || scrapedCountry.dt || "",
        players: scrapedCountry.players
      });
    } else if (existingCountry && Array.isArray(existingCountry.players) && existingCountry.players.length) {
      finalCountries.push({
        ...existingCountry,
        flagCode: existingCountry.flagCode || scrapedCountry.flagCode || "un",
        players: dedupePlayers(existingCountry.players)
      });
    } else {
      console.warn(`  Omitido ${scrapedCountry.country}: ESPN no trajo jugadores suficientes y no existe respaldo manual.`);
    }

    used.add(key);
  }

  return finalCountries.sort((a, b) => a.country.localeCompare(b.country, "es"));
}

async function main() {
  console.log("Leyendo JSON actual...");
  const existing = readExistingJson();

  if (!Array.isArray(existing.formations)) {
    throw new Error("El JSON actual no tiene formations.");
  }

  console.log("Consultando solo selecciones participantes reales de ESPN fifa.world...");
  const teams = await getTeams();
  console.log(`Selecciones participantes encontradas: ${teams.length}`);

  const scrapedCountries = [];

  for (const [index, team] of teams.entries()) {
    const rawName = team.displayName || team.name || team.location || team.shortDisplayName || "";
    const countryName = normalizeCountryName(rawName);
    const teamId = team.id;

    if (!countryName || !teamId || isPlaceholderTeam(team)) continue;

    console.log(`[${index + 1}/${teams.length}] ${countryName} (${teamId})`);

    let players = [];

    try {
      players = await getTeamRoster(teamId);
    } catch (error) {
      console.warn(`  Aviso: no se pudo traer roster: ${error.message}`);
    }

    if (!players.length) {
      console.warn("  Sin jugadores desde ESPN. Se usara respaldo manual si existe.");
    } else {
      console.log(`  Jugadores ESPN: ${players.length}`);
    }

    scrapedCountries.push({
      country: countryName,
      flagCode: getFlagCode(team),
      dt: "",
      players
    });
  }

  const finalCountries = buildFinalParticipantCountries(existing.countries || [], scrapedCountries);

  const finalJson = {
    formations: existing.formations,
    countries: finalCountries,
    meta: {
      source: "ESPN fifa.world participantes reales + respaldo manual del JSON anterior",
      updatedAt: new Date().toISOString(),
      totalCountries: finalCountries.length,
      espnTeamsFound: teams.length,
      note: "Generado por scripts/update-worldcup11-espn.js. El resultado final incluye solo selecciones reales encontradas en ESPN fifa.world. Se descartan placeholders como Group Winner, Round of 16 Winner, Quarterfinal Winner, etc."
    }
  };

  const output = `${JSON.stringify(finalJson, null, 2)}\n`;

  fs.writeFileSync(MAIN_JSON_PATH, output, "utf8");
  console.log(`Guardado: ${path.relative(ROOT_DIR, MAIN_JSON_PATH)}`);

  if (fs.existsSync(path.dirname(PUBLIC_JSON_PATH))) {
    fs.writeFileSync(PUBLIC_JSON_PATH, output, "utf8");
    console.log(`Copiado: ${path.relative(ROOT_DIR, PUBLIC_JSON_PATH)}`);
  }

  console.log(`Listo. JSON final con ${finalCountries.length} selecciones participantes.`);
}

main().catch(error => {
  console.error("Error actualizando worldcup11-players.json:");
  console.error(error);
  process.exit(1);
});
