import fs from "node:fs/promises";

let CACHE_AGENDA = null;
let CACHE_AGENDA_TIME = 0;

let CACHE_LIVE = null;
let CACHE_LIVE_TIME = 0;

const CACHE_AGENDA_MS = 2 * 60 * 1000; // 2 minutos
const CACHE_LIVE_MS = 45 * 1000; // 45 segundos

const BASE_IMG = "https://raw.githubusercontent.com/gastonledesma328-dot/aca/refs/heads/main/img";

const LEAGUES = {
  // FIFA / Mundo
  "fifa.world": "Mundial FIFA",
  "fifa.cwc": "Mundial de Clubes FIFA",
  "fifa.worldq.conmebol": "Eliminatorias CONMEBOL",
  "fifa.worldq.uefa": "Eliminatorias UEFA",

  // Europa top
  "uefa.champions": "UEFA Champions League",
  "uefa.europa": "UEFA Europa League",
  "uefa.europa.conf": "UEFA Conference League",
  "eng.1": "Premier League",
  "esp.1": "LaLiga",
  "ita.1": "Serie A",
  "ger.1": "Bundesliga",
  "fra.1": "Ligue 1",
  "por.1": "Primeira Liga",
  "ned.1": "Eredivisie",

  // Sudamérica
  "conmebol.libertadores": "CONMEBOL Libertadores",
  "conmebol.sudamericana": "CONMEBOL Sudamericana",
  "bra.1": "Brasileirão Serie A",
  "bra.2": "Brasileirão Serie B",
  "arg.1": "Liga Profesional Argentina",
  "arg.2": "Primera Nacional Argentina",
  "arg.copa": "Copa Argentina",
  "uru.1": "Campeonato Uruguayo",
  "chi.1": "Primera División Chile",
  "col.1": "Primera A Colombia",
  "ecu.1": "LigaPro Ecuador",
  "per.1": "Liga 1 Perú",
  "par.1": "Liga de Paraguay",
  "bol.1": "Liga Profesional Boliviana",
  "ven.1": "Primera División Venezuela",

  // Norteamérica
  "mex.1": "Liga MX",
  "usa.1": "MLS",
  "concacaf.champions": "CONCACAF Champions Cup",

  // Femenino
  "fifa.wwc": "Mundial Femenino FIFA",
  "uefa.wchampions": "UEFA Women's Champions League",
  "eng.w.1": "Women's Super League Inglaterra",
  "usa.nwsl": "NWSL Estados Unidos",
};

const LEAGUE_PRIORITY = {
  "fifa.world": 1,
  "fifa.cwc": 2,
  "fifa.worldq.conmebol": 4,
  "fifa.worldq.uefa": 5,

  "uefa.champions": 10,
  "uefa.europa": 11,
  "uefa.europa.conf": 12,
  "eng.1": 20,
  "esp.1": 21,
  "ita.1": 22,
  "ger.1": 23,
  "fra.1": 24,
  "por.1": 50,
  "ned.1": 51,

  "conmebol.libertadores": 100,
  "conmebol.sudamericana": 101,
  "bra.1": 110,
  "bra.2": 112,
  "arg.1": 120,
  "arg.copa": 121,
  "arg.2": 123,
  "uru.1": 130,
  "chi.1": 131,
  "col.1": 132,
  "ecu.1": 133,
  "per.1": 134,
  "par.1": 135,
  "bol.1": 136,
  "ven.1": 137,

  "mex.1": 200,
  "usa.1": 201,
  "concacaf.champions": 202,

  "fifa.wwc": 500,
  "uefa.wchampions": 501,
  "eng.w.1": 503,
  "usa.nwsl": 504,
};

const LEAGUE_365_FALLBACKS = [
  {
    slug: "bol.1",
    nombre: "Liga Profesional Boliviana",
    prioridad: LEAGUE_PRIORITY["bol.1"] ?? 136,
    match: /bolivia|boliviana|division profesional bolivia|primera division bolivia/i,
    exclude: /saudi|saudí|arabia|promerica|costa rica|femenina/i,
  },
  {
    slug: "uru.1",
    nombre: "Campeonato Uruguayo",
    prioridad: LEAGUE_PRIORITY["uru.1"] ?? 130,
    match: /uruguay|uruguayo|campeonato uruguayo|primera division uruguay|liga auf uruguaya|liga uruguaya/i,
    exclude: /promerica|costa rica|saudi|saudí|arabia/i,
  },
  {
    slug: "par.1",
    nombre: "Liga de Paraguay",
    prioridad: LEAGUE_PRIORITY["par.1"] ?? 135,
    match: /paraguay|paraguayo|paraguaya|liga de paraguay|primera division paraguay|division de honor|copa de primera/i,
    exclude: /promerica|costa rica|saudi|saudí|arabia/i,
  },
  {
    slug: "ecu.1",
    nombre: "LigaPro Ecuador",
    prioridad: LEAGUE_PRIORITY["ecu.1"] ?? 133,
    match: /ecuador|ecuatoriana|ligapro ecuador|liga pro ecuador|serie a ecuador|liga pro\b/i,
    exclude: /saudi|saudí|arabia|liga profesional saud|promerica|costa rica|femenina/i,
  },
];

const SCOREBOARD_URLS = [
  "https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard",
  "https://site.web.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard",
];

const SUMMARY_URLS = [
  "https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/summary?event={eventId}",
  "https://site.web.api.espn.com/apis/site/v2/sports/soccer/{league}/summary?event={eventId}",
];

const DETAILS_365_URLS = [
  "https://webws.365scores.com/web/game/?appTypeId=5&langId=14&timezoneName=America%2FBuenos_Aires&userCountryId=386&gameId={gameId}",
  "https://webws.365scores.com/web/gamecenter/?appTypeId=5&langId=14&timezoneName=America%2FBuenos_Aires&userCountryId=386&gameId={gameId}",
  "https://webws.365scores.com/web/game/?appTypeId=5&langId=14&timezoneName=America%2FBuenos_Aires&userCountryId=386&id={gameId}",
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0",
  "Accept": "application/json,text/plain,*/*",
  "Referer": "https://www.espn.com.ar/futbol/calendario",
};

const HEADERS_365 = {
  "User-Agent": "Mozilla/5.0",
  "Accept": "application/json,text/plain,*/*",
  "Origin": "https://www.365scores.com",
  "Referer": "https://www.365scores.com/",
};

function jsonResponse(data, status = 200, maxAge = 60) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": `public, max-age=${maxAge}`,
    },
  });
}

function fechaArgentinaDate() {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    yyyy: map.year,
    mm: map.month,
    dd: map.day,
    yyyymmdd: `${map.year}${map.month}${map.day}`,
    yyyy_mm_dd: `${map.year}-${map.month}-${map.day}`,
    ddmmyyyy: `${map.day}/${map.month}/${map.year}`,
  };
}

function fechaApiUTC() {
  return fechaArgentinaDate().yyyymmdd;
}

function toArgentinaDateTime(iso) {
  if (!iso) {
    return {
      fecha: null,
      hora_inicio: null,
    };
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return {
      fecha: null,
      hora_inicio: null,
    };
  }

  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    fecha: `${map.year}-${map.month}-${map.day}`,
    hora_inicio: `${map.hour}:${map.minute}`,
  };
}

/* ============================================================
   UTILIDADES 365SCORES
============================================================ */

function normalizarHoraHHMM(value) {
  const match = String(value || "").match(/\b(\d{1,2}):(\d{2})\b/);

  if (!match) return null;

  const hh = String(match[1]).padStart(2, "0");
  const mm = String(match[2]).padStart(2, "0");

  return `${hh}:${mm}`;
}

function isoTieneZonaHoraria(value) {
  const raw = String(value || "");
  return /z$/i.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw);
}

function fechaHoraDesde365StartTime(startTime) {
  if (!startTime) {
    return {
      fecha_365_arg: null,
      hora_inicio_365: null,
    };
  }

  const raw = String(startTime);

  if (!isoTieneZonaHoraria(raw)) {
    const fechaMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const hora = normalizarHoraHHMM(raw);

    return {
      fecha_365_arg: fechaMatch
        ? `${fechaMatch[1]}-${fechaMatch[2]}-${fechaMatch[3]}`
        : null,
      hora_inicio_365: hora,
    };
  }

  const convertido = toArgentinaDateTime(raw);

  return {
    fecha_365_arg: convertido.fecha,
    hora_inicio_365: convertido.hora_inicio,
  };
}

function normalizarScore(score) {
  if (score === undefined || score === null) return null;

  if (typeof score === "object") {
    score = score.value ?? score.displayValue ?? score.score;
  }

  if (score === undefined || score === null) return null;

  const number = Number(score);
  return Number.isFinite(number) ? String(number) : String(score);
}

function minutoNumero(value) {
  if (!value) return 0;
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

/* ============================================================
   LOGOS
============================================================ */

function obtenerLogo(team) {
  const logos = team?.logos || [];

  for (const logo of logos) {
    if (logo.href && logo.href.toLowerCase().includes(".png")) {
      return logo.href;
    }
  }

  if (logos[0]?.href) return logos[0].href;
  if (team?.logo) return team.logo;
  if (team?.id) return `https://a.espncdn.com/i/teamlogos/soccer/500/${team.id}.png`;

  return null;
}

function obtenerLogoLiga(leagueData, leagueSlug) {
  const fallback = {
    // FIFA / Confederaciones
    "fifa.world": `${BASE_IMG}/liga_confederaciones/fifa.png`,
    "fifa.cwc": `${BASE_IMG}/liga_confederaciones/fifa.png`,
    "fifa.worldq.conmebol": `${BASE_IMG}/liga_confederaciones/conmebol.png`,
    "fifa.worldq.uefa": `${BASE_IMG}/liga_confederaciones/uefa.png`,

    // Europa
    "uefa.champions": `${BASE_IMG}/ligas/uefa_champions.png`,
    "uefa.europa": `${BASE_IMG}/ligas/uefa_europa.png`,
    "uefa.europa.conf": `${BASE_IMG}/ligas/uefa_europa_conf.png`,

    "eng.1": `${BASE_IMG}/ligas/premier_league.png`,
    "esp.1": `${BASE_IMG}/ligas/espana.png`,
    "ita.1": `${BASE_IMG}/ligas/serie_a.png`,
    "ger.1": `${BASE_IMG}/ligas/bundesliga.png`,
    "fra.1": `${BASE_IMG}/ligas/ligue_1.png`,
    "por.1": `${BASE_IMG}/ligas/liga_portugal_bwin.png`,
    "ned.1": `${BASE_IMG}/ligas/eredivise.png`,

    // Sudamérica
    "conmebol.libertadores": `${BASE_IMG}/ligas/conmebol_libertadores.png`,
    "conmebol.sudamericana": `${BASE_IMG}/liga_confederaciones/conmebol.png`,

    "bra.1": `${BASE_IMG}/ligas/brasil.png`,
    "bra.2": `${BASE_IMG}/ligas/Campeonato_Brasileiro_Série_B.png`,
    "arg.1": `${BASE_IMG}/ligas/liga_profesional_arg.png`,
    "arg.2": `${BASE_IMG}/ligas/argentina_primeranacional.png`,
    "arg.copa": `${BASE_IMG}/ligas/liga_profesional_arg.png`,

    "uru.1": `${BASE_IMG}/ligas/liga_auf_uruguaya.png`,
    "chi.1": `${BASE_IMG}/ligas/liga_de_primera_Itaú.png`,
    "col.1": `${BASE_IMG}/ligas/Liga_BetPlay_Dimayor.png`,
    "ecu.1": `${BASE_IMG}/ligas/LigaPro_ecuador.png`,
    "per.1": `${BASE_IMG}/ligas/liga_1_peru.png`,
    "par.1": `${BASE_IMG}/ligas/primera_division_de_paraguay.png`,
    "bol.1": `${BASE_IMG}/ligas/Liga_profesional_boliviana.png`,
    "ven.1": `${BASE_IMG}/ligas/liga_futve_de_venezuela.png`,

    // Norteamérica
    "mex.1": `${BASE_IMG}/ligas/liga_bbva_mx.png`,
    "usa.1": `${BASE_IMG}/ligas/Major_League_Soccer.png`,
    "concacaf.champions": `${BASE_IMG}/liga_confederaciones/concacaf.png`,

    // Otros disponibles en tu repo
    "swe.1": `${BASE_IMG}/ligas/Allsvenskan.png`,
    "aus.1": `${BASE_IMG}/ligas/australia_league.png`,
    "jpn.1": `${BASE_IMG}/ligas/j_league.png`,
    "kor.1": `${BASE_IMG}/ligas/k_league.png`,
    "chn.1": `${BASE_IMG}/ligas/superliga_de_china.png`,
    "pol.1": `${BASE_IMG}/ligas/primera_division_polonia.png`,

    // Femenino / ascenso argentino disponibles
    "arg.w": `${BASE_IMG}/ligas/argentina_fem.png`,
    "arg.3": `${BASE_IMG}/ligas/argentina_primera_b.png`,
    "arg.4": `${BASE_IMG}/ligas/argentina_primera_c.png`,
  };

  // Primero usamos tus logos locales del repo para evitar logos rotos de ESPN.
  if (fallback[leagueSlug]) {
    return fallback[leagueSlug];
  }

  // Si no hay logo local para esa liga, usamos el logo que venga de ESPN.
  const logos = leagueData?.logos || [];

  for (const logo of logos) {
    if (logo.href && logo.href.toLowerCase().includes(".png")) {
      return logo.href;
    }
  }

  if (logos[0]?.href) return logos[0].href;

  return null;
}

/* ============================================================
   ESPN
============================================================ */

function extraerEstado(competition) {
  const status = competition?.status || {};
  const type = status.type || {};

  const estado_nombre = type.name || null;
  const completado = Boolean(type.completed);
  const minuto = status.displayClock || null;

  let mostrar_tiempo = type.shortDetail || type.description || null;

  if (
    completado ||
    estado_nombre === "STATUS_FINAL" ||
    estado_nombre === "STATUS_FULL_TIME"
  ) {
    mostrar_tiempo = "Fin";
  } else if (
    estado_nombre !== "STATUS_SCHEDULED" &&
    minuto &&
    minuto !== "0'"
  ) {
    mostrar_tiempo = minuto;
  }

  return {
    estado: type.description || null,
    estado_corto: type.shortDetail || null,
    estado_nombre,
    completado,
    minuto,
    periodo: status.period || null,
    mostrar_tiempo,
  };
}

async function elegirCompetenciaMasActualizada(event, leagueSlug) {
  return event.competitions?.[0] || {};
}

function partidoEmpezo(estado, marcadorLocal, marcadorVisitante) {
  const activos = new Set([
    "STATUS_IN_PROGRESS",
    "STATUS_FIRST_HALF",
    "STATUS_SECOND_HALF",
    "STATUS_HALFTIME",
    "STATUS_END_PERIOD",
    "STATUS_FINAL",
    "STATUS_FULL_TIME",
  ]);

  const noIniciados = new Set([
    "STATUS_SCHEDULED",
    "STATUS_POSTPONED",
    "STATUS_CANCELED",
    "STATUS_SUSPENDED",
    "STATUS_DELAYED",
    "STATUS_ABANDONED",
  ]);

  if (noIniciados.has(estado.estado_nombre)) return false;
  if (estado.completado) return true;
  if (activos.has(estado.estado_nombre)) return true;

  if (
    estado.minuto &&
    estado.minuto !== "0'" &&
    estado.estado_nombre !== "STATUS_SCHEDULED"
  ) {
    return true;
  }

  const gl = Number(marcadorLocal || 0);
  const gv = Number(marcadorVisitante || 0);

  return gl > 0 || gv > 0;
}

function extraerEquipos(competition) {
  const competitors = competition?.competitors || [];

  const data = {
    local: null,
    visitante: null,
    local_id: null,
    visitante_id: null,
    local_logo: null,
    visitante_logo: null,
    marcador_local: null,
    marcador_visitante: null,
  };

  for (const c of competitors) {
    const team = c.team || {};
    const nombre = team.displayName || team.shortDisplayName || team.name || null;
    const score = normalizarScore(c.score);

    if (c.homeAway === "home") {
      data.local = nombre;
      data.local_id = team.id || null;
      data.local_logo = obtenerLogo(team);
      data.marcador_local = score;
    }

    if (c.homeAway === "away") {
      data.visitante = nombre;
      data.visitante_id = team.id || null;
      data.visitante_logo = obtenerLogo(team);
      data.marcador_visitante = score;
    }
  }

  return data;
}

/* ============================================================
   INCIDENCIAS ESPN + SUMMARY + 365 DETAILS
============================================================ */

function normalizarMinutoIncidencia(value) {
  if (value === undefined || value === null) return null;

  if (typeof value === "object") {
    value = value.displayValue ?? value.value ?? value.clock ?? value.minute;
  }

  const text = String(value).trim();

  if (!text) return null;
  if (/final|fin|half|descanso/i.test(text)) return text;
  if (text.includes("'")) return text;

  const match = text.match(/\d+/);
  return match ? `${match[0]}'` : text;
}

function textoIncidencia(item) {
  return String(
    item?.type?.text ||
      item?.type?.name ||
      item?.type?.description ||
      item?.type?.abbreviation ||
      item?.type ||
      item?.eventType?.name ||
      item?.eventType?.displayName ||
      item?.eventType?.text ||
      item?.incidentType?.name ||
      item?.incidentType?.text ||
      item?.actionType?.name ||
      item?.description ||
      item?.text ||
      item?.playText ||
      item?.headline ||
      item?.title ||
      item?.name ||
      ""
  );
}

function limpiarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\bclub\b/g, "")
    .replace(/\batletico\b/g, "atletico")
    .replace(/\bdeportivo\b/g, "deportivo")
    .replace(/\bca\b/g, "")
    .replace(/\bfc\b/g, "")
    .replace(/\bcf\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function esGolIncidencia(item) {
  const text = limpiarTexto(textoIncidencia(item));
  const raw = limpiarTexto(JSON.stringify({
    type: item?.type,
    eventType: item?.eventType,
    incidentType: item?.incidentType,
    actionType: item?.actionType,
    name: item?.name,
    text: item?.text,
    title: item?.title,
  }));

  const combinado = `${text} ${raw}`;
  const scoringPlay = item?.scoringPlay === true || item?.scoreValue === 1;

  if (/own goal|autogol|gol en contra/.test(combinado)) return true;
  if (/penalty.*scored|penal.*convertido|penalti.*convertido|penal.*anotado/.test(combinado)) return true;

  return (
    scoringPlay ||
    /(^|\s)goal($|\s)/.test(combinado) ||
    /(^|\s)gol($|\s)/.test(combinado)
  );
}

function esRojaIncidencia(item) {
  const text = limpiarTexto(textoIncidencia(item));
  const raw = limpiarTexto(JSON.stringify({
    type: item?.type,
    eventType: item?.eventType,
    incidentType: item?.incidentType,
    actionType: item?.actionType,
    name: item?.name,
    text: item?.text,
    title: item?.title,
  }));

  const combinado = `${text} ${raw}`;

  return (
    item?.red === true ||
    item?.redCard === true ||
    item?.roja === true ||
    /red card|tarjeta roja|roja|expulsion|expulsado|sent off/.test(combinado)
  );
}

function primerNombreJugador(item) {
  const candidates = [
    item?.athlete,
    item?.player,
    item?.participant,
    item?.competitorPlayer,
    item?.member,
    item?.player1,
    ...(Array.isArray(item?.athletesInvolved) ? item.athletesInvolved : []),
    ...(Array.isArray(item?.athletes) ? item.athletes : []),
    ...(Array.isArray(item?.participants) ? item.participants : []),
    ...(Array.isArray(item?.players) ? item.players : []),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const athlete = candidate.athlete || candidate.player || candidate;
    const name =
      athlete.displayName ||
      athlete.fullName ||
      athlete.shortName ||
      athlete.name ||
      candidate.displayName ||
      candidate.fullName ||
      candidate.name;

    if (name) return String(name).trim();
  }

  const text = String(item?.text || item?.description || item?.playText || item?.title || "").trim();

  if (!text) return null;

  return (
    text
      .replace(/\s+(Goal|Gol|Red Card|Tarjeta Roja|Yellow Card|Tarjeta Amarilla).*$/i, "")
      .replace(/\s+\d+'?\s*$/i, "")
      .trim() || null
  );
}

function equipoIncidencia(item) {
  const team = item?.team || item?.competitor || item?.club || item?.squad || {};

  return {
    id: team.id ? String(team.id) : null,
    nombre:
      team.displayName ||
      team.shortDisplayName ||
      team.name ||
      item?.teamName ||
      item?.competitorName ||
      item?.clubName ||
      item?.equipo ||
      null,
    homeAway: item?.homeAway || team.homeAway || item?.side || null,
  };
}

function tokensEquipo(nombre) {
  return limpiarTexto(nombre)
    .split(" ")
    .filter((t) => t.length >= 3);
}

function similitudNombre(a, b) {
  const ta = tokensEquipo(a);
  const tb = tokensEquipo(b);

  if (!ta.length || !tb.length) return 0;

  const aa = limpiarTexto(a);
  const bb = limpiarTexto(b);

  if (aa === bb) return 100;
  if (aa.includes(bb) || bb.includes(aa)) return 90;

  let hits = 0;

  for (const token of ta) {
    if (tb.includes(token)) hits++;
  }

  return Math.round((hits / Math.max(ta.length, tb.length)) * 100);
}

function ladoIncidencia(item, equipos) {
  const team = equipoIncidencia(item);
  const side = String(team.homeAway || "").toLowerCase();

  if (["home", "local"].includes(side)) return "home";
  if (["away", "visitante"].includes(side)) return "away";

  if (team.id && equipos.local_id && String(team.id) === String(equipos.local_id)) {
    return "home";
  }

  if (team.id && equipos.visitante_id && String(team.id) === String(equipos.visitante_id)) {
    return "away";
  }

  if (team.nombre) {
    if (similitudNombre(team.nombre, equipos.local) >= 70) return "home";
    if (similitudNombre(team.nombre, equipos.visitante) >= 70) return "away";
  }

  return null;
}

function nombreEquipoPorLado(lado, equipos, fallback = null) {
  if (lado === "home") return equipos.local || fallback;
  if (lado === "away") return equipos.visitante || fallback;
  return fallback;
}

function relojIncidencia(item) {
  return normalizarMinutoIncidencia(
    item?.clock?.displayValue ||
      item?.clock ||
      item?.displayClock ||
      item?.displayTime ||
      item?.time ||
      item?.minute ||
      item?.gameTime ||
      item?.gameTimeDisplay ||
      item?.period?.displayClock
  );
}

function listasIncidencias(event, competition) {
  return [
    ...(Array.isArray(competition?.details) ? competition.details : []),
    ...(Array.isArray(competition?.scoringPlays) ? competition.scoringPlays : []),
    ...(Array.isArray(competition?.plays) ? competition.plays : []),
    ...(Array.isArray(event?.details) ? event.details : []),
    ...(Array.isArray(event?.scoringPlays) ? event.scoringPlays : []),
    ...(Array.isArray(event?.plays) ? event.plays : []),
  ];
}

async function cargarSummaryEvento(leagueSlug, eventId) {
  if (!leagueSlug || !eventId) {
    return null;
  }

  for (const template of SUMMARY_URLS) {
    const url = template
      .replace("{league}", leagueSlug)
      .replace("{eventId}", eventId);

    try {
      const response = await fetch(`${url}&_=${Date.now()}`, {
        headers: HEADERS,
        cache: "no-store",
      });

      if (!response.ok) {
        continue;
      }

      return await response.json();
    } catch {
      // Probamos el siguiente endpoint.
    }
  }

  return null;
}

function listasIncidenciasSummary(summary) {
  if (!summary || typeof summary !== "object") {
    return [];
  }

  const headerCompetition =
    summary.header?.competitions?.[0] ||
    summary.competitions?.[0] ||
    {};

  return [
    ...(Array.isArray(headerCompetition?.details) ? headerCompetition.details : []),
    ...(Array.isArray(headerCompetition?.scoringPlays) ? headerCompetition.scoringPlays : []),
    ...(Array.isArray(headerCompetition?.plays) ? headerCompetition.plays : []),

    ...(Array.isArray(summary?.details) ? summary.details : []),
    ...(Array.isArray(summary?.scoringPlays) ? summary.scoringPlays : []),
    ...(Array.isArray(summary?.plays) ? summary.plays : []),

    ...(Array.isArray(summary?.boxscore?.details) ? summary.boxscore.details : []),
    ...(Array.isArray(summary?.boxscore?.scoringPlays) ? summary.boxscore.scoringPlays : []),
    ...(Array.isArray(summary?.boxscore?.plays) ? summary.boxscore.plays : []),

    ...(Array.isArray(summary?.gamepackageJSON?.plays) ? summary.gamepackageJSON.plays : []),
    ...(Array.isArray(summary?.gamepackageJSON?.scoringPlays) ? summary.gamepackageJSON.scoringPlays : []),
  ];
}

function deduplicarIncidencias(items) {
  const vistos = new Set();
  const salida = [];

  for (const item of items) {
    const key = [
      item.tipo || item.type || "",
      item.minuto || "",
      item.jugador || "",
      item.equipo || "",
      item.local_visitante || "",
    ]
      .map((value) => limpiarTexto(value))
      .join("|");

    if (vistos.has(key)) continue;

    vistos.add(key);
    salida.push(item);
  }

  return salida;
}

function extraerIncidenciasDesdeLista(detalles, equipos) {
  const goleadores = [];
  const tarjetas_rojas = [];

  for (const item of detalles) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const tipo = textoIncidencia(item);
    const minuto = relojIncidencia(item);
    const jugador = primerNombreJugador(item);
    const team = equipoIncidencia(item);
    const lado = ladoIncidencia(item, equipos);
    const equipo = nombreEquipoPorLado(lado, equipos, team.nombre);

    if (esGolIncidencia(item)) {
      goleadores.push({
        minuto,
        jugador: jugador || tipo || "Gol",
        equipo,
        local_visitante: lado,
        tipo: tipo || "Gol",
      });
    }

    if (esRojaIncidencia(item)) {
      tarjetas_rojas.push({
        minuto,
        jugador: jugador || tipo || "Tarjeta roja",
        equipo,
        local_visitante: lado,
        tipo: tipo || "Tarjeta Roja",
      });
    }
  }

  const rojasDeduplicadas = deduplicarIncidencias(tarjetas_rojas);

  return {
    goleadores: deduplicarIncidencias(goleadores),
    tarjetas_rojas: rojasDeduplicadas,
    local_rojas: rojasDeduplicadas.filter((card) => card.local_visitante === "home").length,
    visitante_rojas: rojasDeduplicadas.filter((card) => card.local_visitante === "away").length,
  };
}

function extraerIncidenciasESPN(event, competition, equipos) {
  return extraerIncidenciasDesdeLista(listasIncidencias(event, competition), equipos);
}

function extraerIncidenciasDesdeSummary(summary, equipos) {
  return extraerIncidenciasDesdeLista(listasIncidenciasSummary(summary), equipos);
}

function combinarIncidencias(base, extra) {
  const goleadores = deduplicarIncidencias([
    ...(base?.goleadores || []),
    ...(extra?.goleadores || []),
  ]);

  const tarjetas_rojas = deduplicarIncidencias([
    ...(base?.tarjetas_rojas || []),
    ...(extra?.tarjetas_rojas || []),
  ]);

  return {
    goleadores,
    tarjetas_rojas,
    local_rojas: tarjetas_rojas.filter((card) => card.local_visitante === "home").length,
    visitante_rojas: tarjetas_rojas.filter((card) => card.local_visitante === "away").length,
  };
}

/* ============================================================
   DETALLE 365SCORES PARA GOLES / ROJAS FALTANTES
============================================================ */

async function cargarDetalles365(gameId) {
  if (!gameId) {
    return null;
  }

  for (const template of DETAILS_365_URLS) {
    const url = template.replace("{gameId}", encodeURIComponent(String(gameId)));

    try {
      const response = await fetch(`${url}&_=${Date.now()}`, {
        headers: HEADERS_365,
        cache: "no-store",
      });

      if (!response.ok) {
        continue;
      }

      return await response.json();
    } catch {
      // Probamos el siguiente endpoint.
    }
  }

  return null;
}

function obtenerTexto365(item) {
  return String(
    item?.name ||
      item?.title ||
      item?.text ||
      item?.description ||
      item?.eventText ||
      item?.eventName ||
      item?.type?.name ||
      item?.type?.title ||
      item?.eventType?.name ||
      item?.eventType?.title ||
      item?.incidentType?.name ||
      item?.actionType?.name ||
      ""
  );
}

function esObjetoIncidencia365(item) {
  if (!item || typeof item !== "object") return false;

  const texto = limpiarTexto(obtenerTexto365(item));
  const raw = limpiarTexto(JSON.stringify({
    name: item?.name,
    title: item?.title,
    text: item?.text,
    description: item?.description,
    eventType: item?.eventType,
    type: item?.type,
    incidentType: item?.incidentType,
    actionType: item?.actionType,
  }));

  const combinado = `${texto} ${raw}`;

  return (
    /(^|\s)goal($|\s)|(^|\s)gol($|\s)|penal|penalty|autogol|own goal|red card|tarjeta roja|roja|expulsion|expulsado|sent off/.test(combinado) ||
    item?.red === true ||
    item?.redCard === true ||
    item?.scoringPlay === true
  );
}

function recolectarObjetos365(value, salida = [], depth = 0) {
  if (!value || depth > 8 || salida.length > 1200) {
    return salida;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      recolectarObjetos365(item, salida, depth + 1);
    }
    return salida;
  }

  if (typeof value !== "object") {
    return salida;
  }

  if (esObjetoIncidencia365(value)) {
    salida.push(value);
  }

  const preferredKeys = [
    "events",
    "incidents",
    "gameEvents",
    "gameIncidents",
    "plays",
    "timeline",
    "commentary",
    "actions",
    "members",
    "items",
    "statistics",
    "game",
    "data",
  ];

  for (const key of preferredKeys) {
    if (value[key]) {
      recolectarObjetos365(value[key], salida, depth + 1);
    }
  }

  return salida;
}

function id365DeEquipo(item) {
  return (
    item?.competitorId ||
    item?.teamId ||
    item?.participantId ||
    item?.clubId ||
    item?.competitor?.id ||
    item?.team?.id ||
    item?.club?.id ||
    item?.participant?.id ||
    null
  );
}

function nombre365DeEquipo(item) {
  return (
    item?.competitorName ||
    item?.teamName ||
    item?.clubName ||
    item?.participantName ||
    item?.competitor?.name ||
    item?.team?.name ||
    item?.club?.name ||
    item?.participant?.name ||
    null
  );
}

function jugador365(item) {
  const candidates = [
    item?.player,
    item?.player1,
    item?.athlete,
    item?.member,
    item?.competitorPlayer,
    item?.participant,
    ...(Array.isArray(item?.players) ? item.players : []),
    ...(Array.isArray(item?.members) ? item.members : []),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const name =
      candidate?.name ||
      candidate?.displayName ||
      candidate?.fullName ||
      candidate?.shortName ||
      candidate?.player?.name ||
      candidate?.athlete?.name;

    if (name) return String(name).trim();
  }

  const text = String(item?.text || item?.description || item?.title || item?.name || "").trim();

  if (!text) return null;

  return (
    text
      .replace(/\s+(Goal|Gol|Red Card|Tarjeta Roja|Yellow Card|Tarjeta Amarilla).*$/i, "")
      .replace(/\s+\d+'?\s*$/i, "")
      .trim() || null
  );
}

function minuto365Incidencia(item) {
  return normalizarMinutoIncidencia(
    item?.gameTimeDisplay ||
      item?.displayGameTime ||
      item?.timeDisplay ||
      item?.displayTime ||
      item?.minuteDisplay ||
      item?.gameTime ||
      item?.time ||
      item?.minute
  );
}

function lado365(item, partido) {
  const side = String(item?.homeAway || item?.side || "").toLowerCase();

  if (["home", "local"].includes(side)) return "home";
  if (["away", "visitante"].includes(side)) return "away";

  const teamId = id365DeEquipo(item);
  const home365 = partido?.match_365?.local_id_365;
  const away365 = partido?.match_365?.visitante_id_365;

  if (teamId && home365 && String(teamId) === String(home365)) return "home";
  if (teamId && away365 && String(teamId) === String(away365)) return "away";

  const teamName = nombre365DeEquipo(item);

  if (teamName) {
    if (similitudNombre(teamName, partido.local) >= 70) return "home";
    if (similitudNombre(teamName, partido.visitante) >= 70) return "away";
  }

  const text = obtenerTexto365(item);

  if (text) {
    if (similitudNombre(text, partido.local) >= 60) return "home";
    if (similitudNombre(text, partido.visitante) >= 60) return "away";
  }

  return null;
}

function tipo365(item) {
  const text = obtenerTexto365(item);
  return text || "Incidencia";
}

function extraerIncidenciasDesde365Detalles(detalles365, partido) {
  const objetos = recolectarObjetos365(detalles365);
  const goleadores = [];
  const tarjetas_rojas = [];

  for (const item of objetos) {
    const tipo = tipo365(item);
    const minuto = minuto365Incidencia(item);
    const jugador = jugador365(item);
    const lado = lado365(item, partido);
    const equipo = nombreEquipoPorLado(lado, partido, nombre365DeEquipo(item));

    if (esGolIncidencia(item)) {
      goleadores.push({
        minuto,
        jugador: jugador || tipo || "Gol",
        equipo,
        local_visitante: lado,
        tipo: tipo || "Gol",
        fuente: "365Scores",
      });
    }

    if (esRojaIncidencia(item)) {
      tarjetas_rojas.push({
        minuto,
        jugador: jugador || tipo || "Tarjeta roja",
        equipo,
        local_visitante: lado,
        tipo: tipo || "Tarjeta Roja",
        fuente: "365Scores",
      });
    }
  }

  const rojasDeduplicadas = deduplicarIncidencias(tarjetas_rojas);

  return {
    goleadores: deduplicarIncidencias(goleadores),
    tarjetas_rojas: rojasDeduplicadas,
    local_rojas: rojasDeduplicadas.filter((card) => card.local_visitante === "home").length,
    visitante_rojas: rojasDeduplicadas.filter((card) => card.local_visitante === "away").length,
  };
}

async function completarIncidencias365SiFaltan(partido) {
  // Si el partido todavía no empezó, no consultamos detalles de 365Scores.
  // Esto evita rojas/goles falsos en partidos programados.
  if (!partidoPuedeMostrarIncidencias(partido)) {
    return limpiarIncidenciasSiNoCorresponde(partido);
  }

  const faltaIncidencias =
    (partido.goleadores || []).length === 0 &&
    (partido.tarjetas_rojas || []).length === 0;

  const gameId = partido?.match_365?.id_365 || partido?.id_365;

  if (!faltaIncidencias || !gameId) {
    return limpiarIncidenciasSiNoCorresponde(partido);
  }

  const detalles365 = await cargarDetalles365(gameId);

  if (!detalles365) {
    return limpiarIncidenciasSiNoCorresponde(partido);
  }

  const incidencias365 = extraerIncidenciasDesde365Detalles(detalles365, partido);
  const combinadas = combinarIncidencias(
    {
      goleadores: partido.goleadores || [],
      tarjetas_rojas: partido.tarjetas_rojas || [],
    },
    incidencias365
  );

  return limpiarIncidenciasSiNoCorresponde({
    ...partido,
    goleadores: combinadas.goleadores,
    tarjetas_rojas: combinadas.tarjetas_rojas,
    local_rojas: combinadas.local_rojas,
    visitante_rojas: combinadas.visitante_rojas,
    incidencias_365_usado:
      incidencias365.goleadores.length > 0 ||
      incidencias365.tarjetas_rojas.length > 0,
  });
}

/* ============================================================
   365SCORES
============================================================ */

function formatoMinuto365(game) {
  const statusText = game?.statusText || "";
  const shortStatusText = game?.shortStatusText || "";
  const gameTime = Number(game?.gameTime || 0);

  if (
    game?.statusGroup === 4 ||
    /final/i.test(statusText) ||
    /final/i.test(shortStatusText)
  ) {
    return "Fin";
  }

  if (game?.gameTimeDisplay) {
    return String(game.gameTimeDisplay);
  }

  if (gameTime > 0) {
    return `${Math.floor(gameTime)}'`;
  }

  return null;
}

function convertir365Game(game) {
  const local = game?.homeCompetitor?.name || null;
  const visitante = game?.awayCompetitor?.name || null;

  if (!local || !visitante) return null;

  const marcadorLocal = normalizarScore(game?.homeCompetitor?.score);
  const marcadorVisitante = normalizarScore(game?.awayCompetitor?.score);

  const completado =
    game?.statusGroup === 4 ||
    /final/i.test(game?.statusText || "") ||
    /final/i.test(game?.shortStatusText || "");

  const enVivo =
    game?.statusGroup === 3 ||
    (!completado && Number(game?.gameTime || 0) > 0);

  const minuto = formatoMinuto365(game);
  const fechaHora365 = fechaHoraDesde365StartTime(game.startTime);

  const liga365 =
    game.competitionDisplayName ||
    game.competitionName ||
    game.competition?.name ||
    game.competition?.displayName ||
    null;

  const pais365 =
    game.countryName ||
    game.country?.name ||
    game.competition?.countryName ||
    game.competition?.country?.name ||
    game.categoryName ||
    null;

  return {
    id_365: game.id || null,
    local_365: local,
    visitante_365: visitante,
    local_id_365: game?.homeCompetitor?.id || null,
    visitante_id_365: game?.awayCompetitor?.id || null,

    liga_365: liga365,
    pais_365: pais365,
    competition_id_365: game.competitionId || game.competition?.id || null,

    start_365: game.startTime || null,

    fecha_365_arg: fechaHora365.fecha_365_arg,
    hora_inicio_365: fechaHora365.hora_inicio_365,

    estado_365: game.statusText || null,
    estado_corto_365: game.shortStatusText || null,
    status_group_365: game.statusGroup ?? null,
    game_time_365: game.gameTime ?? null,
    minuto_365: minuto,
    completado_365: completado,
    en_vivo_365: enVivo,
    marcador_local_365: marcadorLocal,
    marcador_visitante_365: marcadorVisitante,
    resultado_365:
      marcadorLocal !== null &&
      marcadorVisitante !== null &&
      marcadorLocal !== "-1" &&
      marcadorVisitante !== "-1"
        ? `${marcadorLocal}-${marcadorVisitante}`
        : null,
  };
}

async function fetch365Scores() {
  const fecha = fechaArgentinaDate().ddmmyyyy;

  const urls = [
    `https://webws.365scores.com/web/games/allscores/?appTypeId=5&langId=14&timezoneName=America%2FBuenos_Aires&userCountryId=386&sports=1&startDate=${encodeURIComponent(fecha)}&endDate=${encodeURIComponent(fecha)}&onlyMajorGames=true&withTop=true&topBookmaker=14`,
    `https://webws.365scores.com/web/games/allscores/?appTypeId=5&langId=14&timezoneName=America%2FBuenos_Aires&userCountryId=386&sports=1&startDate=${encodeURIComponent(fecha)}&endDate=${encodeURIComponent(fecha)}&withTop=true&topBookmaker=14`,
  ];

  const todos = [];
  const vistos = new Set();

  for (const url of urls) {
    try {
      const response = await fetch(`${url}&_=${Date.now()}`, {
        headers: HEADERS_365,
        cache: "no-store",
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const games = Array.isArray(data.games) ? data.games : [];

      for (const game of games) {
        const convertido = convertir365Game(game);

        if (!convertido) {
          continue;
        }

        const key = convertido.id_365
          ? String(convertido.id_365)
          : `${convertido.local_365}-${convertido.visitante_365}-${convertido.start_365}`;

        if (vistos.has(key)) {
          continue;
        }

        vistos.add(key);
        todos.push(convertido);
      }
    } catch {
      // Si falla una URL de 365Scores, probamos la siguiente.
    }
  }

  return todos;
}

function buscarPartido365(partido, juegos365) {
  let mejor = null;
  let mejorScore = 0;

  for (const game of juegos365) {
    const directaLocal = similitudNombre(partido.local, game.local_365);
    const directaVisitante = similitudNombre(partido.visitante, game.visitante_365);

    const invertidaLocal = similitudNombre(partido.local, game.visitante_365);
    const invertidaVisitante = similitudNombre(partido.visitante, game.local_365);

    const directa = directaLocal + directaVisitante;
    const invertida = invertidaLocal + invertidaVisitante;

    const score = Math.max(directa, invertida);

    if (score > mejorScore) {
      mejorScore = score;
      mejor = {
        game,
        invertido: invertida > directa,
        score,
      };
    }
  }

  if (!mejor || mejor.score < 110) return null;

  return mejor;
}

function aplicar365(partido, juegos365) {
  const match = buscarPartido365(partido, juegos365);

  if (!match) {
    return {
      ...partido,
      fuente_live: partido.fuente_live || "ESPN",
      match_365: null,
    };
  }

  const game = match.game;

  const marcadorLocal365 = match.invertido
    ? game.marcador_visitante_365
    : game.marcador_local_365;

  const marcadorVisitante365 = match.invertido
    ? game.marcador_local_365
    : game.marcador_visitante_365;

  const tieneMarcador365 =
    marcadorLocal365 !== null &&
    marcadorVisitante365 !== null &&
    marcadorLocal365 !== "-1" &&
    marcadorVisitante365 !== "-1";

  const usar365 =
    game.completado_365 ||
    game.en_vivo_365 ||
    minutoNumero(game.minuto_365) >= minutoNumero(partido.minuto) ||
    tieneMarcador365 ||
    Boolean(game.hora_inicio_365);

  if (!usar365) {
    return {
      ...partido,
      fuente_live: partido.fuente_live || "ESPN",
      match_365: {
        id_365: game.id_365,
        start_365: game.start_365,
        fecha_365_arg: game.fecha_365_arg,
        hora_inicio_365: game.hora_inicio_365,
        score_match: match.score,
        usado: false,
      },
    };
  }

  let fecha = partido.fecha;
  let hora = partido.hora;
  let horaInicio = partido.hora_inicio;
  let mostrarTiempo = partido.mostrar_tiempo;
  let estado = partido.estado;
  let estadoCorto = partido.estado_corto;
  let estadoNombre = partido.estado_nombre;
  let completado = partido.completado;
  let minuto = partido.minuto;

  if (game.fecha_365_arg) {
    fecha = game.fecha_365_arg;
  }

  if (game.hora_inicio_365) {
    horaInicio = game.hora_inicio_365;

    if (!game.completado_365 && !game.minuto_365) {
      hora = game.hora_inicio_365;
      mostrarTiempo = game.hora_inicio_365;
    }
  }

  if (game.completado_365) {
    hora = "Fin";
    mostrarTiempo = "Fin";
    estado = "Finalizado";
    estadoCorto = "Final";
    estadoNombre = "STATUS_FINAL";
    completado = true;
    minuto = "Fin";
  } else if (game.minuto_365) {
    hora = game.minuto_365;
    mostrarTiempo = game.minuto_365;
    estado = game.estado_365 || "En vivo";
    estadoCorto = game.estado_corto_365 || game.minuto_365;
    estadoNombre = "STATUS_IN_PROGRESS";
    completado = false;
    minuto = game.minuto_365;
  }

  const resultado = tieneMarcador365
    ? `${marcadorLocal365}-${marcadorVisitante365}`
    : partido.resultado;

  return {
    ...partido,

    fecha,
    hora_inicio: horaInicio,
    hora,
    mostrar_tiempo: mostrarTiempo,

    estado,
    estado_corto: estadoCorto,
    estado_nombre: estadoNombre,
    completado,
    minuto,

    marcador_local: tieneMarcador365 ? marcadorLocal365 : partido.marcador_local,
    marcador_visitante: tieneMarcador365 ? marcadorVisitante365 : partido.marcador_visitante,

    marcador_local_display: tieneMarcador365 ? marcadorLocal365 : partido.marcador_local_display,
    marcador_visitante_display: tieneMarcador365 ? marcadorVisitante365 : partido.marcador_visitante_display,

    resultado,
    mostrar_marcador: tieneMarcador365 ? true : partido.mostrar_marcador,

    fuente_live: "365Scores",
    match_365: {
      id_365: game.id_365,
      local_365: game.local_365,
      visitante_365: game.visitante_365,
      local_id_365: game.local_id_365,
      visitante_id_365: game.visitante_id_365,
      liga_365: game.liga_365,
      pais_365: game.pais_365,
      competition_id_365: game.competition_id_365,
      start_365: game.start_365,
      fecha_365_arg: game.fecha_365_arg,
      hora_inicio_365: game.hora_inicio_365,
      estado_365: game.estado_365,
      minuto_365: game.minuto_365,
      resultado_365: game.resultado_365,
      score_match: match.score,
      invertido: match.invertido,
      usado: true,
    },
  };
}

/* ============================================================
   FALLBACK 365SCORES PARA LIGAS FALTANTES
============================================================ */

function detectarLiga365Fallback(game) {
  const texto = [
    game.liga_365,
    game.pais_365,
    game.local_365,
    game.visitante_365,
  ].join(" ");

  for (const liga of LEAGUE_365_FALLBACKS) {
    if (liga.exclude && liga.exclude.test(texto)) {
      continue;
    }

    if (liga.match.test(texto)) {
      return liga;
    }
  }

  return null;
}

function yaExistePartidoSimilar(partidos, local, visitante) {
  return partidos.some((partido) => {
    const directa =
      similitudNombre(partido.local, local) >= 70 &&
      similitudNombre(partido.visitante, visitante) >= 70;

    const invertida =
      similitudNombre(partido.local, visitante) >= 70 &&
      similitudNombre(partido.visitante, local) >= 70;

    return directa || invertida;
  });
}

function partidoDesde365(game, liga) {
  const marcadorLocal = game.marcador_local_365;
  const marcadorVisitante = game.marcador_visitante_365;

  const tieneMarcador =
    marcadorLocal !== null &&
    marcadorVisitante !== null &&
    marcadorLocal !== "-1" &&
    marcadorVisitante !== "-1";

  const fecha = game.fecha_365_arg || fechaArgentinaDate().yyyy_mm_dd;
  const horaInicio = game.hora_inicio_365 || null;

  let hora = horaInicio || "--:--";
  let mostrarTiempo = hora;

  if (game.completado_365) {
    hora = "Fin";
    mostrarTiempo = "Fin";
  } else if (game.minuto_365) {
    hora = game.minuto_365;
    mostrarTiempo = game.minuto_365;
  }

  return {
    id: `365-${game.id_365 || `${game.local_365}-${game.visitante_365}`}`,
    id_365: game.id_365 || null,

    partido: `${game.local_365} vs ${game.visitante_365}`,
    local: game.local_365,
    visitante: game.visitante_365,
    local_id: null,
    visitante_id: null,
    local_logo: null,
    visitante_logo: null,

    liga: liga.nombre,
    liga_corta: liga.nombre,
    liga_slug: liga.slug,
    liga_logo: obtenerLogoLiga(null, liga.slug),
    prioridad_liga: liga.prioridad,

    competicion: {
      nombre: liga.nombre,
      nombre_corto: liga.nombre,
      slug: liga.slug,
      logo: obtenerLogoLiga(null, liga.slug),
      prioridad: liga.prioridad,
    },

    fecha,
    hora_inicio: horaInicio,
    hora,
    mostrar_tiempo: mostrarTiempo,

    estado: game.estado_365 || null,
    estado_corto: game.estado_corto_365 || null,
    estado_nombre: game.completado_365
      ? "STATUS_FINAL"
      : game.en_vivo_365
        ? "STATUS_IN_PROGRESS"
        : "STATUS_SCHEDULED",

    completado: game.completado_365,
    minuto: game.minuto_365 || null,
    periodo: null,

    marcador_local: tieneMarcador ? marcadorLocal : null,
    marcador_visitante: tieneMarcador ? marcadorVisitante : null,
    marcador_local_display: tieneMarcador ? marcadorLocal : null,
    marcador_visitante_display: tieneMarcador ? marcadorVisitante : null,
    resultado: tieneMarcador ? `${marcadorLocal}-${marcadorVisitante}` : null,
    mostrar_marcador: tieneMarcador,

    goleadores: [],
    tarjetas_rojas: [],
    local_rojas: 0,
    visitante_rojas: 0,

    fecha_espn: null,
    url_espn: null,

    fuente_live: "365Scores",
    match_365: {
      id_365: game.id_365,
      local_365: game.local_365,
      visitante_365: game.visitante_365,
      local_id_365: game.local_id_365,
      visitante_id_365: game.visitante_id_365,
      liga_365: game.liga_365,
      pais_365: game.pais_365,
      competition_id_365: game.competition_id_365,
      start_365: game.start_365,
      fecha_365_arg: game.fecha_365_arg,
      hora_inicio_365: game.hora_inicio_365,
      estado_365: game.estado_365,
      minuto_365: game.minuto_365,
      resultado_365: game.resultado_365,
      usado: true,
      agregado_desde_365: true,
    },
  };
}

function agregarPartidosFaltantesDesde365(partidos, juegos365) {
  const agregados = [];

  for (const game of juegos365) {
    if (!game.local_365 || !game.visitante_365) {
      continue;
    }

    const liga = detectarLiga365Fallback(game);

    if (!liga) {
      continue;
    }

    if (yaExistePartidoSimilar(partidos, game.local_365, game.visitante_365)) {
      continue;
    }

    agregados.push(partidoDesde365(game, liga));
  }

  return [...partidos, ...agregados];
}

/* ============================================================
   ARMADO DE PARTIDOS ESPN
============================================================ */

async function limpiarEvento(event, leagueSlug, leagueName, leagueLogo = null) {
  const competition = await elegirCompetenciaMasActualizada(event, leagueSlug);
  const equipos = extraerEquipos(competition);
  const estado = extraerEstado(competition);

  let incidencias = extraerIncidenciasESPN(event, competition, equipos);

  const necesitaSummary =
    event?.id &&
    estado.estado_nombre !== "STATUS_SCHEDULED" &&
    estado.estado_nombre !== "STATUS_POSTPONED" &&
    estado.estado_nombre !== "STATUS_CANCELED" &&
    incidencias.goleadores.length === 0 &&
    incidencias.tarjetas_rojas.length === 0;

  if (necesitaSummary) {
    const summary = await cargarSummaryEvento(leagueSlug, event.id);

    if (summary) {
      const incidenciasSummary = extraerIncidenciasDesdeSummary(summary, equipos);
      incidencias = combinarIncidencias(incidencias, incidenciasSummary);
    }
  }

  const mostrarMarcador = partidoEmpezo(
    estado,
    equipos.marcador_local,
    equipos.marcador_visitante
  );

  const fechaEvento = competition.date || event.date;
  const { fecha, hora_inicio } = toArgentinaDateTime(fechaEvento);

  let hora = hora_inicio;

  if (estado.completado) {
    hora = "Fin";
  } else if (
    estado.estado_nombre !== "STATUS_SCHEDULED" &&
    estado.minuto &&
    estado.minuto !== "0'"
  ) {
    hora = estado.minuto;
  }

  const resultado =
    mostrarMarcador &&
    equipos.marcador_local !== null &&
    equipos.marcador_visitante !== null
      ? `${equipos.marcador_local}-${equipos.marcador_visitante}`
      : null;

  const urlEspn = event.links?.[0]?.href || null;
  const prioridad = LEAGUE_PRIORITY[leagueSlug] ?? 9999;

  return {
    id: event.id || null,
    partido:
      equipos.local && equipos.visitante
        ? `${equipos.local} vs ${equipos.visitante}`
        : event.name || null,

    local: equipos.local,
    visitante: equipos.visitante,
    local_id: equipos.local_id,
    visitante_id: equipos.visitante_id,
    local_logo: equipos.local_logo,
    visitante_logo: equipos.visitante_logo,

    liga: leagueName,
    liga_corta: leagueName,
    liga_slug: leagueSlug,
    liga_logo: leagueLogo,
    prioridad_liga: prioridad,

    competicion: {
      nombre: leagueName,
      nombre_corto: leagueName,
      slug: leagueSlug,
      logo: leagueLogo,
      prioridad,
    },

    fecha,
    hora_inicio,

    hora,
    mostrar_tiempo: hora,

    estado: estado.estado,
    estado_corto: estado.estado_corto,
    estado_nombre: estado.estado_nombre,
    completado: estado.completado,
    minuto: estado.minuto,
    periodo: estado.periodo,

    marcador_local: equipos.marcador_local,
    marcador_visitante: equipos.marcador_visitante,

    marcador_local_display: mostrarMarcador ? equipos.marcador_local : null,
    marcador_visitante_display: mostrarMarcador ? equipos.marcador_visitante : null,

    resultado,
    mostrar_marcador: mostrarMarcador,

    goleadores: incidencias.goleadores,
    tarjetas_rojas: incidencias.tarjetas_rojas,
    local_rojas: incidencias.local_rojas,
    visitante_rojas: incidencias.visitante_rojas,

    fecha_espn: fechaEvento || null,
    url_espn: urlEspn,

    fuente_live: "ESPN",
    match_365: null,
  };
}

async function fetchLeague(leagueSlug, leagueName) {
  const params = new URLSearchParams({
    region: "ar",
    lang: "es",
    contentorigin: "espn",
    dates: fechaApiUTC(),
    limit: "300",
    _: String(Date.now()),
  });

  let lastError = null;

  for (const template of SCOREBOARD_URLS) {
    const url = `${template.replace("{league}", leagueSlug)}?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: HEADERS,
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const events = Array.isArray(data.events) ? data.events : [];
      const leagueData = Array.isArray(data.leagues) ? data.leagues[0] : null;

      return {
        leagueSlug,
        leagueName,
        leagueLogo: obtenerLogoLiga(leagueData, leagueSlug),
        events,
        ok: true,
        error: null,
      };
    } catch (error) {
      lastError = error.message;
    }
  }

  return {
    leagueSlug,
    leagueName,
    leagueLogo: obtenerLogoLiga(null, leagueSlug),
    events: [],
    ok: false,
    error: lastError,
  };
}

/* ============================================================
   PARTIDOS QUE CRUZAN AL DÍA SIGUIENTE
============================================================ */

function sumarDiasFechaYYYYMMDD(fecha, dias = 1) {
  if (!fecha) return null;

  const [yyyy, mm, dd] = String(fecha).split("-").map(Number);

  if (!yyyy || !mm || !dd) return null;

  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  date.setUTCDate(date.getUTCDate() + dias);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function horaAMinutos(hora) {
  const match = String(hora || "").match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
}

function partidoDebeAparecerDiaSiguiente(partido) {
  const minutos = horaAMinutos(partido.hora_inicio || partido.hora);

  if (minutos === null) return false;

  return minutos >= 23 * 60;
}

function agregarPartidosAlDiaSiguiente(partidos) {
  const salida = [];
  const vistos = new Set();

  for (const partido of partidos) {
    const keyOriginal = `${partido.id || partido.partido || ""}-${partido.liga_slug || ""}-${partido.fecha || ""}-original`;

    if (!vistos.has(keyOriginal)) {
      salida.push(partido);
      vistos.add(keyOriginal);
    }

    if (!partidoDebeAparecerDiaSiguiente(partido)) {
      continue;
    }

    const fechaSiguiente = sumarDiasFechaYYYYMMDD(partido.fecha, 1);

    if (!fechaSiguiente) {
      continue;
    }

    const copia = {
      ...partido,
      id: `${partido.id || partido.partido}-${fechaSiguiente}-continuacion`,
      fecha: fechaSiguiente,
      fecha_original: partido.fecha,
      partido_cruza_dia: true,
      mostrar_en_dia_siguiente: true,
    };

    const keyCopia = `${copia.id}-${copia.liga_slug || ""}-${copia.fecha}-copia`;

    if (!vistos.has(keyCopia)) {
      salida.push(copia);
      vistos.add(keyCopia);
    }
  }

  return salida;
}

function agruparPorLiga(partidos) {
  const ligas = {};

  for (const partido of partidos) {
    const liga = partido.liga || "Sin competición";
    const prioridad = partido.prioridad_liga ?? 9999;

    if (!ligas[liga]) {
      ligas[liga] = {
        liga,
        liga_slug: partido.liga_slug,
        liga_logo: partido.liga_logo || null,
        prioridad,
        partidos: [],
      };
    }

    if (!ligas[liga].liga_logo && partido.liga_logo) {
      ligas[liga].liga_logo = partido.liga_logo;
    }

    ligas[liga].partidos.push(partido);
  }

  const agrupado = Object.values(ligas).map((ligaData) => {
    ligaData.partidos.sort((a, b) => {
      return (
        String(a.fecha || "").localeCompare(String(b.fecha || "")) ||
        String(a.hora_inicio || "").localeCompare(String(b.hora_inicio || "")) ||
        String(a.partido || "").localeCompare(String(b.partido || ""))
      );
    });

    return {
      liga: ligaData.liga,
      liga_slug: ligaData.liga_slug,
      liga_logo: ligaData.liga_logo || null,
      prioridad: ligaData.prioridad,
      total: ligaData.partidos.length,
      partidos: ligaData.partidos,
    };
  });

  agrupado.sort((a, b) => {
    return (
      (a.prioridad ?? 9999) - (b.prioridad ?? 9999) ||
      String(a.liga || "").localeCompare(String(b.liga || ""))
    );
  });

  return agrupado;
}

/* ============================================================
   BUILD
============================================================ */

async function buildAgenda() {
  const [results, juegos365] = await Promise.all([
    Promise.all(
      Object.entries(LEAGUES).map(([slug, name]) => fetchLeague(slug, name))
    ),
    fetch365Scores(),
  ]);

  const partidos = [];
  const errores = [];
  const vistos = new Set();

  for (const result of results) {
    if (!result.ok) {
      errores.push({
        liga: result.leagueName,
        slug: result.leagueSlug,
        error: result.error,
      });
      continue;
    }

    for (const event of result.events) {
      const key = event.id || `${result.leagueSlug}-${event.name}-${event.date}`;

      if (vistos.has(key)) continue;

      const itemBase = await limpiarEvento(
        event,
        result.leagueSlug,
        result.leagueName,
        result.leagueLogo
      );

      if (itemBase.local && itemBase.visitante) {
        const itemCon365 = aplicar365(itemBase, juegos365);
        const itemFinal = await completarIncidencias365SiFaltan(itemCon365);
        const itemSeguro = limpiarIncidenciasSiNoCorresponde(itemFinal);

        partidos.push(itemSeguro);
        vistos.add(key);
      }
    }
  }

  const partidosConFaltantes365Base = agregarPartidosFaltantesDesde365(partidos, juegos365);
  const partidosConFaltantes365 = [];

  for (const partido of partidosConFaltantes365Base) {
    const partidoConIncidencias = await completarIncidencias365SiFaltan(partido);
    partidosConFaltantes365.push(limpiarIncidenciasSiNoCorresponde(partidoConIncidencias));
  }

  const partidosConCruceDia = agregarPartidosAlDiaSiguiente(partidosConFaltantes365)
    .map(limpiarIncidenciasSiNoCorresponde);

  partidosConCruceDia.sort((a, b) => {
    return (
      (a.prioridad_liga ?? 9999) - (b.prioridad_liga ?? 9999) ||
      String(a.fecha || "").localeCompare(String(b.fecha || "")) ||
      String(a.hora_inicio || "").localeCompare(String(b.hora_inicio || "")) ||
      String(a.partido || "").localeCompare(String(b.partido || ""))
    );
  });

  return {
    fuente: "ESPN Argentina + 365Scores",
    metodo:
      "Cloudflare Worker ESPN scoreboard + ESPN summary para incidencias faltantes + 365Scores detalle por id_365 para goles/rojas faltantes + corrector 365Scores + fallback 365Scores para ligas faltantes + 365Scores completo sin cortar en onlyMajorGames + filtro anti falsos positivos Ecuador + horarios Argentina + logos de liga + caché agenda/live + partidos desde 23:00 duplicados al día siguiente",
    fecha_scrapeo: new Date().toISOString(),
    total: partidosConCruceDia.length,
    total_original: partidos.length,
    total_agregados_desde_365scores: partidosConFaltantes365.length - partidos.length,
    total_agregados_dia_siguiente: partidosConCruceDia.length - partidosConFaltantes365.length,
    total_ligas_consultadas: Object.keys(LEAGUES).length,
    total_partidos_365scores: juegos365.length,
    partidos: partidosConCruceDia,
    agrupado_por_liga: agruparPorLiga(partidosConCruceDia),
    errores,
  };
}

/* ============================================================
   CACHE + LIVE
============================================================ */

async function getAgendaData() {
  const now = Date.now();

  if (CACHE_AGENDA && now - CACHE_AGENDA_TIME < CACHE_AGENDA_MS) {
    return {
      data: CACHE_AGENDA,
      cache_worker: true,
      cache_edad_segundos: Math.round((now - CACHE_AGENDA_TIME) / 1000),
    };
  }

  const data = await buildAgenda();

  CACHE_AGENDA = data;
  CACHE_AGENDA_TIME = now;

  return {
    data,
    cache_worker: false,
    cache_edad_segundos: 0,
  };
}

function textoNormalizado(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}


function partidoPuedeMostrarIncidencias(partido) {
  if (!partido) {
    return false;
  }

  const match365 = partido.match_365 || {};

  const texto = textoNormalizado(
    [
      partido.estado,
      partido.estado_corto,
      partido.estado_nombre,
      partido.minuto,
      partido.mostrar_tiempo,
      partido.hora,
      partido.fuente_live,

      match365.estado_365,
      match365.estado_corto_365,
      match365.minuto_365,
      match365.game_time_365,
      match365.status_group_365,
    ].join(" ")
  );

  // Partidos que todavía no empezaron: nunca deben mostrar rojas ni goles.
  if (
    texto.includes("status_scheduled") ||
    texto.includes("scheduled") ||
    texto.includes("programado") ||
    texto.includes("por jugar") ||
    texto.includes("not started") ||
    texto.includes("status_postponed") ||
    texto.includes("postponed") ||
    texto.includes("suspendido") ||
    texto.includes("status_canceled") ||
    texto.includes("cancelado") ||
    texto.includes("status_delayed") ||
    texto.includes("demorado")
  ) {
    return false;
  }

  // Finalizados: sí pueden mostrar incidencias reales.
  if (
    partido.completado === true ||
    texto.includes("status_final") ||
    texto.includes("status_full_time") ||
    texto.includes("finalizado") ||
    texto.includes("full time") ||
    texto.includes(" fin ") ||
    texto === "fin"
  ) {
    return true;
  }

  // En vivo: sí pueden mostrar incidencias.
  if (
    partido.en_vivo_365 === true ||
    match365.en_vivo_365 === true ||
    match365.status_group_365 === 3 ||
    match365.statusGroup === 3 ||
    texto.includes("status_in_progress") ||
    texto.includes("status_first_half") ||
    texto.includes("status_second_half") ||
    texto.includes("status_halftime") ||
    texto.includes("in progress") ||
    texto.includes("en vivo") ||
    texto.includes("live") ||
    texto.includes("1t") ||
    texto.includes("2t") ||
    texto.includes("primer tiempo") ||
    texto.includes("segundo tiempo") ||
    texto.includes("entretiempo") ||
    texto.includes("halftime") ||
    texto.includes("descanso")
  ) {
    return true;
  }

  // Minutos tipo 12', 45+2', 90+5'
  if (/\b\d{1,3}(?:\+\d{1,2})?'\b/.test(texto)) {
    return true;
  }

  const gameTime365 = Number(match365.game_time_365 || partido.game_time_365 || 0);

  if (Number.isFinite(gameTime365) && gameTime365 > 0 && gameTime365 < 130) {
    return true;
  }

  return false;
}

function limpiarIncidenciasSiNoCorresponde(partido) {
  if (partidoPuedeMostrarIncidencias(partido)) {
    return partido;
  }

  return {
    ...partido,

    goleadores: [],
    tarjetas_rojas: [],
    tarjetas: [],

    local_rojas: 0,
    visitante_rojas: 0,
    tarjetas_rojas_local: 0,
    tarjetas_rojas_visitante: 0,

    incidencias_limpiadas_por_estado: true,
  };
}

function esPartidoLive(partido) {
  if (!partido) {
    return false;
  }

  if (partido.completado === true) {
    return false;
  }

  const match365 = partido.match_365 || {};

  if (
    partido.en_vivo_365 === true ||
    match365.en_vivo_365 === true ||
    match365.status_group_365 === 3 ||
    match365.statusGroup === 3
  ) {
    return true;
  }

  const texto = textoNormalizado(
    [
      partido.estado,
      partido.estado_corto,
      partido.estado_nombre,
      partido.minuto,
      partido.mostrar_tiempo,
      partido.hora,
      partido.fuente_live,

      match365.estado_365,
      match365.estado_corto_365,
      match365.minuto_365,
      match365.game_time_365,
      match365.status_group_365,
    ].join(" ")
  );

  if (
    texto.includes("status_in_progress") ||
    texto.includes("status_first_half") ||
    texto.includes("status_second_half") ||
    texto.includes("status_halftime") ||
    texto.includes("in progress") ||
    texto.includes("en vivo") ||
    texto.includes("live") ||
    texto.includes("1t") ||
    texto.includes("2t") ||
    texto.includes("primer tiempo") ||
    texto.includes("segundo tiempo") ||
    texto.includes("entretiempo") ||
    texto.includes("halftime") ||
    texto.includes("descanso")
  ) {
    return true;
  }

  if (/\b\d{1,3}(?:\+\d{1,2})?'\b/.test(texto)) {
    return true;
  }

  const gameTime365 = Number(match365.game_time_365 || partido.game_time_365 || 0);

  if (Number.isFinite(gameTime365) && gameTime365 > 0 && gameTime365 < 130) {
    return true;
  }

  return false;
}

function limpiarPartidoLive(partido) {
  return {
    id: partido.id,
    id_365: partido.id_365 || null,

    partido: partido.partido,
    local: partido.local,
    visitante: partido.visitante,
    local_id: partido.local_id,
    visitante_id: partido.visitante_id,

    liga: partido.liga,
    liga_slug: partido.liga_slug,

    fecha: partido.fecha,
    hora_inicio: partido.hora_inicio,
    hora: partido.hora,
    mostrar_tiempo: partido.mostrar_tiempo,

    estado: partido.estado,
    estado_corto: partido.estado_corto,
    estado_nombre: partido.estado_nombre,
    completado: partido.completado,
    minuto: partido.minuto,
    periodo: partido.periodo,

    marcador_local: partido.marcador_local,
    marcador_visitante: partido.marcador_visitante,
    marcador_local_display: partido.marcador_local_display,
    marcador_visitante_display: partido.marcador_visitante_display,
    resultado: partido.resultado,
    mostrar_marcador: partido.mostrar_marcador,

    goleadores: partido.goleadores || [],
    tarjetas_rojas: partido.tarjetas_rojas || [],
    local_rojas: partido.local_rojas || 0,
    visitante_rojas: partido.visitante_rojas || 0,

    fuente_live: partido.fuente_live || null,
    match_365: partido.match_365 || null,
  };
}

async function getLiveData() {
  const now = Date.now();

  if (CACHE_LIVE && now - CACHE_LIVE_TIME < CACHE_LIVE_MS) {
    return {
      ...CACHE_LIVE,
      cache_worker: true,
      cache_edad_segundos: Math.round((now - CACHE_LIVE_TIME) / 1000),
    };
  }

  const agendaResult = await getAgendaData();
  const agenda = agendaResult.data;
  const partidos = Array.isArray(agenda.partidos) ? agenda.partidos : [];

  const live = partidos
    .filter(esPartidoLive)
    .map(limpiarPartidoLive);

  const data = {
    fuente: "ESPN Argentina + 365Scores",
    metodo: "/live desde agenda cacheada",
    fecha_scrapeo: new Date().toISOString(),
    total: live.length,
    partidos: live,
  };

  CACHE_LIVE = data;
  CACHE_LIVE_TIME = now;

  return {
    ...data,
    cache_worker: false,
    cache_edad_segundos: 0,
  };
}

/* ============================================================
   GENERAR JSON PARA GITHUB ACTIONS
============================================================ */

function crearLiveJsonDesdeAgenda(agenda) {
  const partidos = Array.isArray(agenda.partidos) ? agenda.partidos : [];

  const live = partidos
    .filter(esPartidoLive)
    .map(limpiarPartidoLive);

  return {
    fuente: "ESPN Argentina + 365Scores",
    metodo: "live generado desde agenda diaria en GitHub Actions",
    fecha_scrapeo: new Date().toISOString(),
    total: live.length,
    partidos: live,
  };
}

async function main() {
  await fs.mkdir("data", { recursive: true });

  console.log("Generando agenda completa...");

  const agenda = await buildAgenda();

  console.log(`Partidos generados: ${agenda.total}`);

  await fs.writeFile(
    "data/agenda.json",
    JSON.stringify(agenda, null, 2),
    "utf8"
  );

  const live = crearLiveJsonDesdeAgenda(agenda);

  await fs.writeFile(
    "data/live.json",
    JSON.stringify(live, null, 2),
    "utf8"
  );

  console.log("Archivos generados:");
  console.log("- data/agenda.json");
  console.log("- data/live.json");
}

main().catch((error) => {
  console.error("Error generando agenda:", error);
  process.exit(1);
});
